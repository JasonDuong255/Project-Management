import type { Prisma } from '@prisma/client'
import { prisma } from '../../db/prisma.js'
import { ApiError } from '../../middlewares/error.js'
import { canEditProjectInfo, canManageProjectPlan } from '../../lib/permissions.js'
import { diffFields, writeActivityLog } from '../../lib/activity-log.js'
import type { AuthUser } from '../../types/domain.js'
import type { CreateProjectInput, UpdateProjectInput } from './projects.schema.js'

const DEFAULT_BASIS = {
  outputContracts: [],
  inputContracts: [],
  deploymentApprovals: [],
  projectTeamDecisions: [],
  ttkMode: 'CHUYEN_TRACH',
  deploymentMode: 'NOI_BO',
  durationDays: 0,
  durationHours: 0,
}

const DEFAULT_FINANCIAL = {
  revenue: { amount: 0, note: '' },
  internalCost: { amount: 0, note: '' },
  externalCost: { amount: 0, note: '' },
  profit: { amount: 0, note: '' },
  costSource: '',
}

const DEFAULT_PERSONNEL = {
  aitsMembers: [],
  customerMembers: [],
  partners: [],
}

export async function createProject(input: CreateProjectInput, currentUser: AuthUser) {
  if (currentUser.role !== 'PMO' && currentUser.role !== 'ADMIN_HC') {
    throw new ApiError(403, 'Only PMO/ADMIN_HC can create projects')
  }

  const memberIds = Array.from(new Set(input.teamMembers.map((m) => m.userId)))
  const aitsMembers = await Promise.all(
    input.teamMembers.map(async (m) => {
      const user = await prisma.user.findUnique({ where: { id: m.userId } })
      return {
        userId: m.userId,
        employeeCode: user?.employeeCode ?? '',
        fullName: user?.name ?? '',
        title: user?.title ?? '',
        unit: user?.unit ?? '',
        role: m.role,
        responsibility: '',
        totalPlannedHours: m.totalPlannedHours,
        email: user?.email ?? '',
        phone: user?.phone ?? '',
      }
    }),
  )

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        code: input.code,
        name: input.name,
        summary: input.summary,
        sponsor: input.sponsor,
        department: input.department,
        objective: input.objective,
        ttkDecisionNumber: input.ttkDecisionNumber,
        createdById: input.createdById,
        adminId: input.adminId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        approvalInfo: {
          status: 'PENDING',
          requestedById: input.createdById,
          requestFileName: input.approvalRequestFileName,
          requestSubmittedAt: new Date().toISOString(),
          approvedById: '',
          approvedAt: '',
          approvalFileName: '',
          note: '',
        } as Prisma.InputJsonValue,
        basisInfo: DEFAULT_BASIS as Prisma.InputJsonValue,
        financialInfo: DEFAULT_FINANCIAL as Prisma.InputJsonValue,
        personnelInfo: { ...DEFAULT_PERSONNEL, aitsMembers } as Prisma.InputJsonValue,
        members: {
          create: memberIds.map((userId) => ({ userId })),
        },
      },
    })

    await writeActivityLog(tx, {
      projectId: project.id,
      userId: currentUser.id,
      action: 'PROJECT_INFO_UPDATED',
      entityType: 'PROJECT',
      entityId: project.id,
      entityName: project.name,
      changes: [{ field: 'created', oldValue: null, newValue: project.code }],
    })

    return project
  })
}

