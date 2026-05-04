import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { prisma } from '../../db/prisma.js'
import { canManageProjectPlan } from '../../lib/permissions.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const risksRouter = Router()

const riskSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['OPEN', 'WATCHING', 'MITIGATED']),
  ownerId: z.string().uuid(),
  mitigation: z.string().default(''),
})

risksRouter.post('/:projectId/risks', validateBody(riskSchema), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const user = req.user
    const project = await prisma.project.findUnique({ where: { id: String(req.params.projectId) }, include: { members: true } })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canManageProjectPlan(project, user)) throw new ApiError(403, 'Forbidden')

    const data = {
      projectId: String(req.params.projectId),
      title: req.body.title,
      level: req.body.level,
      status: req.body.status,
      ownerId: req.body.ownerId,
      mitigation: req.body.mitigation,
      lastUpdated: new Date(),
    }

    if (req.body.id) {
      await prisma.projectRisk.update({ where: { id: req.body.id }, data })
    } else {
      await prisma.projectRisk.create({ data })
    }

    res.json(await assembleSnapshot(user))
  } catch (err) {
    next(err)
  }
})
