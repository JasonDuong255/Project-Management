import { z } from 'zod'

const teamMemberInput = z.object({
  userId: z.string().uuid(),
  role: z.string(),
  totalPlannedHours: z.number().nonnegative().default(0),
})

export const createProjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().default(''),
  sponsor: z.string().default(''),
  objective: z.string().default(''),
  ttkDecisionNumber: z.string().default(''),
  createdById: z.string().uuid(),
  adminId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  approvalRequestFileName: z.string().default(''),
  teamMembers: z.array(teamMemberInput).default([]),
  department: z.string().default(''),
})

export const updateProjectSchema = z.object({
  patch: z
    .object({
      summary: z.string().optional(),
      sponsor: z.string().optional(),
      department: z.string().optional(),
      objective: z.string().optional(),
      ttkDecisionNumber: z.string().optional(),
      status: z.enum(['INITIATION', 'PLANNING', 'IN_PROGRESS', 'AT_RISK', 'DONE']).optional(),
      health: z.enum(['GREEN', 'AMBER', 'RED']).optional(),
      progress: z.number().int().min(0).max(100).optional(),
      currentPhase: z.string().optional(),
      adjustedPlan: z.string().optional(),
      riskSummary: z.string().optional(),
      createdById: z.string().uuid().optional(),
      memberIds: z.array(z.string().uuid()).optional(),
      adminId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      approvalInfo: z.record(z.unknown()).optional(),
      basisInfo: z.record(z.unknown()).optional(),
      financialInfo: z.record(z.unknown()).optional(),
      personnelInfo: z.record(z.unknown()).optional(),
      monthlyAllocations: z
        .array(
          z.object({
            memberId: z.string().uuid(),
            month: z.string(),
            hours: z.number().nonnegative(),
          }),
        )
        .optional(),
    })
    .strict(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
