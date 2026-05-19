import type { Prisma } from '@prisma/client'
import { prisma } from '../../db/prisma.js'
import { ApiError } from '../../middlewares/error.js'
import {
  canCreateProject,
  canEditProjectInfo,
  canManageProjectPlan,
} from '../../lib/permissions.js'
import { diffFields, writeActivityLog } from '../../lib/activity-log.js'
import { storeProjectFile } from '../../lib/file-storage.js'
import type { AuthUser } from '../../types/domain.js'
import type { CreateProjectInput, UpdateProjectInput } from './projects.schema.js'

const DEFAULT_BASIS = {
  outputContracts: [],
  inputContracts: [],
  deploymentApprovals: [],
  projectTeamDecisions: [],
  businessCenterCode: 'BU1',
  customerGroupCode: 'VNA',
  marketCode: 'HK',
  domainCode: 'PM',
  projectKindCode: 'NC',
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
  if (!canCreateProject(currentUser)) {
    throw new ApiError(403, 'Only ADMIN_HC (TCHC) can create projects')
  }

  // Dedupe by userId, keeping the first occurrence's role/hours.
  const seen = new Set<string>()
  const dedupedMembers = input.teamMembers.filter((m) => {
    if (seen.has(m.userId)) return false
    seen.add(m.userId)
    return true
  })
  // Map ProjectMember rows: promote string-match coordinator to a real flag.
  const memberRowData = dedupedMembers.map((m) => ({
    userId: m.userId,
    isCoordinator: /dieu phoi du an/i.test(m.role),
    roleInProject: m.role,
    responsibility: m.responsibility,
    totalPlannedHours: m.totalPlannedHours,
  }))
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
        responsibility: m.responsibility,
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
        basisInfo: {
          ...DEFAULT_BASIS,
          businessCenterCode: input.businessCenterCode,
          customerGroupCode: input.customerGroupCode,
          marketCode: input.marketCode,
          domainCode: input.domainCode,
          projectKindCode: input.projectKindCode,
        } as Prisma.InputJsonValue,
        financialInfo: DEFAULT_FINANCIAL as Prisma.InputJsonValue,
        personnelInfo: { ...DEFAULT_PERSONNEL, aitsMembers } as Prisma.InputJsonValue,
        members: {
          create: memberRowData,
        },
      },
    })

    if (input.ttkDecisionAttachment?.fileName) {
      const documentUrl = await storeProjectFile(project.id, input.ttkDecisionAttachment)
      await tx.projectDocument.create({
        data: {
          projectId: project.id,
          title: input.ttkDecisionAttachment.title ?? input.ttkDecisionAttachment.fileName,
          category: 'TTK_DECISION',
          documentNumber: input.ttkDecisionNumber,
          description: 'Tep dinh kem so quyet dinh thanh lap TTK',
          url: documentUrl,
          uploadedBy: currentUser.id,
        },
      })
    }

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
      if (patch.status === 'CLOSED') {
        await writeActivityLog(tx, {
          projectId,
          userId: currentUser.id,
          action: 'PROJECT_CLOSED',
          entityType: 'PROJECT',
          entityId: projectId,
          entityName: updated.name,
          changes: [{ field: 'status', oldValue: before.status, newValue: 'CLOSED' }],
        })
      } else if (before.status === 'CLOSED') {
        await writeActivityLog(tx, {
          projectId,
          userId: currentUser.id,
          action: 'PROJECT_REOPENED',
          entityType: 'PROJECT',
          entityId: projectId,
          entityName: updated.name,
          changes: [{ field: 'status', oldValue: 'CLOSED', newValue: patch.status }],
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
