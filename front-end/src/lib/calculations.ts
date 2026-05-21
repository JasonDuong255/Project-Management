import dayjs from 'dayjs'

import type {
  Catalogs,
  DelayRaise,
  EffectiveTaskStatus,
  GanttItem,
  HealthStatus,
  PlanItem,
  Project,
  ProjectRisk,
  User,
  Worklog,
} from '../types'

/**
 * v3.14 (19/05/2026): suy ra trạng thái HIỂN THỊ của task từ status DB + endDate.
 * - DONE: giữ nguyên (đã hoàn thành thì không cần cảnh báo deadline)
 * - Chưa DONE + today > endDate → OVERDUE
 * - Chưa DONE + ngày endDate trong vòng 1 ngày (today hoặc ngày mai) → DUE_SOON
 * - Còn lại: giữ status DB (NOT_STARTED / IN_PROGRESS)
 * Dùng helper này MỌI NƠI hiển thị status thay vì đọc thẳng task.status,
 * để cảnh báo deadline thống nhất.
 */
export function getEffectiveTaskStatus(
  task: Pick<PlanItem, 'status' | 'progress' | 'endDate'>,
  today = dayjs(),
): EffectiveTaskStatus {
  if (task.status === 'DONE' || task.progress >= 100) return 'DONE'
  if (!task.endDate) return task.status
  const end = dayjs(task.endDate).startOf('day')
  const now = today.startOf('day')
  if (end.isBefore(now)) return 'OVERDUE'
  const diffDays = end.diff(now, 'day')
  if (diffDays <= 1) return 'DUE_SOON'
  return task.status
}

/**
 * v3.14 (19/05/2026): auto-compute project.health từ task deadlines,
 * KHÔNG còn cho PM/PMO chỉnh thủ công.
 *
 * Quy tắc derive (cùng pattern với getEffectiveTaskStatus):
 * - Có ít nhất 1 task OVERDUE → AT_RISK
 * - Có ít nhất 1 task DUE_SOON (chưa OVERDUE) → NEEDS_REVIEW
 * - Còn lại (kể cả dự án chưa có task) → STABLE
 *
 * `today` injectable cho test. Dự án không có task → STABLE.
 */
export function getEffectiveProjectHealth(
  project: Pick<Project, 'id'>,
  planItems: PlanItem[],
  today = dayjs(),
): HealthStatus {
  const tasks = planItems.filter((item) => item.projectId === project.id)
  if (tasks.length === 0) return 'STABLE'
  let hasDueSoon = false
  for (const task of tasks) {
    const eff = getEffectiveTaskStatus(task, today)
    if (eff === 'OVERDUE') return 'AT_RISK'
    if (eff === 'DUE_SOON') hasDueSoon = true
  }
  return hasDueSoon ? 'NEEDS_REVIEW' : 'STABLE'
}

export interface WorkloadRow {
  user: User
  month: string
  capacity: number
  planned: number
  actual: number
  delta: number
  projectNames: string[]
}

export interface TaskDeadlineNotificationChild {
  id: string
  name: string
  status: PlanItem['status']
  progress: number
  endDate: string
  assigneeNames: string
}

export interface TaskDeadlineNotification {
  id: string
  projectId: string
  projectCode: string
  projectName: string
  taskId: string
  taskName: string
  progress: number
  endDate: string
  daysRemaining: number
  assigneeNames: string
  projectManagerName: string
  childTasks: TaskDeadlineNotificationChild[]
}

export function getTaskAssigneeIds(task: PlanItem) {
  if (task.assigneeIds?.length) {
    return task.assigneeIds
  }

  return task.assigneeId ? [task.assigneeId] : []
}

export function getTaskPrimaryAssigneeId(task: PlanItem) {
  return getTaskAssigneeIds(task)[0] ?? task.assigneeId
}

export function normalizeUserRole(role: User['role']) {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return 'PMO'
    case 'PROJECT_ADMIN':
      return 'PM'
    default:
      return role
  }
}

export function isProjectCoordinator(project: Project, userId?: string) {
  if (!userId) {
    return false
  }

  // v3.1: prefer first-class isCoordinator flag from project_members rows.
  if (project.members) {
    const match = project.members.find((m) => m.userId === userId)
    if (match) return match.isCoordinator
  }

  // Fallback: legacy string-match on JSONB personnelInfo (will go away in v3.3).
  return project.personnelInfo.aitsMembers.some((member) => {
    const normalizedRole = member.role.trim().toLowerCase()
    return member.userId === userId && normalizedRole.includes('dieu phoi du an')
  })
}

