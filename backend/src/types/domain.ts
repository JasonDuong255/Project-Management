// Mirror of front-end/src/types/index.ts — adjust together when domain changes.

export type UserRole = 'PMO' | 'ADMIN_HC' | 'PM' | 'DELIVERY_MEMBER'
export type LegacyUserRole = UserRole | 'SYSTEM_ADMIN' | 'PROJECT_ADMIN'
export type ProjectStatus = 'INITIATION' | 'PLANNING' | 'IN_PROGRESS' | 'AT_RISK' | 'DONE'
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
export type RiskStatus = 'OPEN' | 'WATCHING' | 'MITIGATED'
export type TtkMode = 'CHUYEN_TRACH' | 'KIEM_NHIEM'
export type DeploymentMode = 'HD_PLHD' | 'TK_THD' | 'NOI_BO'
export type ProjectApprovalStatus = 'PENDING' | 'APPROVED'

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

export interface ProjectApprovalInfo {
  status: ProjectApprovalStatus
  requestedById: string
  requestFileName: string
  requestSubmittedAt: string
  approvedById: string
  approvedAt: string
  approvalFileName: string
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
