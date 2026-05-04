import type { Project, ProjectMember, User } from '@prisma/client'
import type { AuthUser, ProjectAitsPersonnel, ProjectPersonnelInfo } from '../types/domain.js'

export type ProjectWithMembers = Project & { members: ProjectMember[] }

function readPersonnelInfo(project: Project): ProjectPersonnelInfo {
  const value = project.personnelInfo as unknown as ProjectPersonnelInfo | null
  return (
    value ?? {
      aitsMembers: [],
      customerMembers: [],
      partners: [],
    }
  )
}

export function isProjectCoordinator(project: Project, userId: string): boolean {
  const personnel = readPersonnelInfo(project)
  return personnel.aitsMembers.some(
    (member: ProjectAitsPersonnel) =>
      member.userId === userId && member.role.toLowerCase().includes('dieu phoi du an'),
  )
}

export function isProjectMember(project: ProjectWithMembers, userId: string): boolean {
  if (project.members.some((m) => m.userId === userId)) return true
  const personnel = readPersonnelInfo(project)
  return personnel.aitsMembers.some((member) => member.userId === userId)
}

export function canViewProject(project: ProjectWithMembers, user: AuthUser): boolean {
  if (user.role === 'PMO' || user.role === 'ADMIN_HC') return true
  if (user.role === 'PM') {
    return project.adminId === user.id || isProjectCoordinator(project, user.id)
  }
  return isProjectMember(project, user.id)
}

export function canManageProjectPlan(project: Project, user: AuthUser): boolean {
  const approvalStatus = (project.approvalInfo as unknown as { status?: string } | null)?.status
  if (approvalStatus !== 'APPROVED') return false
  if (user.role === 'PMO') return true
  if (project.adminId === user.id) return true
  return isProjectCoordinator(project, user.id)
}

export function canEditProjectInfo(project: Project, user: AuthUser): boolean {
  if (user.role === 'PMO' || user.role === 'ADMIN_HC') return true
  if (project.adminId === user.id) return true
  return isProjectCoordinator(project, user.id)
}

export function filterVisibleProjects<P extends ProjectWithMembers>(
  projects: P[],
  user: AuthUser,
): P[] {
  return projects.filter((p) => canViewProject(p, user))
}

export function assertCanManagePlan(project: Project, user: AuthUser): void {
  if (!canManageProjectPlan(project, user)) {
    const err = new Error('Forbidden: cannot manage this project plan')
    ;(err as Error & { status?: number }).status = 403
    throw err
  }
}

// Re-export the role normalizer so it lives next to the other helpers.
export { normalizeUserRole } from './normalize.js'
export type { User }
