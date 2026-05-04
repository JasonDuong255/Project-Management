import type { ErrorRequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', issues: err.flatten() })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Unique constraint violated', meta: err.meta })
      return
    }
  }

  console.error('[unhandled error]', err)
  res.status(500).json({ error: 'Internal server error' })
}
