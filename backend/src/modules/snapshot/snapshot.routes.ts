import { Router } from 'express'
import { assembleSnapshot } from './snapshot.service.js'
import { ApiError } from '../../middlewares/error.js'

export const snapshotRouter = Router()

snapshotRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const snapshot = await assembleSnapshot(req.user)
    res.json(snapshot)
  } catch (err) {
    next(err)
  }
})
