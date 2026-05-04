import { prisma } from '../../db/prisma.js'
import { ApiError } from '../../middlewares/error.js'
import { canEditProjectInfo } from '../../lib/permissions.js'
import { writeActivityLog } from '../../lib/activity-log.js'
import type { AuthUser } from '../../types/domain.js'
import type { CreateDocumentInput, UpdateDocumentInput } from './documents.schema.js'

export async function addDocument(
  projectId: string,
  input: CreateDocumentInput,
  user: AuthUser,
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { members: true } })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canEditProjectInfo(project, user)) throw new ApiError(403, 'Forbidden')

    const doc = await tx.projectDocument.create({
      data: {
        projectId,
        title: input.title,
        category: input.category,
        description: input.description,
        url: input.url,
        uploadedBy: input.uploadedBy,
      },
    })
    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: 'DOCUMENT_ADDED',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: project.name,
      changes: [{ field: 'document', oldValue: null, newValue: doc.title }],
    })
    return doc
  })
}

export async function updateDocument(
  projectId: string,
  documentId: string,
  input: UpdateDocumentInput,
  user: AuthUser,
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { members: true } })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canEditProjectInfo(project, user)) throw new ApiError(403, 'Forbidden')

    const doc = await tx.projectDocument.findUnique({ where: { id: documentId } })
    if (!doc || doc.projectId !== projectId) throw new ApiError(404, 'Document not found')

    const updated = await tx.projectDocument.update({
      where: { id: documentId },
      data: {
        title: input.title ?? doc.title,
        category: input.category ?? doc.category,
        documentNumber: input.documentNumber ?? doc.documentNumber,
        description: input.description ?? doc.description,
        url: input.url ?? doc.url,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    })

    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: 'DOCUMENT_ADDED',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: project.name,
      changes: [{ field: 'document', oldValue: doc.title, newValue: updated.title }],
    })
    return updated
  })
}

export async function deleteDocument(projectId: string, documentId: string, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { members: true } })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canEditProjectInfo(project, user)) throw new ApiError(403, 'Forbidden')

    const doc = await tx.projectDocument.findUnique({ where: { id: documentId } })
    if (!doc || doc.projectId !== projectId) throw new ApiError(404, 'Document not found')

    await tx.projectDocument.delete({ where: { id: documentId } })
    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: 'DOCUMENT_DELETED',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: project.name,
      changes: [{ field: 'document', oldValue: doc.title, newValue: null }],
    })
  })
}
