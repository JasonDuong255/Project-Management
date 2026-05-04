import { Router } from 'express'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { deletePlanItem, savePlanItem } from './plan-items.service.js'
import { savePlanItemSchema } from './plan-items.schema.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const planItemsRouter = Router()

planItemsRouter.post(
  '/:projectId/plan-items',
  validateBody(savePlanItemSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      await savePlanItem(String(req.params.projectId), req.body, req.user)
      res.json(await assembleSnapshot(req.user))
    } catch (err) {
      next(err)
    }
  },
)

planItemsRouter.patch(
  '/:projectId/plan-items/:planItemId',
  validateBody(savePlanItemSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const body = { ...req.body, id: String(req.params.planItemId) }
      await savePlanItem(String(req.params.projectId), body, req.user)
      res.json(await assembleSnapshot(req.user))
    } catch (err) {
      next(err)
    }
  },
)

planItemsRouter.delete('/:projectId/plan-items/:planItemId', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await deletePlanItem(String(req.params.projectId), String(req.params.planItemId), req.user)
    res.json(await assembleSnapshot(req.user))
  } catch (err) {
    next(err)
  }
})
