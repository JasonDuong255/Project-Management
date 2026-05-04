import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { requireRoles } from '../../middlewares/rbac.js'
import { prisma } from '../../db/prisma.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'
import type { CatalogKey } from '../../types/domain.js'

export const catalogsRouter = Router()

const CATALOG_KEYS: CatalogKey[] = [
  'projectStatuses',
  'healthStatuses',
  'taskStatuses',
  'riskLevels',
  'documentCategories',
  'departments',
  'projectMemberRoles',
]

const catalogValuesSchema = z.array(
  z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
  }),
)

catalogsRouter.patch(
  '/:groupKey',
  requireRoles(['PMO']),
  validateBody(catalogValuesSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const key = String(req.params.groupKey) as CatalogKey
      if (!CATALOG_KEYS.includes(key)) {
        throw new ApiError(400, `Unknown catalog group: ${key}`)
      }
      await prisma.catalogGroup.upsert({
        where: { key },
        create: { key, values: req.body },
        update: { values: req.body },
      })
      res.json(await assembleSnapshot(req.user))
    } catch (err) {
      next(err)
    }
  },
)
