import dayjs from 'dayjs'
import {
  CirclePlus,
  Edit3,
  FileText,
  RefreshCcw,
  Save,
  Sparkles,
  Timer,
  Trash2,
  Workflow,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CloseFlowPanel } from '../components/CloseFlowPanel'
import { useConfirm } from '../components/ConfirmDialog'
import { EditModeBar, useEditMode } from '../components/EditModeBar'
import { GanttChart } from '../components/GanttChart'
import { useLoading } from '../components/LoadingOverlay'
import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useToast } from '../components/Toast'
import { useAppData } from '../context/AppContext'
import {
  canManageProjectPlan,
  getTaskAssigneeIds,
  getTaskPrimaryAssigneeId,
  getHealthTone,
  normalizeUserRole,
  getProjectById,
  getProjectTasks,
  getStatusTone,
} from '../lib/calculations'
import { formatDate, formatHours, formatMonthLabel, getCatalogLabel } from '../lib/formatters'
import type {
  ActivityLogAction,
  DeploymentMode,
  GanttItem,
  PlanItem,
  ProjectAitsPersonnel,
  ProjectDocument,
  ProjectExternalPersonnel,
  Project,
  ProjectFinancialInfo,
  ProjectPersonnelInfo,
  ProjectRisk,
  ProjectReferenceItem,
  RiskLevel,
  TtkMode,
  User,
} from '../types'

type ReferenceGroupKey =
  | 'outputContracts'
  | 'inputContracts'
  | 'deploymentApprovals'
  | 'projectTeamDecisions'

type FinancialFieldKey = 'revenue' | 'internalCost' | 'externalCost' | 'profit'
type ExternalPersonnelGroupKey = 'customerMembers' | 'partners'
type ProjectDocumentCategory = 'CONTRACT' | 'PROJECT_DOCUMENT' | 'SUBMISSION' | 'MEETING_MINUTES'
type ProjectDetailTab = 'PROJECT_INIT' | 'OVERVIEW' | 'PERSONNEL' | 'DOCUMENTS' | 'RISKS' | 'PLAN' | 'WORKLOAD'

const ACTION_LABELS: Record<ActivityLogAction, string> = {
  PROJECT_INFO_UPDATED: 'Cap nhat thong tin',
  PERSONNEL_UPDATED: 'Cap nhat nhan su',
  DOCUMENT_ADDED: 'Them tai lieu',
  DOCUMENT_DELETED: 'Xoa tai lieu',
  TASK_CREATED: 'Tao task',
  SUBTASK_CREATED: 'Tao subtask',
  TASK_UPDATED: 'Cap nhat task',
  SUBTASK_UPDATED: 'Cap nhat subtask',
  TASK_DELETED: 'Xoa task',
  SUBTASK_DELETED: 'Xoa subtask',
  TASK_HOURS_CHANGED: 'Doi gio task',
  SUBTASK_HOURS_CHANGED: 'Doi gio subtask',
  WORKLOG_ADDED: 'Khai bao tien do',
  PROJECT_CLOSED: 'Dong du an',
  PROJECT_REOPENED: 'Mo lai du an',
}

const ACTION_TONES: Record<ActivityLogAction, 'info' | 'danger' | 'warning' | 'success' | 'neutral'> = {
  PROJECT_INFO_UPDATED: 'info',
  PERSONNEL_UPDATED: 'info',
  DOCUMENT_ADDED: 'success',
  DOCUMENT_DELETED: 'danger',
  TASK_CREATED: 'success',
  SUBTASK_CREATED: 'success',
  TASK_UPDATED: 'info',
  SUBTASK_UPDATED: 'info',
  TASK_DELETED: 'danger',
  SUBTASK_DELETED: 'danger',
  TASK_HOURS_CHANGED: 'warning',
  SUBTASK_HOURS_CHANGED: 'warning',
  WORKLOG_ADDED: 'info',
  PROJECT_CLOSED: 'success',
  PROJECT_REOPENED: 'info',
}
type ProjectRiskStatus = ProjectRisk['status']

interface RiskFormState {
  id: string
  title: string
  cause: string
  description: string
  level: RiskLevel
  status: ProjectRiskStatus
  ownerId: string
  mitigation: string
  dueDate: string
  resolutionResult: string
  resolutionProgress: number
  nextPlan: string
  notes: string
}

interface PlanRiskPromptState {
  taskName: string
  timeline: string
  assignees: string
  draft: RiskFormState
}

const ttkModeOptions: Array<{ value: TtkMode; label: string }> = [
  { value: 'CHUYEN_TRACH', label: 'Chuyen trach' },
  { value: 'KIEM_NHIEM', label: 'Kiem nhiem' },
]

const deploymentModeOptions: Array<{ value: DeploymentMode; label: string }> = [
  { value: 'HD_PLHD', label: 'HD/PLHD' },
  { value: 'TK_THD', label: 'TK THD' },
  { value: 'NOI_BO', label: 'Noi bo' },
]

const referenceGroupLabels: Record<ReferenceGroupKey, string> = {
  outputContracts: 'Danh sach hop dong dau ra',
  inputContracts: 'Danh sach hop dong dau vao',
  deploymentApprovals: 'Phe duyet trien khai',
  projectTeamDecisions: 'Quyet dinh thanh lap to du an',
}

const projectDocumentCategories: Array<{ value: ProjectDocumentCategory; label: string }> = [
  { value: 'CONTRACT', label: 'Hop dong' },
  { value: 'PROJECT_DOCUMENT', label: 'Tai lieu du an' },
  { value: 'SUBMISSION', label: 'To trinh' },
  { value: 'MEETING_MINUTES', label: 'Bien ban hop' },
]

const riskStatusOptions: Array<{ value: ProjectRiskStatus; label: string }> = [
  { value: 'OPEN', label: 'Dang mo' },
  { value: 'WATCHING', label: 'Dang theo doi' },
  { value: 'MITIGATED', label: 'Da giam nhe' },
]

function normalizeProjectDocumentCategory(category: string): ProjectDocumentCategory {
  const normalizedCategory = category.trim().toLowerCase()

  if (normalizedCategory === 'contract' || normalizedCategory === 'hop dong') {
    return 'CONTRACT'
  }

  if (normalizedCategory === 'submission' || normalizedCategory === 'to trinh') {
    return 'SUBMISSION'
  }

  if (
    normalizedCategory === 'meeting_minutes' ||
    normalizedCategory === 'meeting minutes' ||
    normalizedCategory === 'bien ban hop'
  ) {
    return 'MEETING_MINUTES'
  }

  return 'PROJECT_DOCUMENT'
}

function cloneReferenceItems(items: ProjectReferenceItem[]) {
  return items.map((item) => ({
    name: item.name,
    note: item.note,
  }))
}

function cloneFinancialInfo(financialInfo: ProjectFinancialInfo): ProjectFinancialInfo {
  return {
    revenue: { ...financialInfo.revenue },
    internalCost: { ...financialInfo.internalCost },
    externalCost: { ...financialInfo.externalCost },
    profit: { ...financialInfo.profit },
    costSource: financialInfo.costSource,
  }
}

function cloneAitsPersonnel(items: ProjectAitsPersonnel[]) {
  return items.map((item) => ({
    userId: item.userId,
    employeeCode: item.employeeCode,
    fullName: item.fullName,
    title: item.title,
    unit: item.unit,
    role: item.role,
    responsibility: item.responsibility,
    totalPlannedHours: item.totalPlannedHours,
    email: item.email,
    phone: item.phone,
  }))
}

function cloneExternalPersonnel(items: ProjectExternalPersonnel[]) {
  return items.map((item) => ({
    fullName: item.fullName,
    title: item.title,
    unit: item.unit,
    role: item.role,
    responsibility: item.responsibility,
    email: item.email,
    phone: item.phone,
  }))
}

function createReferenceItem(): ProjectReferenceItem {
  return {
    name: '',
    note: '',
  }
}

function createAitsPersonnel(): ProjectAitsPersonnel {
  return {
    userId: '',
    employeeCode: '',
    fullName: '',
    title: '',
    unit: '',
    role: '',
    responsibility: '',
    totalPlannedHours: 0,
    email: '',
    phone: '',
  }
}

function createExternalPersonnel(): ProjectExternalPersonnel {
  return {
    fullName: '',
    title: '',
    unit: '',
    role: '',
    responsibility: '',
    email: '',
    phone: '',
  }
}

function sanitizeReferenceItems(items: ProjectReferenceItem[]) {
  return items
    .map((item) => ({
      name: item.name.trim(),
      note: item.note.trim(),
    }))
    .filter((item) => item.name || item.note)
}

function sanitizeAitsPersonnel(items: ProjectAitsPersonnel[]) {
  return items
    .map((item) => ({
      userId: item.userId,
      employeeCode: item.employeeCode.trim(),
      fullName: item.fullName.trim(),
      title: item.title.trim(),
      unit: item.unit.trim(),
      role: item.role.trim(),
      responsibility: item.responsibility.trim(),
      totalPlannedHours: Number(item.totalPlannedHours) || 0,
      email: item.email.trim(),
      phone: item.phone.trim(),
    }))
    // BA decision 12/05/2026: every AITS row must be bound to a real User
    // (userId is a valid UUID). Unbound drafts are silently dropped here so
    // the BE strict validator never rejects the whole save.
    .filter((item) => item.userId.length > 0)
}

function sanitizeExternalPersonnel(items: ProjectExternalPersonnel[]) {
  return items
    .map((item) => ({
      fullName: item.fullName.trim(),
      title: item.title.trim(),
      unit: item.unit.trim(),
      role: item.role.trim(),
      responsibility: item.responsibility.trim(),
      email: item.email.trim(),
      phone: item.phone.trim(),
    }))
    .filter(
      (item) =>
        item.fullName ||
        item.title ||
        item.unit ||
        item.role ||
        item.responsibility ||
        item.email ||
        item.phone,
    )
}

