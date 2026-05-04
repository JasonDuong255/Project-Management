import { Router } from 'express'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { addDocument, deleteDocument, updateDocument } from './documents.service.js'
import { createDocumentSchema, updateDocumentSchema } from './documents.schema.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const documentsRouter = Router()

documentsRouter.post(
  '/:projectId/documents',
  validateBody(createDocumentSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      await addDocument(String(req.params.projectId), req.body, req.user)
      res.json(await assembleSnapshot(req.user))
    } catch (err) {
      next(err)
    }
  },
)

documentsRouter.patch(
  '/:projectId/documents/:documentId',
  validateBody(updateDocumentSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new ApiError(401, 'Authentication required')
      await updateDocument(String(req.params.projectId), String(req.params.documentId), req.body, req.user)
      res.json(await assembleSnapshot(req.user))
    } catch (err) {
      next(err)
    }
  },
)

documentsRouter.delete('/:projectId/documents/:documentId', async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await deleteDocument(String(req.params.projectId), String(req.params.documentId), req.user)
    res.json(await assembleSnapshot(req.user))
  } catch (err) {
    next(err)
  }
})
