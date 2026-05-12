import { Router } from 'express'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'
import {
  inboxFor,
  ksvDecide,
  pauseProject,
  requestClose,
  resumeProject,
  tchcDecide,
} from './close-workflow.service.js'
import {
  ksvDecisionSchema,
  requestCloseSchema,
  tchcDecisionSchema,
} from './close-workflow.schema.js'

export const closeWorkflowRouter = Router()

closeWorkflowRouter.post('/:projectId/pause', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await pauseProject(String(req.params.projectId), req.user)
    res.json(await assembleSnapshot(req.user))
  } catch (err) {
    next(err)
  }
})

closeWorkflowRouter.post('/:projectId/resume', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await resumeProject(String(req.params.projectId), req.user)
    res.json(await assembleSnapshot(req.user))
  } catch (err) {
    next(err)
  }
})

closeWorkflowRouter.post(
  '/:projectId/close-requests',
  validateBody(requestCloseSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      const id = await requestClose(String(req.params.projectId), req.body, req.user)
      const snapshot = await assembleSnapshot(req.user)
      res.json({ closeRequestId: id, ...snapshot })
    } catch (err) {
      next(err)
    }
  },
)

closeWorkflowRouter.patch(
  '/:projectId/close-requests/:requestId/ksv',
  validateBody(ksvDecisionSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      await ksvDecide(
        String(req.params.projectId),
        String(req.params.requestId),
        req.body,
        req.user,
      )
      res.json(await assembleSnapshot(req.user))
    } catch (err) {
      next(err)
    }
  },
)

closeWorkflowRouter.patch(
  '/:projectId/close-requests/:requestId/tchc',
  validateBody(tchcDecisionSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      await tchcDecide(
        String(req.params.projectId),
        String(req.params.requestId),
        req.body,
        req.user,
      )
      res.json(await assembleSnapshot(req.user))
    } catch (err) {
      next(err)
    }
  },
)

// Inbox for the current user (KSV / TCHC / requester views).
export const closeInboxRouter = Router()
closeInboxRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    const items = await inboxFor(req.user)
    res.json({ items })
  } catch (err) {
    next(err)
  }
})
