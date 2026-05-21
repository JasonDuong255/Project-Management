// Mirror of front-end/src/types/index.ts — adjust together when domain changes.

export type UserRole = 'PMO' | 'ADMIN_HC' | 'PM' | 'DELIVERY_MEMBER'
export type LegacyUserRole = UserRole | 'SYSTEM_ADMIN' | 'PROJECT_ADMIN'
export type FunctionalTitle = 'NORMAL' | 'KSV'
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED'
export type HealthStatus = 'STABLE' | 'NEEDS_REVIEW' | 'AT_RISK'
export type ProjectType = 'PRELIMINARY' | 'FEASIBILITY' | 'CONTRACT' | 'INTERNAL'
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
export type RiskStatus = 'OPEN' | 'WATCHING' | 'MITIGATED'
export type TtkMode = 'CHUYEN_TRACH' | 'KIEM_NHIEM'
export type DeploymentMode = 'HD_PLHD' | 'TK_THD' | 'NOI_BO'

export type ActivityLogAction =
  | 'PROJECT_INFO_UPDATED'
  | 'PERSONNEL_UPDATED'
  | 'DOCUMENT_ADDED'
  | 'DOCUMENT_DELETED'
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
  | 'DOCUMENT_UPDATED'
  | 'ALLOCATION_UPDATED'
  // v3.12 BA #7 (19/05/2026): worklog approval workflow.
  | 'WORKLOG_APPROVED'
  | 'WORKLOG_REJECTED'

export type ExternalPersonnelKind = 'CUSTOMER' | 'PARTNER'

export type ActivityEntityType = 'PROJECT' | 'PLAN_ITEM'

export interface ActivityLogChange {
  field: string
  oldValue: string | number | null
  newValue: string | number | null
}

export interface AuthUser {
  id: string
  username: string
  email: string
  name: string
  role: UserRole
  functionalTitle: FunctionalTitle
  isActive: boolean
  employeeCode: string
  title: string
  unit: string
  phone: string
  monthlyCapacity: number
  avatarColor: string
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

export interface MonthAllocationItem {
  month: string
  hours: number
}

export interface CatalogOption {
  value: string
  label: string
  description?: string
}

export type CatalogKey =
  | 'projectStatuses'
  | 'healthStatuses'
  | 'taskStatuses'
  | 'riskLevels'
  | 'documentCategories'
  | 'departments'
  | 'projectMemberRoles'

export type Catalogs = Record<CatalogKey, CatalogOption[]>
