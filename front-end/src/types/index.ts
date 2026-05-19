export type UserRole =
  | 'PMO'
  | 'ADMIN_HC'
  | 'PM'
  | 'DELIVERY_MEMBER'
  | 'PROJECT_ADMIN'
  | 'SYSTEM_ADMIN'

/**
 * Functional title overlay on top of role.
 * - BRD I originally listed both TCNL and KSV. BA 14/05/2026 removed TCNL —
 *   the second-stage close approver is now TCHC = the regular ADMIN_HC role
 *   (no overlay needed).
 * - KSV remains as a functional title because it lives inside DBCL, not HC.
 */
export type FunctionalTitle = 'NORMAL' | 'KSV'

/** v3.1: 3 operational values per BRD IV.2.2. */
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED'

/** v3.1: derived from plan-item deadlines (computation in v3.2). */
export type HealthStatus = 'STABLE' | 'NEEDS_REVIEW' | 'AT_RISK'

/** BRD III.1.2.2.1 — drives KTQT cap validation. */
export type ProjectType = 'PRELIMINARY' | 'FEASIBILITY' | 'CONTRACT' | 'INTERNAL'

export type BusinessCenterCode = 'BU1' | 'BU2' | 'BU3' | 'BU4' | 'BU5'
export type CustomerGroupCode = 'VNA' | 'LDLK' | 'OT' | 'NB'
export type MarketCode = 'HK' | 'CHK' | 'AN' | 'CP' | 'XD' | 'TC' | 'GD' | 'NL' | 'DN' | 'YT' | 'HH'
export type DomainCode = 'PM' | 'HT' | 'DV'
export type ProjectKindCode = 'NC' | 'KT' | 'HĐ' | 'HD' | 'NB'

export type CloseRequestDecision = 'PENDING' | 'APPROVED' | 'REJECTED'

export type PlanTaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'NEEDS_REPLAN'

export type WorkType = 'PRELIMINARY' | 'SUBTASK' | 'MILESTONE'

export type DelayRaiseStatus = 'OPEN' | 'ACKNOWLEDGED' | 'REPLANNED'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type TtkMode = 'CHUYEN_TRACH' | 'KIEM_NHIEM'
export type DeploymentMode = 'HD_PLHD' | 'TK_THD' | 'NOI_BO'

export interface User {
  id: string
  name: string
  email: string
  username: string
  /** Owned by Supabase Auth — never returned by the API. Demo accounts all use '123456'. */
  password?: string
  role: UserRole
  /** v3.1 BRD I — TCNL/KSV identification independent of role. */
  functionalTitle?: FunctionalTitle
  isActive?: boolean
  employeeCode: string
  title: string
  unit: string
  phone: string
  monthlyCapacity: number
  avatarColor: string
}

export interface ProjectDocument {
  id: string
  title: string
  category: string
  documentNumber: string
  uploadedBy: string
  uploadedAt: string
  updatedBy: string
  updatedAt: string
  url: string
  description: string
}

export interface MonthlyAllocation {
  memberId: string
  month: string
  hours: number
}

export interface ProjectRisk {
  id: string
  title: string
  /** v3.3 BRD IV.5.1.4 — full risk register fields. */
  cause?: string
  description?: string
  level: RiskLevel
  status: 'OPEN' | 'WATCHING' | 'MITIGATED'
  ownerId: string
  mitigation: string
  dueDate?: string | null
  resolutionResult?: string
  resolutionProgress?: number
  nextPlan?: string
  notes?: string
  lastUpdated: string
}

export type ExternalPersonnelKind = 'CUSTOMER' | 'PARTNER'

/** v3.3 — first-class External Personnel catalog row, returned per-project. */
export interface ProjectExternalPersonnelRow {
  externalPersonnelId: string
  kind: ExternalPersonnelKind
  fullName: string
  employeeCode: string
  title: string
  unit: string
  email: string
  phone: string
  roleInProject: string
  responsibility: string
  totalPlannedHours: number
}

export interface ProjectReferenceItem {
  name: string
  note: string
}

export interface ProjectBasisInfo {
  outputContracts: ProjectReferenceItem[]
  inputContracts: ProjectReferenceItem[]
  deploymentApprovals: ProjectReferenceItem[]
  projectTeamDecisions: ProjectReferenceItem[]
  businessCenterCode?: BusinessCenterCode
  customerGroupCode?: CustomerGroupCode
  marketCode?: MarketCode
  domainCode?: DomainCode
  projectKindCode?: ProjectKindCode
  ttkMode: TtkMode
  deploymentMode: DeploymentMode
  durationDays: number
  durationHours: number
}

