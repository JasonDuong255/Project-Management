import type { Project, ProjectMember, User } from '@prisma/client'
import type { AuthUser } from '../types/domain.js'

export type ProjectWithMembers = Project & { members: ProjectMember[] }

// ─── Project membership / coordinator (now first-class on project_members) ──

export function isProjectCoordinator(project: ProjectWithMembers, userId: string): boolean {
  return project.members.some((m) => m.userId === userId && m.isCoordinator)
}

export function isProjectMember(project: ProjectWithMembers, userId: string): boolean {
  return project.members.some((m) => m.userId === userId)
}

// ─── Approver helpers ───────────────────────────────────────────────────────
// BA decision 14/05/2026: the second-stage approver after KSV is now TCHC,
// which is identical to the ADMIN_HC role (no functional-title overlay).
// KSV remains a functional title because it lives inside DBCL not HC.

export function isKSV(user: AuthUser): boolean {
  return user.functionalTitle === 'KSV'
}

export function isTCHC(user: AuthUser): boolean {
  return user.role === 'ADMIN_HC'
}

// ─── View / edit / manage gates ─────────────────────────────────────────────

export function canViewProject(project: ProjectWithMembers, user: AuthUser): boolean {
  if (user.role === 'PMO' || user.role === 'ADMIN_HC') return true
  if (user.role === 'PM') {
    return project.adminId === user.id || isProjectCoordinator(project, user.id)
  }
  return isProjectMember(project, user.id)
}

/**
 * BRD: only when project is ACTIVE (Đang triển khai). PAUSED can't be edited
 * either; only resume is allowed via a dedicated endpoint. CLOSED is fully locked.
 */
export function canManageProjectPlan(project: ProjectWithMembers, user: AuthUser): boolean {
  if (project.status !== 'ACTIVE') return false
  if (user.role === 'PMO') return true
  if (project.adminId === user.id) return true
  return isProjectCoordinator(project, user.id)
}

export function canEditProjectInfo(project: ProjectWithMembers, user: AuthUser): boolean {
  if (project.status === 'CLOSED') return false
  if (user.role === 'PMO' || user.role === 'ADMIN_HC') return true
  if (project.adminId === user.id) return true
  return isProjectCoordinator(project, user.id)
}

/**
 * BRD IV.4.1: project creation belongs exclusively to TCHC (= ADMIN_HC).
 * The earlier draft also allowed PMO as a super-admin; this is removed per
 * BA decision (12/05/2026) — TCHC is the only role that may create projects.
 */
export function canCreateProject(user: AuthUser): boolean {
  return user.role === 'ADMIN_HC'
}

// ─── List filtering ─────────────────────────────────────────────────────────

export function filterVisibleProjects<P extends ProjectWithMembers>(
  projects: P[],
  user: AuthUser,
): P[] {
  return projects.filter((p) => canViewProject(p, user))
}

export function assertCanManagePlan(project: ProjectWithMembers, user: AuthUser): void {
  if (!canManageProjectPlan(project, user)) {
    const err = new Error('Forbidden: cannot manage this project plan')
    ;(err as Error & { status?: number }).status = 403
    throw err
  }
}

// Re-export the role normalizer so it lives next to the other helpers.
export { normalizeUserRole } from './normalize.js'
export type { User }
