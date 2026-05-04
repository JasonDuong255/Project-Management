import { Router } from 'express'
import { ApiError } from '../../middlewares/error.js'
import { listForUser, markAllRead, markRead } from './notifications.service.js'

export const notificationsRouter = Router()

notificationsRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const unread = req.query.unread === '1' || req.query.unread === 'true'
    const items = await listForUser(req.user.id, unread)
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

notificationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await markRead(req.user.id, String(req.params.id))
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await markAllRead(req.user.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
