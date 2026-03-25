import type {
  AppSnapshot,
  Catalogs,
  CreateDocumentInput,
  CreateProjectInput,
  DelayRaise,
  MockDatabase,
  PlanItem,
  Project,
  SaveAllocationInput,
  SavePlanItemInput,
  SaveRiskInput,
  SaveWorklogInput,
  UpdateProjectInput,
  User,
  Worklog,
} from '../types'

const STORAGE_KEY = 'ppm-demo-db-v1'
const CURRENT_USER_KEY = 'ppm-demo-current-user-v1'

async function wait(duration = 220) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration)
  })
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function calculateDurationDays(startDate: string, endDate: string) {
  const start = Date.parse(startDate)
  const end = Date.parse(endDate)

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0
  }

  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1
}

function createDefaultBasisInfo(project?: Pick<Project, 'startDate' | 'endDate'>): Project['basisInfo'] {
  const durationDays = project ? calculateDurationDays(project.startDate, project.endDate) : 0

  return {
    outputContracts: [],
    inputContracts: [],
    deploymentApprovals: [],
    projectTeamDecisions: [],
    ttkMode: 'KIEM_NHIEM',
    deploymentMode: 'NOI_BO',
    durationDays,
    durationHours: durationDays * 8,
  }
}

function createDefaultFinancialItem(): Project['financialInfo']['revenue'] {
  return {
    amount: 0,
    note: '',
  }
}

function createDefaultFinancialInfo(): Project['financialInfo'] {
  return {
    revenue: createDefaultFinancialItem(),
    internalCost: createDefaultFinancialItem(),
    externalCost: createDefaultFinancialItem(),
    profit: createDefaultFinancialItem(),
    costSource: '',
  }
}

function buildAitsPersonnelFromProject(project: Project, users: User[]): Project['personnelInfo']['aitsMembers'] {
  const memberIds = [...new Set([project.adminId, ...project.memberIds])]

  return memberIds.map((memberId) => {
    const user = users.find((item) => item.id === memberId)
    const totalPlannedHours = project.monthlyAllocations
      .filter((allocation) => allocation.memberId === memberId)
      .reduce((sum, allocation) => sum + allocation.hours, 0)

    return {
      fullName: user?.name ?? memberId,
      titleUnit: user ? `${user.title} - ${user.unit}` : '',
      role: memberId === project.adminId ? 'PM phu trach' : 'Nhan su AITS',
      responsibility: '',
      totalPlannedHours,
      email: user?.email ?? '',
      phone: '',
    }
  })
}

function createDefaultPersonnelInfo(
  project: Project,
  users: User[],
): Project['personnelInfo'] {
  return {
    aitsMembers: buildAitsPersonnelFromProject(project, users),
    customerMembers: [],
    partners: [],
  }
}

function normalizeReferenceItems(items?: Project['basisInfo']['outputContracts']) {
  return (items ?? []).map((item) => ({
    name: item?.name ?? '',
    note: item?.note ?? '',
  }))
}

function normalizeAitsPersonnelItems(items?: Project['personnelInfo']['aitsMembers']) {
  return (items ?? []).map((item) => ({
    fullName: item?.fullName ?? '',
    titleUnit: item?.titleUnit ?? '',
    role: item?.role ?? '',
    responsibility: item?.responsibility ?? '',
    totalPlannedHours: item?.totalPlannedHours ?? 0,
    email: item?.email ?? '',
    phone: item?.phone ?? '',
  }))
}

function normalizeExternalPersonnelItems(items?: Project['personnelInfo']['customerMembers']) {
  return (items ?? []).map((item) => ({
    fullName: item?.fullName ?? '',
    titleUnit: item?.titleUnit ?? '',
    role: item?.role ?? '',
    responsibility: item?.responsibility ?? '',
    email: item?.email ?? '',
    phone: item?.phone ?? '',
  }))
}

function normalizeFinancialItem(
  item?: Project['financialInfo']['revenue'],
): Project['financialInfo']['revenue'] {
  return {
    amount: item?.amount ?? 0,
    note: item?.note ?? '',
  }
}

