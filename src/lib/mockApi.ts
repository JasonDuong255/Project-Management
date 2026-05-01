import type {
  ActivityLogAction,
  ActivityLogChange,
  AppSnapshot,
  Catalogs,
  CreateDocumentInput,
  CreateProjectInput,
  DeleteDocumentInput,
  DeletePlanItemInput,
  DelayRaise,
  MockDatabase,
  PlanItem,
  Project,
  SaveAllocationInput,
  SavePlanItemInput,
  SaveRiskInput,
  SaveWorklogInput,
  UpdateDocumentInput,
  UpdateProjectInput,
  User,
  Worklog,
} from '../types'

const STORAGE_KEY = 'ppm-demo-db-v2'
const CURRENT_USER_KEY = 'ppm-demo-current-user-v2'

async function wait(duration = 220) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration)
  })
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function getCurrentUserId(): string {
  return window.localStorage.getItem(CURRENT_USER_KEY) ?? ''
}

function addActivityLog(
  database: MockDatabase,
  params: {
    projectId: string
    action: ActivityLogAction
    entityType: 'PROJECT' | 'PLAN_ITEM'
    entityId: string
    entityName: string
    changes: ActivityLogChange[]
  },
) {
  database.activityLogs.unshift({
    id: createId('log'),
    projectId: params.projectId,
    userId: getCurrentUserId(),
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    changes: params.changes,
    timestamp: new Date().toISOString(),
  })
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

const defaultProjectMemberRoles: Catalogs['projectMemberRoles'] = [
  { value: 'PM du an', label: 'PM du an' },
  { value: 'Dieu phoi du an', label: 'Dieu phoi du an' },
  { value: 'Business Analyst', label: 'Business Analyst' },
  { value: 'Lap trinh vien', label: 'Lap trinh vien' },
  { value: 'Kiem thu', label: 'Kiem thu' },
  { value: 'Ky su tich hop', label: 'Ky su tich hop' },
  { value: 'Thanh vien trien khai', label: 'Thanh vien trien khai' },
]

function normalizeUserRole(role: User['role']): User['role'] {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return 'PMO'
    case 'PROJECT_ADMIN':
      return 'PM'
    default:
      return role
  }
}

function normalizeUser(user: User): User {
  return {
    ...user,
    role: normalizeUserRole(user.role),
    employeeCode: user.employeeCode ?? `EMP-${user.id.toUpperCase().slice(-4)}`,
    phone: user.phone ?? '',
    monthlyCapacity: user.monthlyCapacity ?? 0,
  }
}

function normalizeCatalogs(catalogs: Catalogs): Catalogs {
  return {
    ...catalogs,
    projectMemberRoles: catalogs.projectMemberRoles?.length
      ? catalogs.projectMemberRoles
      : defaultProjectMemberRoles,
  }
}

function normalizePersonnelRole(role?: string) {
  const normalized = (role ?? '').trim().toLowerCase()

  if (!normalized) {
    return 'Thanh vien trien khai'
  }

  if (normalized.includes('pm')) {
    return 'PM du an'
  }

  if (normalized.includes('dieu phoi')) {
    return 'Dieu phoi du an'
  }

  if (normalized.includes('business analyst') || normalized === 'ba') {
    return 'Business Analyst'
  }

  if (normalized.includes('kiem thu') || normalized.includes('test')) {
    return 'Kiem thu'
  }

  if (normalized.includes('tich hop')) {
    return 'Ky su tich hop'
  }

  if (normalized.includes('lap trinh') || normalized.includes('frontend')) {
    return 'Lap trinh vien'
  }

  return role ?? 'Thanh vien trien khai'
}

