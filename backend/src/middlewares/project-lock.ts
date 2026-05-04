import type { RequestHandler } from 'express'
import { prisma } from '../db/prisma.js'
import { ApiError } from './error.js'

/**
 * BRD IV.6: when a project is CLOSED, no edits are allowed.
 *
 * This middleware is mounted at the path level (e.g. `/api/projects`) where
 * `:projectId` lives INSIDE the downstream router, so `req.params.projectId`
 * is not yet populated. We extract the first URL segment after the mount
 * (`req.url` is everything after the mount path) — that's the project id.
 *
 * Skips: GET requests, requests where the first segment isn't a project id
 * (e.g. POST /api/projects to create a new project), and CLOSED guard
 * applies only to mutations.
 */
export const requireProjectNotClosed: RequestHandler = async (req, _res, next) => {
  try {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next()
      return
    }
    // req.url after the mount: '/<projectId>/...'
    const segments = req.url.split('?')[0]!.split('/').filter(Boolean)
    const projectId = segments[0]
    if (!projectId || projectId.length < 3) {
      next()
      return
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    })
    if (!project) {
      next(new ApiError(404, 'Project not found'))
      return
    }
    if (project.status === 'CLOSED') {
      next(new ApiError(423, 'Project is closed; mutations are disabled'))
      return
    }
    next()
  } catch (err) {
    next(err)
  }
}
