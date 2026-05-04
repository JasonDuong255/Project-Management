import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { prisma } from '../../db/prisma.js'
import { writeActivityLog } from '../../lib/activity-log.js'
import { recalculateProjectProgress } from '../../lib/recalc.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const worklogsRouter = Router()

const worklogSchema = z.object({
  taskId: z.string(),
  memberId: z.string().uuid(),
  date: z.string(),
  hours: z.number().nonnegative(),
  progressNote: z.string().default(''),
  progress: z.number().int().min(0).max(100),
})

worklogsRouter.post(
  '/:projectId/worklogs',
  validateBody(worklogSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const user = req.user

      // Members can only log their own time. PMO/PM can log on behalf (matches FE flexibility).
      if (user.role === 'DELIVERY_MEMBER' && req.body.memberId !== user.id) {
        throw new ApiError(403, 'Members can only log their own time')
      }

      await prisma.$transaction(async (tx) => {
        const task = await tx.planItem.findUnique({ where: { id: req.body.taskId } })
        if (!task || task.projectId !== String(req.params.projectId)) {
          throw new ApiError(404, 'Task not found')
        }

        await tx.worklog.create({
          data: {
            projectId: String(req.params.projectId),
            taskId: req.body.taskId,
            memberId: req.body.memberId,
            date: new Date(req.body.date),
            hours: req.body.hours,
            progressNote: req.body.progressNote,
          },
        })

        // Auto-status: NOT_STARTED → IN_PROGRESS; progress ≥ 100 → DONE
        const nextProgress = req.body.progress
        let nextStatus = task.status
        if (task.status === 'NOT_STARTED' && nextProgress > 0) nextStatus = 'IN_PROGRESS'
        if (nextProgress >= 100) nextStatus = 'DONE'

        await tx.planItem.update({
          where: { id: task.id },
          data: {
            actualHours: { increment: req.body.hours },
            progress: nextProgress,
            status: nextStatus,
          },
        })

        await writeActivityLog(tx, {
          projectId: String(req.params.projectId),
          userId: user.id,
          action: 'WORKLOG_ADDED',
          entityType: 'PLAN_ITEM',
          entityId: task.id,
          entityName: task.name,
          changes: [{ field: 'hours', oldValue: null, newValue: req.body.hours }],
        })

        await recalculateProjectProgress(tx, String(req.params.projectId))
      })

      res.json(await assembleSnapshot(user))
    } catch (err) {
      next(err)
    }
  },
)