export function canManageProjectPlan(project: Project, currentUser: User | null) {
  if (!currentUser) {
    return false
  }

  // v3.1: only ACTIVE projects can be managed (PAUSED/CLOSED are read-only).
  if (project.status !== 'ACTIVE') {
    return false
  }

  const normalizedRole = normalizeUserRole(currentUser.role)

  return (
    normalizedRole === 'PMO' ||
    project.adminId === currentUser.id ||
    isProjectCoordinator(project, currentUser.id)
  )
}

export function getVisibleProjects(projects: Project[], currentUser: User | null) {
  if (!currentUser) {
    return []
  }

  const normalizedRole = normalizeUserRole(currentUser.role)

  if (normalizedRole === 'PMO' || normalizedRole === 'ADMIN_HC') {
    return projects
  }

  if (normalizedRole === 'PM') {
    return projects.filter(
      (project) =>
        project.adminId === currentUser.id || isProjectCoordinator(project, currentUser.id),
    )
  }

  return projects.filter(
    (project) =>
      project.memberIds.includes(currentUser.id) ||
      project.personnelInfo.aitsMembers.some((member) => member.userId === currentUser.id),
  )
}

export function getOpenRisks(projects: Project[]) {
  const items: Array<ProjectRisk & { projectName: string; projectCode: string }> = []

  projects.forEach((project) => {
    project.risks.forEach((risk) => {
      if (risk.status !== 'MITIGATED') {
        items.push({
          ...risk,
          projectName: project.name,
          projectCode: project.code,
        })
      }
    })
  })

  return items
}

export function getTaskCountByStatus(planItems: PlanItem[]) {
  return planItems.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.status] = (accumulator[item.status] ?? 0) + 1
    return accumulator
  }, {})
}

export function getProjectStatusChart(projects: Project[], catalogs: Catalogs) {
  return catalogs.projectStatuses.map((item) => ({
    name: item.label,
    value: projects.filter((project) => project.status === item.value).length,
  }))
}

export function getHealthChart(
  projects: Project[],
  catalogs: Catalogs,
  planItems: PlanItem[],
) {
  // v3.14: health derive on-the-fly từ task deadlines.
  return catalogs.healthStatuses.map((item) => ({
    name: item.label,
    value: projects.filter(
      (project) => getEffectiveProjectHealth(project, planItems) === item.value,
    ).length,
  }))
}

export function getAllMonths(projects: Project[], worklogs: Worklog[]) {
  const months = new Set<string>()

  projects.forEach((project) => {
    project.monthlyAllocations.forEach((allocation) => months.add(allocation.month))
  })

  worklogs.forEach((worklog) => {
    months.add(dayjs(worklog.date).format('YYYY-MM'))
  })

  return [...months].sort()
}