function normalizeAssigneeIds(assigneeIds?: string[], assigneeId?: string) {
  const merged = [...(assigneeIds ?? []), ...(assigneeId ? [assigneeId] : [])]
  return [...new Set(merged.filter(Boolean))]
}

function normalizeProject(project: Project, users: User[]): Project {
  const defaultBasisInfo = createDefaultBasisInfo(project)
  const defaultPersonnelInfo = createDefaultPersonnelInfo(project, users)
  const basisInfo = project.basisInfo
  const financialInfo = project.financialInfo
  const personnelInfo = project.personnelInfo

  return {
    ...project,
    basisInfo: {
      outputContracts: normalizeReferenceItems(basisInfo?.outputContracts),
      inputContracts: normalizeReferenceItems(basisInfo?.inputContracts),
      deploymentApprovals: normalizeReferenceItems(basisInfo?.deploymentApprovals),
      projectTeamDecisions: normalizeReferenceItems(basisInfo?.projectTeamDecisions),
      ttkMode: basisInfo?.ttkMode ?? defaultBasisInfo.ttkMode,
      deploymentMode: basisInfo?.deploymentMode ?? defaultBasisInfo.deploymentMode,
      durationDays: basisInfo?.durationDays ?? defaultBasisInfo.durationDays,
      durationHours: basisInfo?.durationHours ?? defaultBasisInfo.durationHours,
    },
    financialInfo: {
      revenue: normalizeFinancialItem(financialInfo?.revenue),
      internalCost: normalizeFinancialItem(financialInfo?.internalCost),
      externalCost: normalizeFinancialItem(financialInfo?.externalCost),
      profit: normalizeFinancialItem(financialInfo?.profit),
      costSource: financialInfo?.costSource ?? '',
    },
    personnelInfo: {
      aitsMembers: normalizeAitsPersonnelItems(personnelInfo?.aitsMembers).length
        ? normalizeAitsPersonnelItems(personnelInfo?.aitsMembers)
        : defaultPersonnelInfo.aitsMembers,
      customerMembers: normalizeExternalPersonnelItems(personnelInfo?.customerMembers),
      partners: normalizeExternalPersonnelItems(personnelInfo?.partners),
    },
  }
}

function normalizePlanItem(item: PlanItem): PlanItem {
  const assigneeIds = normalizeAssigneeIds(item.assigneeIds, item.assigneeId)

  return {
    ...item,
    assigneeId: assigneeIds[0] ?? '',
    assigneeIds,
  }
}

function normalizeDatabase(database: MockDatabase): MockDatabase {
  return {
    ...database,
    projects: database.projects.map((project) => normalizeProject(project, database.users)),
    planItems: database.planItems.map((item) => normalizePlanItem(item)),
  }
}

function recalculateProjectProgress(database: MockDatabase, projectId: string) {
  const projectTasks = database.planItems.filter((item) => item.projectId === projectId)

  if (!projectTasks.length) {
    return
  }

  const progress = Math.round(
    projectTasks.reduce((sum, item) => sum + item.progress, 0) / projectTasks.length,
  )

  database.projects = database.projects.map((project) =>
    project.id === projectId ? { ...project, progress } : project,
  )
}

function clone<T>(value: T): T {
  return window.structuredClone(value)
}

function readDatabase() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  return normalizeDatabase(JSON.parse(raw) as MockDatabase)
}

function writeDatabase(database: MockDatabase) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDatabase(database)))
}

