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

export const tcnlDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().default(''),
})
export type TcnlDecisionInput = z.infer<typeof tcnlDecisionSchema>
