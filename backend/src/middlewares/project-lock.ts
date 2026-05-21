import type { RequestHandler } from 'express'
import { prisma } from '../db/prisma.js'
import { ApiError } from './error.js'

/**
 * BRD IV.6: khi dự án đã đóng (CLOSED) hoặc đã hoàn thành (COMPLETED),
 * không cho phép mutation. Cả 2 đều là trạng thái cuối.
 *
 * v3.15 (19/05/2026): thêm COMPLETED vào danh sách bị khóa.
 *
 * This middleware is mounted at the path level (e.g. `/api/projects`) where
 * `:projectId` lives INSIDE the downstream router, so `req.params.projectId`
 * is not yet populated. We extract the first URL segment after the mount
 * (`req.url` is everything after the mount path) — that's the project id.
 *
 * Skips: GET requests, requests where the first segment isn't a project id
 * (e.g. POST /api/projects to create a new project), and lock guard
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
    if (project.status === 'CLOSED' || project.status === 'COMPLETED') {
      next(
        new ApiError(
          423,
          project.status === 'COMPLETED'
            ? 'Project is completed; mutations are disabled'
            : 'Project is closed; mutations are disabled',
        ),
      )
      return
    }
    next()
  } catch (err) {
    next(err)
  }
}
