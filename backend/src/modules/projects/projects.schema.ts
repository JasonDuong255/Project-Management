import { z } from 'zod'

const teamMemberInput = z.object({
  userId: z.string().uuid(),
  role: z.string(),
  responsibility: z.string().default(''),
  totalPlannedHours: z.number().nonnegative().default(0),
})

const ttkDecisionAttachmentInput = z.object({
  fileName: z.string().min(1),
  title: z.string().optional(),
  contentBase64: z.string().optional(),
  mimeType: z.string().optional(),
})

export const createProjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().default(''),
  sponsor: z.string().default(''),
  objective: z.string().default(''),
  ttkDecisionNumber: z.string().default(''),
  ttkDecisionAttachment: ttkDecisionAttachmentInput.optional(),
  businessCenterCode: z.enum(['BU1', 'BU2', 'BU3', 'BU4', 'BU5']),
  customerGroupCode: z.enum(['VNA', 'LDLK', 'OT', 'NB']),
  marketCode: z.enum(['HK', 'CHK', 'AN', 'CP', 'XD', 'TC', 'GD', 'NL', 'DN', 'YT', 'HH']),
  domainCode: z.enum(['PM', 'HT', 'DV']),
  projectKindCode: z.enum(['NC', 'KT', 'HĐ', 'HD', 'NB']),
  createdById: z.string().uuid(),
  adminId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
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
      status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).optional(),
      health: z.enum(['STABLE', 'NEEDS_REVIEW', 'AT_RISK']).optional(),
      projectType: z.enum(['PRELIMINARY', 'FEASIBILITY', 'CONTRACT', 'INTERNAL']).optional(),
      psUserId: z.string().uuid().nullable().optional(),
      progress: z.number().int().min(0).max(100).optional(),
      currentPhase: z.string().optional(),
      adjustedPlan: z.string().optional(),
      riskSummary: z.string().optional(),
      createdById: z.string().uuid().optional(),
      memberIds: z.array(z.string().uuid()).optional(),
      adminId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      basisInfo: z.record(z.unknown()).optional(),
      financialInfo: z.record(z.unknown()).optional(),
      // AITS members must always be bound to a real User (userId is required).
      // Free-text customer / partner rows remain unconstrained.
      personnelInfo: z
        .object({
          aitsMembers: z
            .array(
              z
                .object({
                  userId: z.string().uuid({ message: 'aitsMembers[].userId is required (must be linked to a User)' }),
                })
                .passthrough(),
            )
            .optional(),
          customerMembers: z.array(z.record(z.unknown())).optional(),
          partners: z.array(z.record(z.unknown())).optional(),
        })
        .passthrough()
        .optional(),
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
