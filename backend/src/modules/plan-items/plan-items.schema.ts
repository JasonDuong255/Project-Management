import { z } from 'zod'

const monthAllocation = z.object({
  month: z.string(),
  hours: z.number().nonnegative(),
})

export const savePlanItemSchema = z.object({
  id: z.string().optional(),
  parentId: z.string().nullable(),
  name: z.string().min(1),
  workType: z.enum(['PRELIMINARY', 'SUBTASK', 'MILESTONE']),
  ownerId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  // v3.14: chỉ 3 trạng thái lưu DB. DUE_SOON / OVERDUE là derive ở FE.
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']),
  baselineStartDate: z.string(),
  baselineEndDate: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  progress: z.number().int().min(0).max(100),
  plannedHours: z.number().nonnegative(),
  monthAllocations: z.array(monthAllocation).default([]),
  dependencyNote: z.string().default(''),
  deliverable: z.string().default(''),
})

export type SavePlanItemInput = z.infer<typeof savePlanItemSchema>
