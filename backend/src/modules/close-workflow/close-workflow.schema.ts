import { z } from 'zod'

export const requestCloseSchema = z.object({
  note: z.string().default(''),
})
export type RequestCloseInput = z.infer<typeof requestCloseSchema>

export const ksvDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().default(''),
})
export type KsvDecisionInput = z.infer<typeof ksvDecisionSchema>

export const tchcDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().default(''),
})
export type TchcDecisionInput = z.infer<typeof tchcDecisionSchema>