export interface ProjectFinancialItem {
  amount: number
  note: string
}

export interface ProjectFinancialInfo {
  revenue: ProjectFinancialItem
  internalCost: ProjectFinancialItem
  externalCost: ProjectFinancialItem
  profit: ProjectFinancialItem
  costSource: string
}

export interface ProjectAitsPersonnel {
  userId: string
  employeeCode: string
  fullName: string
  title: string
  unit: string
  role: string
  responsibility: string
  totalPlannedHours: number
  email: string
  phone: string
}

export interface ProjectExternalPersonnel {
  fullName: string
  title: string
  unit: string
  role: string
  responsibility: string
  email: string
  phone: string
}

export interface ProjectPersonnelInfo {
  aitsMembers: ProjectAitsPersonnel[]
  customerMembers: ProjectExternalPersonnel[]
  partners: ProjectExternalPersonnel[]
}

export interface ProjectMemberRow {
  userId: string
  isCoordinator: boolean
  roleInProject: string
  responsibility: string
  totalPlannedHours: number
}

export interface Project {
  id: string
  code: string
  name: string
  summary: string
  sponsor: string
  department: string
  objective: string
  ttkDecisionNumber: string
  createdById: string
  adminId: string
  /** v3.1 BRD IV.4.1 — Project Sponsor user. Optional (server returns null when unset). */
  psUserId?: string | null
  /** v3.1 BRD III.1.2.2.1 — drives KTQT cap validation. */
  projectType?: ProjectType
  memberIds: string[]
  /** v3.1: first-class member rows replacing the personnelInfo string-match. */
  members?: ProjectMemberRow[]
  startDate: string
  endDate: string
  status: ProjectStatus
  health: HealthStatus
  progress: number
  currentPhase: string
  adjustedPlan: string
  riskSummary: string
  /** v3.1 BRD III.1.2.5 — set when status moves to PAUSED / CLOSED. */
  pausedAt?: string | null
  closedAt?: string | null
  basisInfo: ProjectBasisInfo
  financialInfo: ProjectFinancialInfo
  personnelInfo: ProjectPersonnelInfo
  documents: ProjectDocument[]
  monthlyAllocations: MonthlyAllocation[]
  risks: ProjectRisk[]
  /** v3.3 — first-class catalog-backed customer/partner personnel assignments. */
  externalPersonnel?: ProjectExternalPersonnelRow[]
}

export interface MonthAllocationItem {
  month: string
  hours: number
}

export interface PlanItem {
  id: string
  projectId: string
  parentId: string | null
  name: string
  workType: WorkType
  ownerId: string
  assigneeId: string
  assigneeIds: string[]
  status: PlanTaskStatus
  baselineStartDate: string
  baselineEndDate: string
  startDate: string
  endDate: string
  progress: number
  plannedHours: number
  actualHours: number
  monthAllocations: MonthAllocationItem[]
  dependencyNote: string
  deliverable: string
  replanRequested: boolean
}

export interface Worklog {
  id: string
  taskId: string
  projectId: string
  memberId: string
  date: string
  hours: number
  progressNote: string
}

export interface DelayRaise {
  id: string
  projectId: string
  taskId: string
  requesterId: string
  requestedAt: string
  reason: string
  impact: string
  status: DelayRaiseStatus
  managerResponse: string
}

export type ActivityLogAction =
  | 'PROJECT_INFO_UPDATED'
  | 'PERSONNEL_UPDATED'
  | 'DOCUMENT_ADDED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_UPDATED'
  | 'TASK_CREATED'
  | 'SUBTASK_CREATED'
  | 'TASK_UPDATED'
  | 'SUBTASK_UPDATED'
  | 'TASK_DELETED'
  | 'SUBTASK_DELETED'
  | 'TASK_HOURS_CHANGED'
  | 'SUBTASK_HOURS_CHANGED'
  | 'WORKLOG_ADDED'
  | 'PROJECT_CLOSED'
  | 'PROJECT_REOPENED'
  | 'PROJECT_PAUSED'
  | 'PROJECT_REOPENED_FROM_PAUSE'
  | 'CLOSE_REQUESTED'
  | 'CLOSE_APPROVED_KSV'
  | 'CLOSE_REJECTED_KSV'
  | 'CLOSE_CONFIRMED_TCHC'
  | 'CLOSE_REJECTED_TCHC'
  | 'RISK_CREATED'
  | 'RISK_UPDATED'
  | 'RISK_DELETED'
  | 'PERSONNEL_ADDED'
  | 'PERSONNEL_REMOVED'
  | 'ALLOCATION_UPDATED'

export interface ActivityLogChange {
  field: string
  oldValue: string | number | null
  newValue: string | number | null
}

