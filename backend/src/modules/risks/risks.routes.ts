import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { prisma } from '../../db/prisma.js'
import { canManageProjectPlan } from '../../lib/permissions.js'
import { writeActivityLog, diffFields } from '../../lib/activity-log.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const risksRouter = Router()

// BRD IV.5.1.4 — full risk register fields.
const riskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  cause: z.string().default(''),
  description: z.string().default(''),
  level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['OPEN', 'WATCHING', 'MITIGATED']),
  ownerId: z.string().uuid(),
  mitigation: z.string().default(''),
  dueDate: z.string().optional().nullable(),
  resolutionResult: z.string().default(''),
  resolutionProgress: z.number().int().min(0).max(100).default(0),
  nextPlan: z.string().default(''),
  notes: z.string().default(''),
})

risksRouter.post('/:projectId/risks', validateBody(riskSchema), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const user = req.user
    const projectId = String(req.params.projectId)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canManageProjectPlan(project, user)) throw new ApiError(403, 'Forbidden')

    const data = {
      projectId,
      title: req.body.title,
      cause: req.body.cause,
      description: req.body.description,
      level: req.body.level,
      status: req.body.status,
      ownerId: req.body.ownerId,
      mitigation: req.body.mitigation,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      resolutionResult: req.body.resolutionResult,
      resolutionProgress: req.body.resolutionProgress,
      nextPlan: req.body.nextPlan,
      notes: req.body.notes,
      lastUpdated: new Date(),
    }

    await prisma.$transaction(async (tx) => {
      if (req.body.id) {
        const before = await tx.projectRisk.findUnique({ where: { id: req.body.id } })
        if (!before || before.projectId !== projectId) {
          throw new ApiError(404, 'Risk not found')
        }
        const updated = await tx.projectRisk.update({ where: { id: req.body.id }, data })
        const changes = diffFields(
          {
            title: before.title,
            level: before.level,
            status: before.status,
            ownerId: before.ownerId,
            resolutionProgress: before.resolutionProgress,
          },
          {
            title: updated.title,
            level: updated.level,
            status: updated.status,
            ownerId: updated.ownerId,
            resolutionProgress: updated.resolutionProgress,
          },
          ['title', 'level', 'status', 'ownerId', 'resolutionProgress'],
        )
        if (changes.length > 0) {
          await writeActivityLog(tx, {
            projectId,
            userId: user.id,
            action: 'RISK_UPDATED',
            entityType: 'PROJECT',
            entityId: projectId,
            entityName: project.name,
            changes,
          })
        }
      } else {
        const created = await tx.projectRisk.create({ data })
        await writeActivityLog(tx, {
          projectId,
          userId: user.id,
          action: 'RISK_CREATED',
          entityType: 'PROJECT',
          entityId: projectId,
          entityName: project.name,
          changes: [{ field: 'title', oldValue: null, newValue: created.title }],
        })
      }
    })

    res.json(await assembleSnapshot(user))
  } catch (err) {
    next(err)
  }
})

risksRouter.delete('/:projectId/risks/:riskId', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const user = req.user
    const projectId = String(req.params.projectId)
    const riskId = String(req.params.riskId)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canManageProjectPlan(project, user)) throw new ApiError(403, 'Forbidden')

    await prisma.$transaction(async (tx) => {
      const before = await tx.projectRisk.findUnique({ where: { id: riskId } })
      if (!before || before.projectId !== projectId) {
        throw new ApiError(404, 'Risk not found')
      }
      await tx.projectRisk.delete({ where: { id: riskId } })
      await writeActivityLog(tx, {
        projectId,
        userId: user.id,
        action: 'RISK_DELETED',
        entityType: 'PROJECT',
        entityId: projectId,
        entityName: project.name,
        changes: [{ field: 'title', oldValue: before.title, newValue: null }],
      })
    })

    res.json(await assembleSnapshot(user))
  } catch (err) {
    next(err)
  }
})
