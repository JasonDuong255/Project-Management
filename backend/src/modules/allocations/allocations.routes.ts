import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { prisma } from '../../db/prisma.js'
import { canManageProjectPlan } from '../../lib/permissions.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const allocationsRouter = Router()

const allocationSchema = z.object({
  memberId: z.string().uuid(),
  month: z.string(),
  hours: z.number().nonnegative(),
})

allocationsRouter.post(
  '/:projectId/allocations',
  validateBody(allocationSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const user = req.user
      const project = await prisma.project.findUnique({ where: { id: String(req.params.projectId) } })
      if (!project) throw new ApiError(404, 'Project not found')
      if (!canManageProjectPlan(project, user)) throw new ApiError(403, 'Forbidden')

      await prisma.monthlyAllocation.upsert({
        where: {
          projectId_memberId_month: {
            projectId: String(req.params.projectId),
            memberId: req.body.memberId,
            month: req.body.month,
          },
        },
        create: {
          projectId: String(req.params.projectId),
          memberId: req.body.memberId,
          month: req.body.month,
          hours: req.body.hours,
        },
        update: { hours: req.body.hours },
      })
      res.json(await assembleSnapshot(user))
    } catch (err) {
      next(err)
    }
  },
)