export interface ActivityLog {
  id: string
  projectId: string
  userId: string
  action: ActivityLogAction
  entityType: 'PROJECT' | 'PLAN_ITEM'
  entityId: string
  entityName: string
  changes: ActivityLogChange[]
  timestamp: string
}

export interface DeletePlanItemInput {
  planItemId: string
  projectId: string
}

export interface CatalogOption {
  value: string
  label: string
  description?: string
}

export interface Catalogs {
  projectStatuses: CatalogOption[]
  healthStatuses: CatalogOption[]
  taskStatuses: CatalogOption[]
  riskLevels: CatalogOption[]
  documentCategories: CatalogOption[]
  departments: CatalogOption[]
  projectMemberRoles: CatalogOption[]
}

export interface MockDatabase {
  users: User[]
  projects: Project[]
  planItems: PlanItem[]
  worklogs: Worklog[]
  delayRaises: DelayRaise[]
  activityLogs: ActivityLog[]
  catalogs: Catalogs
}

export interface AppSnapshot extends MockDatabase {
  currentUser: User | null
}

export interface CreateProjectTeamMemberInput {
  userId: string
  role: string
  responsibility?: string
  totalPlannedHours: number
}

export interface DocumentAttachmentInput {
  fileName: string
  mimeType?: string
  contentBase64?: string
}

export interface CreateProjectInput {
  code: string
  name: string
  summary?: string
  sponsor: string
  objective: string
  ttkDecisionNumber?: string
  ttkDecisionAttachment?: DocumentAttachmentInput & { title?: string }
  businessCenterCode: BusinessCenterCode
  customerGroupCode: CustomerGroupCode
  marketCode: MarketCode
  domainCode: DomainCode
  projectKindCode: ProjectKindCode
  createdById: string
  adminId: string
  startDate: string
  endDate: string
  teamMembers: CreateProjectTeamMemberInput[]
  department?: string
}

export interface UpdateProjectInput {
  projectId: string
  patch: Partial<
    Pick<
      Project,
      | 'summary'
      | 'sponsor'
      | 'department'
      | 'objective'
      | 'ttkDecisionNumber'
      | 'status'
      | 'health'
      | 'progress'
      | 'currentPhase'
      | 'adjustedPlan'
      | 'riskSummary'
      | 'createdById'
      | 'memberIds'
      | 'adminId'
      | 'startDate'
      | 'endDate'
      | 'basisInfo'
      | 'financialInfo'
      | 'personnelInfo'
      | 'monthlyAllocations'
    >
  >
}

export interface CreateDocumentInput {
  projectId: string
  title: string
  category: string
  documentNumber?: string
  description: string
  url: string
  attachment?: DocumentAttachmentInput
  uploadedBy: string
}

export interface UpdateDocumentInput {
  projectId: string
  documentId: string
  title: string
  category: string
  documentNumber: string
  description: string
  url: string
  attachment?: DocumentAttachmentInput
  updatedBy: string
}

export interface DeleteDocumentInput {
  projectId: string
  documentId: string
}

export interface SavePlanItemInput {
  id?: string
  projectId: string
  parentId: string | null
  name: string
  workType: WorkType
  ownerId: string
  assigneeId: string
  assigneeIds: string[]
  status: PlanTaskStatus
  baselineStartDate: string
  baselineEndDate: string
  startDate: string
  endDate: string
  progress: number
  plannedHours: number
  monthAllocations: MonthAllocationItem[]
  dependencyNote: string
  deliverable: string
}

export interface SaveWorklogInput {
  taskId: string
  projectId: string
  memberId: string
  date: string
  hours: number
  progressNote: string
  progress: number
}

export interface RaiseDelayInput {
  projectId: string
  taskId: string
  requesterId: string
  reason: string
  impact: string
}

export interface SaveAllocationInput {
  projectId: string
  memberId: string
  month: string
  hours: number
}

export interface SaveRiskInput {
  projectId: string
  id?: string
  title: string
  /** v3.3 fields — optional on input; default to '' / 0 / null on the BE. */
  cause?: string
  description?: string
  level: RiskLevel
  status: 'OPEN' | 'WATCHING' | 'MITIGATED'
  ownerId: string
  mitigation: string
  dueDate?: string | null
  resolutionResult?: string
  resolutionProgress?: number
  nextPlan?: string
  notes?: string
}

export interface DeleteRiskInput {
  projectId: string
  riskId: string
}

export interface GanttItem {
  id: string
  label: string
  sublabel: string
  startDate: string
  endDate: string
  progress: number
  status: PlanTaskStatus
  depth: number
  childCount: number
  workType: WorkType
}
