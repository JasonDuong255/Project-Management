import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from '../../db/prisma.js'
import { canViewProject } from '../../lib/permissions.js'
import type {
  AuthUser,
  CatalogKey,
  CatalogOption,
  Catalogs,
} from '../../types/domain.js'

const projectInclude = {
  members: true,
  documents: true,
  monthlyAllocations: true,
  risks: true,
} satisfies Prisma.ProjectInclude

const planItemInclude = {
  assignees: true,
} satisfies Prisma.PlanItemInclude

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>
type PlanItemRow = Prisma.PlanItemGetPayload<{ include: typeof planItemInclude }>

const EMPTY_CATALOGS: Catalogs = {
  projectStatuses: [],
  healthStatuses: [],
  taskStatuses: [],
  riskLevels: [],
  documentCategories: [],
  departments: [],
  projectMemberRoles: [],
}

export async function assembleSnapshot(user: AuthUser, db: PrismaClient = prisma) {
  const [users, projects, planItems, worklogs, delayRaises, activityLogs, catalogGroups] =
    await Promise.all([
      db.user.findMany({ orderBy: { name: 'asc' } }),
      db.project.findMany({ include: projectInclude, orderBy: { createdAt: 'desc' } }),
      db.planItem.findMany({ include: planItemInclude, orderBy: { createdAt: 'asc' } }),
      db.worklog.findMany({ orderBy: { date: 'desc' } }),
      db.delayRaise.findMany({ orderBy: { requestedAt: 'desc' } }),
      db.activityLog.findMany({ orderBy: { timestamp: 'desc' } }),
      db.catalogGroup.findMany(),
    ])

  const visibleProjects = projects.filter((p) => canViewProject(p, user))
  const visibleProjectIds = new Set(visibleProjects.map((p) => p.id))

  const filteredPlanItems = planItems.filter((p) => visibleProjectIds.has(p.projectId))
  const filteredWorklogs = worklogs.filter((w) => visibleProjectIds.has(w.projectId))
  const filteredDelays = delayRaises.filter((d) => visibleProjectIds.has(d.projectId))
  const filteredActivity = activityLogs.filter((a) => visibleProjectIds.has(a.projectId))

  return {
    currentUser: user,
    users: users.map(serializeUser),
    projects: visibleProjects.map(serializeProject),
    planItems: filteredPlanItems.map(serializePlanItem),
    worklogs: filteredWorklogs.map(serializeWorklog),
    delayRaises: filteredDelays.map(serializeDelayRaise),
    activityLogs: filteredActivity.map(serializeActivityLog),
    catalogs: foldCatalogs(catalogGroups),
  }
}

function serializeUser(u: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    employeeCode: u.employeeCode,
    functionalTitle: u.functionalTitle,
    isActive: u.isActive,
    title: u.title,
    unit: u.unit,
    phone: u.phone,
    monthlyCapacity: u.monthlyCapacity,
    avatarColor: u.avatarColor,
  }
}

function serializeProject(p: ProjectRow) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    summary: p.summary,
    sponsor: p.sponsor,
    department: p.department,
    objective: p.objective,
    ttkDecisionNumber: p.ttkDecisionNumber,
    createdById: p.createdById,
    adminId: p.adminId,
    psUserId: p.psUserId,
    projectType: p.projectType,
    memberIds: p.members.map((m) => m.userId),
    members: p.members.map((m) => ({
      userId: m.userId,
      isCoordinator: m.isCoordinator,
      roleInProject: m.roleInProject,
      responsibility: m.responsibility,
      totalPlannedHours: m.totalPlannedHours,
    })),
    startDate: p.startDate.toISOString().slice(0, 10),
    endDate: p.endDate.toISOString().slice(0, 10),
    status: p.status,
    health: p.health,
    pausedAt: p.pausedAt?.toISOString() ?? null,
    closedAt: p.closedAt?.toISOString() ?? null,
    progress: p.progress,
    currentPhase: p.currentPhase,
    adjustedPlan: p.adjustedPlan,
    riskSummary: p.riskSummary,
    approvalInfo: p.approvalInfo,
    basisInfo: p.basisInfo,
    financialInfo: p.financialInfo,
    personnelInfo: p.personnelInfo,
    documents: p.documents.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      documentNumber: d.documentNumber,
      description: d.description,
      url: d.url,
      uploadedBy: d.uploadedBy,
      uploadedAt: d.uploadedAt.toISOString(),
      updatedBy: d.updatedBy ?? '',
      updatedAt: d.updatedAt?.toISOString() ?? '',
    })),
    monthlyAllocations: p.monthlyAllocations.map((a) => ({
      memberId: a.memberId,
      month: a.month,
      hours: a.hours,
    })),
    risks: p.risks.map((r) => ({
      id: r.id,
      title: r.title,
      level: r.level,
      status: r.status,
      ownerId: r.ownerId,
      mitigation: r.mitigation,
      lastUpdated: r.lastUpdated.toISOString(),
    })),
  }
}

function serializePlanItem(p: PlanItemRow) {
  return {
    id: p.id,
    projectId: p.projectId,
    parentId: p.parentId,
    name: p.name,
    workType: p.workType,
    ownerId: p.ownerId,
    assigneeId: p.assigneeId,
    assigneeIds: p.assignees.map((a) => a.userId),
    status: p.status,
    baselineStartDate: p.baselineStartDate.toISOString().slice(0, 10),
    baselineEndDate: p.baselineEndDate.toISOString().slice(0, 10),
    startDate: p.startDate.toISOString().slice(0, 10),
    endDate: p.endDate.toISOString().slice(0, 10),
    progress: p.progress,
    plannedHours: p.plannedHours,
    actualHours: p.actualHours,
    monthAllocations: p.monthAllocations,
    dependencyNote: p.dependencyNote,
    deliverable: p.deliverable,
    replanRequested: p.replanRequested,
  }
}

function serializeWorklog(w: Awaited<ReturnType<typeof prisma.worklog.findFirstOrThrow>>) {
  return {
    id: w.id,
    taskId: w.taskId,
    projectId: w.projectId,
    memberId: w.memberId,
    date: w.date.toISOString().slice(0, 10),
    hours: w.hours,
    progressNote: w.progressNote,
  }
}

function serializeDelayRaise(d: Awaited<ReturnType<typeof prisma.delayRaise.findFirstOrThrow>>) {
  return {
    id: d.id,
    projectId: d.projectId,
    taskId: d.taskId,
    requesterId: d.requesterId,
    requestedAt: d.requestedAt.toISOString(),
    reason: d.reason,
    impact: d.impact,
    status: d.status,
    managerResponse: d.managerResponse,
  }
}

function serializeActivityLog(a: Awaited<ReturnType<typeof prisma.activityLog.findFirstOrThrow>>) {
  return {
    id: a.id,
    projectId: a.projectId,
    userId: a.userId,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    entityName: a.entityName,
    changes: a.changes,
    timestamp: a.timestamp.toISOString(),
  }
}

function foldCatalogs(
  groups: Awaited<ReturnType<typeof prisma.catalogGroup.findMany>>,
): Catalogs {
  const out: Catalogs = { ...EMPTY_CATALOGS }
  for (const g of groups) {
    out[g.key as CatalogKey] = (g.values as unknown as CatalogOption[]) ?? []
  }
  return out
}
