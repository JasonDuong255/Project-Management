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
import {
  closeInboxRouter,
  closeWorkflowRouter,
} from './modules/close-workflow/close-workflow.routes.js'
import { notificationsRouter } from './modules/notifications/notifications.routes.js'
import { authLogRouter } from './modules/auth-log/auth-log.routes.js'
import {
  externalPersonnelRouter,
  projectExternalPersonnelRouter,
} from './modules/external-personnel/external-personnel.routes.js'
import { requireAuth } from './middlewares/auth.js'
import { requireProjectNotClosed } from './middlewares/project-lock.js'

export function mountRoutes(app: Express) {
  app.use('/api/snapshot', requireAuth, snapshotRouter)
  // Close-workflow first — its routes (pause/resume/close-requests) must
  // bypass the lock-when-closed middleware so they can run on PAUSED/CLOSED projects.
  app.use('/api/projects', requireAuth, closeWorkflowRouter)
  // Lock-when-closed applies to all other mutation modules. POST /projects has
  // no :projectId so the middleware no-ops cleanly; PATCH /projects/:id is gated.
  app.use('/api/projects', requireAuth, requireProjectNotClosed, projectsRouter)
  app.use('/api/projects', requireAuth, requireProjectNotClosed, documentsRouter)
  app.use('/api/projects', requireAuth, requireProjectNotClosed, planItemsRouter)
  app.use('/api/projects', requireAuth, requireProjectNotClosed, worklogsRouter)
  app.use('/api/projects', requireAuth, requireProjectNotClosed, delayRaisesRouter)
  app.use('/api/projects', requireAuth, requireProjectNotClosed, allocationsRouter)
  app.use('/api/projects', requireAuth, requireProjectNotClosed, risksRouter)
  app.use('/api/projects', requireAuth, requireProjectNotClosed, projectExternalPersonnelRouter)
  app.use('/api/external-personnel', requireAuth, externalPersonnelRouter)
  app.use('/api/close-inbox', requireAuth, closeInboxRouter)
  app.use('/api/notifications', requireAuth, notificationsRouter)
  // Auth-log: POST /event is unauth-friendly (records failed logins); GET is PMO-only.
  app.use('/api/auth-log', authLogRouter)
  app.use('/api/catalogs', requireAuth, catalogsRouter)
  app.use('/api/admin', requireAuth, adminRouter)
}
