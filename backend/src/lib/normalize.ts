import type { LegacyUserRole, UserRole } from '../types/domain.js'

export function normalizeUserRole(role: LegacyUserRole | string): UserRole {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return 'PMO'
    case 'PROJECT_ADMIN':
      return 'PM'
    case 'PMO':
    case 'ADMIN_HC':
    case 'PM':
    case 'DELIVERY_MEMBER':
      return role
    default:
      // Default unknown roles to delivery member — least privilege.
      return 'DELIVERY_MEMBER'
  }
}