async function fetchJsonFile<T>(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Không thể nạp mock data từ ${url}`)
  }

  return (await response.json()) as T
}

async function loadSeedDatabase() {
  const [users, projects, planItems, worklogs, delayRaises, catalogs] =
    await Promise.all([
      fetchJsonFile<User[]>('/mock/users.json'),
      fetchJsonFile<Project[]>('/mock/projects.json'),
      fetchJsonFile<PlanItem[]>('/mock/plan-items.json'),
      fetchJsonFile<Worklog[]>('/mock/worklogs.json'),
      fetchJsonFile<DelayRaise[]>('/mock/delay-raises.json'),
      fetchJsonFile<Catalogs>('/mock/catalogs.json'),
    ])

  return normalizeDatabase({
    users,
    projects,
    planItems,
    worklogs,
    delayRaises,
    catalogs,
  } satisfies MockDatabase)
}

async function ensureDatabase(force = false) {
  if (!force) {
    const existing = readDatabase()
    if (existing) {
      return existing
    }
  }

  const seeded = await loadSeedDatabase()
  writeDatabase(seeded)
  return seeded
}

async function buildSnapshot(force = false): Promise<AppSnapshot> {
  const database = await ensureDatabase(force)
  const currentUserId = window.localStorage.getItem(CURRENT_USER_KEY)
  const currentUser =
    database.users.find((user) => user.id === currentUserId) ?? null

  return {
    ...database,
    currentUser,
  }
}

async function updateDatabase(
  recipe: (database: MockDatabase) => void | Promise<void>,
) {
  const database = clone(await ensureDatabase())
  await recipe(database)
  writeDatabase(database)
  await wait()
  return buildSnapshot()
}

export async function getSnapshot() {
  await wait()
  return buildSnapshot()
}

export async function login(identifier: string, password: string) {
  const database = await ensureDatabase()
  const user =
    database.users.find(
      (item) =>
        (item.username === identifier || item.email === identifier) &&
        item.password === password,
    ) ?? null

  await wait()

  if (!user) {
    return null
  }

  window.localStorage.setItem(CURRENT_USER_KEY, user.id)
  return buildSnapshot()
}

export async function logout() {
  window.localStorage.removeItem(CURRENT_USER_KEY)
  await wait()
  return buildSnapshot()
}

export async function createProject(input: CreateProjectInput) {
  return updateDatabase((database) => {
    const project: Project = {
      id: createId('p'),
      code: input.code,
      name: input.name,
      summary: input.summary,
      sponsor: input.sponsor,
      department: input.department,
      objective: input.objective,
      adminId: input.adminId,
      memberIds: input.memberIds,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'INITIATION',
      health: 'GREEN',
      progress: 0,
      currentPhase: 'Khởi động dự án',
      adjustedPlan: 'Chưa có điều chỉnh',
      riskSummary: 'Chưa ghi nhận rủi ro',
      basisInfo: createDefaultBasisInfo(input),
      financialInfo: createDefaultFinancialInfo(),
      personnelInfo: {
        aitsMembers: [],
        customerMembers: [],
        partners: [],
      },
      documents: [],
      monthlyAllocations: [],
      risks: [],
    }

    database.projects.unshift(normalizeProject(project, database.users))
  })
}

export async function updateProject(input: UpdateProjectInput) {
  return updateDatabase((database) => {
    database.projects = database.projects.map((project) =>
      project.id === input.projectId
        ? normalizeProject({ ...project, ...input.patch }, database.users)
        : project,
    )
  })
}

export async function addProjectDocument(input: CreateDocumentInput) {
  return updateDatabase((database) => {
    database.projects = database.projects.map((project) => {
      if (project.id !== input.projectId) {
        return project
      }

      return {
        ...project,
        documents: [
          {
            id: createId('doc'),
            title: input.title,
            category: input.category,
            description: input.description,
            url: input.url,
            uploadedBy: input.uploadedBy,
            uploadedAt: new Date().toISOString(),
          },
          ...project.documents,
        ],
      }
    })
  })
}

export async function savePlanItem(input: SavePlanItemInput) {
  return updateDatabase((database) => {
    const existing = database.planItems.find((item) => item.id === input.id)

    if (existing) {
      database.planItems = database.planItems.map((item) =>
        item.id === input.id
          ? {
              ...item,
              ...input,
              id: item.id,
              assigneeId: input.assigneeIds[0] ?? input.assigneeId,
              assigneeIds: normalizeAssigneeIds(input.assigneeIds, input.assigneeId),
              actualHours: item.actualHours,
              replanRequested:
                input.status === 'NEEDS_REPLAN' ? true : item.replanRequested,
            }
          : item,
      )
      recalculateProjectProgress(database, input.projectId)
      return
    }

    database.planItems.unshift({
      id: createId('task'),
      projectId: input.projectId,
      parentId: input.parentId,
      name: input.name,
      workType: input.workType,
      ownerId: input.ownerId,
      assigneeId: input.assigneeIds[0] ?? input.assigneeId,
      assigneeIds: normalizeAssigneeIds(input.assigneeIds, input.assigneeId),
      status: input.status,
      baselineStartDate: input.baselineStartDate,
      baselineEndDate: input.baselineEndDate,
      startDate: input.startDate,
      endDate: input.endDate,
      progress: input.progress,
      plannedHours: input.plannedHours,
      actualHours: 0,
      monthAllocations: input.monthAllocations,
      dependencyNote: input.dependencyNote,
      deliverable: input.deliverable,
      replanRequested: input.status === 'NEEDS_REPLAN',
    })

    recalculateProjectProgress(database, input.projectId)
  })
}

export async function addWorklog(input: SaveWorklogInput) {
  return updateDatabase((database) => {
    database.worklogs.unshift({
      id: createId('wl'),
      taskId: input.taskId,
      projectId: input.projectId,
      memberId: input.memberId,
      date: input.date,
      hours: input.hours,
      progressNote: input.progressNote,
    })

    database.planItems = database.planItems.map((item) => {
      if (item.id !== input.taskId) {
        return item
      }

      const nextStatus =
        input.progress >= 100
          ? 'DONE'
          : item.status === 'NOT_STARTED'
            ? 'IN_PROGRESS'
            : item.status

      return {
        ...item,
        actualHours: item.actualHours + input.hours,
        progress: input.progress,
        status: nextStatus,
      }
    })

    recalculateProjectProgress(database, input.projectId)
  })
}

export async function raiseDelay(input: {
  projectId: string
  taskId: string
  requesterId: string
  reason: string
  impact: string
}) {
  return updateDatabase((database) => {
    database.delayRaises.unshift({
      id: createId('dr'),
      projectId: input.projectId,
      taskId: input.taskId,
      requesterId: input.requesterId,
      requestedAt: new Date().toISOString(),
      reason: input.reason,
      impact: input.impact,
      status: 'OPEN',
      managerResponse: '',
    })

    database.planItems = database.planItems.map((item) =>
      item.id === input.taskId
        ? { ...item, replanRequested: true, status: 'NEEDS_REPLAN' }
        : item,
    )
  })
}

export async function saveAllocation(input: SaveAllocationInput) {
  return updateDatabase((database) => {
    database.projects = database.projects.map((project) => {
      if (project.id !== input.projectId) {
        return project
      }

      const nextAllocations = project.monthlyAllocations.filter(
        (allocation) =>
          !(
            allocation.memberId === input.memberId &&
            allocation.month === input.month
          ),
      )

      nextAllocations.push({
        memberId: input.memberId,
        month: input.month,
        hours: input.hours,
      })

      return {
        ...project,
        monthlyAllocations: nextAllocations.sort((left, right) =>
          left.month.localeCompare(right.month),
        ),
      }
    })
  })
}

export async function saveRisk(input: SaveRiskInput) {
  return updateDatabase((database) => {
    database.projects = database.projects.map((project) => {
      if (project.id !== input.projectId) {
        return project
      }

      const risks = project.risks.filter((risk) => risk.id !== input.id)

      risks.unshift({
        id: input.id ?? createId('risk'),
        title: input.title,
        level: input.level,
        status: input.status,
        ownerId: input.ownerId,
        mitigation: input.mitigation,
        lastUpdated: new Date().toISOString(),
      })

      return {
        ...project,
        risks,
      }
    })
  })
}

export async function updateCatalogGroup<K extends keyof Catalogs>(
  group: K,
  values: Catalogs[K],
) {
  return updateDatabase((database) => {
    database.catalogs[group] = values
  })
}

export async function resetDemoData() {
  window.localStorage.removeItem(STORAGE_KEY)
  await wait()
  return buildSnapshot(true)
}
