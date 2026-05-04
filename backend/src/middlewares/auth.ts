import type { RequestHandler } from 'express'
import { prisma } from '../db/prisma.js'
import { verifySupabaseAccessToken } from '../lib/supabase.js'
import { ApiError } from './error.js'
import type { AuthUser } from '../types/domain.js'
import { normalizeUserRole } from '../lib/normalize.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization') ?? req.header('Authorization')
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new ApiError(401, 'Missing bearer token')
    }
    const token = header.slice(7).trim()

    const payload = await verifySupabaseAccessToken(token)
    const profile = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!profile) {
      throw new ApiError(403, 'No profile registered for this auth user')
    }
    if (!profile.isActive) {
      throw new ApiError(403, 'Account is inactive')
    }

    req.user = {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      name: profile.name,
      role: normalizeUserRole(profile.role),
      functionalTitle: profile.functionalTitle,
      isActive: profile.isActive,
      employeeCode: profile.employeeCode,
      title: profile.title,
      unit: profile.unit,
      phone: profile.phone,
      monthlyCapacity: profile.monthlyCapacity,
      avatarColor: profile.avatarColor,
    }
    next()
  } catch (err) {
    if (err instanceof ApiError) {
      next(err)
      return
    }
    next(new ApiError(401, 'Invalid or expired token'))
  }
}
