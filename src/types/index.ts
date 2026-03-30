export type UserRole = 'PROJECT_ADMIN' | 'DELIVERY_MEMBER' | 'SYSTEM_ADMIN'

export type ProjectStatus =
  | 'INITIATION'
  | 'PLANNING'
  | 'IN_PROGRESS'
  | 'AT_RISK'
  | 'DONE'

export type HealthStatus = 'GREEN' | 'AMBER' | 'RED'

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
  password: string
  role: UserRole
  title: string
  unit: string
  monthlyCapacity: number
  avatarColor: string
}

export interface ProjectDocument {
  id: string
  title: string
  category: string
  uploadedBy: string
  uploadedAt: string
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
  level: RiskLevel
  status: 'OPEN' | 'WATCHING' | 'MITIGATED'
  ownerId: string
  mitigation: string
  lastUpdated: string
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
  fullName: string
  titleUnit: string
  role: string
  responsibility: string
  totalPlannedHours: number
  email: string
  phone: string
}

export interface ProjectExternalPersonnel {
  fullName: string
  titleUnit: string
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

export interface Project {
  id: string
  code: string
  name: string
  summary: string
  sponsor: string
  department: string
  objective: string
  adminId: string
  memberIds: string[]
  startDate: string
  endDate: string
  status: ProjectStatus
  health: HealthStatus
  progress: number
  currentPhase: string
  adjustedPlan: string
  riskSummary: string
  basisInfo: ProjectBasisInfo
  financialInfo: ProjectFinancialInfo
  personnelInfo: ProjectPersonnelInfo
  documents: ProjectDocument[]
  monthlyAllocations: MonthlyAllocation[]
  risks: ProjectRisk[]
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
}

export interface MockDatabase {
  users: User[]
  projects: Project[]
  planItems: PlanItem[]
  worklogs: Worklog[]
  delayRaises: DelayRaise[]
  catalogs: Catalogs
}

export interface AppSnapshot extends MockDatabase {
  currentUser: User | null
}

export interface CreateProjectInput {
  code: string
  name: string
  summary: string
  sponsor: string
  department: string
  objective: string
  adminId: string
  memberIds: string[]
  startDate: string
  endDate: string
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
      | 'status'
      | 'health'
      | 'progress'
      | 'currentPhase'
      | 'adjustedPlan'
      | 'riskSummary'
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
  description: string
  url: string
  uploadedBy: string
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
  level: RiskLevel
  status: 'OPEN' | 'WATCHING' | 'MITIGATED'
  ownerId: string
  mitigation: string
}

export interface GanttItem {
  id: string
  label: string
  sublabel: string
  startDate: string
  endDate: string
  progress: number
  status: PlanTaskStatus
}
