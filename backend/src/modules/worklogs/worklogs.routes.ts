import { Router } from 'express'
import { z } from 'zod'
import type { PlanTaskStatus } from '@prisma/client'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { prisma } from '../../db/prisma.js'
import { writeActivityLog } from '../../lib/activity-log.js'
import { recalculateProjectProgress } from '../../lib/recalc.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'
import { canDecideWorklog } from '../../lib/permissions.js'

export const worklogsRouter = Router()

const worklogSchema = z.object({
  taskId: z.string(),
  memberId: z.string().uuid(),
  date: z.string(),
  hours: z.number().nonnegative(),
  progressNote: z.string().default(''),
  progress: z.number().int().min(0).max(100),
})

const decideSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional().default(''),
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
        if (task.status === 'DONE' || task.progress >= 100) {
          throw new ApiError(409, 'Completed tasks cannot receive worklogs')
        }

        // v3.12 BA #7 (19/05/2026): worklog mới mặc định PENDING. Không cộng
        // vào task.actualHours cho đến khi PM/điều phối Duyệt.
        await tx.worklog.create({
          data: {
            projectId: String(req.params.projectId),
            taskId: req.body.taskId,
            memberId: req.body.memberId,
            date: new Date(req.body.date),
            hours: req.body.hours,
            progressNote: req.body.progressNote,
            // status mặc định = PENDING (qua @default trong schema).
          },
        })

        // Member's self-reported progress vẫn cập nhật ngay (không phụ thuộc duyệt).
        const nextProgress = req.body.progress
        let nextStatus: PlanTaskStatus = task.status
        if (task.status === 'NOT_STARTED' && nextProgress > 0) nextStatus = 'IN_PROGRESS'
        if (nextProgress >= 100) nextStatus = 'DONE'

        await tx.planItem.update({
          where: { id: task.id },
          data: {
            // KHÔNG increment actualHours - chờ duyệt mới cộng.
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
          changes: [
            { field: 'hours', oldValue: null, newValue: req.body.hours },
            { field: 'status', oldValue: null, newValue: 'PENDING' },
          ],
        })

        await recalculateProjectProgress(tx, String(req.params.projectId))
      })

      res.json(await assembleSnapshot(user))
    } catch (err) {
      next(err)
    }
  },
)

/**
 * v3.12 BA #7 (19/05/2026): PM dự án + điều phối + PMO duyệt / từ chối worklog.
 * - APPROVED → cộng vào task.actualHours, ghi activity WORKLOG_APPROVED.
 * - REJECTED → ghi rejectReason, ghi activity WORKLOG_REJECTED. Không tự duyệt
 *   worklog của chính mình.
 */
worklogsRouter.patch(
  '/:projectId/worklogs/:worklogId/decide',
  validateBody(decideSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const user = req.user
      const projectId = String(req.params.projectId)
      const worklogId = String(req.params.worklogId)

      await prisma.$transaction(async (tx) => {
        const worklog = await tx.worklog.findUnique({
          where: { id: worklogId },
          include: { task: true, project: true },
        })
        if (!worklog || worklog.projectId !== projectId) {
          throw new ApiError(404, 'Worklog not found')
        }
        if (!(await canDecideWorklog(tx, user, worklog))) {
          throw new ApiError(403, 'You do not have permission to decide this worklog')
        }
        if (worklog.memberId === user.id) {
          throw new ApiError(409, 'Cannot decide your own worklog')
        }
        if (worklog.status !== 'PENDING') {
          throw new ApiError(409, `Worklog already ${worklog.status.toLowerCase()}`)
        }

        const decision = req.body.decision as 'APPROVED' | 'REJECTED'
        const reason = String(req.body.reason ?? '')

        await tx.worklog.update({
          where: { id: worklogId },
          data: {
            status: decision,
            decidedById: user.id,
            decidedAt: new Date(),
            rejectReason: decision === 'REJECTED' ? reason : '',
          },
        })

        if (decision === 'APPROVED') {
          await tx.planItem.update({
            where: { id: worklog.taskId },
            data: { actualHours: { increment: worklog.hours } },
          })
          await recalculateProjectProgress(tx, projectId)
        }

        await writeActivityLog(tx, {
          projectId,
          userId: user.id,
          action: decision === 'APPROVED' ? 'WORKLOG_APPROVED' : 'WORKLOG_REJECTED',
          entityType: 'PLAN_ITEM',
          entityId: worklog.taskId,
          entityName: worklog.task.name,
          changes: [
            { field: 'status', oldValue: 'PENDING', newValue: decision },
            ...(decision === 'REJECTED' && reason
              ? [{ field: 'rejectReason', oldValue: null, newValue: reason }]
              : []),
          ],
        })
      })

      res.json(await assembleSnapshot(user))
    } catch (err) {
      next(err)
    }
  },
)