function createDefaultApprovalInfo(project?: Partial<Project>): Project['approvalInfo'] {
  const inferredStatus =
    project?.approvalInfo?.status ?? ((project?.progress ?? 0) > 0 ? 'APPROVED' : 'PENDING')
  const fallbackDate = project?.startDate
    ? new Date(project.startDate).toISOString()
    : new Date().toISOString()

  return {
    status: inferredStatus,
    requestedById: project?.approvalInfo?.requestedById ?? project?.createdById ?? project?.adminId ?? '',
    requestFileName:
      project?.approvalInfo?.requestFileName ??
      project?.basisInfo?.deploymentApprovals?.[0]?.name ??
      '',
    requestSubmittedAt: project?.approvalInfo?.requestSubmittedAt ?? fallbackDate,
    approvedById: project?.approvalInfo?.approvedById ?? '',
    approvedAt:
      inferredStatus === 'APPROVED'
        ? project?.approvalInfo?.approvedAt ?? fallbackDate
        : project?.approvalInfo?.approvedAt ?? '',
    approvalFileName: project?.approvalInfo?.approvalFileName ?? '',
    note: project?.approvalInfo?.note ?? '',
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
      userId: memberId,
      employeeCode: user?.employeeCode ?? '',
      fullName: user?.name ?? memberId,
      title: user?.title ?? '',
      unit: user?.unit ?? '',
      role: memberId === project.adminId ? 'PM du an' : 'Thanh vien trien khai',
      responsibility: '',
      totalPlannedHours,
      email: user?.email ?? '',
      phone: user?.phone ?? '',
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

function resolveAitsUserId(
  item: Project['personnelInfo']['aitsMembers'][number] | undefined,
  users: User[],
) {
  if (item?.userId) {
    return item.userId
  }

  const byEmail = item?.email
    ? users.find((user) => user.email.toLowerCase() === item.email.toLowerCase())
    : null

  if (byEmail) {
    return byEmail.id
  }

  const byName = item?.fullName
    ? users.find((user) => user.name.toLowerCase() === item.fullName.toLowerCase())
    : null

  return byName?.id ?? ''
}

function normalizeAitsPersonnelItems(
  items: Project['personnelInfo']['aitsMembers'] | undefined,
  users: User[],
) {
  return (items ?? []).map((item) => ({
    userId: resolveAitsUserId(item, users),
    employeeCode: item?.employeeCode ?? '',
    fullName: item?.fullName ?? '',
    title: item?.title ?? splitTitleUnit(item).title,
    unit: item?.unit ?? splitTitleUnit(item).unit,
    role: normalizePersonnelRole(item?.role),
    responsibility: item?.responsibility ?? '',
    totalPlannedHours: item?.totalPlannedHours ?? 0,
    email: item?.email ?? '',
    phone: item?.phone ?? '',
  }))
}

function normalizeExternalPersonnelItems(items?: Project['personnelInfo']['customerMembers']) {
  return (items ?? []).map((item) => ({
    fullName: item?.fullName ?? '',
    title: item?.title ?? splitTitleUnit(item).title,
    unit: item?.unit ?? splitTitleUnit(item).unit,
    role: item?.role ?? '',
    responsibility: item?.responsibility ?? '',
    email: item?.email ?? '',
    phone: item?.phone ?? '',
  }))
}

function attachAitsUserIds(
  items: Project['personnelInfo']['aitsMembers'],
  project: Project,
) {
  const availableIds = [...new Set([project.adminId, ...project.memberIds].filter(Boolean))]
  const usedIds = new Set(items.map((item) => item.userId).filter(Boolean))

  return items.map((item, index) => {
    if (item.userId) {
      return item
    }

    const looksLikePm =
      item.role.toLowerCase().includes('pm') ||
      item.title.toLowerCase().includes('project manager') ||
      index === 0

    if (looksLikePm && project.adminId && !usedIds.has(project.adminId)) {
      usedIds.add(project.adminId)
      return {
        ...item,
        userId: project.adminId,
      }
    }

    const nextId = availableIds.find((memberId) => !usedIds.has(memberId)) ?? ''

    if (nextId) {
      usedIds.add(nextId)
    }

    return {
      ...item,
      userId: nextId,
    }
  })
}

function splitTitleUnit(item: Record<string, unknown> | undefined | null): { title: string; unit: string } {
  const combined = ((item as Record<string, unknown>)?.titleUnit as string) ?? ''
  if (!combined) return { title: '', unit: '' }
  const parts = combined.split(' - ')
  return { title: parts[0]?.trim() ?? '', unit: parts.slice(1).join(' - ').trim() }
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
  const approvalInfo = createDefaultApprovalInfo(project)
  const normalizedAitsMembers = attachAitsUserIds(
    normalizeAitsPersonnelItems(project.personnelInfo?.aitsMembers, users),
    project,
  ).map((item) => {
    const resolvedUser = users.find((user) => user.id === item.userId)

    return {
      ...item,
      employeeCode: item.employeeCode || resolvedUser?.employeeCode || '',
      fullName: item.fullName || resolvedUser?.name || item.userId,
      title: item.title || resolvedUser?.title || '',
      unit: item.unit || resolvedUser?.unit || '',
      email: item.email || resolvedUser?.email || '',
      phone: item.phone || resolvedUser?.phone || '',
    }
  })
  const basisInfo = project.basisInfo
  const financialInfo = project.financialInfo
  const personnelInfo = project.personnelInfo

  return {
    ...project,
    ttkDecisionNumber: project.ttkDecisionNumber ?? '',
    createdById: project.createdById ?? approvalInfo.requestedById ?? project.adminId,
    approvalInfo,
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
      aitsMembers: normalizedAitsMembers.length
        ? normalizedAitsMembers
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
  const users = database.users.map((user) => normalizeUser(user))
  const catalogs = normalizeCatalogs(database.catalogs)

  return {
    ...database,
    users,
    catalogs,
    projects: database.projects.map((project) => normalizeProject(project, users)),
    planItems: database.planItems.map((item) => normalizePlanItem(item)),
    activityLogs: database.activityLogs ?? [],
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
  const [users, projects, planItems, worklogs, delayRaises, activityLogs, catalogs] =
    await Promise.all([
      fetchJsonFile<User[]>('/mock/users.json'),
      fetchJsonFile<Project[]>('/mock/projects.json'),
      fetchJsonFile<PlanItem[]>('/mock/plan-items.json'),
      fetchJsonFile<Worklog[]>('/mock/worklogs.json'),
      fetchJsonFile<DelayRaise[]>('/mock/delay-raises.json'),
      fetchJsonFile<import('../types').ActivityLog[]>('/mock/activity-logs.json'),
      fetchJsonFile<Catalogs>('/mock/catalogs.json'),
    ])

  return normalizeDatabase({
    users,
    projects,
    planItems,
    worklogs,
    delayRaises,
    activityLogs,
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
    const teamMembers = input.teamMembers.map((member) => ({
      ...member,
      role:
        member.userId === input.adminId
          ? 'PM du an'
          : normalizePersonnelRole(member.role || 'Thanh vien trien khai'),
      totalPlannedHours: Math.max(0, Math.round(member.totalPlannedHours)),
    }))
    const memberIds = [...new Set(teamMembers.map((member) => member.userId).filter(Boolean))]
    const personnelInfo: Project['personnelInfo'] = {
      aitsMembers: teamMembers.map((member) => {
        const user = database.users.find((item) => item.id === member.userId)

        return {
          userId: member.userId,
          employeeCode: user?.employeeCode ?? '',
          fullName: user?.name ?? member.userId,
          title: user?.title ?? '',
      unit: user?.unit ?? '',
          role: member.role,
          responsibility: '',
          totalPlannedHours: member.totalPlannedHours,
          email: user?.email ?? '',
          phone: user?.phone ?? '',
        }
      }),
      customerMembers: [],
      partners: [],
    }
    const project: Project = {
      id: createId('p'),
      code: input.code,
      name: input.name,
      summary: input.summary,
      sponsor: input.sponsor,
      department: input.department ?? 'PMO',
      objective: input.objective,
      ttkDecisionNumber: input.ttkDecisionNumber ?? '',
      createdById: input.createdById,
      adminId: input.adminId,
      memberIds,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'INITIATION',
      health: 'GREEN',
      progress: 0,
      currentPhase: 'Khởi động dự án',
      adjustedPlan: 'Chưa có điều chỉnh',
      riskSummary: 'Chưa ghi nhận rủi ro',
      approvalInfo: {
        status: 'PENDING',
        requestedById: input.createdById,
        requestFileName: input.approvalRequestFileName,
        requestSubmittedAt: new Date().toISOString(),
        approvedById: '',
        approvedAt: '',
        approvalFileName: '',
        note: '',
      },
      basisInfo: createDefaultBasisInfo(input),
      financialInfo: createDefaultFinancialInfo(),
      personnelInfo,
      documents: [],
      monthlyAllocations: [],
      risks: [],
    }

    database.projects.unshift(normalizeProject(project, database.users))
  })
}

export async function updateProject(input: UpdateProjectInput) {
  return updateDatabase((database) => {
    const existing = database.projects.find((p) => p.id === input.projectId)
    if (!existing) return

    database.projects = database.projects.map((project) =>
      project.id === input.projectId
        ? normalizeProject({ ...project, ...input.patch }, database.users)
        : project,
    )

    // Detect close/reopen
    if (input.patch.status) {
      if (input.patch.status === 'DONE' && existing.status !== 'DONE') {
        addActivityLog(database, {
          projectId: input.projectId,
          action: 'PROJECT_CLOSED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          entityName: existing.name,
          changes: [{ field: 'status', oldValue: existing.status, newValue: 'DONE' }],
        })
        return
      }
      if (input.patch.status !== 'DONE' && existing.status === 'DONE') {
        addActivityLog(database, {
          projectId: input.projectId,
          action: 'PROJECT_REOPENED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          entityName: existing.name,
          changes: [{ field: 'status', oldValue: 'DONE', newValue: input.patch.status }],
        })
        return
      }
    }

    // Detect personnel changes
    if (input.patch.personnelInfo) {
      const oldMembers = existing.personnelInfo?.aitsMembers ?? []
      const newMembers = input.patch.personnelInfo.aitsMembers ?? []
      const oldCustomers = existing.personnelInfo?.customerMembers ?? []
      const newCustomers = input.patch.personnelInfo.customerMembers ?? []
      const oldPartners = existing.personnelInfo?.partners ?? []
      const newPartners = input.patch.personnelInfo.partners ?? []

      const personnelChanges: import('../types').ActivityLogChange[] = []
      if (oldMembers.length !== newMembers.length) {
        personnelChanges.push({ field: 'aitsMembers', oldValue: `${oldMembers.length} thanh vien`, newValue: `${newMembers.length} thanh vien` })
      }
      if (oldCustomers.length !== newCustomers.length) {
        personnelChanges.push({ field: 'customerMembers', oldValue: `${oldCustomers.length} khach hang`, newValue: `${newCustomers.length} khach hang` })
      }
      if (oldPartners.length !== newPartners.length) {
        personnelChanges.push({ field: 'partners', oldValue: `${oldPartners.length} doi tac`, newValue: `${newPartners.length} doi tac` })
      }

      // Detect member detail changes even if count stays the same
      if (personnelChanges.length === 0) {
        const oldJson = JSON.stringify(oldMembers.map(m => ({ userId: m.userId, role: m.role, hours: m.totalPlannedHours })))
        const newJson = JSON.stringify(newMembers.map(m => ({ userId: m.userId, role: m.role, hours: m.totalPlannedHours })))
        if (oldJson !== newJson) {
          personnelChanges.push({ field: 'aitsMembers', oldValue: 'Thay doi chi tiet', newValue: 'Cap nhat vai tro/gio cong' })
        }
        const oldCJson = JSON.stringify(oldCustomers)
        const newCJson = JSON.stringify(newCustomers)
        if (oldCJson !== newCJson) {
          personnelChanges.push({ field: 'customerMembers', oldValue: 'Thay doi chi tiet', newValue: 'Cap nhat thong tin KH' })
        }
        const oldPJson = JSON.stringify(oldPartners)
        const newPJson = JSON.stringify(newPartners)
        if (oldPJson !== newPJson) {
          personnelChanges.push({ field: 'partners', oldValue: 'Thay doi chi tiet', newValue: 'Cap nhat thong tin doi tac' })
        }
      }

      if (personnelChanges.length > 0) {
        addActivityLog(database, {
          projectId: input.projectId,
          action: 'PERSONNEL_UPDATED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          entityName: existing.name,
          changes: personnelChanges,
        })
      }
      return
    }

    // Detect general info changes
    const trackFields = ['summary', 'sponsor', 'department', 'objective', 'startDate', 'endDate', 'status', 'health', 'currentPhase', 'adjustedPlan'] as const
    const changes: import('../types').ActivityLogChange[] = []
    for (const field of trackFields) {
      if (field in (input.patch as Record<string, unknown>)) {
        const oldVal = existing[field]
        const newVal = (input.patch as Record<string, unknown>)[field]
        if (oldVal !== newVal) {
          changes.push({ field, oldValue: String(oldVal ?? ''), newValue: String(newVal ?? '') })
        }
      }
    }

    // Detect basisInfo changes
    if (input.patch.basisInfo) {
      const oldBasis = existing.basisInfo
      const newBasis = input.patch.basisInfo
      if (oldBasis.ttkMode !== newBasis.ttkMode) {
        changes.push({ field: 'ttkMode', oldValue: oldBasis.ttkMode, newValue: newBasis.ttkMode })
      }
      if (oldBasis.deploymentMode !== newBasis.deploymentMode) {
        changes.push({ field: 'deploymentMode', oldValue: oldBasis.deploymentMode, newValue: newBasis.deploymentMode })
      }
      if (oldBasis.durationHours !== newBasis.durationHours) {
        changes.push({ field: 'durationHours', oldValue: oldBasis.durationHours, newValue: newBasis.durationHours })
      }
    }

    // Detect financialInfo changes
    if (input.patch.financialInfo) {
      const oldFin = existing.financialInfo
      const newFin = input.patch.financialInfo
      if (oldFin.revenue.amount !== newFin.revenue.amount) {
        changes.push({ field: 'revenue', oldValue: oldFin.revenue.amount, newValue: newFin.revenue.amount })
      }
      if (oldFin.internalCost.amount !== newFin.internalCost.amount) {
        changes.push({ field: 'internalCost', oldValue: oldFin.internalCost.amount, newValue: newFin.internalCost.amount })
      }
      if (oldFin.externalCost.amount !== newFin.externalCost.amount) {
        changes.push({ field: 'externalCost', oldValue: oldFin.externalCost.amount, newValue: newFin.externalCost.amount })
      }
      if (oldFin.profit.amount !== newFin.profit.amount) {
        changes.push({ field: 'profit', oldValue: oldFin.profit.amount, newValue: newFin.profit.amount })
      }
    }

    if (changes.length > 0) {
      addActivityLog(database, {
        projectId: input.projectId,
        action: 'PROJECT_INFO_UPDATED',
        entityType: 'PROJECT',
        entityId: input.projectId,
        entityName: existing.name,
        changes,
      })
    }
  })
}

export async function addProjectDocument(input: CreateDocumentInput) {
  return updateDatabase((database) => {
    const project = database.projects.find((p) => p.id === input.projectId)
    const now = new Date().toISOString()

    database.projects = database.projects.map((p) => {
      if (p.id !== input.projectId) {
        return p
      }

      return {
        ...p,
        documents: [
          {
            id: createId('doc'),
            title: input.title,
            category: input.category,
            documentNumber: '',
            description: input.description,
            url: input.url,
            uploadedBy: input.uploadedBy,
            uploadedAt: now,
            updatedBy: '',
            updatedAt: '',
          },
          ...p.documents,
        ],
      }
    })

    if (project) {
      addActivityLog(database, {
        projectId: input.projectId,
        action: 'DOCUMENT_ADDED',
        entityType: 'PROJECT',
        entityId: input.projectId,
        entityName: project.name,
        changes: [{ field: input.category, oldValue: null, newValue: input.title }],
      })
    }
  })
}

export async function updateProjectDocument(input: UpdateDocumentInput) {
  return updateDatabase((database) => {
    const project = database.projects.find((p) => p.id === input.projectId)
    const existingDoc = project?.documents.find((d) => d.id === input.documentId)

    database.projects = database.projects.map((p) => {
      if (p.id !== input.projectId) return p

      return {
        ...p,
        documents: p.documents.map((doc) =>
          doc.id === input.documentId
            ? {
                ...doc,
                title: input.title,
                category: input.category,
                documentNumber: input.documentNumber,
                description: input.description,
                url: input.url || doc.url,
                updatedBy: input.updatedBy,
                updatedAt: new Date().toISOString(),
              }
            : doc,
        ),
      }
    })

    if (project && existingDoc) {
      const changes: import('../types').ActivityLogChange[] = []
      if (existingDoc.title !== input.title) changes.push({ field: 'title', oldValue: existingDoc.title, newValue: input.title })
      if (existingDoc.category !== input.category) changes.push({ field: 'category', oldValue: existingDoc.category, newValue: input.category })
      if ((existingDoc.documentNumber ?? '') !== input.documentNumber) changes.push({ field: 'documentNumber', oldValue: existingDoc.documentNumber ?? '', newValue: input.documentNumber })

      if (changes.length > 0) {
        addActivityLog(database, {
          projectId: input.projectId,
          action: 'DOCUMENT_ADDED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          entityName: project.name,
          changes,
        })
      }
    }
  })
}

export async function deleteProjectDocument(input: DeleteDocumentInput) {
  return updateDatabase((database) => {
    const project = database.projects.find((p) => p.id === input.projectId)
    const doc = project?.documents.find((d) => d.id === input.documentId)

    database.projects = database.projects.map((p) =>
      p.id === input.projectId
        ? {
            ...p,
            documents: p.documents.filter((document) => document.id !== input.documentId),
          }
        : p,
    )

    if (project && doc) {
      addActivityLog(database, {
        projectId: input.projectId,
        action: 'DOCUMENT_DELETED',
        entityType: 'PROJECT',
        entityId: input.projectId,
        entityName: project.name,
        changes: [{ field: doc.category, oldValue: doc.title, newValue: null }],
      })
    }
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

      // Track all changes to the plan item
      const isSubtask = existing.parentId !== null
      const planChanges: import('../types').ActivityLogChange[] = []

      if (existing.plannedHours !== input.plannedHours) {
        planChanges.push({ field: 'plannedHours', oldValue: existing.plannedHours, newValue: input.plannedHours })
      }
      if (existing.name !== input.name) {
        planChanges.push({ field: 'name', oldValue: existing.name, newValue: input.name })
      }
      if (existing.startDate !== input.startDate) {
        planChanges.push({ field: 'startDate', oldValue: existing.startDate, newValue: input.startDate })
      }
      if (existing.endDate !== input.endDate) {
        planChanges.push({ field: 'endDate', oldValue: existing.endDate, newValue: input.endDate })
      }
      if (existing.status !== input.status) {
        planChanges.push({ field: 'status', oldValue: existing.status, newValue: input.status })
      }
      if (JSON.stringify(existing.assigneeIds) !== JSON.stringify(normalizeAssigneeIds(input.assigneeIds, input.assigneeId))) {
        planChanges.push({ field: 'assigneeIds', oldValue: existing.assigneeIds.join(', '), newValue: normalizeAssigneeIds(input.assigneeIds, input.assigneeId).join(', ') })
      }
      if (existing.deliverable !== input.deliverable) {
        planChanges.push({ field: 'deliverable', oldValue: existing.deliverable || null, newValue: input.deliverable || null })
      }

      if (planChanges.length > 0) {
        // Use specific HOURS_CHANGED action if only hours changed
        const onlyHoursChanged = planChanges.length === 1 && planChanges[0].field === 'plannedHours'
        addActivityLog(database, {
          projectId: input.projectId,
          action: onlyHoursChanged
            ? (isSubtask ? 'SUBTASK_HOURS_CHANGED' : 'TASK_HOURS_CHANGED')
            : (isSubtask ? 'SUBTASK_UPDATED' : 'TASK_UPDATED'),
          entityType: 'PLAN_ITEM',
          entityId: existing.id,
          entityName: existing.name,
          changes: planChanges,
        })
      }

      recalculateProjectProgress(database, input.projectId)
      return
    }

    const newId = createId('task')
    const isSubtask = input.parentId !== null

    database.planItems.unshift({
      id: newId,
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

    addActivityLog(database, {
      projectId: input.projectId,
      action: isSubtask ? 'SUBTASK_CREATED' : 'TASK_CREATED',
      entityType: 'PLAN_ITEM',
      entityId: newId,
      entityName: input.name,
      changes: [
        { field: 'plannedHours', oldValue: null, newValue: input.plannedHours },
        { field: 'startDate', oldValue: null, newValue: input.startDate },
        { field: 'endDate', oldValue: null, newValue: input.endDate },
      ],
    })

    recalculateProjectProgress(database, input.projectId)
  })
}

export async function deletePlanItem(input: DeletePlanItemInput) {
  return updateDatabase((database) => {
    const item = database.planItems.find((i) => i.id === input.planItemId)
    if (!item) return

    const isSubtask = item.parentId !== null

    // Delete the item and all its children (if it's a parent task)
    const idsToDelete = new Set([input.planItemId])
    if (!isSubtask) {
      database.planItems
        .filter((i) => i.parentId === input.planItemId)
        .forEach((child) => idsToDelete.add(child.id))
    }

    database.planItems = database.planItems.filter((i) => !idsToDelete.has(i.id))
    database.worklogs = database.worklogs.filter((w) => !idsToDelete.has(w.taskId))

    addActivityLog(database, {
      projectId: input.projectId,
      action: isSubtask ? 'SUBTASK_DELETED' : 'TASK_DELETED',
      entityType: 'PLAN_ITEM',
      entityId: input.planItemId,
      entityName: item.name,
      changes: [{
        field: 'deleted',
        oldValue: item.name,
        newValue: null,
      }],
    })

    recalculateProjectProgress(database, input.projectId)
  })
}

export async function addWorklog(input: SaveWorklogInput) {
  return updateDatabase((database) => {
    const task = database.planItems.find((item) => item.id === input.taskId)

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

    if (task) {
      addActivityLog(database, {
        projectId: input.projectId,
        action: 'WORKLOG_ADDED',
        entityType: 'PLAN_ITEM',
        entityId: input.taskId,
        entityName: task.name,
        changes: [
          { field: 'hours', oldValue: null, newValue: input.hours },
          { field: 'progress', oldValue: task.progress, newValue: input.progress },
          ...(input.progressNote ? [{ field: 'note', oldValue: null, newValue: input.progressNote }] : []),
        ],
      })
    }

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
