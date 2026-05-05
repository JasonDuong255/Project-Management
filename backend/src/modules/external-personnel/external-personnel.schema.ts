import { z } from 'zod'

export const externalPersonnelKindSchema = z.enum(['CUSTOMER', 'PARTNER'])

export const createExternalPersonnelSchema = z.object({
  kind: externalPersonnelKindSchema,
  fullName: z.string().min(1),
  employeeCode: z.string().default(''),
  title: z.string().default(''),
  unit: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
})
export type CreateExternalPersonnelInput = z.infer<typeof createExternalPersonnelSchema>

export const updateExternalPersonnelSchema = createExternalPersonnelSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
export type UpdateExternalPersonnelInput = z.infer<typeof updateExternalPersonnelSchema>

export const linkProjectExternalSchema = z.object({
  externalPersonnelId: z.string().min(1).optional(),
  // when externalPersonnelId is missing, we create the catalog row inline.
  newPerson: createExternalPersonnelSchema.optional(),
  roleInProject: z.string().default(''),
  responsibility: z.string().default(''),
  totalPlannedHours: z.number().int().nonnegative().default(0),
})
export type LinkProjectExternalInput = z.infer<typeof linkProjectExternalSchema>
