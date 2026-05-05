import { Router } from 'express'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { prisma } from '../../db/prisma.js'
import { canEditProjectInfo } from '../../lib/permissions.js'
import { writeActivityLog } from '../../lib/activity-log.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'
import {
  createExternalPersonnelSchema,
  externalPersonnelKindSchema,
  linkProjectExternalSchema,
  updateExternalPersonnelSchema,
} from './external-personnel.schema.js'

// ─── /api/external-personnel — global catalog (Admin / QLDA) ──────────────

export const externalPersonnelRouter = Router()

externalPersonnelRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const kindFilter = req.query.kind
      ? externalPersonnelKindSchema.parse(String(req.query.kind))
      : undefined
    const items = await prisma.externalPersonnel.findMany({
      where: { ...(kindFilter ? { kind: kindFilter } : {}), isActive: true },
      orderBy: { fullName: 'asc' },
    })
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

externalPersonnelRouter.post(
  '/',
  validateBody(createExternalPersonnelSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const created = await prisma.externalPersonnel.create({
        data: { ...req.body, createdById: req.user.id },
      })
      res.json({ item: created })
    } catch (err) {
      next(err)
    }
  },
)

externalPersonnelRouter.patch(
  '/:id',
  validateBody(updateExternalPersonnelSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const updated = await prisma.externalPersonnel.update({
        where: { id: String(req.params.id) },
        data: { ...req.body, updatedById: req.user.id },
      })
      res.json({ item: updated })
    } catch (err) {
      next(err)
    }
  },
)

externalPersonnelRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    if (req.user.role !== 'PMO' && req.user.role !== 'ADMIN_HC') {
      throw new ApiError(403, 'Only PMO/ADMIN_HC can delete catalog entries')
    }
    // Soft-delete to preserve referential history of past project assignments.
    await prisma.externalPersonnel.update({
      where: { id: String(req.params.id) },
      data: { isActive: false, updatedById: req.user.id },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── /api/projects/:id/external-personnel — per-project assignments ──────

export const projectExternalPersonnelRouter = Router()

projectExternalPersonnelRouter.post(
  '/:projectId/external-personnel',
  validateBody(linkProjectExternalSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const user = req.user
      const projectId = String(req.params.projectId)

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { members: true },
      })
      if (!project) throw new ApiError(404, 'Project not found')
      if (!canEditProjectInfo(project, user)) throw new ApiError(403, 'Forbidden')

      await prisma.$transaction(async (tx) => {
        let externalPersonnelId = req.body.externalPersonnelId
        let displayName = ''

        if (!externalPersonnelId) {
          if (!req.body.newPerson) {
            throw new ApiError(400, 'Either externalPersonnelId or newPerson required')
          }
          const created = await tx.externalPersonnel.create({
            data: { ...req.body.newPerson, createdById: user.id },
          })
          externalPersonnelId = created.id
          displayName = created.fullName
        } else {
          const existing = await tx.externalPersonnel.findUnique({
            where: { id: externalPersonnelId },
          })
          if (!existing) throw new ApiError(404, 'External personnel not in catalog')
          displayName = existing.fullName
        }

        await tx.projectExternalPersonnel.upsert({
          where: {
            projectId_externalPersonnelId: { projectId, externalPersonnelId },
          },
          create: {
            projectId,
            externalPersonnelId,
            roleInProject: req.body.roleInProject,
            responsibility: req.body.responsibility,
            totalPlannedHours: req.body.totalPlannedHours,
          },
          update: {
            roleInProject: req.body.roleInProject,
            responsibility: req.body.responsibility,
            totalPlannedHours: req.body.totalPlannedHours,
          },
        })

        await writeActivityLog(tx, {
          projectId,
          userId: user.id,
          action: 'PERSONNEL_ADDED',
          entityType: 'PROJECT',
          entityId: projectId,
          entityName: project.name,
          changes: [{ field: 'externalPersonnel', oldValue: null, newValue: displayName }],
        })
      })

      res.json(await assembleSnapshot(user))
    } catch (err) {
      next(err)
    }
  },
)

projectExternalPersonnelRouter.delete(
  '/:projectId/external-personnel/:externalPersonnelId',
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const user = req.user
      const projectId = String(req.params.projectId)
      const externalPersonnelId = String(req.params.externalPersonnelId)

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { members: true },
      })
      if (!project) throw new ApiError(404, 'Project not found')
      if (!canEditProjectInfo(project, user)) throw new ApiError(403, 'Forbidden')

      await prisma.$transaction(async (tx) => {
        const existing = await tx.projectExternalPersonnel.findUnique({
          where: { projectId_externalPersonnelId: { projectId, externalPersonnelId } },
          include: { externalPersonnel: { select: { fullName: true } } },
        })
        if (!existing) throw new ApiError(404, 'Assignment not found')

        await tx.projectExternalPersonnel.delete({
          where: { projectId_externalPersonnelId: { projectId, externalPersonnelId } },
        })
        await writeActivityLog(tx, {
          projectId,
          userId: user.id,
          action: 'PERSONNEL_REMOVED',
          entityType: 'PROJECT',
          entityId: projectId,
          entityName: project.name,
          changes: [
            {
              field: 'externalPersonnel',
              oldValue: existing.externalPersonnel.fullName,
              newValue: null,
            },
          ],
        })
      })

      res.json(await assembleSnapshot(user))
    } catch (err) {
      next(err)
    }
  },
)
