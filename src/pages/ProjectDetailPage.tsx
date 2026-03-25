import dayjs from 'dayjs'
import { ChevronDown, ChevronUp, CirclePlus, Edit3, Save, Timer, Workflow, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { GanttChart } from '../components/GanttChart'
import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import {
  getTaskAssigneeIds,
  getTaskPrimaryAssigneeId,
  getHealthTone,
  getProjectById,
  getProjectTasks,
  getStatusTone,
} from '../lib/calculations'
import { formatDate, formatHours, getCatalogLabel } from '../lib/formatters'
import type {
  DeploymentMode,
  GanttItem,
  PlanItem,
  ProjectAitsPersonnel,
  ProjectExternalPersonnel,
  Project,
  ProjectFinancialInfo,
  ProjectPersonnelInfo,
  ProjectReferenceItem,
  TtkMode,
} from '../types'

type ReferenceGroupKey =
  | 'outputContracts'
  | 'inputContracts'
  | 'deploymentApprovals'
  | 'projectTeamDecisions'

type FinancialFieldKey = 'revenue' | 'internalCost' | 'externalCost' | 'profit'
type ExternalPersonnelGroupKey = 'customerMembers' | 'partners'

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
    fullName: item.fullName,
    titleUnit: item.titleUnit,
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
    titleUnit: item.titleUnit,
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
    fullName: '',
    titleUnit: '',
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
    titleUnit: '',
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
      fullName: item.fullName.trim(),
      titleUnit: item.titleUnit.trim(),
      role: item.role.trim(),
      responsibility: item.responsibility.trim(),
      totalPlannedHours: Number(item.totalPlannedHours) || 0,
      email: item.email.trim(),
      phone: item.phone.trim(),
    }))
    .filter(
      (item) =>
        item.fullName ||
        item.titleUnit ||
        item.role ||
        item.responsibility ||
        item.email ||
        item.phone ||
        item.totalPlannedHours,
    )
}

function sanitizeExternalPersonnel(items: ProjectExternalPersonnel[]) {
  return items
    .map((item) => ({
      fullName: item.fullName.trim(),
      titleUnit: item.titleUnit.trim(),
      role: item.role.trim(),
      responsibility: item.responsibility.trim(),
      email: item.email.trim(),
      phone: item.phone.trim(),
    }))
    .filter(
      (item) =>
        item.fullName ||
        item.titleUnit ||
        item.role ||
        item.responsibility ||
        item.email ||
        item.phone,
    )
}

