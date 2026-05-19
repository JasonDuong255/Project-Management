import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ApiError } from '../middlewares/error.js'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

export interface FileAttachmentInput {
  fileName: string
  contentBase64?: string
  mimeType?: string
}

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || 'attachment'
  return baseName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
}

export async function storeProjectFile(projectId: string, attachment: FileAttachmentInput) {
  if (!attachment.contentBase64) {
    return attachment.fileName
  }

  const buffer = Buffer.from(attachment.contentBase64, 'base64')
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(413, 'File attachment exceeds the 25MB limit')
  }

  const safeFileName = sanitizeFileName(attachment.fileName)
  const storedFileName = `${randomUUID()}-${safeFileName}`
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'project-documents', projectId)
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, storedFileName), buffer)

  return `/uploads/project-documents/${projectId}/${encodeURIComponent(storedFileName)}`
}
