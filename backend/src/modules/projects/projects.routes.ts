import { Router } from 'express'
import { ApiError } from '../../middlewares/error.js'
import { validateBody } from '../../middlewares/validate.js'
import { createProject, updateProject } from './projects.service.js'
import { createProjectSchema, updateProjectSchema } from './projects.schema.js'
import { assembleSnapshot } from '../snapshot/snapshot.service.js'

export const projectsRouter = Router()

projectsRouter.post('/', validateBody(createProjectSchema), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await createProject(req.body, req.user)
    res.json(await assembleSnapshot(req.user))
  } catch (err) {
    next(err)
  }
})

projectsRouter.patch('/:projectId', validateBody(updateProjectSchema), async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'Authentication required')
    await updateProject(String(req.params.projectId), req.body.patch, req.user)
    res.json(await assembleSnapshot(req.user))
  } catch (err) {
    next(err)
  }
})
