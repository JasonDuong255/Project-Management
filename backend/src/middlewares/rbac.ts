import type { RequestHandler } from 'express'
import type { UserRole } from '../types/domain.js'
import { ApiError } from './error.js'

export function requireRoles(roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required'))
      return
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'Forbidden: role not permitted'))
      return
    }
    next()
  }
}
