import dayjs from 'dayjs'

import type { CatalogOption, UserRole } from '../types'

export function formatDate(value: string) {
  return dayjs(value).format('DD/MM/YYYY')
}

export function formatDateTime(value: string) {
  return dayjs(value).format('DD/MM/YYYY HH:mm')
}

export function formatMonthLabel(value: string) {
  return dayjs(`${value}-01`).format('MM/YYYY')
}

export function formatHours(value: number) {
  return `${value}h`
}

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case 'PMO':
    case 'SYSTEM_ADMIN':
      return 'PMO'
    case 'ADMIN_HC':
      return 'To chuc hanh chinh'
    case 'PM':
    case 'PROJECT_ADMIN':
      return 'PM'
    case 'DELIVERY_MEMBER':
      return 'Thanh vien to trien khai'
    default:
      return role
  }
}

export function getCatalogLabel(options: CatalogOption[], value: string) {
  return options.find((item) => item.value === value)?.label ?? value
}