function formatCurrencyPreview(amount: number) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} VND`
}

function buildInitForm(project: Project) {
  return {
    code: project.code,
    name: project.name,
    summary: project.summary,
    sponsor: project.sponsor,
    objective: project.objective,
    ttkDecisionNumber: project.ttkDecisionNumber ?? '',
    adminId: project.adminId,
    startDate: project.startDate,
    endDate: project.endDate,
    department: project.department,
  }
}

function buildOverviewForm(project: Project) {
  return {
    summary: project.summary,
    sponsor: project.sponsor,
    objective: project.objective,
    adminId: project.adminId,
    status: project.status,
    startDate: project.startDate,
    basisInfo: {
      outputContracts: cloneReferenceItems(project.basisInfo.outputContracts),
      inputContracts: cloneReferenceItems(project.basisInfo.inputContracts),
      deploymentApprovals: cloneReferenceItems(project.basisInfo.deploymentApprovals),
      projectTeamDecisions: cloneReferenceItems(project.basisInfo.projectTeamDecisions),
      ttkMode: project.basisInfo.ttkMode,
      deploymentMode: project.basisInfo.deploymentMode,
      durationDays: project.basisInfo.durationDays,
      durationHours: project.basisInfo.durationHours,
    },
    financialInfo: cloneFinancialInfo(project.financialInfo),
  }
}

function buildPersonnelForm(project: Project): ProjectPersonnelInfo {
  return {
    aitsMembers: cloneAitsPersonnel(project.personnelInfo.aitsMembers),
    customerMembers: cloneExternalPersonnel(project.personnelInfo.customerMembers),
    partners: cloneExternalPersonnel(project.personnelInfo.partners),
  }
}

function buildDocumentForm(doc?: import('../types').ProjectDocument | null) {
  if (doc) {
    return {
      id: doc.id,
      title: doc.title,
      category: normalizeProjectDocumentCategory(doc.category) as ProjectDocumentCategory,
      documentNumber: doc.documentNumber ?? '',
      description: doc.description,
      fileName: doc.url,
    }
  }

  return {
    id: '',
    title: '',
    category: 'PROJECT_DOCUMENT' as ProjectDocumentCategory,
    documentNumber: '',
    description: '',
    fileName: '',
  }
}

function buildRiskForm(project: Project, defaultOwnerId: string, risk?: ProjectRisk | null): RiskFormState {
  if (risk) {
    return {
      id: risk.id,
      title: risk.title,
      cause: risk.cause ?? '',
      description: risk.description ?? '',
      level: risk.level,
      status: risk.status,
      ownerId: risk.ownerId,
      mitigation: risk.mitigation,
      dueDate: risk.dueDate ?? '',
      resolutionResult: risk.resolutionResult ?? '',
      resolutionProgress: risk.resolutionProgress ?? 0,
      nextPlan: risk.nextPlan ?? '',
      notes: risk.notes ?? '',
    }
  }

  return {
    id: '',
    title: '',
    cause: '',
    description: '',
    level: 'MEDIUM',
    status: 'OPEN',
    ownerId: defaultOwnerId || project.adminId,
    mitigation: '',
    dueDate: '',
    resolutionResult: '',
    resolutionProgress: 0,
    nextPlan: '',
    notes: '',
  }
}

function buildRiskDraftFromPlan(
  project: Project,
  task: ReturnType<typeof buildPlanForm>,
  assigneeNames: string,
): PlanRiskPromptState {
  const dependencyNote = task.dependencyNote.trim()
  const deliverable = task.deliverable.trim()
  const taskName = task.name.trim() || 'Task vua cap nhat'
  const mitigationParts = [
    `Danh gia lai anh huong cua thay doi ke hoach doi voi ${taskName}.`,
    deliverable ? `Deliverable lien quan: ${deliverable}.` : '',
    dependencyNote ? `Phu thuoc can luu y: ${dependencyNote}.` : '',
  ].filter(Boolean)

  return {
    taskName,
    timeline: `${formatDate(task.startDate)} - ${formatDate(task.endDate)}`,
    assignees: assigneeNames,
    draft: {
      id: '',
      title: `Rui ro thay doi ke hoach - ${taskName}`,
      cause: '',
      description: '',
      level: 'MEDIUM',
      status: 'OPEN',
      ownerId: task.assigneeId || project.adminId,
      mitigation: mitigationParts.join(' '),
      dueDate: '',
      resolutionResult: '',
      resolutionProgress: 0,
      nextPlan: '',
      notes: '',
    },
  }
}

function getRiskLevelTone(level: RiskLevel) {
  switch (level) {
    case 'HIGH':
      return 'danger'
    case 'MEDIUM':
      return 'warning'
    default:
      return 'success'
  }
}

function getRiskStatusLabel(status: ProjectRiskStatus) {
  return riskStatusOptions.find((item) => item.value === status)?.label ?? status
}

function getRiskStatusTone(status: ProjectRiskStatus) {
  switch (status) {
    case 'MITIGATED':
      return 'success'
    case 'WATCHING':
      return 'info'
    default:
      return 'warning'
  }
}

function getDocumentCategoryLabel(category: ProjectDocumentCategory) {
  return projectDocumentCategories.find((item) => item.value === category)?.label ?? 'Tai lieu'
}

function buildPlanForm(project: Project, task?: PlanItem | null) {
  if (task) {
    return {
      id: task.id,
      parentId: task.parentId ?? '',
      name: task.name,
      workType: task.workType,
      assigneeIds: getTaskAssigneeIds(task),
      assigneeId: task.assigneeId,
      status: task.status,
      baselineStartDate: task.baselineStartDate,
      baselineEndDate: task.baselineEndDate,
      startDate: task.startDate,
      endDate: task.endDate,
      progress: task.progress,
      plannedHours: task.plannedHours,
      dependencyNote: task.dependencyNote ?? '',
      deliverable: task.deliverable ?? '',
    }
  }

  return {
    id: '',
    parentId: '',
    name: '',
    workType: 'SUBTASK' as const,
    assigneeIds: project.memberIds[0] ? [project.memberIds[0]] : [],
    assigneeId: project.memberIds[0] ?? '',
    status: 'NOT_STARTED' as const,
    baselineStartDate: project.startDate,
    baselineEndDate: project.endDate,
    startDate: project.startDate,
    endDate: project.endDate,
    progress: 0,
    plannedHours: 16,
    dependencyNote: '',
    deliverable: '',
  }
}

function buildExecutionForm(task: PlanItem, memberId: string) {
  return {
    memberId,
    date: dayjs().format('YYYY-MM-DD'),
    hours: 4,
    progress: task.progress,
    progressNote: '',
  }
}

interface ScopedTaskItem {
  task: PlanItem
  depth: number
}

function getRootTask(tasks: PlanItem[], task: PlanItem | null) {
  if (!task) {
    return null
  }

  const byId = new Map(tasks.map((item) => [item.id, item]))
  let current = task

  while (current.parentId) {
    const parent = byId.get(current.parentId)

    if (!parent) {
      break
    }

    current = parent
  }

  return current
}

function getDescendantTasks(
  tasks: PlanItem[],
  parentId: string,
  depth = 0,
): ScopedTaskItem[] {
  const children = tasks
    .filter((task) => task.parentId === parentId)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))

  return children.flatMap((child) => [
    { task: child, depth },
    ...getDescendantTasks(tasks, child.id, depth + 1),
  ])
}

function buildScopedGanttItems(
  items: ScopedTaskItem[],
  allTasks: PlanItem[],
  getAssigneeNames: (task: PlanItem) => string,
): GanttItem[] {
  return items.map(({ task, depth }) => {
    const childCount = allTasks.filter((t) => t.parentId === task.id).length
    return {
      id: task.id,
      label: task.name,
      sublabel: `${getAssigneeNames(task)} | ${task.deliverable || 'Dang cap nhat deliverable'}`,
      startDate: task.startDate,
      endDate: task.endDate,
      progress: task.progress,
      status: task.status,
      depth,
      childCount,
      workType: task.workType,
    }
  })
}

/* ═══════ Workload helpers (moved from WorkloadPage) ═══════ */

interface ResolvedAitsMember {
  memberId: string
  user: User
  personnel: ProjectAitsPersonnel
}

function getEstimatedProjectEndDate(project: Project) {
  if (project.basisInfo.durationDays > 0) {
    return dayjs(project.startDate).add(project.basisInfo.durationDays - 1, 'day')
  }
  return dayjs(project.endDate)
}

function getProjectAllocationMonths(project: Project) {
  const startMonth = dayjs(project.startDate).startOf('month')
  const endMonth = getEstimatedProjectEndDate(project).startOf('month')
  const months: string[] = []
  let cursor = startMonth
  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, 'month')) {
    months.push(cursor.format('YYYY-MM'))
    cursor = cursor.add(1, 'month')
  }
  return months
}

/**
 * Resolve an AITS personnel row to its real User record. Since BA decision
 * 12/05/2026, every AITS member MUST have a userId — the BE rejects rows
 * lacking it. The old email/fullName fallback chain has been removed.
 */
function resolveAitsUser(personnel: ProjectAitsPersonnel, allUsers: User[]) {
  if (!personnel.userId) return null
  return allUsers.find((user) => user.id === personnel.userId) ?? null
}

function buildFallbackAitsPersonnel(
  user: User,
  project: Project,
  totalPlannedHours: number,
): ProjectAitsPersonnel {
  return {
    userId: user.id,
    fullName: user.name,
    title: user.title,
    unit: user.unit,
    role: user.id === project.adminId ? 'PM du an' : 'Thanh vien trien khai',
    responsibility: '',
    totalPlannedHours,
    email: user.email,
    phone: user.phone,
    employeeCode: user.employeeCode,
  }
}

function distributeHoursEvenly(totalHours: number, months: string[]) {
  if (!months.length) return {}
  const safeTotal = Math.max(0, Math.round(totalHours))
  const base = Math.floor(safeTotal / months.length)
  const remainder = safeTotal % months.length
  return months.reduce<Record<string, number>>((acc, month, i) => {
    acc[month] = base + (i < remainder ? 1 : 0)
    return acc
  }, {})
}

function buildAllocationKey(memberId: string, month: string) {
  return `${memberId}:${month}`
}

function buildProjectDraftAllocations(
  project: Project,
  members: ResolvedAitsMember[],
  months: string[],
) {
  const nextDraft: Record<string, number> = {}
  const monthSet = new Set(months)
  members.forEach((member) => {
    const savedAllocations = project.monthlyAllocations.filter(
      (a) => a.memberId === member.memberId && monthSet.has(a.month),
    )
    const savedTotal = savedAllocations.reduce((sum, a) => sum + a.hours, 0)
    const targetTotal = Math.max(0, Math.round(member.personnel.totalPlannedHours))
    const hoursByMonth =
      savedAllocations.length > 0 && savedTotal === targetTotal
        ? months.reduce<Record<string, number>>((acc, month) => {
            acc[month] = savedAllocations.find((a) => a.month === month)?.hours ?? 0
            return acc
          }, {})
        : distributeHoursEvenly(targetTotal, months)
    months.forEach((month) => {
      nextDraft[buildAllocationKey(member.memberId, month)] = hoursByMonth[month] ?? 0
    })
  })
  return nextDraft
}

/* ═══════ Main component ═══════ */

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const {
    currentUser,
    users,
    projects,
    planItems,
    worklogs,
    catalogs,
    updateProject,
    addProjectDocument,
    updateProjectDocument,
    deleteProjectDocument,
    savePlanItem,
    deletePlanItem,
    saveRisk,
    deleteRisk,
    addWorklog,
    activityLogs: allActivityLogs,
    getUser,
  } = useAppData()
  // BA decision 13/05/2026: replace inline form messages with bottom-right
  // toast pops, use a confirmation modal in place of window.confirm, and show
  // a global loading overlay while mutations are in flight.
  const toast = useToast()
  const { confirm } = useConfirm()
  const loading = useLoading()
  const initEdit = useEditMode()
  const overviewEdit = useEditMode()
  const personnelEdit = useEditMode()
  const project = getProjectById(projects, projectId)
  const projectActivityLogs = (allActivityLogs ?? []).filter(
    (log) => log.projectId === projectId,
  )
  const overviewLogs = projectActivityLogs.filter((l) =>
    (['PROJECT_INFO_UPDATED', 'PROJECT_CLOSED', 'PROJECT_REOPENED'] as string[]).includes(l.action),
  )
  const personnelLogs = projectActivityLogs.filter((l) => l.action === 'PERSONNEL_UPDATED')
  const documentLogs = projectActivityLogs.filter((l) =>
    (['DOCUMENT_ADDED', 'DOCUMENT_DELETED'] as string[]).includes(l.action),
  )
  const planLogs = projectActivityLogs.filter((l) =>
    ([
      'TASK_CREATED', 'SUBTASK_CREATED', 'TASK_UPDATED', 'SUBTASK_UPDATED',
      'TASK_DELETED', 'SUBTASK_DELETED', 'TASK_HOURS_CHANGED', 'SUBTASK_HOURS_CHANGED',
      'WORKLOG_ADDED',
    ] as string[]).includes(l.action),
  )

  const [message, setMessage] = useState('')
  const [initForm, setInitForm] = useState<ReturnType<typeof buildInitForm> | null>(null)
  const [overviewForm, setOverviewForm] = useState<ReturnType<typeof buildOverviewForm> | null>(null)
  const [personnelForm, setPersonnelForm] = useState<ReturnType<typeof buildPersonnelForm> | null>(null)
  const [documentForm, setDocumentForm] = useState<ReturnType<typeof buildDocumentForm> | null>(null)
  const [planForm, setPlanForm] = useState<ReturnType<typeof buildPlanForm> | null>(null)
  const [riskForm, setRiskForm] = useState<RiskFormState | null>(null)
  const [riskSummaryDraft, setRiskSummaryDraft] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [executionForm, setExecutionForm] = useState<ReturnType<typeof buildExecutionForm> | null>(null)
  const [documentInputKey, setDocumentInputKey] = useState(0)
  const [activeDetailTab, setActiveDetailTab] = useState<ProjectDetailTab>('PROJECT_INIT')
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false)
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false)
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false)
  const [planRiskPrompt, setPlanRiskPrompt] = useState<PlanRiskPromptState | null>(null)

  const projectTasks = project ? getProjectTasks(planItems, project.id) : []
  const overviewTasks = projectTasks.filter((task) => task.parentId === null)
  const selectedTask =
    projectTasks.find((task) => task.id === selectedTaskId) ?? overviewTasks[0] ?? projectTasks[0] ?? null
  const focusedOverviewTask = getRootTask(projectTasks, selectedTask)
  const selectedTaskAssigneeIds = selectedTask ? getTaskAssigneeIds(selectedTask) : []
  const getTaskAssigneeNames = (task: PlanItem) =>
    getTaskAssigneeIds(task)
      .map((assigneeId) => getUser(assigneeId)?.name ?? assigneeId)
      .join(', ')
  const overviewGanttItems = buildScopedGanttItems(
    overviewTasks.map((task) => ({ task, depth: 0 })),
    projectTasks,
    (task) => getTaskAssigneeNames(task) || 'Chua phan cong',
  )
  const focusedSubtaskItems = focusedOverviewTask
    ? getDescendantTasks(projectTasks, focusedOverviewTask.id)
    : []
  const focusedSubtaskGanttItems = buildScopedGanttItems(
    focusedSubtaskItems,
    projectTasks,
    (task) => getTaskAssigneeNames(task) || 'Chua phan cong',
  )
  const groupedProjectDocuments = projectDocumentCategories.map((category) => ({
    ...category,
    items: project
      ? project.documents
          .filter((document) => normalizeProjectDocumentCategory(document.category) === category.value)
          .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
      : [],
  }))

  useEffect(() => {
    if (!project) {
      return
    }

    setInitForm(buildInitForm(project))
    setOverviewForm(buildOverviewForm(project))
    setPersonnelForm(buildPersonnelForm(project))
    setDocumentForm(buildDocumentForm())
    setPlanForm(buildPlanForm(project))
    setRiskForm(buildRiskForm(project, currentUser?.id ?? project.adminId))
    setRiskSummaryDraft(project.riskSummary)
    setDocumentInputKey((current) => current + 1)
    setIsRiskModalOpen(false)
    setPlanRiskPrompt(null)
    // Reset edit-mode flags when switching between projects.
    initEdit.exit()
    overviewEdit.exit()
    personnelEdit.exit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, project?.id])

  useEffect(() => {
    if (!selectedTask) {
      return
    }

    if (!selectedTaskId) {
      setSelectedTaskId(selectedTask.id)
      return
    }

    const defaultMemberId =
      currentUser && getTaskAssigneeIds(selectedTask).includes(currentUser.id)
        ? currentUser.id
        : getTaskPrimaryAssigneeId(selectedTask)

    setExecutionForm(buildExecutionForm(selectedTask, defaultMemberId))
  }, [currentUser, project, selectedTask, selectedTaskId])

  if (
    !project ||
    !currentUser ||
    !initForm ||
    !overviewForm ||
    !personnelForm ||
    !documentForm ||
    !planForm
  ) {
    return (
      <div className="page-grid">
        <section className="panel empty-panel">
          <h3>Khong tim thay du an</h3>
          <p>Du an khong ton tai.</p>
          <Link to="/projects" className="secondary-button">
            Quay lai
          </Link>
        </section>
      </div>
    )
  }

  const normalizedRole = normalizeUserRole(currentUser.role)
  const canManageProject = normalizedRole === 'PMO' || currentUser.id === project.adminId
  const canManagePlan = canManageProjectPlan(project, currentUser)
  // Whether the read-only tab has been switched into edit mode — drives both
  // the disabled cascade on inputs AND the visibility of row-level "Thêm" /
  // "Xoá" action buttons (user feedback 13/05/2026: action buttons must be
  // hidden, not just disabled, while reading).
  const overviewEditable = canManageProject && overviewEdit.isEditing
  const personnelEditable = canManageProject && personnelEdit.isEditing

  /**
   * Removing a personnel row only mutates draft state (the actual write
   * happens on Save), but we still ask for confirmation so a stray click
   * doesn't silently drop a row the user filled in.
   */
  async function confirmRemoveAitsRow(index: number) {
    const member = personnelForm?.aitsMembers[index]
    const ok = await confirm({
      title: 'Xoá thành viên AITS khỏi dự án?',
      description: member?.fullName
        ? `Thành viên "${member.fullName}" sẽ bị gỡ khỏi danh sách. Thay đổi chưa lưu — bấm "Lưu thay đổi" để xác nhận.`
        : 'Dòng này sẽ bị gỡ khỏi danh sách. Thay đổi chưa lưu — bấm "Lưu thay đổi" để xác nhận.',
      tone: 'danger',
      confirmLabel: 'Xoá khỏi danh sách',
    })
    if (ok) removeAitsPersonnelItem(index)
  }

  async function confirmRemoveExternalRow(
    group: ExternalPersonnelGroupKey,
    index: number,
  ) {
    const member = personnelForm?.[group][index]
    const groupLabel = group === 'customerMembers' ? 'khách hàng' : 'đối tác'
    const ok = await confirm({
      title: `Xoá ${groupLabel} khỏi dự án?`,
      description: member?.fullName
        ? `"${member.fullName}" sẽ bị gỡ khỏi danh sách. Thay đổi chưa lưu — bấm "Lưu thay đổi" để xác nhận.`
        : `Dòng này sẽ bị gỡ khỏi danh sách. Thay đổi chưa lưu — bấm "Lưu thay đổi" để xác nhận.`,
      tone: 'danger',
      confirmLabel: 'Xoá khỏi danh sách',
    })
    if (ok) removeExternalPersonnelItem(group, index)
  }

  async function confirmRemoveReferenceItem(
    group: ReferenceGroupKey,
    index: number,
  ) {
    const ok = await confirm({
      title: 'Xoá mục tài liệu căn cứ?',
      description: 'Dòng này sẽ bị gỡ khỏi danh sách. Thay đổi chưa lưu — bấm "Lưu thay đổi" để xác nhận.',
      tone: 'danger',
      confirmLabel: 'Xoá khỏi danh sách',
    })
    if (ok) removeReferenceItemFromGroup(group, index)
  }
  const canUpdateSelectedTask =
    !!selectedTask &&
    (canManagePlan || getTaskAssigneeIds(selectedTask).includes(currentUser.id))
  const canCreateChildForSelectedTask = !!selectedTask && canManagePlan
  const isCreatingChildTask = !!planForm.parentId && !planForm.id
  const canOpenPlanModal =
    canManagePlan || (isCreatingChildTask && canCreateChildForSelectedTask)
  const canSubmitPlanForm =
    canManagePlan || (isCreatingChildTask && canCreateChildForSelectedTask)
  const selectedTaskWorklogs = selectedTask
    ? worklogs
        .filter((item) => item.taskId === selectedTask.id)
        .sort((left, right) => right.date.localeCompare(left.date))
    : []
  const projectManagers = users.filter(
    (user) => normalizeUserRole(user.role) === 'PM',
  )
  const sponsorUsers = users.filter((user) => normalizeUserRole(user.role) !== 'DELIVERY_MEMBER')
  const projectRiskItems = [...project.risks].sort((left, right) =>
    right.lastUpdated.localeCompare(left.lastUpdated),
  )
  const openRiskCount = projectRiskItems.filter((risk) => risk.status !== 'MITIGATED').length
  const highRiskCount = projectRiskItems.filter(
    (risk) => risk.level === 'HIGH' && risk.status !== 'MITIGATED',
  ).length
  const mitigatedRiskCount = projectRiskItems.filter((risk) => risk.status === 'MITIGATED').length
  const riskOwnerIds = Array.from(
    new Set(
      [
        project.adminId,
        project.createdById,
        currentUser.id,
        ...project.memberIds,
        ...project.personnelInfo.aitsMembers.map((member) => member.userId).filter(Boolean),
        ...projectRiskItems.map((risk) => risk.ownerId),
      ].filter(Boolean),
    ),
  )
  const totalDocumentCount = project.documents.length
  const detailTabs: Array<{ id: ProjectDetailTab; label: string; note: string }> = [
    {
      id: 'PROJECT_INIT',
      label: 'Thong tin khoi tao',
      note: `${project.code} | ${getUser(project.createdById)?.name ?? 'N/A'}`,
    },
    {
      id: 'OVERVIEW',
      label: 'Overview',
      note: `${getUser(overviewForm.adminId)?.name ?? 'Chua phan cong'} | ${formatDate(overviewForm.startDate)}`,
    },
    {
      id: 'PERSONNEL',
      label: 'Nhan su',
      note: `${personnelForm.aitsMembers.length} AITS | ${personnelForm.customerMembers.length} KH | ${personnelForm.partners.length} doi tac`,
    },
    {
      id: 'DOCUMENTS',
      label: 'Tai lieu',
      note: `${totalDocumentCount} tep | ${groupedProjectDocuments[0]?.items.length ?? 0} hop dong`,
    },
    {
      id: 'RISKS',
      label: 'Quan ly rui ro',
      note: `${openRiskCount} dang mo | ${highRiskCount} muc cao`,
    },
    {
      id: 'PLAN',
      label: 'Ke hoach',
      note: `${projectTasks.length} task | ${selectedTask ? `Focus: ${selectedTask.name}` : 'Chua co task'}`,
    },
    ...(canManageProject
      ? [
          {
            id: 'WORKLOAD' as ProjectDetailTab,
            label: 'Phan bo gio cong',
            note: `${project.monthlyAllocations.length} phan bo`,
          },
        ]
      : []),
  ]

  function updateAitsPersonnelItem(
    index: number,
    field: keyof ProjectAitsPersonnel,
    value: string | number,
  ) {
    setPersonnelForm((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        aitsMembers: current.aitsMembers.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item,
        ),
      }
    })
  }

  /**
   * Bind an AITS personnel row to a real User. Required since BA decision
   * 12/05/2026: free-text entries are no longer allowed; identity fields
   * (name/title/unit/email/phone/employeeCode) are derived from the User
   * record. Only role / responsibility / totalPlannedHours stay editable.
   */
  function bindAitsPersonnelUser(index: number, userId: string) {
    const picked = users.find((u) => u.id === userId)
    if (!picked) return
    setPersonnelForm((current) => {
      if (!current) return current
      return {
        ...current,
        aitsMembers: current.aitsMembers.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                userId: picked.id,
                employeeCode: picked.employeeCode,
                fullName: picked.name,
                title: picked.title,
                unit: picked.unit,
                email: picked.email,
                phone: picked.phone,
              }
            : item,
        ),
      }
    })
  }

  function updateExternalPersonnelItem(
    group: ExternalPersonnelGroupKey,
    index: number,
    field: keyof ProjectExternalPersonnel,
    value: string,
  ) {
    setPersonnelForm((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [group]: current[group].map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item,
        ),
      }
    })
  }

  function addAitsPersonnelItem() {
    setPersonnelForm((current) =>
      current
        ? {
            ...current,
            aitsMembers: [...current.aitsMembers, createAitsPersonnel()],
          }
        : current,
    )
  }

  function addExternalPersonnelItem(group: ExternalPersonnelGroupKey) {
    setPersonnelForm((current) =>
      current
        ? {
            ...current,
            [group]: [...current[group], createExternalPersonnel()],
          }
        : current,
    )
  }

  function removeAitsPersonnelItem(index: number) {
    setPersonnelForm((current) =>
      current
        ? {
            ...current,
            aitsMembers: current.aitsMembers.filter((_, itemIndex) => itemIndex !== index),
          }
        : current,
    )
  }

  function removeExternalPersonnelItem(group: ExternalPersonnelGroupKey, index: number) {
    setPersonnelForm((current) =>
      current
        ? {
            ...current,
            [group]: current[group].filter((_, itemIndex) => itemIndex !== index),
          }
        : current,
    )
  }

  function updateReferenceGroup(
    group: ReferenceGroupKey,
    recipe: (items: ProjectReferenceItem[]) => ProjectReferenceItem[],
  ) {
    setOverviewForm((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        basisInfo: {
          ...current.basisInfo,
          [group]: recipe(current.basisInfo[group]),
        },
      }
    })
  }

  function addReferenceItemToGroup(group: ReferenceGroupKey) {
    updateReferenceGroup(group, (items) => [...items, createReferenceItem()])
  }

  function removeReferenceItemFromGroup(group: ReferenceGroupKey, index: number) {
    updateReferenceGroup(group, (items) => items.filter((_, itemIndex) => itemIndex !== index))
  }

  function updateReferenceItemField(
    group: ReferenceGroupKey,
    index: number,
    field: keyof ProjectReferenceItem,
    value: string,
  ) {
    updateReferenceGroup(group, (items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  }

  function updateFinancialField(
    field: FinancialFieldKey,
    key: keyof ProjectFinancialInfo[FinancialFieldKey],
    value: string | number,
  ) {
    setOverviewForm((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        financialInfo: {
          ...current.financialInfo,
          [field]: {
            ...current.financialInfo[field],
            [key]: value,
          },
        },
      }
    })
  }

  function renderReferenceEditor(group: ReferenceGroupKey) {
    const items = overviewForm?.basisInfo[group] ?? []

    return (
      <div className="overview-reference-card">
        <div className="overview-section__toolbar">
          <div>
            <strong>{referenceGroupLabels[group]}</strong>
            <p>Tai lieu va ghi chu</p>
          </div>
          {overviewEditable ? (
            <button
              type="button"
              className="ghost-button ghost-button--compact"
              onClick={() => addReferenceItemToGroup(group)}
            >
              <CirclePlus size={15} />
              Them muc
            </button>
          ) : null}
        </div>

        {items.length ? (
          <div className="overview-reference-list">
            {items.map((item, index) => (
              <div key={`${group}-${index}`} className="overview-reference-item">
                <label>
                  <span>Ten tai lieu</span>
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateReferenceItemField(group, index, 'name', event.target.value)
                    }
                    disabled={!canManageProject}
                  />
                </label>
                <label className="span-2">
                  <span>Ghi chu</span>
                  <input
                    value={item.note}
                    onChange={(event) =>
                      updateReferenceItemField(group, index, 'note', event.target.value)
                    }
                    disabled={!canManageProject}
                  />
                </label>
                {overviewEditable ? (
                  <button
                    type="button"
                    className="ghost-button ghost-button--compact overview-reference-item__remove"
                    onClick={() => void confirmRemoveReferenceItem(group, index)}
                  >
                    <Trash2 size={14} /> Xoa
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="overview-empty-note">
            <p>Chua co du lieu.</p>
          </div>
        )}
      </div>
    )
  }

  async function handlePersonnelSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!personnelForm || !project) return
    const ok = await confirm({
      title: 'Lưu thông tin nhân sự?',
      description: 'Toàn bộ thay đổi nhân sự AITS / KH / Đối tác sẽ được lưu và ghi vào lịch sử thao tác.',
      tone: 'primary',
      confirmLabel: 'Lưu thay đổi',
    })
    if (!ok) return

    const sanitizedPersonnel: ProjectPersonnelInfo = {
      aitsMembers: sanitizeAitsPersonnel(personnelForm.aitsMembers),
      customerMembers: sanitizeExternalPersonnel(personnelForm.customerMembers),
      partners: sanitizeExternalPersonnel(personnelForm.partners),
    }

    await personnelEdit.withSave(async () => {
      try {
        await loading.run('Đang lưu thông tin nhân sự…', () =>
          updateProject({ projectId: project.id, patch: { personnelInfo: sanitizedPersonnel } }),
        )
        setPersonnelForm(sanitizedPersonnel)
        toast.success('Đã cập nhật thông tin nhân sự dự án')
      } catch (err) {
        toast.error('Không lưu được thông tin nhân sự', err instanceof Error ? err.message : '')
        throw err
      }
    })
  }

  async function handleInitSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !initForm) return
    const ok = await confirm({
      title: 'Lưu thông tin khởi tạo?',
      description: 'Các thay đổi được ghi vào lịch sử thao tác của dự án.',
      tone: 'primary',
      confirmLabel: 'Lưu thay đổi',
    })
    if (!ok) return

    await initEdit.withSave(async () => {
      try {
        await loading.run('Đang lưu thông tin khởi tạo…', () =>
          updateProject({
            projectId: project.id,
            patch: {
              summary: initForm.summary.trim(),
              sponsor: initForm.sponsor,
              objective: initForm.objective.trim(),
              ttkDecisionNumber: initForm.ttkDecisionNumber.trim(),
              adminId: initForm.adminId,
              startDate: initForm.startDate,
              endDate: initForm.endDate,
            },
          }),
        )
        toast.success('Đã cập nhật thông tin khởi tạo dự án')
      } catch (err) {
        toast.error('Không lưu được thông tin khởi tạo', err instanceof Error ? err.message : '')
        throw err
      }
    })
  }

  async function handleOverviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !overviewForm) return
    const ok = await confirm({
      title: 'Lưu thông tin chung?',
      description: 'Các thay đổi được ghi vào lịch sử thao tác. Bao gồm: cơ sở căn cứ, tài chính, hình thức TTK.',
      tone: 'primary',
      confirmLabel: 'Lưu thay đổi',
    })
    if (!ok) return

    const sanitizedOverview = {
      ...overviewForm,
      summary: overviewForm.summary.trim(),
      sponsor: overviewForm.sponsor,
      objective: overviewForm.objective.trim(),
      basisInfo: {
        ...overviewForm.basisInfo,
        outputContracts: sanitizeReferenceItems(overviewForm.basisInfo.outputContracts),
        inputContracts: sanitizeReferenceItems(overviewForm.basisInfo.inputContracts),
        deploymentApprovals: sanitizeReferenceItems(overviewForm.basisInfo.deploymentApprovals),
        projectTeamDecisions: sanitizeReferenceItems(overviewForm.basisInfo.projectTeamDecisions),
        durationDays: Number(overviewForm.basisInfo.durationDays) || 0,
        durationHours: Number(overviewForm.basisInfo.durationHours) || 0,
      },
      financialInfo: {
        revenue: {
          amount: Number(overviewForm.financialInfo.revenue.amount) || 0,
          note: overviewForm.financialInfo.revenue.note.trim(),
        },
        internalCost: {
          amount: Number(overviewForm.financialInfo.internalCost.amount) || 0,
          note: overviewForm.financialInfo.internalCost.note.trim(),
        },
        externalCost: {
          amount: Number(overviewForm.financialInfo.externalCost.amount) || 0,
          note: overviewForm.financialInfo.externalCost.note.trim(),
        },
        profit: {
          amount: Number(overviewForm.financialInfo.profit.amount) || 0,
          note: overviewForm.financialInfo.profit.note.trim(),
        },
        costSource: overviewForm.financialInfo.costSource.trim(),
      },
    }

    await overviewEdit.withSave(async () => {
      try {
        await loading.run('Đang lưu thông tin chung…', () =>
          updateProject({ projectId: project.id, patch: sanitizedOverview }),
        )
        setOverviewForm(sanitizedOverview)
        toast.success('Đã cập nhật thông tin chung dự án')
      } catch (err) {
        toast.error('Không lưu được thông tin chung', err instanceof Error ? err.message : '')
        throw err
      }
    })
  }

  async function handleDocumentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !currentUser || !documentForm) return
    if (!canManageProject) {
      toast.error('Không có quyền', 'Bạn không có quyền cập nhật tài liệu của dự án này.')
      return
    }
    if (!documentForm.id && !documentForm.fileName) {
      toast.warning('Thiếu file tài liệu', 'Hãy chọn file trước khi thêm mới.')
      return
    }
    const ok = await confirm({
      title: documentForm.id ? 'Cập nhật tài liệu?' : 'Thêm tài liệu mới?',
      description: documentForm.id
        ? 'Thay đổi sẽ được ghi vào lịch sử tài liệu.'
        : 'Tài liệu sẽ được lưu vào danh mục của dự án.',
      tone: 'primary',
      confirmLabel: documentForm.id ? 'Lưu thay đổi' : 'Thêm tài liệu',
    })
    if (!ok) return

    try {
      if (documentForm.id) {
        await loading.run('Đang lưu tài liệu…', () =>
          updateProjectDocument({
            projectId: project.id,
            documentId: documentForm.id,
            title: documentForm.title.trim() || documentForm.fileName,
            category: documentForm.category,
            documentNumber: documentForm.documentNumber.trim(),
            description: documentForm.description.trim(),
            url: documentForm.fileName,
            updatedBy: currentUser.id,
          }),
        )
        toast.success('Đã cập nhật tài liệu')
      } else {
        await loading.run('Đang thêm tài liệu…', () =>
          addProjectDocument({
            projectId: project.id,
            title: documentForm.title.trim() || documentForm.fileName,
            category: documentForm.category,
            description: documentForm.description.trim(),
            url: documentForm.fileName,
            uploadedBy: currentUser.id,
          }),
        )
        toast.success('Đã thêm tài liệu vào danh mục dự án')
      }
      setDocumentForm(buildDocumentForm())
      setDocumentInputKey((current) => current + 1)
      setIsDocumentModalOpen(false)
    } catch (err) {
      toast.error('Không lưu được tài liệu', err instanceof Error ? err.message : '')
    }
  }

  async function handleDeleteDocument(document: ProjectDocument) {
    if (!project) return
    if (!canManageProject) {
      toast.error('Không có quyền', 'Bạn không có quyền xóa tài liệu của dự án này.')
      return
    }
    const ok = await confirm({
      title: `Xóa tài liệu "${document.title}"?`,
      description: 'Hành động này không thể hoàn tác. Tệp đính kèm sẽ bị gỡ khỏi danh mục dự án.',
      tone: 'danger',
      confirmLabel: 'Xóa tài liệu',
    })
    if (!ok) return

    try {
      await loading.run('Đang xóa tài liệu…', () =>
        deleteProjectDocument({ projectId: project.id, documentId: document.id }),
      )
      toast.success('Đã xóa tài liệu', document.title)
    } catch (err) {
      toast.error('Không xóa được tài liệu', err instanceof Error ? err.message : '')
    }
  }

  async function handleDeletePlanItem(item: PlanItem) {
    if (!project || !canManagePlan) return
    const ok = await confirm({
      title: `Xóa task "${item.name}"?`,
      description: 'Subtask, worklog và yêu cầu re-plan liên quan sẽ bị xóa theo (cascade). Không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xóa task',
    })
    if (!ok) return

    try {
      await loading.run('Đang xóa task…', () =>
        deletePlanItem({ planItemId: item.id, projectId: project.id }),
      )
      if (selectedTaskId === item.id) setSelectedTaskId('')
      toast.success('Đã xóa task', item.name)
    } catch (err) {
      toast.error('Không xóa được task', err instanceof Error ? err.message : '')
    }
  }

  async function handleRiskSummarySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project) return
    if (!canManagePlan) {
      toast.error('Không có quyền', 'Bạn không có quyền cập nhật tổng quan rủi ro của dự án này.')
      return
    }
    const ok = await confirm({
      title: 'Lưu tổng quan rủi ro?',
      tone: 'primary',
      confirmLabel: 'Lưu thay đổi',
    })
    if (!ok) return

    try {
      await loading.run('Đang lưu tổng quan rủi ro…', () =>
        updateProject({
          projectId: project.id,
          patch: { riskSummary: riskSummaryDraft.trim() },
        }),
      )
      toast.success('Đã cập nhật tổng quan rủi ro')
    } catch (err) {
      toast.error('Không lưu được tổng quan rủi ro', err instanceof Error ? err.message : '')
    }
  }

  async function handleRiskSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !currentUser || !riskForm) return
    if (!canManagePlan) {
      toast.error('Không có quyền', 'Bạn không có quyền cập nhật rủi ro của dự án này.')
      return
    }
    const ok = await confirm({
      title: riskForm.id ? 'Cập nhật rủi ro?' : 'Thêm rủi ro mới?',
      tone: 'primary',
      confirmLabel: riskForm.id ? 'Lưu thay đổi' : 'Thêm rủi ro',
    })
    if (!ok) return

    try {
      await loading.run('Đang lưu rủi ro…', () =>
        saveRisk({
          projectId: project.id,
          id: riskForm.id || undefined,
          title: riskForm.title.trim(),
          cause: riskForm.cause.trim(),
          description: riskForm.description.trim(),
          level: riskForm.level,
          status: riskForm.status,
          ownerId: riskForm.ownerId,
          mitigation: riskForm.mitigation.trim(),
          dueDate: riskForm.dueDate || null,
          resolutionResult: riskForm.resolutionResult.trim(),
          resolutionProgress: Number(riskForm.resolutionProgress) || 0,
          nextPlan: riskForm.nextPlan.trim(),
          notes: riskForm.notes.trim(),
        }),
      )
      setIsRiskModalOpen(false)
      setPlanRiskPrompt(null)
      setRiskForm(buildRiskForm(project, currentUser.id))
      toast.success(riskForm.id ? 'Đã cập nhật rủi ro' : 'Đã thêm rủi ro mới')
    } catch (err) {
      toast.error('Không lưu được rủi ro', err instanceof Error ? err.message : '')
    }
  }

  async function handleRiskDelete() {
    if (!project || !riskForm?.id) return
    const ok = await confirm({
      title: 'Xóa rủi ro này?',
      description: 'Lịch sử thao tác sẽ được giữ. Hành động không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xóa rủi ro',
    })
    if (!ok) return

    try {
      await loading.run('Đang xóa rủi ro…', () =>
        deleteRisk({ projectId: project.id, riskId: riskForm.id }),
      )
      setIsRiskModalOpen(false)
      setRiskForm(buildRiskForm(project, currentUser?.id ?? project.adminId))
      toast.success('Đã xóa rủi ro')
    } catch (err) {
      toast.error('Không xóa được rủi ro', err instanceof Error ? err.message : '')
    }
  }

  async function handlePlanSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !currentUser || !planForm) return

    if (!canSubmitPlanForm) {
      toast.error('Không có quyền', 'Bạn không có quyền tạo hoặc cập nhật task này.')
      return
    }
    if (!planForm.assigneeIds.length) {
      toast.warning('Thiếu nhân sự', 'Hãy chọn ít nhất một nhân sự tham gia task.')
      return
    }

    const submittedPlan = { ...planForm }
    const ok = await confirm({
      title: submittedPlan.id ? 'Cập nhật task?' : 'Tạo task mới?',
      description: submittedPlan.parentId
        ? 'Task này thuộc về một task cha trong kế hoạch.'
        : 'Task tổng quan sẽ được thêm vào kế hoạch triển khai.',
      tone: 'primary',
      confirmLabel: submittedPlan.id ? 'Lưu thay đổi' : 'Tạo task',
    })
    if (!ok) return

    try {
      await loading.run('Đang lưu task…', () =>
        savePlanItem({
          id: submittedPlan.id || undefined,
          projectId: project.id,
          parentId: submittedPlan.parentId || null,
          name: submittedPlan.name,
          workType: submittedPlan.parentId ? 'SUBTASK' : submittedPlan.workType,
          ownerId: project.adminId,
          assigneeId: submittedPlan.assigneeId || submittedPlan.assigneeIds[0],
          assigneeIds: submittedPlan.assigneeIds,
          status: submittedPlan.status,
          baselineStartDate: submittedPlan.baselineStartDate || submittedPlan.startDate,
          baselineEndDate: submittedPlan.baselineEndDate || submittedPlan.endDate,
          startDate: submittedPlan.startDate,
          endDate: submittedPlan.endDate,
          progress: Number(submittedPlan.progress),
          plannedHours: Number(submittedPlan.plannedHours),
          monthAllocations: [],
          dependencyNote: submittedPlan.dependencyNote,
          deliverable: submittedPlan.deliverable,
        }),
      )

      const assigneeNames =
        submittedPlan.assigneeIds
          .map((memberId) => getUser(memberId)?.name ?? memberId)
          .join(', ') || 'Chưa phân công'
      const nextRiskPrompt = buildRiskDraftFromPlan(project, submittedPlan, assigneeNames)
      setPlanForm(buildPlanForm(project))
      setIsPlanModalOpen(false)
      setPlanRiskPrompt(nextRiskPrompt)
      toast.success(submittedPlan.id ? 'Đã cập nhật task' : 'Đã tạo task mới', submittedPlan.name)
    } catch (err) {
      toast.error('Không lưu được task', err instanceof Error ? err.message : '')
    }
  }

  async function handleExecutionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask || !executionForm) return
    const ok = await confirm({
      title: 'Lưu khai báo tiến độ?',
      description: 'Hệ thống sẽ cộng dồn giờ công, tự động cập nhật trạng thái task và đồng bộ tới a.Office.',
      tone: 'primary',
      confirmLabel: 'Lưu khai báo',
    })
    if (!ok) return

    try {
      await loading.run('Đang lưu tiến độ…', () =>
        addWorklog({
          taskId: selectedTask.id,
          projectId: project!.id,
          memberId: executionForm.memberId,
          date: executionForm.date,
          hours: Number(executionForm.hours),
          progressNote: executionForm.progressNote,
          progress: Number(executionForm.progress),
        }),
      )
      setIsExecutionModalOpen(false)
      toast.success('Đã cập nhật tiến độ và giờ công', selectedTask.name)
    } catch (err) {
      toast.error('Không lưu được tiến độ', err instanceof Error ? err.message : '')
    }
  }

  function openTaskModal() {
    setPlanForm(buildPlanForm(project!))
    setIsPlanModalOpen(true)
  }

  function openDocumentModal(docOrCategory?: ProjectDocumentCategory | import('../types').ProjectDocument) {
    if (docOrCategory && typeof docOrCategory === 'object') {
      setDocumentForm(buildDocumentForm(docOrCategory))
    } else {
      setDocumentForm({
        ...buildDocumentForm(),
        category: docOrCategory ?? 'PROJECT_DOCUMENT',
      })
    }
    setDocumentInputKey((current) => current + 1)
    setIsDocumentModalOpen(true)
  }

  function closeDocumentModal() {
    setDocumentForm(buildDocumentForm())
    setDocumentInputKey((current) => current + 1)
    setIsDocumentModalOpen(false)
  }

  function openRiskModal(risk?: ProjectRisk) {
    if (!project || !currentUser) {
      return
    }

    setRiskForm(buildRiskForm(project, currentUser.id, risk))
    setIsRiskModalOpen(true)
  }

  function closeRiskModal() {
    if (!project || !currentUser) {
      return
    }

    setRiskForm(buildRiskForm(project, currentUser.id))
    setIsRiskModalOpen(false)
  }

  function closePlanRiskPrompt() {
    setPlanRiskPrompt(null)
  }

  function handleUpdateRiskNow() {
    if (!planRiskPrompt) {
      return
    }

    setActiveDetailTab('RISKS')
    setRiskForm(planRiskPrompt.draft)
    setIsRiskModalOpen(true)
    setPlanRiskPrompt(null)
  }

  function openExecutionModal(task: PlanItem) {
    const defaultMemberId =
      currentUser && getTaskAssigneeIds(task).includes(currentUser.id)
        ? currentUser.id
        : getTaskPrimaryAssigneeId(task)

    setSelectedTaskId(task.id)
    setExecutionForm(buildExecutionForm(task, defaultMemberId))
    setIsExecutionModalOpen(true)
  }

  function handleEditTask(task: PlanItem) {
    setPlanForm(buildPlanForm(project!, task))
    setSelectedTaskId(task.id)
    setIsPlanModalOpen(true)
  }

  function handleCreateChildTask(parentTask: PlanItem) {
    const nextForm = buildPlanForm(project!)
    nextForm.parentId = parentTask.id
    nextForm.workType = 'SUBTASK'
    nextForm.assigneeIds = getTaskAssigneeIds(parentTask)
    nextForm.assigneeId = getTaskPrimaryAssigneeId(parentTask)
    nextForm.baselineStartDate = parentTask.startDate
    nextForm.baselineEndDate = parentTask.endDate
    nextForm.startDate = parentTask.startDate
    nextForm.endDate = parentTask.endDate
    setPlanForm(nextForm)
    setSelectedTaskId(parentTask.id)
    setIsPlanModalOpen(true)
  }

  function resetPlanForm() {
    if (planForm?.parentId) {
      const parentTask = projectTasks.find((task) => task.id === planForm.parentId)

      if (parentTask) {
        const nextForm = buildPlanForm(project!)
        nextForm.parentId = parentTask.id
        nextForm.workType = 'SUBTASK'
        nextForm.assigneeIds = getTaskAssigneeIds(parentTask)
        nextForm.assigneeId = getTaskPrimaryAssigneeId(parentTask)
        nextForm.baselineStartDate = parentTask.startDate
        nextForm.baselineEndDate = parentTask.endDate
        nextForm.startDate = parentTask.startDate
        nextForm.endDate = parentTask.endDate
        setPlanForm(nextForm)
        return
      }
    }

    setPlanForm(buildPlanForm(project!))
  }

  function closePlanModal() {
    resetPlanForm()
    setIsPlanModalOpen(false)
  }

  function closeExecutionModal() {
    setIsExecutionModalOpen(false)
  }

  function toggleTaskAssignee(memberId: string) {
    setPlanForm((current) => {
      if (!current) {
        return current
      }

      const isSelected = current.assigneeIds.includes(memberId)
      const assigneeIds = isSelected
        ? current.assigneeIds.filter((item) => item !== memberId)
        : [...current.assigneeIds, memberId]
      const assigneeId = assigneeIds.includes(current.assigneeId)
        ? current.assigneeId
        : assigneeIds[0] ?? ''

      return {
        ...current,
        assigneeIds,
        assigneeId,
      }
    })
  }

  return (
    <div className="page-grid project-detail-page">
      <SectionHeader
        title={project.code}
        description={project.name}
        actions={
          <Link to="/projects" className="secondary-button">
            Quay lai
          </Link>
        }
      />

      {message ? <p className="form-success">{message}</p> : null}

      <CloseFlowPanel project={project} />

      <section className="detail-grid detail-grid--compact">
        <div className="detail-card">
          <span>PM</span>
          <strong>{getUser(project.adminId)?.name}</strong>
        </div>
        <div className="detail-card">
          <span>Trang thai</span>
          <StatusPill
            label={getCatalogLabel(catalogs.projectStatuses, project.status)}
            tone={getStatusTone(project.status)}
          />
        </div>
        <div className="detail-card">
          <span>Health</span>
          <StatusPill
            label={getCatalogLabel(catalogs.healthStatuses, project.health)}
            tone={getHealthTone(project.health)}
          />
        </div>
        <div className="detail-card">
          <span>Tien do</span>
          <strong>{project.progress}%</strong>
        </div>
      </section>

      <nav className="detail-tabs" aria-label="Tabs du an">
        {detailTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`detail-tabs__button${activeDetailTab === tab.id ? ' detail-tabs__button--active' : ''}`}
            onClick={() => setActiveDetailTab(tab.id)}
          >
            <span className="detail-tabs__label">{tab.label}</span>
            <small>{tab.note}</small>
          </button>
        ))}
      </nav>

      {activeDetailTab === 'PROJECT_INIT' ? (
        <section className="panel panel--compact detail-tab-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Khoi tao</span>
              <h3>Thong tin khoi tao</h3>
            </div>
            <div className="panel-actions">
              <StatusPill label={canManageProject ? 'Co the cap nhat' : 'Chi xem'} tone="info" />
            </div>
          </div>

          <EditModeBar
            isEditing={initEdit.isEditing}
            canEdit={canManageProject}
            saving={initEdit.saving}
            onStartEdit={initEdit.start}
            onSave={() =>
              handleInitSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>)
            }
            onCancel={() => {
              setInitForm(buildInitForm(project))
              initEdit.exit()
            }}
            readingLabel="Bấm Cập nhật để chỉnh sửa thông tin khởi tạo dự án."
            editingLabel="Sửa các trường, sau đó bấm Lưu thay đổi."
          />

          <form className="form-grid form-grid--compact overview-form" onSubmit={handleInitSubmit}>
            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Du an</span>
                  <h4>Thong tin co ban</h4>
                </div>
              </div>
              <div className="overview-section__grid">
                <label>
                  <span>Ma du an</span>
                  <input value={initForm.code} disabled />
                </label>
                <label>
                  <span>Ten du an</span>
                  <input value={initForm.name} disabled />
                </label>
                <label className="span-2">
                  <span>Tom tat</span>
                  <textarea
                    rows={3}
                    value={initForm.summary}
                    onChange={(event) =>
                      setInitForm((current) => current ? { ...current, summary: event.target.value } : current)
                    }
                    disabled={!canManageProject || !initEdit.isEditing}
                  />
                </label>
                <label>
                  <span>Nhiem vu</span>
                  <textarea
                    rows={2}
                    value={initForm.objective}
                    onChange={(event) =>
                      setInitForm((current) => current ? { ...current, objective: event.target.value } : current)
                    }
                    disabled={!canManageProject || !initEdit.isEditing}
                  />
                </label>
                <label>
                  <span>Don vi</span>
                  <input value={initForm.department} disabled />
                </label>
              </div>
            </div>

            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Quyet dinh</span>
                  <h4>Thanh lap TTK</h4>
                </div>
              </div>
              <div className="overview-section__grid">
                <label>
                  <span>So quyet dinh TTK</span>
                  <input
                    value={initForm.ttkDecisionNumber}
                    placeholder="VD: QD-2026/001"
                    onChange={(event) =>
                      setInitForm((current) => current ? { ...current, ttkDecisionNumber: event.target.value } : current)
                    }
                    disabled={!canManageProject || !initEdit.isEditing}
                  />
                </label>
                <label>
                  <span>Nguoi tao</span>
                  <input value={getUser(project.createdById)?.name ?? project.createdById} disabled />
                </label>
              </div>
            </div>

            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Phan cong</span>
                  <h4>PM va thoi gian</h4>
                </div>
              </div>
              <div className="overview-section__grid">
                <label>
                  <span>Sponsor</span>
                  <select
                    value={initForm.sponsor}
                    onChange={(event) =>
                      setInitForm((current) => current ? { ...current, sponsor: event.target.value } : current)
                    }
                    disabled={!canManageProject || !initEdit.isEditing}
                  >
                    {users.filter((u) => normalizeUserRole(u.role) !== 'DELIVERY_MEMBER').map((u) => (
                      <option key={u.id} value={u.id}>{u.name} - {u.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>PM phu trach</span>
                  <select
                    value={initForm.adminId}
                    onChange={(event) =>
                      setInitForm((current) => current ? { ...current, adminId: event.target.value } : current)
                    }
                    disabled={!canManageProject || !initEdit.isEditing}
                  >
                    {users.filter((u) => normalizeUserRole(u.role) === 'PM').map((u) => (
                      <option key={u.id} value={u.id}>{u.name} - {u.employeeCode}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Ngay bat dau</span>
                  <input
                    type="date"
                    value={initForm.startDate}
                    onChange={(event) =>
                      setInitForm((current) => current ? { ...current, startDate: event.target.value } : current)
                    }
                    disabled={!canManageProject || !initEdit.isEditing}
                  />
                </label>
                <label>
                  <span>Ngay ket thuc</span>
                  <input
                    type="date"
                    value={initForm.endDate}
                    onChange={(event) =>
                      setInitForm((current) => current ? { ...current, endDate: event.target.value } : current)
                    }
                    disabled={!canManageProject || !initEdit.isEditing}
                  />
                </label>
              </div>
            </div>
          </form>

          {/* Lịch sử thay đổi tab Thông tin khởi tạo */}
          <InlineActivityLog logs={overviewLogs} getUser={getUser} />
        </section>
      ) : null}

      {activeDetailTab === 'OVERVIEW' ? (
      <section className="panel panel--compact detail-tab-panel">
        <div className="panel-heading panel-heading--compact">
          <div>
            <span className="eyebrow">Overview</span>
            <h3>Thong tin chung</h3>
          </div>
          <div className="panel-actions">
            <StatusPill label={canManageProject ? 'Co the cap nhat' : 'Chi xem'} tone="info" />
          </div>
        </div>

        <EditModeBar
          isEditing={overviewEdit.isEditing}
          canEdit={canManageProject}
          saving={overviewEdit.saving}
          onStartEdit={overviewEdit.start}
          onSave={() =>
            handleOverviewSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>)
          }
          onCancel={() => {
            setOverviewForm(buildOverviewForm(project))
            overviewEdit.exit()
          }}
          readingLabel="Bấm Cập nhật để chỉnh sửa thông tin chung, cơ sở căn cứ, tài chính."
          editingLabel="Sửa các trường, sau đó bấm Lưu thay đổi."
        />

        <form className="form-grid form-grid--compact overview-form" onSubmit={handleOverviewSubmit}>
          {/* fieldset[disabled] propagates the disabled attribute to every
              form control inside, so we don't have to touch each individual
              input's disabled prop. The display:contents removes it from
              layout while preserving the disabled cascade. */}
          <fieldset
            disabled={!overviewEdit.isEditing || !canManageProject}
            className="edit-mode-fieldset"
          >
            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Nhom 1</span>
                  <h4>Thong tin chung</h4>
                </div>
                <p>Mo ta, tien do, trang thai va PM</p>
              </div>

              <div className="overview-section__grid">
                <label className="span-2">
                  <span>Mo ta</span>
                  <textarea
                    rows={3}
                    value={overviewForm.summary}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current ? { ...current, summary: event.target.value } : current,
                      )
                    }
                    disabled={!canManageProject}
                  />
                </label>

                <label>
                  <span>Ngay bat dau</span>
                  <input
                    type="date"
                    value={overviewForm.startDate}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current ? { ...current, startDate: event.target.value } : current,
                      )
                    }
                    disabled={!canManageProject}
                  />
                </label>

                <label>
                  <span>Trang thai</span>
                  <select
                    value={overviewForm.status}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current
                          ? { ...current, status: event.target.value as Project['status'] }
                          : current,
                      )
                    }
                    disabled={!canManageProject}
                  >
                    {catalogs.projectStatuses.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="span-2">
                  <span>PM</span>
                  <select
                    value={overviewForm.adminId}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current ? { ...current, adminId: event.target.value } : current,
                      )
                    }
                    disabled={!canManageProject}
                  >
                    {projectManagers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="span-2">
                  <span>Sponsor</span>
                  <select
                    value={overviewForm.sponsor}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current ? { ...current, sponsor: event.target.value } : current,
                      )
                    }
                    disabled={!canManageProject}
                  >
                    {sponsorUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="span-2">
                  <span>Nhiem vu</span>
                  <textarea
                    rows={2}
                    value={overviewForm.objective}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current ? { ...current, objective: event.target.value } : current,
                      )
                    }
                    disabled={!canManageProject}
                  />
                </label>
              </div>
            </div>

            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Nhom 2</span>
                  <h4>Can cu</h4>
                </div>
                <p>Hop dong, phe duyet, quyet dinh</p>
              </div>

              <div className="overview-reference-grid">
                {renderReferenceEditor('outputContracts')}
                {renderReferenceEditor('inputContracts')}
                {renderReferenceEditor('deploymentApprovals')}
                {renderReferenceEditor('projectTeamDecisions')}
              </div>

              <div className="overview-section__grid overview-section__grid--tight">
                <label>
                  <span>Hinh thuc TTK</span>
                  <select
                    value={overviewForm.basisInfo.ttkMode}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current
                          ? {
                              ...current,
                              basisInfo: {
                                ...current.basisInfo,
                                ttkMode: event.target.value as TtkMode,
                              },
                            }
                          : current,
                      )
                    }
                    disabled={!canManageProject}
                  >
                    {ttkModeOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Hinh thuc trien khai</span>
                  <select
                    value={overviewForm.basisInfo.deploymentMode}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current
                          ? {
                              ...current,
                              basisInfo: {
                                ...current.basisInfo,
                                deploymentMode: event.target.value as DeploymentMode,
                              },
                            }
                          : current,
                      )
                    }
                    disabled={!canManageProject}
                  >
                    {deploymentModeOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Thoi gian trien khai (so ngay)</span>
                  <input
                    type="number"
                    min={0}
                    value={overviewForm.basisInfo.durationDays}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current
                          ? {
                              ...current,
                              basisInfo: {
                                ...current.basisInfo,
                                durationDays: Number(event.target.value),
                              },
                            }
                          : current,
                      )
                    }
                    disabled={!canManageProject}
                  />
                </label>

                <label>
                  <span>Thoi gian trien khai (so gio)</span>
                  <input
                    type="number"
                    min={0}
                    value={overviewForm.basisInfo.durationHours}
                    onChange={(event) =>
                      setOverviewForm((current) =>
                        current
                          ? {
                              ...current,
                              basisInfo: {
                                ...current.basisInfo,
                                durationHours: Number(event.target.value),
                              },
                            }
                          : current,
                      )
                    }
                    disabled={!canManageProject}
                  />
                </label>
              </div>
            </div>

            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Nhom 3</span>
                  <h4>Tai chinh</h4>
                </div>
                <p>Doanh thu, chi phi va loi nhuan</p>
              </div>

              <div className="overview-financial-grid">
                <div className="overview-financial-card">
                  <div className="overview-financial-card__header">
                    <strong>Doanh thu</strong>
                    <span>{formatCurrencyPreview(overviewForm.financialInfo.revenue.amount)}</span>
                  </div>
                  <label>
                    <span>Gia tien</span>
                    <input
                      type="number"
                      min={0}
                      value={overviewForm.financialInfo.revenue.amount}
                      onChange={(event) =>
                        updateFinancialField('revenue', 'amount', Number(event.target.value))
                      }
                      disabled={!canManageProject}
                    />
                  </label>
                  <label>
                    <span>Note PAKD</span>
                    <input
                      value={overviewForm.financialInfo.revenue.note}
                      onChange={(event) => updateFinancialField('revenue', 'note', event.target.value)}
                      disabled={!canManageProject}
                    />
                  </label>
                </div>

                <div className="overview-financial-card">
                  <div className="overview-financial-card__header">
                    <strong>Chi phi noi bo</strong>
                    <span>{formatCurrencyPreview(overviewForm.financialInfo.internalCost.amount)}</span>
                  </div>
                  <label>
                    <span>Gia tien</span>
                    <input
                      type="number"
                      min={0}
                      value={overviewForm.financialInfo.internalCost.amount}
                      onChange={(event) =>
                        updateFinancialField('internalCost', 'amount', Number(event.target.value))
                      }
                      disabled={!canManageProject}
                    />
                  </label>
                  <label>
                    <span>Note PAKD</span>
                    <input
                      value={overviewForm.financialInfo.internalCost.note}
                      onChange={(event) =>
                        updateFinancialField('internalCost', 'note', event.target.value)
                      }
                      disabled={!canManageProject}
                    />
                  </label>
                </div>

                <div className="overview-financial-card">
                  <div className="overview-financial-card__header">
                    <strong>Chi phi thue ngoai</strong>
                    <span>{formatCurrencyPreview(overviewForm.financialInfo.externalCost.amount)}</span>
                  </div>
                  <label>
                    <span>Gia tien</span>
                    <input
                      type="number"
                      min={0}
                      value={overviewForm.financialInfo.externalCost.amount}
                      onChange={(event) =>
                        updateFinancialField('externalCost', 'amount', Number(event.target.value))
                      }
                      disabled={!canManageProject}
                    />
                  </label>
                  <label>
                    <span>Note PAKD</span>
                    <input
                      value={overviewForm.financialInfo.externalCost.note}
                      onChange={(event) =>
                        updateFinancialField('externalCost', 'note', event.target.value)
                      }
                      disabled={!canManageProject}
                    />
                  </label>
                </div>

                <div className="overview-financial-card">
                  <div className="overview-financial-card__header">
                    <strong>Loi nhuan</strong>
                    <span>{formatCurrencyPreview(overviewForm.financialInfo.profit.amount)}</span>
                  </div>
                  <label>
                    <span>Gia tien</span>
                    <input
                      type="number"
                      min={0}
                      value={overviewForm.financialInfo.profit.amount}
                      onChange={(event) =>
                        updateFinancialField('profit', 'amount', Number(event.target.value))
                      }
                      disabled={!canManageProject}
                    />
                  </label>
                  <label>
                    <span>Note PAKD</span>
                    <input
                      value={overviewForm.financialInfo.profit.note}
                      onChange={(event) => updateFinancialField('profit', 'note', event.target.value)}
                      disabled={!canManageProject}
                    />
                  </label>
                </div>
              </div>

              <label className="span-2">
                <span>Nguon chi phi</span>
                <textarea
                  rows={2}
                  value={overviewForm.financialInfo.costSource}
                  onChange={(event) =>
                    setOverviewForm((current) =>
                      current
                        ? {
                            ...current,
                            financialInfo: {
                              ...current.financialInfo,
                              costSource: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                  disabled={!canManageProject}
                />
              </label>
            </div>

          </fieldset>
        </form>
        <InlineActivityLog logs={overviewLogs} getUser={getUser} />
      </section>
      ) : null}

      {activeDetailTab === 'PERSONNEL' ? (
      <section className="panel panel--compact detail-tab-panel">
        <div className="panel-heading panel-heading--compact">
          <div>
            <span className="eyebrow">Personnel</span>
            <h3>Thong tin nhan su</h3>
          </div>
          <div className="panel-actions">
            <StatusPill label={canManageProject ? 'Co the cap nhat' : 'Chi xem'} tone="info" />
          </div>
        </div>

        <EditModeBar
          isEditing={personnelEdit.isEditing}
          canEdit={canManageProject}
          saving={personnelEdit.saving}
          onStartEdit={personnelEdit.start}
          onSave={() =>
            handlePersonnelSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>)
          }
          onCancel={() => {
            setPersonnelForm(buildPersonnelForm(project))
            personnelEdit.exit()
          }}
          readingLabel="Bấm Cập nhật để chỉnh sửa nhân sự AITS / Khách hàng / Đối tác."
          editingLabel="Sửa các trường, sau đó bấm Lưu thay đổi."
        />

        <form className="personnel-form" onSubmit={handlePersonnelSubmit}>
          <fieldset
            disabled={!personnelEdit.isEditing || !canManageProject}
            className="edit-mode-fieldset"
          >
            <div className="personnel-group">
              <div className="personnel-group__header">
                <div>
                  <span className="eyebrow">Bang 1</span>
                  <h4>Nhan su AITS</h4>
                  <p>Nhan su noi bo va gio cong TK</p>
                </div>
                {personnelEditable ? (
                  <button
                    type="button"
                    className="ghost-button ghost-button--compact"
                    onClick={addAitsPersonnelItem}
                  >
                    <CirclePlus size={15} />
                    Them nhan su
                  </button>
                ) : null}
              </div>

              <div className="table-wrapper personnel-table-wrapper">
                <table className="personnel-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Nhan vien AITS</th>
                      <th>Chuc danh / Don vi</th>
                      <th>Vai tro</th>
                      <th>Nhiem vu</th>
                      <th>Tong gio cong TK</th>
                      <th>Email / SDT</th>
                      {personnelEditable ? <th>Tac vu</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {personnelForm.aitsMembers.length ? (
                      personnelForm.aitsMembers.map((member, index) => {
                        // Pool of valid AITS members = all internal Users not already selected
                        // on another row. The current row's user stays selectable.
                        const otherSelectedIds = new Set(
                          personnelForm.aitsMembers
                            .map((m, i) => (i === index ? '' : m.userId))
                            .filter(Boolean),
                        )
                        const aitsPool = users.filter(
                          (u) =>
                            normalizeUserRole(u.role) !== 'ADMIN_HC' &&
                            !otherSelectedIds.has(u.id),
                        )
                        return (
                          <tr key={`aits-${index}`}>
                            <td className="personnel-table__index">{index + 1}</td>
                            <td>
                              <select
                                value={member.userId}
                                onChange={(event) => bindAitsPersonnelUser(index, event.target.value)}
                                disabled={!canManageProject}
                              >
                                <option value="">— Chon nhan vien —</option>
                                {aitsPool.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.employeeCode})
                                  </option>
                                ))}
                              </select>
                              {member.userId ? (
                                <p className="workload-cell-note">{member.fullName}</p>
                              ) : null}
                            </td>
                            <td>
                              <strong>{member.title || '—'}</strong>
                              <p className="workload-cell-note">{member.unit || '—'}</p>
                            </td>
                            <td>
                              <input
                                value={member.role}
                                onChange={(event) =>
                                  updateAitsPersonnelItem(index, 'role', event.target.value)
                                }
                                disabled={!canManageProject}
                              />
                            </td>
                            <td>
                              <input
                                value={member.responsibility}
                                onChange={(event) =>
                                  updateAitsPersonnelItem(index, 'responsibility', event.target.value)
                                }
                                disabled={!canManageProject}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                value={member.totalPlannedHours}
                                onChange={(event) =>
                                  updateAitsPersonnelItem(
                                    index,
                                    'totalPlannedHours',
                                    Number(event.target.value),
                                  )
                                }
                                disabled={!canManageProject}
                              />
                            </td>
                            <td>
                              <span>{member.email || '—'}</span>
                              <p className="workload-cell-note">{member.phone || '—'}</p>
                            </td>
                            {personnelEditable ? (
                              <td className="personnel-table__actions">
                                <button
                                  type="button"
                                  className="ghost-button ghost-button--compact"
                                  onClick={() => void confirmRemoveAitsRow(index)}
                                >
                                  <Trash2 size={14} /> Xoa
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={personnelEditable ? 8 : 7} className="personnel-table__empty">
                          Chua co nhan su AITS.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="personnel-group">
              <div className="personnel-group__header">
                <div>
                  <span className="eyebrow">Bang 2</span>
                  <h4>Nhan su khach hang</h4>
                  <p>Dau moi phia khach hang</p>
                </div>
                {personnelEditable ? (
                  <button
                    type="button"
                    className="ghost-button ghost-button--compact"
                    onClick={() => addExternalPersonnelItem('customerMembers')}
                  >
                    <CirclePlus size={15} />
                    Them nhan su
                  </button>
                ) : null}
              </div>

              <div className="table-wrapper personnel-table-wrapper">
                <table className="personnel-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Ho va ten</th>
                      <th>Chuc danh</th>
                      <th>Don vi</th>
                      <th>Nhiem vu</th>
                      <th>Email</th>
                      <th>SDT</th>
                      {personnelEditable ? <th>Tac vu</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {personnelForm.customerMembers.length ? (
                      personnelForm.customerMembers.map((member, index) => (
                        <tr key={`customer-${index}`}>
                          <td className="personnel-table__index">{index + 1}</td>
                          <td>
                            <input
                              value={member.fullName}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'customerMembers',
                                  index,
                                  'fullName',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.title}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'customerMembers',
                                  index,
                                  'title',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.unit}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'customerMembers',
                                  index,
                                  'unit',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.responsibility}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'customerMembers',
                                  index,
                                  'responsibility',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              type="email"
                              value={member.email}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'customerMembers',
                                  index,
                                  'email',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              type="tel"
                              value={member.phone}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'customerMembers',
                                  index,
                                  'phone',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          {personnelEditable ? (
                            <td className="personnel-table__actions">
                              <button
                                type="button"
                                className="ghost-button ghost-button--compact"
                                onClick={() => void confirmRemoveExternalRow('customerMembers', index)}
                              >
                                <Trash2 size={14} /> Xoa
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={personnelEditable ? 8 : 7} className="personnel-table__empty">
                          Chua co dau moi khach hang.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="personnel-group">
              <div className="personnel-group__header">
                <div>
                  <span className="eyebrow">Bang 3</span>
                  <h4>Doi tac</h4>
                  <p>Nhan su doi tac tham gia du an</p>
                </div>
                {personnelEditable ? (
                  <button
                    type="button"
                    className="ghost-button ghost-button--compact"
                    onClick={() => addExternalPersonnelItem('partners')}
                  >
                    <CirclePlus size={15} />
                    Them doi tac
                  </button>
                ) : null}
              </div>

              <div className="table-wrapper personnel-table-wrapper">
                <table className="personnel-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Ho va ten</th>
                      <th>Chuc danh</th>
                      <th>Don vi</th>
                      <th>Vai tro</th>
                      <th>Nhiem vu</th>
                      <th>Email</th>
                      <th>SDT</th>
                      {personnelEditable ? <th>Tac vu</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {personnelForm.partners.length ? (
                      personnelForm.partners.map((member, index) => (
                        <tr key={`partner-${index}`}>
                          <td className="personnel-table__index">{index + 1}</td>
                          <td>
                            <input
                              value={member.fullName}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'fullName',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.title}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'title',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.unit}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'unit',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.role}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'role',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.responsibility}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'responsibility',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              type="email"
                              value={member.email}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'email',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              type="tel"
                              value={member.phone}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'phone',
                                  event.target.value,
                                )
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          {personnelEditable ? (
                            <td className="personnel-table__actions">
                              <button
                                type="button"
                                className="ghost-button ghost-button--compact"
                                onClick={() => void confirmRemoveExternalRow('partners', index)}
                              >
                                <Trash2 size={14} /> Xoa
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={personnelEditable ? 9 : 8} className="personnel-table__empty">
                          Chua co doi tac tham gia du an.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </fieldset>
        </form>
        <InlineActivityLog logs={personnelLogs} getUser={getUser} />
      </section>
      ) : null}

      {activeDetailTab === 'DOCUMENTS' ? (
        <section className="panel panel--compact detail-tab-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Documents</span>
              <h3>Tai lieu du an</h3>
            </div>
            <div className="panel-actions">
              <StatusPill label={`${totalDocumentCount} tai lieu`} tone={totalDocumentCount ? 'info' : 'neutral'} />
              {canManageProject ? (
                <button
                  type="button"
                  className="primary-button primary-button--compact"
                  onClick={() => openDocumentModal()}
                >
                  <CirclePlus size={16} />
                  Them tai lieu
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Ten tai lieu</th>
                  <th>File</th>
                  <th>Loai tai lieu</th>
                  <th>So van ban</th>
                  <th>Nguoi them</th>
                  <th>Ngay them</th>
                  <th>Nguoi cap nhat</th>
                  <th>Ngay cap nhat</th>
                  {canManageProject ? <th>Thao tac</th> : null}
                </tr>
              </thead>
              <tbody>
                {project.documents.length ? (
                  project.documents.map((doc, index) => (
                    <tr key={doc.id}>
                      <td>{index + 1}</td>
                      <td><strong>{doc.title}</strong></td>
                      <td>{doc.url || '-'}</td>
                      <td>
                        <StatusPill
                          label={getDocumentCategoryLabel(normalizeProjectDocumentCategory(doc.category))}
                          tone="neutral"
                        />
                      </td>
                      <td>{doc.documentNumber || '-'}</td>
                      <td>{getUser(doc.uploadedBy)?.name ?? doc.uploadedBy}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(doc.uploadedAt)}</td>
                      <td>{doc.updatedBy ? (getUser(doc.updatedBy)?.name ?? doc.updatedBy) : '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{doc.updatedAt ? formatDate(doc.updatedAt) : '-'}</td>
                      {canManageProject ? (
                        <td>
                          <div className="inline-actions">
                            <button
                              type="button"
                              className="ghost-button ghost-button--compact"
                              onClick={() => openDocumentModal(doc)}
                            >
                              <Edit3 size={14} />
                              Sua
                            </button>
                            <button
                              type="button"
                              className="ghost-button ghost-button--compact"
                              style={{ color: 'var(--danger, #dc2626)' }}
                              onClick={() => void handleDeleteDocument(doc)}
                            >
                              <Trash2 size={14} />
                              Xoa
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canManageProject ? 10 : 9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chua co tai lieu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <InlineActivityLog logs={documentLogs} getUser={getUser} />
        </section>
      ) : null}

      {activeDetailTab === 'RISKS' ? (
        <section className="panel panel--compact detail-tab-panel">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Risk center</span>
              <h3>Rui ro</h3>
            </div>
            <div className="panel-actions">
              <StatusPill
                label={canManagePlan ? 'Co the cap nhat' : 'Chi xem'}
                tone={canManagePlan ? 'info' : 'neutral'}
              />
              {canManagePlan ? (
                <button
                  type="button"
                  className="primary-button primary-button--compact"
                  onClick={() => openRiskModal()}
                >
                  <CirclePlus size={16} />
                  Them rui ro
                </button>
              ) : null}
            </div>
          </div>

          <div className="risk-panel-shell">
            <form className="overview-section risk-summary-form" onSubmit={handleRiskSummarySubmit}>
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Tong quan</span>
                  <h4>Tom tat rui ro</h4>
                </div>
                <p>Diem can theo doi va huong xu ly</p>
              </div>

              <div className="risk-summary-strip">
                <article className="risk-summary-card">
                  <span>Dang mo</span>
                  <strong>{openRiskCount}</strong>
                  <small>Can theo doi</small>
                </article>
                <article className="risk-summary-card">
                  <span>Muc cao</span>
                  <strong>{highRiskCount}</strong>
                  <small>Uu tien xu ly</small>
                </article>
                <article className="risk-summary-card">
                  <span>Da giam nhe</span>
                  <strong>{mitigatedRiskCount}</strong>
                  <small>Da co bien phap</small>
                </article>
              </div>

              <label className="span-2">
                <span>Tom tat</span>
                <textarea
                  rows={4}
                  value={riskSummaryDraft}
                  onChange={(event) => setRiskSummaryDraft(event.target.value)}
                  disabled={!canManagePlan}
                  placeholder="Tom tat rui ro va huong xu ly"
                />
              </label>

              {canManagePlan ? (
                <div className="inline-actions span-2">
                  <button type="submit" className="primary-button primary-button--compact">
                    <Save size={16} />
                    Luu tom tat
                  </button>
                </div>
              ) : null}
            </form>

            <div className="risk-list">
              {projectRiskItems.length ? (
                projectRiskItems.map((risk) => (
                  <article key={risk.id} className="risk-card">
                    <div className="risk-card__header">
                      <div>
                        <span className="eyebrow">Muc rui ro</span>
                        <h4>{risk.title}</h4>
                      </div>
                      <div className="inline-actions">
                        <StatusPill
                          label={getCatalogLabel(catalogs.riskLevels, risk.level)}
                          tone={getRiskLevelTone(risk.level)}
                        />
                        <StatusPill
                          label={getRiskStatusLabel(risk.status)}
                          tone={getRiskStatusTone(risk.status)}
                        />
                        {canManagePlan ? (
                          <button
                            type="button"
                            className="ghost-button ghost-button--compact"
                            onClick={() => openRiskModal(risk)}
                          >
                            <Edit3 size={15} />
                            Cap nhat
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="risk-card__meta">
                      <span>Chu tri: {getUser(risk.ownerId)?.name ?? risk.ownerId}</span>
                      <span>Cap nhat: {formatDate(risk.lastUpdated)}</span>
                    </div>

                    <p>{risk.mitigation || 'Chua co bien phap.'}</p>
                  </article>
                ))
              ) : (
                <div className="risk-empty-state">
                  <strong>Chua co rui ro</strong>
                  <p>Them muc rui ro de luu tac dong va bien phap.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeDetailTab === 'PLAN' ? (
      <section className="task-workspace detail-tab-panel">
        <article className="panel panel--compact">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Plan builder</span>
              <h3>Task & subtask</h3>
            </div>
            <div className="panel-actions">
              <StatusPill label={canManagePlan ? 'Co the cap nhat' : 'Chi xem'} tone="info" />
              {canManagePlan ? (
                <button
                  type="button"
                  className="primary-button primary-button--compact"
                  onClick={openTaskModal}
                >
                  <CirclePlus size={16} />
                  Tao task
                </button>
              ) : null}
            </div>
          </div>

          <>
            {selectedTask ? (
              <div className="stack-list">
                <div className="list-row list-row--compact">
                  <div>
                    <strong>Dang chon: {selectedTask.name}</strong>
                    <p>
                      {getTaskAssigneeNames(selectedTask)} | {selectedTask.progress}% |{' '}
                      {formatHours(selectedTask.actualHours)} ghi nhan
                    </p>
                  </div>
                  <div className="inline-actions">
                    <StatusPill
                      label={getCatalogLabel(catalogs.taskStatuses, selectedTask.status)}
                      tone={getStatusTone(selectedTask.status)}
                    />
                    {canUpdateSelectedTask ? (
                      <button
                        type="button"
                        className="ghost-button ghost-button--compact"
                        onClick={() => openExecutionModal(selectedTask)}
                      >
                        <Timer size={15} />
                        Mo cap nhat
                      </button>
                    ) : null}
                    {canManagePlan ? (
                      <button
                        type="button"
                        className="ghost-button ghost-button--compact"
                        onClick={() => handleEditTask(selectedTask)}
                      >
                        <Edit3 size={15} />
                        Sua task
                      </button>
                    ) : null}
                    {canCreateChildForSelectedTask ? (
                      <button
                        type="button"
                        className="ghost-button ghost-button--compact"
                        onClick={() => handleCreateChildTask(selectedTask)}
                      >
                        <Workflow size={15} />
                        Them subtask
                      </button>
                    ) : null}
                    {canManagePlan ? (
                      <button
                        type="button"
                        className="ghost-button ghost-button--compact"
                        style={{ color: 'var(--danger, #dc2626)' }}
                        onClick={() => void handleDeletePlanItem(selectedTask)}
                      >
                        <Trash2 size={15} />
                        Xoa
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="plan-gantt-shell">
              <section className="plan-gantt-group">
                <div className="plan-gantt-caption">
                  <div>
                    <span className="eyebrow">Gantt overview</span>
                    <h4>Task tong quan</h4>
                    <p>Chon task de xem subtask ben duoi</p>
                  </div>
                  <StatusPill label={`${overviewTasks.length} task`} tone="neutral" />
                </div>

                <GanttChart
                  items={overviewGanttItems}
                  variant="embedded"
                  activeId={focusedOverviewTask?.id}
                  onSelect={setSelectedTaskId}
                />
              </section>

              {focusedOverviewTask ? (
                <section className="plan-gantt-group">
                  <div className="plan-gantt-caption">
                    <div>
                      <span className="eyebrow">Subtask timeline</span>
                      <h4>{focusedOverviewTask.name}</h4>
                      <p>
                        {focusedSubtaskGanttItems.length
                          ? 'Timeline subtask cua task dang chon'
                          : 'Chua co subtask'}
                      </p>
                    </div>
                    <StatusPill
                      label={`${focusedSubtaskGanttItems.length} subtask`}
                      tone={focusedSubtaskGanttItems.length ? 'info' : 'neutral'}
                    />
                  </div>

                  {focusedSubtaskGanttItems.length ? (
                    <GanttChart
                      items={focusedSubtaskGanttItems}
                      variant="embedded"
                      activeId={selectedTask && selectedTask.parentId ? selectedTask.id : undefined}
                      onSelect={setSelectedTaskId}
                    />
                  ) : (
                    <div className="plan-gantt-empty">
                      <p>
                        Them subtask cho <strong>{focusedOverviewTask.name}</strong> de xem timeline.
                      </p>
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          </>
        </article>
        <InlineActivityLog logs={planLogs} getUser={getUser} />
      </section>
      ) : null}

      {canManageProject && documentForm && isDocumentModalOpen ? (
        <div className="modal-backdrop" onClick={closeDocumentModal}>
          <div
            className="modal-card document-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Tai lieu</span>
                <h3>{documentForm.id ? 'Cap nhat tai lieu' : 'Them tai lieu'}</h3>
              </div>
              <button
                type="button"
                className="ghost-button icon-button"
                onClick={closeDocumentModal}
                aria-label="Dong"
              >
                <X size={16} />
              </button>
            </div>

            <form className="form-grid" onSubmit={handleDocumentSubmit}>
              <label>
                <span>Ten tai lieu</span>
                <input
                  value={documentForm.title}
                  placeholder="Mac dinh theo ten file"
                  onChange={(event) =>
                    setDocumentForm((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                />
              </label>

              <label>
                <span>Loai tai lieu</span>
                <select
                  value={documentForm.category}
                  onChange={(event) =>
                    setDocumentForm((current) =>
                      current
                        ? { ...current, category: event.target.value as ProjectDocumentCategory }
                        : current,
                    )
                  }
                >
                  {catalogs.documentCategories.length
                    ? catalogs.documentCategories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))
                    : projectDocumentCategories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                </select>
              </label>

              <label>
                <span>So van ban</span>
                <input
                  value={documentForm.documentNumber}
                  placeholder="VD: CV-2026/001"
                  onChange={(event) =>
                    setDocumentForm((current) =>
                      current ? { ...current, documentNumber: event.target.value } : current,
                    )
                  }
                />
              </label>

              <label>
                <span>File tai lieu</span>
                <div className="document-upload-field">
                  <input
                    key={documentInputKey}
                    className="document-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,image/*"
                    onChange={(event) =>
                      setDocumentForm((current) =>
                        current
                          ? { ...current, fileName: event.target.files?.[0]?.name ?? '' }
                          : current,
                      )
                    }
                  />
                  <div className="document-upload-meta">
                    <FileText size={15} />
                    <span>{documentForm.fileName || 'Chua chon file'}</span>
                  </div>
                </div>
              </label>

              <label className="span-2">
                <span>Ghi chu</span>
                <textarea
                  rows={2}
                  value={documentForm.description}
                  onChange={(event) =>
                    setDocumentForm((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                />
              </label>

              <div className="modal-actions span-2">
                <button type="button" className="ghost-button" onClick={closeDocumentModal}>
                  Huy
                </button>
                <button type="submit" className="primary-button">
                  <Save size={16} />
                  {documentForm.id ? 'Luu thay doi' : 'Them tai lieu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManagePlan && riskForm && isRiskModalOpen ? (
        <div className="modal-backdrop" onClick={closeRiskModal}>
          <div className="modal-card document-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Rui ro</span>
                <h3>{riskForm.id ? 'Cap nhat rui ro' : 'Them rui ro'}</h3>
                <p>Tac dong, nguoi theo doi va bien phap</p>
              </div>
              <button
                type="button"
                className="ghost-button icon-button"
                onClick={closeRiskModal}
                aria-label="Dong"
              >
                <X size={16} />
              </button>
            </div>

            <form className="form-grid" onSubmit={handleRiskSubmit}>
              <label className="span-2">
                <span>Tieu de rui ro</span>
                <input
                  value={riskForm.title}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                  required
                />
              </label>

              <label>
                <span>Muc do</span>
                <select
                  value={riskForm.level}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current
                        ? {
                            ...current,
                            level: event.target.value as RiskLevel,
                          }
                        : current,
                    )
                  }
                >
                  {catalogs.riskLevels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Trang thai</span>
                <select
                  value={riskForm.status}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current
                        ? {
                            ...current,
                            status: event.target.value as ProjectRiskStatus,
                          }
                        : current,
                    )
                  }
                >
                  {riskStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="span-2">
                <span>Nguoi theo doi</span>
                <select
                  value={riskForm.ownerId}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, ownerId: event.target.value } : current,
                    )
                  }
                >
                  {riskOwnerIds.map((ownerId) => (
                    <option key={ownerId} value={ownerId}>
                      {getUser(ownerId)?.name ?? ownerId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="span-2">
                <span>Nguyên nhân</span>
                <textarea
                  rows={2}
                  value={riskForm.cause}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, cause: event.target.value } : current,
                    )
                  }
                  placeholder="Vì sao rủi ro phát sinh"
                />
              </label>

              <label className="span-2">
                <span>Nội dung rủi ro</span>
                <textarea
                  rows={3}
                  value={riskForm.description}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                  placeholder="Mô tả chi tiết nội dung rủi ro và tác động"
                />
              </label>

              <label className="span-2">
                <span>Giải pháp / Biện pháp giảm nhẹ</span>
                <textarea
                  rows={3}
                  value={riskForm.mitigation}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, mitigation: event.target.value } : current,
                    )
                  }
                  placeholder="Hướng xử lý dự kiến"
                />
              </label>

              <label>
                <span>Hạn xử lý</span>
                <input
                  type="date"
                  value={riskForm.dueDate}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, dueDate: event.target.value } : current,
                    )
                  }
                />
              </label>

              <label>
                <span>Tiến độ xử lý ({riskForm.resolutionProgress}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={riskForm.resolutionProgress}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current
                        ? { ...current, resolutionProgress: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>

              <label className="span-2">
                <span>Kết quả thực hiện</span>
                <textarea
                  rows={2}
                  value={riskForm.resolutionResult}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current
                        ? { ...current, resolutionResult: event.target.value }
                        : current,
                    )
                  }
                  placeholder="Đã xử lý gì cho đến nay"
                />
              </label>

              <label className="span-2">
                <span>Kế hoạch tiếp theo</span>
                <textarea
                  rows={2}
                  value={riskForm.nextPlan}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, nextPlan: event.target.value } : current,
                    )
                  }
                  placeholder="Bước tiếp theo và người chịu trách nhiệm"
                />
              </label>

              <label className="span-2">
                <span>Ghi chú</span>
                <textarea
                  rows={2}
                  value={riskForm.notes}
                  onChange={(event) =>
                    setRiskForm((current) =>
                      current ? { ...current, notes: event.target.value } : current,
                    )
                  }
                />
              </label>

              <div className="modal-actions span-2" style={{ justifyContent: 'space-between' }}>
                {riskForm.id ? (
                  <button
                    type="button"
                    className="ghost-button"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => void handleRiskDelete()}
                  >
                    <Trash2 size={16} /> Xóa rủi ro
                  </button>
                ) : (
                  <span />
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="ghost-button" onClick={closeRiskModal}>
                    Huy
                  </button>
                  <button type="submit" className="primary-button">
                    <Save size={16} />
                    {riskForm.id ? 'Luu thay doi' : 'Them rui ro'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {planRiskPrompt ? (
        <div className="modal-backdrop" onClick={closePlanRiskPrompt}>
          <div className="modal-card risk-prompt-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Ke hoach da thay doi</span>
                <h3>Cap nhat rui ro?</h3>
                <p>
                  Da luu thay doi cho task <strong>{planRiskPrompt.taskName}</strong>.
                </p>
              </div>
              <button
                type="button"
                className="ghost-button icon-button"
                onClick={closePlanRiskPrompt}
                aria-label="Dong"
              >
                <X size={16} />
              </button>
            </div>

            <div className="risk-prompt-summary">
              <span>Timeline: {planRiskPrompt.timeline}</span>
              <span>Phu trach: {planRiskPrompt.assignees}</span>
            </div>

            <div className="risk-prompt-body">
              <p>
                Neu anh huong deadline hoac nguon luc, hay cap nhat tab <strong>Rui ro</strong>.
              </p>
              <div className="risk-prompt-draft">
                <strong>De xuat:</strong>
                <p>{planRiskPrompt.draft.title}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={closePlanRiskPrompt}>
                De sau
              </button>
              <button type="button" className="primary-button" onClick={handleUpdateRiskNow}>
                <Workflow size={16} />
                Cap nhat ngay
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canOpenPlanModal && isPlanModalOpen ? (
        <div className="modal-backdrop" onClick={closePlanModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Plan builder</span>
                <h3>
                  {planForm.id
                    ? 'Sua task'
                    : planForm.parentId
                      ? 'Them subtask'
                      : 'Them task'}
                </h3>
                <p>
                  {planForm.id
                    ? 'Cap nhat phan cong va ke hoach'
                    : planForm.parentId
                      ? 'Subtask se gan vao task cha'
                      : 'Khai bao task tong quan'}
                </p>
              </div>
              <button
                type="button"
                className="ghost-button icon-button"
                onClick={closePlanModal}
                aria-label="Dong"
              >
                <X size={16} />
              </button>
            </div>

            <form className="form-grid" onSubmit={handlePlanSubmit}>
              <label className="span-2">
                <span>Ten task</span>
                <input
                  value={planForm.name}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  required
                />
              </label>
              <label>
                <span>Task cha</span>
                <select
                  value={planForm.parentId}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current ? { ...current, parentId: event.target.value } : current,
                    )
                  }
                  disabled={!canManagePlan && isCreatingChildTask}
                >
                  <option value="">Khong co</option>
                  {projectTasks
                    .filter((task) => task.id !== planForm.id)
                    .map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="span-2">
                <span>Thanh vien</span>
                <div className="checkbox-grid member-selector-grid">
                  {project.memberIds.map((memberId) => {
                    const isChecked = planForm.assigneeIds.includes(memberId)

                    return (
                      <label key={memberId} className="check-card">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTaskAssignee(memberId)}
                        />
                        <div>
                          <strong>{getUser(memberId)?.name}</strong>
                          <p>{getUser(memberId)?.title}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </label>
              <label>
                <span>Trang thai</span>
                <select
                  value={planForm.status}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? {
                            ...current,
                            status: event.target.value as PlanItem['status'],
                          }
                        : current,
                    )
                  }
                >
                  {catalogs.taskStatuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ke hoach bat dau</span>
                <input
                  type="date"
                  value={planForm.startDate}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current ? { ...current, startDate: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Ke hoach ket thuc</span>
                <input
                  type="date"
                  value={planForm.endDate}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current ? { ...current, endDate: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Tien do ban dau (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={planForm.progress}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? { ...current, progress: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Planned hours</span>
                <input
                  type="number"
                  min={0}
                  value={planForm.plannedHours}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? { ...current, plannedHours: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>
              <div className="modal-actions span-2">
                <button type="button" className="ghost-button" onClick={closePlanModal}>
                  Huy
                </button>
                <button type="button" className="ghost-button" onClick={resetPlanForm}>
                  Tao form moi
                </button>
                <button type="submit" className="primary-button" disabled={!canSubmitPlanForm}>
                  <Save size={16} />
                  {planForm.id ? 'Luu task hien tai' : 'Them task / subtask'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedTask && executionForm && isExecutionModalOpen ? (
        <div className="modal-backdrop" onClick={closeExecutionModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Execution update</span>
                <h3>Cap nhat tien do</h3>
                <p>{selectedTask.name}</p>
              </div>
              <div className="panel-actions">
                <StatusPill
                  label={`${selectedTask.progress}%`}
                  tone={getStatusTone(selectedTask.status)}
                />
                <button
                  type="button"
                  className="ghost-button icon-button"
                  onClick={closeExecutionModal}
                  aria-label="Dong"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="stack-list">
              <div className="list-row">
                <div>
                  <strong>{selectedTask.name}</strong>
                  <p>{selectedTask.deliverable}</p>
                </div>
                <div className="metric-pair">
                  <span>Planned: {formatHours(selectedTask.plannedHours)}</span>
                  <span>Actual: {formatHours(selectedTask.actualHours)}</span>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Phu trach</strong>
                  <p>{getTaskAssigneeNames(selectedTask)}</p>
                </div>
                <small>
                  {formatDate(selectedTask.startDate)} - {formatDate(selectedTask.endDate)}
                </small>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleExecutionSubmit}>
              <label>
                <span>Thanh vien</span>
                <select
                  value={executionForm.memberId}
                  onChange={(event) =>
                    setExecutionForm((current) =>
                      current ? { ...current, memberId: event.target.value } : current,
                    )
                  }
                  disabled={!canManageProject}
                >
                  {selectedTaskAssigneeIds.map((memberId) => (
                    <option key={memberId} value={memberId}>
                      {getUser(memberId)?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ngay</span>
                <input
                  type="date"
                  value={executionForm.date}
                  onChange={(event) =>
                    setExecutionForm((current) =>
                      current ? { ...current, date: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Gio cong</span>
                <input
                  type="number"
                  min={0}
                  value={executionForm.hours}
                  onChange={(event) =>
                    setExecutionForm((current) =>
                      current
                        ? { ...current, hours: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Tien do (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={executionForm.progress}
                  onChange={(event) =>
                    setExecutionForm((current) =>
                      current
                        ? { ...current, progress: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>
              <label className="span-2">
                <span>Ghi chu</span>
                <textarea
                  rows={3}
                  value={executionForm.progressNote}
                  onChange={(event) =>
                    setExecutionForm((current) =>
                      current
                        ? { ...current, progressNote: event.target.value }
                        : current,
                    )
                  }
                  placeholder="Cong viec da xong hoac vuong mac"
                />
              </label>
              <div className="modal-actions span-2">
                <button type="button" className="ghost-button" onClick={closeExecutionModal}>
                  Huy
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!canUpdateSelectedTask}
                >
                  <Timer size={16} />
                  Luu cap nhat
                </button>
              </div>
            </form>

            <div className="panel-heading sub-heading">
              <div>
                <span className="eyebrow">Worklog history</span>
                <h3>Lich su cap nhat</h3>
              </div>
              <StatusPill label={`${selectedTaskWorklogs.length} dong`} tone="neutral" />
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Ngay</th>
                    <th>Thanh vien</th>
                    <th>Gio cong</th>
                    <th>Noi dung</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTaskWorklogs.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.date)}</td>
                      <td>{getUser(item.memberId)?.name}</td>
                      <td>{formatHours(item.hours)}</td>
                      <td>{item.progressNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="stack-list">
              <div className="list-row">
                <div>
                  <strong>Cap nhat gan nhat</strong>
                  <p>
                    {selectedTaskWorklogs[0]
                      ? formatDate(selectedTaskWorklogs[0].date)
                      : 'Chua co worklog'}
                  </p>
                </div>
                <StatusPill
                  label={getCatalogLabel(catalogs.taskStatuses, selectedTask.status)}
                  tone={getStatusTone(selectedTask.status)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeDetailTab === 'WORKLOAD' ? (
        <WorkloadTabPanel
          project={project}
          users={users}
          projects={projects}
          updateProject={updateProject}
          workloadLogs={projectActivityLogs.filter((l) => l.action === 'ALLOCATION_UPDATED')}
          getUserById={getUser}
        />
      ) : null}

    </div>
  )
}

/* ═══════ Inline Activity Log (reusable per-tab history table) ═══════ */

function InlineActivityLog({
  logs,
  getUser,
}: {
  logs: import('../types').ActivityLog[]
  getUser: (id?: string) => User | null
}) {
  if (logs.length === 0) return null

  return (
    <article className="panel panel--compact" style={{ marginTop: '1.5rem' }}>
      <div className="panel-heading panel-heading--compact">
        <div>
          <span className="eyebrow">Lich su thao tac</span>
          <h4>Nhat ky thay doi</h4>
        </div>
        <StatusPill label={`${logs.length} thay doi`} tone="neutral" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Thoi gian</th>
              <th>Nguoi thuc hien</th>
              <th>Hanh dong</th>
              <th>Doi tuong</th>
              <th>Chi tiet</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                <td>{getUser(log.userId)?.name ?? log.userId}</td>
                <td>
                  <StatusPill
                    label={ACTION_LABELS[log.action]}
                    tone={ACTION_TONES[log.action]}
                  />
                </td>
                <td>{log.entityName}</td>
                <td>
                  {log.changes.map((c, i) => (
                    <div key={i} style={{ fontSize: '0.85em' }}>
                      <strong>{c.field}</strong>: {String(c.oldValue ?? '(trong)')} &rarr; {String(c.newValue ?? '(trong)')}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

/* ═══════ Workload Tab Panel (extracted as sub-component for clarity) ═══════ */

function WorkloadTabPanel({
  project,
  users,
  projects,
  updateProject,
  workloadLogs,
  getUserById,
}: {
  project: Project
  users: User[]
  projects: Project[]
  updateProject: (input: { projectId: string; patch: Partial<Project> }) => Promise<void>
  workloadLogs: import('../types').ActivityLog[]
  getUserById: (id?: string) => User | null
}) {
  const toast = useToast()
  const { confirm } = useConfirm()
  const loading = useLoading()
  const projectMonths = getProjectAllocationMonths(project)
  const estimatedEndDate = getEstimatedProjectEndDate(project)

  const resolvedMembers = (() => {
    const mappedMembers = project.personnelInfo.aitsMembers
      .map((personnel) => {
        const user = resolveAitsUser(personnel, users)
        if (!user) return null
        return { memberId: user.id, user, personnel } satisfies ResolvedAitsMember
      })
      .filter((item): item is ResolvedAitsMember => item !== null)
    const mappedIds = new Set(mappedMembers.map((item) => item.memberId))
    const fallbackMembers = [...new Set([project.adminId, ...project.memberIds])]
      .filter((memberId) => !mappedIds.has(memberId))
      .map((memberId) => {
        const user = users.find((item) => item.id === memberId)
        if (!user) return null
        const savedTotal = project.monthlyAllocations
          .filter((a) => a.memberId === memberId)
          .reduce((sum, a) => sum + a.hours, 0)
        return {
          memberId,
          user,
          personnel: buildFallbackAitsPersonnel(user, project, savedTotal),
        } satisfies ResolvedAitsMember
      })
      .filter((item): item is ResolvedAitsMember => item !== null)
    return [...mappedMembers, ...fallbackMembers]
  })()

  // Since 12/05/2026 every aitsMember has a userId, so the "Nhan su chua lien
  // ket" panel that surfaced free-text orphans has been retired.

  const [draftAllocations, setDraftAllocations] = useState<Record<string, number>>(() =>
    buildProjectDraftAllocations(project, resolvedMembers, projectMonths),
  )
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDraftAllocations(buildProjectDraftAllocations(project, resolvedMembers, projectMonths))
    setMessage('')
  }, [project.id, projectMonths.length, projects])

  function getDraftHours(memberId: string, month: string) {
    return draftAllocations[buildAllocationKey(memberId, month)] ?? 0
  }

  function updateDraftHours(memberId: string, month: string, value: number) {
    setDraftAllocations((current) => ({
      ...current,
      [buildAllocationKey(memberId, month)]: Math.max(0, Number.isFinite(value) ? Math.round(value) : 0),
    }))
  }

  function autoDistributeMember(member: ResolvedAitsMember) {
    const even = distributeHoursEvenly(member.personnel.totalPlannedHours, projectMonths)
    setDraftAllocations((current) => {
      const next = { ...current }
      projectMonths.forEach((month) => {
        next[buildAllocationKey(member.memberId, month)] = even[month] ?? 0
      })
      return next
    })
  }

  function autoDistributeAll() {
    setDraftAllocations(buildProjectDraftAllocations(project, resolvedMembers, projectMonths))
  }

  const rowSummaries = resolvedMembers.map((member) => {
    const targetHours = Math.max(0, Math.round(member.personnel.totalPlannedHours))
    const monthDetails = projectMonths.map((month) => {
      const currentHours = getDraftHours(member.memberId, month)
      const otherHours = projects
        .filter((p) => p.id !== project.id)
        .reduce((sum, p) => {
          return (
            sum +
            p.monthlyAllocations
              .filter((a) => a.memberId === member.memberId && a.month === month)
              .reduce((s, a) => s + a.hours, 0)
          )
        }, 0)
      return {
        month,
        currentProjectHours: currentHours,
        otherProjectsHours: otherHours,
        totalMonthHours: currentHours + otherHours,
        remainingHours: member.user.monthlyCapacity - (currentHours + otherHours),
        capacity: member.user.monthlyCapacity,
      }
    })
    const allocatedHours = monthDetails.reduce((sum, d) => sum + d.currentProjectHours, 0)
    return {
      member,
      targetHours,
      allocatedHours,
      deltaHours: targetHours - allocatedHours,
      monthDetails,
      overloadedMonths: monthDetails.filter((d) => d.remainingHours < 0).length,
    }
  })

  const totalTargetHours = rowSummaries.reduce((sum, r) => sum + r.targetHours, 0)
  const totalDraftHours = rowSummaries.reduce((sum, r) => sum + r.allocatedHours, 0)
  const invalidRows = rowSummaries.filter((r) => r.deltaHours !== 0).length
  const overloadedCells = rowSummaries.reduce((sum, r) => sum + r.overloadedMonths, 0)
  const canSave = invalidRows === 0

  async function handleSave() {
    const ok = await confirm({
      title: 'Lưu phân bổ giờ công?',
      description: 'Hệ thống sẽ cập nhật phân bổ theo tháng cho từng thành viên TTK.',
      tone: 'primary',
      confirmLabel: 'Lưu phân bổ',
    })
    if (!ok) return

    const editableIds = new Set(resolvedMembers.map((m) => m.memberId))
    const editableMonths = new Set(projectMonths)
    const preserved = project.monthlyAllocations.filter(
      (a) => !(editableIds.has(a.memberId) && editableMonths.has(a.month)),
    )
    const next = [...preserved]
    rowSummaries.forEach((row) => {
      row.monthDetails.forEach((d) => {
        if (d.currentProjectHours > 0) {
          next.push({ memberId: row.member.memberId, month: d.month, hours: d.currentProjectHours })
        }
      })
    })
    try {
      await loading.run('Đang lưu phân bổ giờ công…', () =>
        updateProject({
          projectId: project.id,
          patch: {
            monthlyAllocations: next.sort((a, b) =>
              a.month.localeCompare(b.month) || a.memberId.localeCompare(b.memberId),
            ),
          },
        }),
      )
      setMessage('')
      toast.success('Đã lưu phân bổ giờ công')
    } catch (err) {
      toast.error('Không lưu được phân bổ giờ công', err instanceof Error ? err.message : '')
    }
  }

  return (
    <div className="detail-tab-panel" style={{ display: 'grid', gap: '1rem' }}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Allocation planner</span>
          <h3>Phan bo gio cong</h3>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {formatDate(project.startDate)} -{' '}
            {formatDate(estimatedEndDate.format('YYYY-MM-DD'))} ({projectMonths.length} thang)
          </p>
        </div>
        <div className="panel-actions">
          <button type="button" className="ghost-button ghost-button--compact" onClick={autoDistributeAll}>
            <Sparkles size={16} />
            Chia deu
          </button>
          <button type="button" className="primary-button primary-button--compact" onClick={handleSave} disabled={!canSave}>
            <Save size={16} />
            Luu phan bo
          </button>
        </div>
      </div>

      {message ? <p className="form-success">{message}</p> : null}

      <section className="detail-grid detail-grid--compact">
        <div className="detail-card">
          <span>Muc tieu</span>
          <strong>{formatHours(totalTargetHours)}</strong>
        </div>
        <div className="detail-card">
          <span>Da draft</span>
          <strong>{formatHours(totalDraftHours)}</strong>
        </div>
        <div className="detail-card">
          <span>Dong loi</span>
          <strong>{invalidRows}</strong>
        </div>
        <div className="detail-card">
          <span>Qua tai</span>
          <strong>{overloadedCells}</strong>
        </div>
      </section>

      <div className="table-wrapper workload-planner-table-wrapper">
        <table className="workload-planner-table">
          <thead>
            <tr>
              <th>Thanh vien</th>
              <th>Muc tieu</th>
              <th>Da phan bo</th>
              <th>Can bang</th>
              <th>Tac vu</th>
              {projectMonths.map((month) => (
                <th key={month}>{formatMonthLabel(month)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowSummaries.map((row) => (
              <tr key={row.member.memberId}>
                <td className="workload-member-cell">
                  <strong>{row.member.personnel.fullName || row.member.user.name}</strong>
                  <p>{row.member.personnel.role || row.member.user.title}</p>
                  <small>{row.member.user.email}</small>
                </td>
                <td>
                  <strong>{formatHours(row.targetHours)}</strong>
                  <p className="workload-cell-note">Theo nhan su AITS</p>
                </td>
                <td>
                  <strong>{formatHours(row.allocatedHours)}</strong>
                  <p className="workload-cell-note">{row.monthDetails.length} thang</p>
                </td>
                <td>
                  <StatusPill
                    label={`${row.deltaHours > 0 ? 'Thieu' : row.deltaHours < 0 ? 'Vuot' : 'Can bang'} ${formatHours(Math.abs(row.deltaHours))}`}
                    tone={row.deltaHours === 0 ? 'success' : 'warning'}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="ghost-button ghost-button--compact"
                    onClick={() => autoDistributeMember(row.member)}
                  >
                    <RefreshCcw size={15} />
                    Chia deu
                  </button>
                </td>
                {row.monthDetails.map((detail) => (
                  <td key={`${row.member.memberId}-${detail.month}`}>
                    <div className="workload-month-cell">
                      <input
                        type="number"
                        min={0}
                        value={detail.currentProjectHours}
                        onChange={(e) =>
                          updateDraftHours(row.member.memberId, detail.month, Number(e.target.value))
                        }
                      />
                      <div className="workload-month-cell__meta">
                        <span>DA khac: {formatHours(detail.otherProjectsHours)}</span>
                        <span>
                          Tong: {formatHours(detail.totalMonthHours)}/{formatHours(detail.capacity)}
                        </span>
                        <span className={detail.remainingHours < 0 ? 'text-danger' : ''}>
                          Con: {formatHours(detail.remainingHours)}
                        </span>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InlineActivityLog logs={workloadLogs} getUser={getUserById} />
    </div>
  )
}
