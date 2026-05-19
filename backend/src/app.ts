import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'node:path'
import { env } from './config/env.js'
import { errorHandler } from './middlewares/error.js'
import { mountRoutes } from './routes.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '40mb' }))
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'qlda-backend', version: '0.1.0' })
  })

  mountRoutes(app)

  app.use(errorHandler)
  return app
}
