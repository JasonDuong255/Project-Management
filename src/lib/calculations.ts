import dayjs from 'dayjs'

import type {
  Catalogs,
  DelayRaise,
  GanttItem,
  PlanItem,
  Project,
  ProjectRisk,
  User,
  Worklog,
} from '../types'

export interface WorkloadRow {
  user: User
  month: string
  capacity: number
  planned: number
  actual: number
  delta: number
  projectNames: string[]
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

export function getVisibleProjects(projects: Project[], currentUser: User | null) {
  if (!currentUser) {
    return []
  }

  if (currentUser.role === 'SYSTEM_ADMIN') {
    return projects
  }

  if (currentUser.role === 'PROJECT_ADMIN') {
    return projects.filter((project) => project.adminId === currentUser.id)
  }

  return projects.filter((project) => project.memberIds.includes(currentUser.id))
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

export function getHealthChart(projects: Project[], catalogs: Catalogs) {
  return catalogs.healthStatuses.map((item) => ({
    name: item.label,
    value: projects.filter((project) => project.health === item.value).length,
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
    const delayedTasks = projectTasks.filter(
      (item) =>
        item.status === 'BLOCKED' ||
        item.status === 'NEEDS_REPLAN' ||
        item.replanRequested,
    ).length
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

export function getDashboardSummary(
  projects: Project[],
  planItems: PlanItem[],
  delayRaises: DelayRaise[],
) {
  const blockedTasks = planItems.filter(
    (item) => item.status === 'BLOCKED' || item.status === 'NEEDS_REPLAN',
  ).length
  const atRiskProjects = projects.filter(
    (project) => project.status === 'AT_RISK' || project.health === 'RED',
  ).length
  const warningProjects = projects.filter((project) => project.health !== 'GREEN')
    .length
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

  const items: GanttItem[] = sourceItems
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .map((item) => {
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
      }
    })

  return items
}

export function getStatusTone(status: Project['status'] | PlanItem['status']) {
  switch (status) {
    case 'DONE':
      return 'success'
    case 'IN_PROGRESS':
      return 'info'
    case 'PLANNING':
    case 'INITIATION':
    case 'NOT_STARTED':
      return 'neutral'
    case 'AT_RISK':
    case 'BLOCKED':
    case 'NEEDS_REPLAN':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function getHealthTone(health: Project['health']) {
  switch (health) {
    case 'GREEN':
      return 'success'
    case 'AMBER':
      return 'warning'
    case 'RED':
      return 'danger'
    default:
      return 'neutral'
  }
}