function formatCurrencyPreview(amount: number) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} VND`
}

function buildOverviewForm(project: Project) {
  return {
    summary: project.summary,
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
      allocationMonth: task.monthAllocations[0]?.month ?? dayjs().format('YYYY-MM'),
      allocationHours: task.monthAllocations[0]?.hours ?? task.plannedHours,
      dependencyNote: task.dependencyNote,
      deliverable: task.deliverable,
    }
  }

  return {
    id: '',
    parentId: '',
    name: '',
    workType: 'PRELIMINARY' as const,
    assigneeIds: project.memberIds[0] ? [project.memberIds[0]] : [],
    assigneeId: project.memberIds[0] ?? '',
    status: 'NOT_STARTED' as const,
    baselineStartDate: project.startDate,
    baselineEndDate: project.endDate,
    startDate: project.startDate,
    endDate: project.endDate,
    progress: 0,
    plannedHours: 16,
    allocationMonth: dayjs(project.startDate).format('YYYY-MM'),
    allocationHours: 16,
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
  getAssigneeNames: (task: PlanItem) => string,
): GanttItem[] {
  return items.map(({ task, depth }) => ({
    id: task.id,
    label: depth > 0 ? `Cap ${depth + 1}: ${task.name}` : task.name,
    sublabel: `${getAssigneeNames(task)} | ${task.deliverable || 'Dang cap nhat deliverable'}`,
    startDate: task.startDate,
    endDate: task.endDate,
    progress: task.progress,
    status: task.status,
  }))
}

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
    savePlanItem,
    addWorklog,
    getUser,
  } = useAppData()
  const project = getProjectById(projects, projectId)

  const [message, setMessage] = useState('')
  const [overviewForm, setOverviewForm] = useState<ReturnType<typeof buildOverviewForm> | null>(null)
  const [personnelForm, setPersonnelForm] = useState<ReturnType<typeof buildPersonnelForm> | null>(null)
  const [planForm, setPlanForm] = useState<ReturnType<typeof buildPlanForm> | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [executionForm, setExecutionForm] = useState<ReturnType<typeof buildExecutionForm> | null>(null)
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false)
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(true)
  const [isPersonnelCollapsed, setIsPersonnelCollapsed] = useState(false)
  const [isPlanBuilderCollapsed, setIsPlanBuilderCollapsed] = useState(false)

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
    (task) => getTaskAssigneeNames(task) || 'Chua phan cong',
  )
  const focusedSubtaskItems = focusedOverviewTask
    ? getDescendantTasks(projectTasks, focusedOverviewTask.id)
    : []
  const focusedSubtaskGanttItems = buildScopedGanttItems(
    focusedSubtaskItems,
    (task) => getTaskAssigneeNames(task) || 'Chua phan cong',
  )

  useEffect(() => {
    if (!project) {
      return
    }

    setOverviewForm(buildOverviewForm(project))
    setPersonnelForm(buildPersonnelForm(project))
    setPlanForm(buildPlanForm(project))
  }, [project])

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

  if (!project || !currentUser || !overviewForm || !personnelForm || !planForm) {
    return (
      <div className="page-grid">
        <section className="panel empty-panel">
          <h3>Khong tim thay du an</h3>
          <p>Du an nay chua co trong du lieu demo hien tai.</p>
          <Link to="/projects" className="secondary-button">
            Quay lai danh sach
          </Link>
        </section>
      </div>
    )
  }

  const canManageProject =
    currentUser.role === 'SYSTEM_ADMIN' || currentUser.id === project.adminId
  const canUpdateSelectedTask =
    !!selectedTask &&
    (canManageProject || getTaskAssigneeIds(selectedTask).includes(currentUser.id))
  const canCreateChildForSelectedTask =
    !!selectedTask &&
    (canManageProject || getTaskAssigneeIds(selectedTask).includes(currentUser.id))
  const isCreatingChildTask = !!planForm.parentId && !planForm.id
  const canOpenPlanModal =
    canManageProject || (isCreatingChildTask && canCreateChildForSelectedTask)
  const canSubmitPlanForm =
    canManageProject || (isCreatingChildTask && canCreateChildForSelectedTask)
  const selectedTaskWorklogs = selectedTask
    ? worklogs
        .filter((item) => item.taskId === selectedTask.id)
        .sort((left, right) => right.date.localeCompare(left.date))
    : []
  const projectManagers = users.filter(
    (user) => user.role === 'PROJECT_ADMIN' || user.role === 'SYSTEM_ADMIN',
  )

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
            <p>Ten tai lieu va ghi chu can cu lien quan.</p>
          </div>
          {canManageProject ? (
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
                  <span>Ten hop dong / tai lieu</span>
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
                {canManageProject ? (
                  <button
                    type="button"
                    className="ghost-button ghost-button--compact overview-reference-item__remove"
                    onClick={() => removeReferenceItemFromGroup(group, index)}
                  >
                    Xoa
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="overview-empty-note">
            <p>Chua co du lieu cho nhom can cu nay.</p>
          </div>
        )}
      </div>
    )
  }

  async function handlePersonnelSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!personnelForm || !project) {
      return
    }

    const sanitizedPersonnel: ProjectPersonnelInfo = {
      aitsMembers: sanitizeAitsPersonnel(personnelForm.aitsMembers),
      customerMembers: sanitizeExternalPersonnel(personnelForm.customerMembers),
      partners: sanitizeExternalPersonnel(personnelForm.partners),
    }

    await updateProject({
      projectId: project.id,
      patch: {
        personnelInfo: sanitizedPersonnel,
      },
    })

    setPersonnelForm(sanitizedPersonnel)
    setMessage('Da cap nhat thong tin nhan su du an.')
  }

  async function handleOverviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const sanitizedOverview = {
      ...overviewForm!,
      summary: overviewForm!.summary.trim(),
      basisInfo: {
        ...overviewForm!.basisInfo,
        outputContracts: sanitizeReferenceItems(overviewForm!.basisInfo.outputContracts),
        inputContracts: sanitizeReferenceItems(overviewForm!.basisInfo.inputContracts),
        deploymentApprovals: sanitizeReferenceItems(overviewForm!.basisInfo.deploymentApprovals),
        projectTeamDecisions: sanitizeReferenceItems(overviewForm!.basisInfo.projectTeamDecisions),
        durationDays: Number(overviewForm!.basisInfo.durationDays) || 0,
        durationHours: Number(overviewForm!.basisInfo.durationHours) || 0,
      },
      financialInfo: {
        revenue: {
          amount: Number(overviewForm!.financialInfo.revenue.amount) || 0,
          note: overviewForm!.financialInfo.revenue.note.trim(),
        },
        internalCost: {
          amount: Number(overviewForm!.financialInfo.internalCost.amount) || 0,
          note: overviewForm!.financialInfo.internalCost.note.trim(),
        },
        externalCost: {
          amount: Number(overviewForm!.financialInfo.externalCost.amount) || 0,
          note: overviewForm!.financialInfo.externalCost.note.trim(),
        },
        profit: {
          amount: Number(overviewForm!.financialInfo.profit.amount) || 0,
          note: overviewForm!.financialInfo.profit.note.trim(),
        },
        costSource: overviewForm!.financialInfo.costSource.trim(),
      },
    }

    await updateProject({
      projectId: project!.id,
      patch: sanitizedOverview,
    })

    setOverviewForm(sanitizedOverview)
    setMessage('Da cap nhat thong tin chung du an.')
  }

  async function handlePlanSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmitPlanForm) {
      setMessage('Ban khong co quyen tao hoac cap nhat task nay.')
      return
    }

    if (!planForm!.assigneeIds.length) {
      setMessage('Hay chon it nhat mot nhan su tham gia task.')
      return
    }

    await savePlanItem({
      id: planForm!.id || undefined,
      projectId: project!.id,
      parentId: planForm!.parentId || null,
      name: planForm!.name,
      workType: planForm!.workType,
      ownerId: project!.adminId,
      assigneeId: planForm!.assigneeId || planForm!.assigneeIds[0],
      assigneeIds: planForm!.assigneeIds,
      status: planForm!.status,
      baselineStartDate: planForm!.baselineStartDate,
      baselineEndDate: planForm!.baselineEndDate,
      startDate: planForm!.startDate,
      endDate: planForm!.endDate,
      progress: Number(planForm!.progress),
      plannedHours: Number(planForm!.plannedHours),
      monthAllocations: [
        {
          month: planForm!.allocationMonth,
          hours: Number(planForm!.allocationHours),
        },
      ],
      dependencyNote: planForm!.dependencyNote,
      deliverable: planForm!.deliverable,
    })

    setMessage(
      planForm!.id
        ? 'Da cap nhat task/subtask trong ke hoach trien khai.'
        : 'Da them task/subtask moi cho ke hoach trien khai.',
    )
    setPlanForm(buildPlanForm(project!))
    setIsPlanModalOpen(false)
  }

  async function handleExecutionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedTask || !executionForm) {
      return
    }

    await addWorklog({
      taskId: selectedTask.id,
      projectId: project!.id,
      memberId: executionForm.memberId,
      date: executionForm.date,
      hours: Number(executionForm.hours),
      progressNote: executionForm.progressNote,
      progress: Number(executionForm.progress),
    })

    setMessage('Da cap nhat tien do va gio cong thuc te cho task duoc chon.')
    setIsExecutionModalOpen(false)
  }

  function openTaskModal() {
    setPlanForm(buildPlanForm(project!))
    setIsPlanModalOpen(true)
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
            Quay lai danh sach
          </Link>
        }
      />

      {message ? <p className="form-success">{message}</p> : null}

      <section className="detail-grid detail-grid--compact">
        <div className="detail-card">
          <span>PM phu trach</span>
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
          <span>Tien do du an</span>
          <strong>{project.progress}%</strong>
        </div>
      </section>

      <section className="panel panel--compact">
        <div className="panel-heading panel-heading--compact">
          <div>
            <span className="eyebrow">Overview</span>
            <h3>Khai bao va cap nhat thong tin chung</h3>
          </div>
          <div className="panel-actions">
            <StatusPill label={canManageProject ? 'Co the cap nhat' : 'Chi xem'} tone="info" />
            <button
              type="button"
              className="ghost-button ghost-button--compact"
              onClick={() => setIsOverviewCollapsed((current) => !current)}
            >
              {isOverviewCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              {isOverviewCollapsed ? 'Mo rong' : 'Thu gon'}
            </button>
          </div>
        </div>

        {isOverviewCollapsed ? (
          <div className="panel-collapsed-note">
            <span>PM: {getUser(overviewForm.adminId)?.name ?? 'Chua phan cong'}</span>
            <span>Bat dau: {formatDate(overviewForm.startDate)}</span>
            <span>
              TTK:{' '}
              {ttkModeOptions.find((item) => item.value === overviewForm.basisInfo.ttkMode)?.label}
            </span>
            <span>Doanh thu: {formatCurrencyPreview(overviewForm.financialInfo.revenue.amount)}</span>
          </div>
        ) : (
          <form className="form-grid form-grid--compact overview-form" onSubmit={handleOverviewSubmit}>
            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Nhom 1</span>
                  <h4>Thong tin chung</h4>
                </div>
                <p>Cap nhat mo ta du an, moc khoi dong tien do, trang thai va PM phu trach.</p>
              </div>

              <div className="overview-section__grid">
                <label className="span-2">
                  <span>Mo ta du an</span>
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
                  <span>Ngay bat dau trien khai tien do</span>
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
                  <span>PM phu trach</span>
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
              </div>
            </div>

            <div className="overview-section span-2">
              <div className="overview-section__header">
                <div>
                  <span className="eyebrow">Nhom 2</span>
                  <h4>Can cu</h4>
                </div>
                <p>Quan ly danh muc hop dong, phe duyet, quyet dinh va thong tin cach thuc trien khai.</p>
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
                  <h4>Doanh thu, chi phi, loi nhuan</h4>
                </div>
                <p>Theo doi doanh thu, cac nhom chi phi, loi nhuan du an va nguon chi phi trien khai.</p>
              </div>

              <div className="overview-financial-grid">
                <div className="overview-financial-card">
                  <div className="overview-financial-card__header">
                    <strong>Doanh thu du an</strong>
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
                    <span>Note so PAKD can cu</span>
                    <input
                      value={overviewForm.financialInfo.revenue.note}
                      onChange={(event) => updateFinancialField('revenue', 'note', event.target.value)}
                      disabled={!canManageProject}
                    />
                  </label>
                </div>

                <div className="overview-financial-card">
                  <div className="overview-financial-card__header">
                    <strong>Chi phi trien khai noi bo</strong>
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
                    <span>Note so PAKD can cu</span>
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
                    <strong>Chi phi trien khai thue ngoai</strong>
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
                    <span>Note so PAKD can cu</span>
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
                    <strong>Loi nhuan du an</strong>
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
                    <span>Note so PAKD can cu</span>
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

            {canManageProject ? (
              <button type="submit" className="primary-button">
                <Save size={16} />
                Luu thong tin chung
              </button>
            ) : null}
          </form>
        )}
      </section>

      <section className="panel panel--compact">
        <div className="panel-heading panel-heading--compact">
          <div>
            <span className="eyebrow">Personnel</span>
            <h3>Thong tin nhan su</h3>
          </div>
          <div className="panel-actions">
            <StatusPill label={canManageProject ? 'Co the cap nhat' : 'Chi xem'} tone="info" />
            <button
              type="button"
              className="ghost-button ghost-button--compact"
              onClick={() => setIsPersonnelCollapsed((current) => !current)}
            >
              {isPersonnelCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              {isPersonnelCollapsed ? 'Mo rong' : 'Thu gon'}
            </button>
          </div>
        </div>

        {isPersonnelCollapsed ? (
          <div className="panel-collapsed-note">
            <span>{personnelForm.aitsMembers.length} nhan su AITS</span>
            <span>{personnelForm.customerMembers.length} nhan su khach hang</span>
            <span>{personnelForm.partners.length} doi tac</span>
          </div>
        ) : (
          <form className="personnel-form" onSubmit={handlePersonnelSubmit}>
            <div className="personnel-group">
              <div className="personnel-group__header">
                <div>
                  <span className="eyebrow">Bang 1</span>
                  <h4>Danh sach nhan su AITS</h4>
                  <p>Thong tin nhan su noi bo tham gia du an va tong gio cong TK.</p>
                </div>
                {canManageProject ? (
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
                      <th>Ho va ten</th>
                      <th>Chuc danh don vi</th>
                      <th>Vai tro</th>
                      <th>Nhiem vu</th>
                      <th>Tong gio cong TK</th>
                      <th>Email</th>
                      <th>SDT</th>
                      {canManageProject ? <th>Tac vu</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {personnelForm.aitsMembers.length ? (
                      personnelForm.aitsMembers.map((member, index) => (
                        <tr key={`aits-${index}`}>
                          <td className="personnel-table__index">{index + 1}</td>
                          <td>
                            <input
                              value={member.fullName}
                              onChange={(event) =>
                                updateAitsPersonnelItem(index, 'fullName', event.target.value)
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              value={member.titleUnit}
                              onChange={(event) =>
                                updateAitsPersonnelItem(index, 'titleUnit', event.target.value)
                              }
                              disabled={!canManageProject}
                            />
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
                            <input
                              type="email"
                              value={member.email}
                              onChange={(event) =>
                                updateAitsPersonnelItem(index, 'email', event.target.value)
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          <td>
                            <input
                              type="tel"
                              value={member.phone}
                              onChange={(event) =>
                                updateAitsPersonnelItem(index, 'phone', event.target.value)
                              }
                              disabled={!canManageProject}
                            />
                          </td>
                          {canManageProject ? (
                            <td className="personnel-table__actions">
                              <button
                                type="button"
                                className="ghost-button ghost-button--compact"
                                onClick={() => removeAitsPersonnelItem(index)}
                              >
                                Xoa
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canManageProject ? 9 : 8} className="personnel-table__empty">
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
                  <h4>Danh sach nhan su Khach hang</h4>
                  <p>Dau moi nghiep vu, phoi hop va phe duyet phia khach hang.</p>
                </div>
                {canManageProject ? (
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
                      <th>Chuc danh don vi</th>
                      <th>Nhiem vu</th>
                      <th>Email</th>
                      <th>SDT</th>
                      {canManageProject ? <th>Tac vu</th> : null}
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
                              value={member.titleUnit}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'customerMembers',
                                  index,
                                  'titleUnit',
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
                          {canManageProject ? (
                            <td className="personnel-table__actions">
                              <button
                                type="button"
                                className="ghost-button ghost-button--compact"
                                onClick={() => removeExternalPersonnelItem('customerMembers', index)}
                              >
                                Xoa
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canManageProject ? 7 : 6} className="personnel-table__empty">
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
                  <h4>Danh sach doi tac</h4>
                  <p>Thong tin nhan su doi tac tham gia trien khai hoac ho tro du an.</p>
                </div>
                {canManageProject ? (
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
                      <th>Chuc danh don vi</th>
                      <th>Vai tro</th>
                      <th>Nhiem vu</th>
                      <th>Email</th>
                      <th>SDT</th>
                      {canManageProject ? <th>Tac vu</th> : null}
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
                              value={member.titleUnit}
                              onChange={(event) =>
                                updateExternalPersonnelItem(
                                  'partners',
                                  index,
                                  'titleUnit',
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
                          {canManageProject ? (
                            <td className="personnel-table__actions">
                              <button
                                type="button"
                                className="ghost-button ghost-button--compact"
                                onClick={() => removeExternalPersonnelItem('partners', index)}
                              >
                                Xoa
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canManageProject ? 8 : 7} className="personnel-table__empty">
                          Chua co doi tac tham gia du an.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {canManageProject ? (
              <button type="submit" className="primary-button">
                <Save size={16} />
                Luu thong tin nhan su
              </button>
            ) : null}
          </form>
        )}
      </section>

      <section className="task-workspace">
        <article className="panel panel--compact">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Plan builder</span>
              <h3>Khai bao task lon va subtask</h3>
            </div>
            <div className="panel-actions">
              <StatusPill label={canManageProject ? 'Cho phep cap nhat' : 'Chi xem'} tone="info" />
              {canManageProject ? (
                <button
                  type="button"
                  className="primary-button primary-button--compact"
                  onClick={openTaskModal}
                >
                  <CirclePlus size={16} />
                  Tao task tong quan
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button ghost-button--compact"
                onClick={() => setIsPlanBuilderCollapsed((current) => !current)}
              >
                {isPlanBuilderCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                {isPlanBuilderCollapsed ? 'Mo rong' : 'Thu gon'}
              </button>
            </div>
          </div>

          {isPlanBuilderCollapsed ? (
            <div className="panel-collapsed-note">
              <span>{projectTasks.length} task / subtask</span>
              {selectedTask ? <span>Dang focus: {selectedTask.name}</span> : null}
              {selectedTask ? <span>{selectedTask.progress}% tien do</span> : null}
            </div>
          ) : (
            <>
              {selectedTask ? (
                <div className="stack-list">
                  <div className="list-row list-row--compact">
                    <div>
                      <strong>Task dang focus: {selectedTask.name}</strong>
                      <p>
                        {getTaskAssigneeNames(selectedTask)} | {selectedTask.progress}% |{' '}
                        {formatHours(selectedTask.actualHours)} da ghi nhan
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
                      {canManageProject ? (
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
                      <p>Chi hien thi cac task tong quan. Chon mot task de xem subtask ben duoi.</p>
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
                            ? 'Timeline chi tiet cua cac subtask thuoc task tong quan dang focus.'
                            : 'Task tong quan nay chua co subtask de hien thi tren Gantt.'}
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
                        activeId={
                          selectedTask && selectedTask.parentId ? selectedTask.id : undefined
                        }
                        onSelect={setSelectedTaskId}
                      />
                    ) : (
                      <div className="plan-gantt-empty">
                        <p>
                          Hay them subtask cho <strong>{focusedOverviewTask.name}</strong> de xem
                          timeline chi tiet.
                        </p>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
            </>
          )}
        </article>
      </section>

      {canOpenPlanModal && isPlanModalOpen ? (
        <div className="modal-backdrop" onClick={closePlanModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Plan builder</span>
                <h3>
                  {planForm.id
                    ? 'Sua task / subtask'
                    : planForm.parentId
                      ? 'Them subtask lien ket'
                      : 'Them task tong quan'}
                </h3>
                <p>
                  {planForm.id
                    ? 'Cap nhat cau truc, phan cong va ke hoach cho task dang chon.'
                    : planForm.parentId
                      ? 'Subtask moi se duoc lien ket vao task cha ma ban da chon.'
                      : 'Khai bao task tong quan de bat dau xay dung ke hoach trien khai.'}
                </p>
              </div>
              <button
                type="button"
                className="ghost-button icon-button"
                onClick={closePlanModal}
                aria-label="Dong popup ke hoach"
              >
                <X size={16} />
              </button>
            </div>

            <form className="form-grid" onSubmit={handlePlanSubmit}>
              <label className="span-2">
                <span>Ten task / subtask</span>
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
                  disabled={!canManageProject && isCreatingChildTask}
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
              <label>
                <span>Loai cong viec</span>
                <select
                  value={planForm.workType}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? {
                            ...current,
                            workType: event.target.value as PlanItem['workType'],
                          }
                        : current,
                    )
                  }
                  disabled={!canManageProject && isCreatingChildTask}
                >
                  <option value="PRELIMINARY">Task tong quan</option>
                  <option value="SUBTASK">Subtask</option>
                  <option value="MILESTONE">Milestone</option>
                </select>
              </label>
              <label className="span-2">
                <span>Thanh vien tham gia</span>
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
                <span>Dau moi task</span>
                <select
                  value={planForm.assigneeId}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current ? { ...current, assigneeId: event.target.value } : current,
                    )
                  }
                  disabled={!planForm.assigneeIds.length}
                >
                  {planForm.assigneeIds.length ? null : (
                    <option value="">Hay chon nhan su tham gia</option>
                  )}
                  {planForm.assigneeIds.map((memberId) => (
                    <option key={memberId} value={memberId}>
                      {getUser(memberId)?.name}
                    </option>
                  ))}
                </select>
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
                <span>Baseline start</span>
                <input
                  type="date"
                  value={planForm.baselineStartDate}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? { ...current, baselineStartDate: event.target.value }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Baseline end</span>
                <input
                  type="date"
                  value={planForm.baselineEndDate}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? { ...current, baselineEndDate: event.target.value }
                        : current,
                    )
                  }
                />
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
              <label>
                <span>Thang phan bo</span>
                <input
                  type="month"
                  value={planForm.allocationMonth}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? { ...current, allocationMonth: event.target.value }
                        : current,
                    )
                  }
                />
              </label>
              <label>
                <span>Gio phan bo thang</span>
                <input
                  type="number"
                  min={0}
                  value={planForm.allocationHours}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? { ...current, allocationHours: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>
              <label className="span-2">
                <span>Deliverable</span>
                <input
                  value={planForm.deliverable}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current ? { ...current, deliverable: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="span-2">
                <span>Ghi chu phu thuoc</span>
                <textarea
                  rows={2}
                  value={planForm.dependencyNote}
                  onChange={(event) =>
                    setPlanForm((current) =>
                      current
                        ? { ...current, dependencyNote: event.target.value }
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
                <h3>Cap nhat tien do va gio cong thuc te</h3>
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
                  aria-label="Dong popup cap nhat thuc hien"
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
                  <strong>Nguoi duoc giao</strong>
                  <p>{getTaskAssigneeNames(selectedTask)}</p>
                </div>
                <small>
                  {formatDate(selectedTask.startDate)} - {formatDate(selectedTask.endDate)}
                </small>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleExecutionSubmit}>
              <label>
                <span>Thanh vien cap nhat</span>
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
                <span>Ngay thuc hien</span>
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
                <span>Gio cong thuc te</span>
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
                <span>Tien do moi (%)</span>
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
                <span>Noi dung cap nhat</span>
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
                  placeholder="Mo ta cong viec da hoan thanh hoac vuong mac hien tai"
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
                  Luu thuc hien
                </button>
              </div>
            </form>

            <div className="panel-heading sub-heading">
              <div>
                <span className="eyebrow">Worklog history</span>
                <h3>Lich su cap nhat cua task dang chon</h3>
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
                  <strong>Lan cap nhat gan nhat</strong>
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
    </div>
  )
}