export function getWorkloadRows(
  users: User[],
  projects: Project[],
  worklogs: Worklog[],
  month: string,
) {
  return users
    .filter((user) => user.role === 'DELIVERY_MEMBER')
    .map<WorkloadRow>((user) => {
      const allocations = projects.flatMap((project) =>
        project.monthlyAllocations
          .filter(
            (allocation) =>
              allocation.memberId === user.id && allocation.month === month,
          )
          .map((allocation) => ({
            hours: allocation.hours,
            projectName: project.name,
          })),
      )

      const actual = worklogs
        .filter(
          (worklog) =>
            worklog.memberId === user.id &&
            dayjs(worklog.date).format('YYYY-MM') === month,
        )
        .reduce((sum, item) => sum + item.hours, 0)

      const planned = allocations.reduce((sum, item) => sum + item.hours, 0)

      return {
        user,
        month,
        capacity: user.monthlyCapacity,
        planned,
        actual,
        delta: planned - user.monthlyCapacity,
        projectNames: allocations.map((item) => item.projectName),
      }
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
}

export function getMonthlyUtilizationChart(
  users: User[],
  projects: Project[],
  worklogs: Worklog[],
) {
  const months = getAllMonths(projects, worklogs)
  const deliveryMembers = users.filter((user) => user.role === 'DELIVERY_MEMBER')

  return months.map((month) => {
    const rows = getWorkloadRows(users, projects, worklogs, month)

    return {
      month: dayjs(`${month}-01`).format('MM/YYYY'),
      planned: rows.reduce((sum, row) => sum + row.planned, 0),
      actual: rows.reduce((sum, row) => sum + row.actual, 0),
      capacity: deliveryMembers.reduce(
        (sum, user) => sum + user.monthlyCapacity,
        0,
      ),
    }
  })
}

export function getProjectPerformanceRows(
  projects: Project[],
  planItems: PlanItem[],
  worklogs: Worklog[],
) {
  return projects.map((project) => {
    const projectTasks = planItems.filter((item) => item.projectId === project.id)
    // v3.14: delayed = DUE_SOON hoặc OVERDUE (derive theo deadline).
    const delayedTasks = projectTasks.filter((item) => {
      const eff = getEffectiveTaskStatus(item)
      return eff === 'DUE_SOON' || eff === 'OVERDUE'
    }).length
    const openRisks = project.risks.filter((risk) => risk.status !== 'MITIGATED')
      .length
    const plannedHours = projectTasks.reduce((sum, item) => sum + item.plannedHours, 0)
    const actualHours = worklogs
      .filter((item) => item.projectId === project.id)
      .reduce((sum, item) => sum + item.hours, 0)

    return {
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      progress: project.progress,
      delayedTasks,
      openRisks,
      plannedHours,
      actualHours,
    }
  })
}

export function getMemberTasks(planItems: PlanItem[], userId: string) {
  return planItems
    .filter((item) => getTaskAssigneeIds(item).includes(userId))
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
}

export function getProjectTasks(planItems: PlanItem[], projectId: string) {
  return planItems
    .filter((item) => item.projectId === projectId)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
}

export function getRecentDelayRaises(delayRaises: DelayRaise[]) {
  return [...delayRaises].sort((left, right) =>
    right.requestedAt.localeCompare(left.requestedAt),
  )
}

export function getProjectById(projects: Project[], projectId?: string) {
  return projects.find((project) => project.id === projectId) ?? null
}

export function getUserById(users: User[], userId?: string) {
  return users.find((user) => user.id === userId) ?? null
}

function getDescendantPlanItems(planItems: PlanItem[], parentId: string): PlanItem[] {
  const children = planItems.filter((item) => item.parentId === parentId)

  return children.flatMap((child) => [child, ...getDescendantPlanItems(planItems, child.id)])
}

export function getTaskDeadlineNotifications(
  planItems: PlanItem[],
  projects: Project[],
  users: User[],
  currentUser: User | null,
) {
  if (!currentUser) {
    return []
  }

  const today = dayjs().startOf('day')

  return planItems
    .filter((item) => item.parentId === null)
    .map<TaskDeadlineNotification | null>((task) => {
      const project = projects.find((projectItem) => projectItem.id === task.projectId)

      if (!project) {
        return null
      }

      const isRecipient =
        normalizeUserRole(currentUser.role) === 'PMO' ||
        project.adminId === currentUser.id ||
        getTaskAssigneeIds(task).includes(currentUser.id)

      if (!isRecipient) {
        return null
      }

      const daysRemaining = dayjs(task.endDate).startOf('day').diff(today, 'day')

      if (daysRemaining < 0 || daysRemaining > 7 || task.progress >= 100) {
        return null
      }

      const childTasks = getDescendantPlanItems(planItems, task.id)
        .filter((item) => item.progress < 100 || item.status !== 'DONE')
        .map<TaskDeadlineNotificationChild>((item) => ({
          id: item.id,
          name: item.name,
          status: item.status,
          progress: item.progress,
          endDate: item.endDate,
          assigneeNames:
            getTaskAssigneeIds(item)
              .map((userId) => users.find((user) => user.id === userId)?.name ?? userId)
              .join(', ') || 'Chua phan cong',
        }))

      const assigneeNames =
        getTaskAssigneeIds(task)
          .map((userId) => users.find((user) => user.id === userId)?.name ?? userId)
          .join(', ') || 'Chua phan cong'

      return {
        id: `deadline-${task.id}`,
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        taskId: task.id,
        taskName: task.name,
        progress: task.progress,
        endDate: task.endDate,
        daysRemaining,
        assigneeNames,
        projectManagerName: users.find((user) => user.id === project.adminId)?.name ?? project.adminId,
        childTasks,
      }
    })
    .filter((item): item is TaskDeadlineNotification => item !== null)
    .sort(
      (left, right) =>
        left.daysRemaining - right.daysRemaining ||
        left.endDate.localeCompare(right.endDate),
    )
}

export function getDashboardSummary(
  projects: Project[],
  planItems: PlanItem[],
  delayRaises: DelayRaise[],
) {
  // v3.14: gộp delay = DUE_SOON / OVERDUE (derive theo deadline).
  const blockedTasks = planItems.filter((item) => {
    const eff = getEffectiveTaskStatus(item)
    return eff === 'DUE_SOON' || eff === 'OVERDUE'
  }).length
  // v3.14: project health derive từ task deadlines (auto-compute).
  const atRiskProjects = projects.filter(
    (project) => getEffectiveProjectHealth(project, planItems) === 'AT_RISK',
  ).length
  const warningProjects = projects.filter(
    (project) => getEffectiveProjectHealth(project, planItems) !== 'STABLE',
  ).length
  const openRaises = delayRaises.filter((item) => item.status === 'OPEN').length

  return {
    totalProjects: projects.length,
    atRiskProjects,
    blockedTasks,
    warningProjects,
    openRaises,
  }
}

export function buildGanttItems(
  planItems: PlanItem[],
  projects: Project[],
  users: User[],
  mode: 'project' | 'member',
  targetId: string,
) {
  const sourceItems =
    mode === 'project'
      ? planItems.filter((item) => item.projectId === targetId)
      : planItems.filter((item) => getTaskAssigneeIds(item).includes(targetId))

  // Build a map of parentId -> children count
  const childCountMap = new Map<string, number>()
  for (const item of sourceItems) {
    if (item.parentId) {
      childCountMap.set(item.parentId, (childCountMap.get(item.parentId) ?? 0) + 1)
    }
  }

  // Build depth map by traversing parent chain
  const depthMap = new Map<string, number>()
  function getDepth(item: PlanItem): number {
    if (depthMap.has(item.id)) return depthMap.get(item.id)!
    if (!item.parentId) {
      depthMap.set(item.id, 0)
      return 0
    }
    const parent = sourceItems.find((si) => si.id === item.parentId)
    if (!parent) {
      depthMap.set(item.id, 0)
      return 0
    }
    const depth = getDepth(parent) + 1
    depthMap.set(item.id, depth)
    return depth
  }
  for (const item of sourceItems) {
    getDepth(item)
  }

  // Build tree-ordered flat list: parent first, then children sorted by startDate
  function buildTreeOrder(parentId: string | null): PlanItem[] {
    const children = sourceItems
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    const result: PlanItem[] = []
    for (const child of children) {
      result.push(child)
      result.push(...buildTreeOrder(child.id))
    }
    return result
  }
  const orderedItems = buildTreeOrder(null)

  const items: GanttItem[] = orderedItems.map((item) => {
    const project = projects.find((projectItem) => projectItem.id === item.projectId)
    const assigneeNames = getTaskAssigneeIds(item)
      .map((userId) => users.find((user) => user.id === userId)?.name ?? userId)
      .join(', ')

    return {
      id: item.id,
      label: item.name,
      sublabel:
        mode === 'project'
          ? `${assigneeNames || 'Chua phan cong'} | ${item.deliverable}`
          : `${project?.code ?? ''} | ${project?.name ?? 'N/A'}`,
      startDate: item.startDate,
      endDate: item.endDate,
      progress: item.progress,
      status: item.status,
      depth: depthMap.get(item.id) ?? 0,
      childCount: childCountMap.get(item.id) ?? 0,
      workType: item.workType,
    }
  })

  return items
}

export function getStatusTone(status: Project['status'] | EffectiveTaskStatus) {
  switch (status) {
    // Project statuses (v3.15: ACTIVE / PAUSED / CLOSED / COMPLETED)
    case 'ACTIVE':
      return 'info'
    case 'PAUSED':
      return 'warning'
    case 'CLOSED':
      return 'neutral' // đóng nhưng chưa hoàn thành — xám
    case 'COMPLETED':
      return 'success' // đóng + tất cả task tổng quan 100% — xanh
    // Plan-item statuses (DB-stored)
    case 'DONE':
      return 'success'
    case 'IN_PROGRESS':
      return 'info'
    case 'NOT_STARTED':
      return 'neutral'
    // v3.14: trạng thái deadline derive on-the-fly
    case 'DUE_SOON':
      return 'warning'
    case 'OVERDUE':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function getHealthTone(health: Project['health']) {
  switch (health) {
    case 'STABLE':
      return 'success'
    case 'NEEDS_REVIEW':
      return 'warning'
    case 'AT_RISK':
      return 'danger'
    default:
      return 'neutral'
  }
}
