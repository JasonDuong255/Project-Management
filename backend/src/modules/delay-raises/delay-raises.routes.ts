import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { prisma } from '../../db/prisma.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const delayRaisesRouter = Router()

const raiseDelaySchema = z.object({
  taskId: z.string(),
  requesterId: z.string().uuid(),
  reason: z.string().default(''),
  impact: z.string().default(''),
})

delayRaisesRouter.post(
  '/:projectId/delay-raises',
  validateBody(raiseDelaySchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const user = req.user
      if (user.role === 'DELIVERY_MEMBER' && req.body.requesterId !== user.id) {
        throw new ApiError(403, 'Members can only raise delays for themselves')
      }

      await prisma.$transaction(async (tx) => {
        const task = await tx.planItem.findUnique({ where: { id: req.body.taskId } })
        if (!task || task.projectId !== String(req.params.projectId)) {
          throw new ApiError(404, 'Task not found')
        }
        // v3.14 (19/05/2026): delay-raise đã được loại bỏ ở FE. Endpoint giữ
        // để tương thích nhưng KHÔNG đổi status task (NEEDS_REPLAN đã bị loại).
        await tx.delayRaise.create({
          data: {
            projectId: String(req.params.projectId),
            taskId: req.body.taskId,
            requesterId: req.body.requesterId,
            reason: req.body.reason,
            impact: req.body.impact,
            status: 'OPEN',
          },
        })
      })

      res.json(await assembleSnapshot(user))
    } catch (err) {
      next(err)
    }
  },
)
