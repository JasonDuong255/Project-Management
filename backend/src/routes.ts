import type { Express } from 'express'
import { snapshotRouter } from './modules/snapshot/snapshot.routes.js'
import { projectsRouter } from './modules/projects/projects.routes.js'
import { documentsRouter } from './modules/documents/documents.routes.js'
import { planItemsRouter } from './modules/plan-items/plan-items.routes.js'
import { worklogsRouter } from './modules/worklogs/worklogs.routes.js'
import { delayRaisesRouter } from './modules/delay-raises/delay-raises.routes.js'
import { allocationsRouter } from './modules/allocations/allocations.routes.js'
import { risksRouter } from './modules/risks/risks.routes.js'
import { catalogsRouter } from './modules/catalogs/catalogs.routes.js'
import { adminRouter } from './modules/admin/admin.routes.js'
import { requireAuth } from './middlewares/auth.js'

export function mountRoutes(app: Express) {
  app.use('/api/snapshot', requireAuth, snapshotRouter)
  app.use('/api/projects', requireAuth, projectsRouter)
  app.use('/api/projects', requireAuth, documentsRouter)
  app.use('/api/projects', requireAuth, planItemsRouter)
  app.use('/api/projects', requireAuth, worklogsRouter)
  app.use('/api/projects', requireAuth, delayRaisesRouter)
  app.use('/api/projects', requireAuth, allocationsRouter)
  app.use('/api/projects', requireAuth, risksRouter)
  app.use('/api/catalogs', requireAuth, catalogsRouter)
  app.use('/api/admin', requireAuth, adminRouter)
}
