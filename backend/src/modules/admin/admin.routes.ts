import { Router } from 'express'
import { ApiError } from '../../middlewares/error.js'
import { requireRoles } from '../../middlewares/rbac.js'
import { runSeed } from '../../db/seed.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const adminRouter = Router()

adminRouter.post('/reset-demo-data', requireRoles(['PMO']), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await runSeed({ wipe: true })
    res.json(await assembleSnapshot(req.user))
  } catch (err) {
    next(err)
  }
})