export async function updateProject(
  projectId: string,
  patch: UpdateProjectInput['patch'],
  currentUser: AuthUser,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })
    if (!before) throw new ApiError(404, 'Project not found')

    const isManagerial =
      patch.status !== undefined ||
      patch.progress !== undefined ||
      patch.health !== undefined ||
      patch.basisInfo !== undefined ||
      patch.financialInfo !== undefined
    if (isManagerial) {
      if (!canManageProjectPlan(before, currentUser) && !canEditProjectInfo(before, currentUser)) {
        throw new ApiError(403, 'Forbidden: cannot manage this project')
      }
    } else if (!canEditProjectInfo(before, currentUser)) {
      throw new ApiError(403, 'Forbidden: cannot edit this project')
    }

    const data: Prisma.ProjectUpdateInput = {}
    if (patch.summary !== undefined) data.summary = patch.summary
    if (patch.sponsor !== undefined) data.sponsor = patch.sponsor
    if (patch.department !== undefined) data.department = patch.department
    if (patch.objective !== undefined) data.objective = patch.objective
    if (patch.ttkDecisionNumber !== undefined) data.ttkDecisionNumber = patch.ttkDecisionNumber
    if (patch.status !== undefined) data.status = patch.status
    if (patch.health !== undefined) data.health = patch.health
    if (patch.currentPhase !== undefined) data.currentPhase = patch.currentPhase
    if (patch.adjustedPlan !== undefined) data.adjustedPlan = patch.adjustedPlan
    if (patch.riskSummary !== undefined) data.riskSummary = patch.riskSummary
    if (patch.adminId !== undefined) data.admin = { connect: { id: patch.adminId } }
    if (patch.createdById !== undefined) data.createdBy = { connect: { id: patch.createdById } }
    if (patch.startDate !== undefined) data.startDate = new Date(patch.startDate)
    if (patch.endDate !== undefined) data.endDate = new Date(patch.endDate)
    if (patch.approvalInfo !== undefined) data.approvalInfo = patch.approvalInfo as Prisma.InputJsonValue
    if (patch.basisInfo !== undefined) data.basisInfo = patch.basisInfo as Prisma.InputJsonValue
    if (patch.financialInfo !== undefined)
      data.financialInfo = patch.financialInfo as Prisma.InputJsonValue
    if (patch.personnelInfo !== undefined)
      data.personnelInfo = patch.personnelInfo as Prisma.InputJsonValue

    const updated = await tx.project.update({
      where: { id: projectId },
      data,
    })

    if (patch.memberIds) {
      await tx.projectMember.deleteMany({ where: { projectId } })
      if (patch.memberIds.length > 0) {
        await tx.projectMember.createMany({
          data: patch.memberIds.map((userId) => ({ projectId, userId })),
          skipDuplicates: true,
        })
      }
    }

    if (patch.monthlyAllocations) {
      await tx.monthlyAllocation.deleteMany({ where: { projectId } })
      if (patch.monthlyAllocations.length > 0) {
        await tx.monthlyAllocation.createMany({
          data: patch.monthlyAllocations.map((a) => ({
            projectId,
            memberId: a.memberId,
            month: a.month,
            hours: a.hours,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Activity log entries (mirrors mockApi.ts:736-826)
    const infoChanges = diffFields(
      {
        summary: before.summary,
        sponsor: before.sponsor,
        department: before.department,
        objective: before.objective,
        currentPhase: before.currentPhase,
        adjustedPlan: before.adjustedPlan,
        riskSummary: before.riskSummary,
      },
      patch,
      ['summary', 'sponsor', 'department', 'objective', 'currentPhase', 'adjustedPlan', 'riskSummary'],
    )
    if (infoChanges.length > 0) {
      await writeActivityLog(tx, {
        projectId,
        userId: currentUser.id,
        action: 'PROJECT_INFO_UPDATED',
        entityType: 'PROJECT',
        entityId: projectId,
        entityName: updated.name,
        changes: infoChanges,
      })
    }

    if (patch.status !== undefined && patch.status !== before.status) {
      if (patch.status === 'DONE') {
        await writeActivityLog(tx, {
          projectId,
          userId: currentUser.id,
          action: 'PROJECT_CLOSED',
          entityType: 'PROJECT',
          entityId: projectId,
          entityName: updated.name,
          changes: [{ field: 'status', oldValue: before.status, newValue: 'DONE' }],
        })
      } else if (before.status === 'DONE') {
        await writeActivityLog(tx, {
          projectId,
          userId: currentUser.id,
          action: 'PROJECT_REOPENED',
          entityType: 'PROJECT',
          entityId: projectId,
          entityName: updated.name,
          changes: [{ field: 'status', oldValue: 'DONE', newValue: patch.status }],
        })
      }
    }

    if (patch.personnelInfo !== undefined) {
      await writeActivityLog(tx, {
        projectId,
        userId: currentUser.id,
        action: 'PERSONNEL_UPDATED',
        entityType: 'PROJECT',
        entityId: projectId,
        entityName: updated.name,
        changes: [{ field: 'personnelInfo', oldValue: null, newValue: 'updated' }],
      })
    }

    return updated
  })
}
