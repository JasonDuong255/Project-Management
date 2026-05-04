// BRD VIII.3 — login/logout audit log. Two endpoints:
//   POST /api/auth-log/event  — FE posts this after a login attempt.
//   GET  /api/auth-log        — admins read.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/prisma.js'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { requireRoles } from '../../middlewares/rbac.js'

export const authLogRouter = Router()

const logEventSchema = z.object({
  email: z.string().default(''),
  status: z.enum(['SUCCESS', 'FAILURE']),
  reason: z.string().default(''),
})

// FE calls this AFTER its own auth attempt. We don't gate it (so failed-login
// events can be recorded) — but we sanity-check the user when status=SUCCESS
// by reading req.user from the requireAuth middleware applied at routes.ts level.
// Failed login posts skip auth: we route this without requireAuth (see routes.ts).
authLogRouter.post('/event', validateBody(logEventSchema), async (req, res, next) => {
  try {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      ''
    const userAgent = req.header('user-agent') ?? ''
    await prisma.authLog.create({
      data: {
        userId: req.user?.id ?? null,
        email: req.body.email,
        ip,
        userAgent,
        status: req.body.status,
        reason: req.body.reason,
      },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// PMO-only listing.
authLogRouter.get('/', requireRoles(['PMO']), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const limit = Math.min(Number(req.query.limit ?? 100), 500)
    const items = await prisma.authLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    res.json({ items })
  } catch (err) {
    next(err)
  }
})
