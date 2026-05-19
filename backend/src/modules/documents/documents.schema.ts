import { z } from 'zod'

const attachmentSchema = z.object({
  fileName: z.string().min(1),
  contentBase64: z.string().optional(),
  mimeType: z.string().optional(),
})

export const createDocumentSchema = z.object({
  title: z.string().min(1),
  category: z.string().default(''),
  documentNumber: z.string().default(''),
  description: z.string().default(''),
  url: z.string().default(''),
  attachment: attachmentSchema.optional(),
  uploadedBy: z.string().uuid(),
})

export const updateDocumentSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  documentNumber: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  attachment: attachmentSchema.optional(),
  updatedBy: z.string().uuid(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
