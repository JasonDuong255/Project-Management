/**
 * v3.17 (19/05/2026): Module Báo cáo — derive data từ snapshot cho 2 loại báo cáo:
 * - Báo cáo tuần: 1 project, render theo milestones (row per milestone)
 * - Báo cáo giám sát: tất cả projects, 1 row mỗi project, có nhóm theo trạng thái
 *
 * Template tham chiếu (file mẫu user cung cấp 19/05/2026):
 *   C:\Users\phucdm\Documents\QLDA\Báo cáo tuần.xlsx
 *   C:\Users\phucdm\Documents\QLDA\Báo cáo giám sát.xlsx (sheet "BC chi tiết")
 *
 * Một số cột phải do user khai báo (không có data trên hệ thống) — xem
 * `MonitoringUserInputs` interface.
 */
import dayjs from 'dayjs'
import type { PlanItem, Project, ProjectRisk, User } from '../types'
import { getEffectiveTaskStatus } from './calculations'

/** Một dòng dữ liệu cho báo cáo tuần (per-milestone). */
export interface WeeklyMilestoneRow {
  index: number
  name: string
  deadline: string
  progress: number
  resultThisWeek: string
  planNextWeek: string
}

export interface WeeklyReportData {
  /** Tuần ISO YYYY-Www. */
  isoWeek: string
  weekRange: string
  project: Project
  customerLabel: string
  psName: string
  pmName: string
  pcName: string
  contractPurchase: string
  contractSale: string
  contractDeadline: string
  ttkDeadline: string
  /** projectType label trong 5 cột Trạng thái (Tiền khả thi / Khả thi / Có HĐ / Nội bộ / Tạm đóng-Đóng). */
  projectStateLabel: string
  scope: string
  milestones: WeeklyMilestoneRow[]
  risks: ProjectRisk[]
  /** Free-text user nhập trong preview trước khi export. */
  proposal: string
}

export interface MonitoringRow {
  index: number
  project: Project
  customerLabel: string
  psName: string
  pmName: string
  pcName: string
  contractPurchase: string
  contractSale: string
  contractDeadline: string
  ttkDeadline: string
  projectStateLabel: string
  scope: string
  milestoneSummary: string
  /** Số lần thay đổi (đếm từ activity log nếu có). */
  changeCount: number
  riskSummary: string
  resultThisWeek: string
  planNextWeek: string
}

/** Field user phải khai báo trong popup khi export báo cáo giám sát. */
export interface MonitoringUserInputs {
  proposal: string
  pmoEvaluation: string
  dbclEvaluation: string
  recommendation: string
  overallRating: 'Tốt' | 'Đạt' | 'Cần cải thiện' | 'Không đánh giá'
  klgb: string
}

export function getIsoWeek(date = dayjs()): string {
  // ISO week — dayjs needs isoWeek plugin. Use simple custom logic.
  // Format YYYY-Www. Use weekday Mon as start (ISO standard).
  const d = date.toDate()
  // Algorithm from MDN-recommended ISO 8601 week number.
  const target = new Date(d.valueOf())
  const dayNr = (d.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

export function getWeekRange(isoWeek: string): { start: string; end: string } {
  const [yearStr, wPart] = isoWeek.split('-W')
  const year = Number(yearStr)
  const week = Number(wPart)
  // Jan 4 is always in ISO week 1. Find Monday of that week, then offset.
  const jan4 = dayjs(`${year}-01-04`)
  const jan4Day = (jan4.day() + 6) % 7 // 0 = Mon
  const isoWeek1Monday = jan4.subtract(jan4Day, 'day')
  const start = isoWeek1Monday.add(week - 1, 'week')
  const end = start.add(6, 'day')
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
}

export function getWeekOptions(referenceDate = dayjs(), back = 8, forward = 4): string[] {
  const current = getIsoWeek(referenceDate)
  const list: string[] = []
  const refStart = getWeekRange(current).start
  for (let offset = -back; offset <= forward; offset++) {
    const d = dayjs(refStart).add(offset, 'week')
    list.push(getIsoWeek(d))
  }
  return list
}

function findAitsRoleUser(project: Project, role: string, users: User[]): User | null {
  const lc = role.trim().toLowerCase()
  const row = project.personnelInfo.aitsMembers.find(
    (m) => (m.role ?? '').trim().toLowerCase() === lc,
  )
  if (!row?.userId) return null
  return users.find((u) => u.id === row.userId) ?? null
}

function getProjectStateLabel(project: Project): string {
  if (project.status === 'PAUSED') return 'Tạm đóng'
  if (project.status === 'CLOSED') return 'Đã đóng'
  if (project.status === 'COMPLETED') return 'Hoàn thành'
  switch (project.projectType) {
    case 'PRELIMINARY':
      return 'Tiền khả thi'
    case 'FEASIBILITY':
      return 'Khả thi'
    case 'CONTRACT':
      return 'Có HĐ'
    case 'INTERNAL':
      return 'Nội bộ'
    default:
      return 'Đang triển khai'
  }
}

function getCustomerLabel(project: Project): string {
  const code = project.basisInfo.customerGroupCode
  if (!code) return ''
  if (code === 'VNA') return 'VNA'
  if (code === 'LDLK') return 'LDLKVG'
  if (code === 'NB') return 'Nội bộ'
  return 'Ngoài khác'
}

function getContractInfo(project: Project): { purchase: string; sale: string } {
  // Documents categorized PURCHASE_CONTRACT / SALE_CONTRACT thường có title như "HĐ số X ngày Y".
  const purchase = project.documents
    .filter((d) => /purchase|hop dong mua|hợp đồng mua/i.test(d.category))
    .map((d) => d.title)
    .join('; ')
  const sale = project.documents
    .filter((d) => /sale_contract|hop dong ban|hợp đồng bán/i.test(d.category))
    .map((d) => d.title)
    .join('; ')
  return {
    purchase: purchase || 'Không phát sinh',
    sale: sale || 'Chưa ký',
  }
}

export function buildWeeklyReport(
  project: Project,
  planItems: PlanItem[],
  users: User[],
  isoWeek: string,
  proposalDraft = '',
): WeeklyReportData {
  const ps = findAitsRoleUser(project, 'PS du an', users)
  const pm = findAitsRoleUser(project, 'PM du an', users)
  const pc = findAitsRoleUser(project, 'Dieu phoi du an', users)

  const rootTasks = planItems
    .filter((t) => t.projectId === project.id && !t.parentId)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

  const milestones: WeeklyMilestoneRow[] = rootTasks.map((task, i) => ({
    index: i + 1,
    name: task.name,
    deadline: task.endDate || '',
    progress: task.progress,
    // Default rỗng — user có thể nhập trong preview rồi mới export.
    resultThisWeek: '',
    planNextWeek: '',
  }))

  const contracts = getContractInfo(project)
  const range = getWeekRange(isoWeek)

  return {
    isoWeek,
    weekRange: `${dayjs(range.start).format('DD/MM/YYYY')} - ${dayjs(range.end).format('DD/MM/YYYY')}`,
    project,
    customerLabel: getCustomerLabel(project),
    psName: ps?.name ?? '',
    pmName: pm?.name ?? '',
    pcName: pc?.name ?? '',
    contractPurchase: contracts.purchase,
    contractSale: contracts.sale,
    contractDeadline: project.endDate
      ? dayjs(project.endDate).format('DD/MM/YYYY')
      : '',
    ttkDeadline: project.kickoffDate
      ? dayjs(project.kickoffDate).format('DD/MM/YYYY')
      : project.startDate
        ? dayjs(project.startDate).format('DD/MM/YYYY')
        : '',
    projectStateLabel: getProjectStateLabel(project),
    scope: project.summary || project.objective || '',
    milestones,
    risks: project.risks ?? [],
    proposal: proposalDraft,
  }
}

export function buildMonitoringRows(
  projects: Project[],
  planItems: PlanItem[],
  users: User[],
): MonitoringRow[] {
  return projects.map((project, idx) => {
    const ps = findAitsRoleUser(project, 'PS du an', users)
    const pm = findAitsRoleUser(project, 'PM du an', users)
    const pc = findAitsRoleUser(project, 'Dieu phoi du an', users)

    const tasks = planItems.filter((t) => t.projectId === project.id)
    const rootTasks = tasks.filter((t) => !t.parentId)
    const milestoneSummary = rootTasks
      .map((t) => {
        const eff = getEffectiveTaskStatus(t)
        const tag =
          eff === 'OVERDUE'
            ? ' [QH]'
            : eff === 'DUE_SOON'
              ? ' [GĐH]'
              : eff === 'DONE'
                ? ' ✓'
                : ''
        return `${t.name} ${t.progress}%${tag}`
      })
      .join('\n')

    const riskSummary = (project.risks ?? [])
      .filter((r) => r.status !== 'MITIGATED')
      .map((r) => `${r.title} (${r.level})`)
      .join('\n')

    const contracts = getContractInfo(project)

    return {
      index: idx + 1,
      project,
      customerLabel: getCustomerLabel(project),
      psName: ps?.name ?? '',
      pmName: pm?.name ?? '',
      pcName: pc?.name ?? '',
      contractPurchase: contracts.purchase,
      contractSale: contracts.sale,
      contractDeadline: project.endDate
        ? dayjs(project.endDate).format('DD/MM/YYYY')
        : '',
      ttkDeadline: project.kickoffDate
        ? dayjs(project.kickoffDate).format('DD/MM/YYYY')
        : project.startDate
          ? dayjs(project.startDate).format('DD/MM/YYYY')
          : '',
      projectStateLabel: getProjectStateLabel(project),
      scope: project.summary || project.objective || '',
      milestoneSummary,
      changeCount: 0, // TODO: đếm từ activityLogs TASK_*_CHANGED nếu cần
      riskSummary,
      resultThisWeek: project.adjustedPlan || '',
      planNextWeek: '',
    }
  })
}

/* ═══════ Excel export (SheetJS) ═══════ */

import * as XLSX from 'xlsx'

/** Sinh file Báo cáo tuần — 1 project, milestones theo từng row. */
export function exportWeeklyReportToExcel(data: WeeklyReportData): void {
  const wb = XLSX.utils.book_new()

  // Header rows — match template Báo cáo tuần.xlsx Sheet1.
  const rows: (string | number)[][] = []
  rows.push([`BÁO CÁO TUẦN ${data.isoWeek}  (${data.weekRange})`])
  rows.push([])
  rows.push([
    'TT',
    'Mã dự án',
    'Tên dự án',
    'PS/PM/PC',
    'HĐ mua',
    'HĐ bán',
    'Theo HĐ',
    'KH TTK',
    'Trạng thái',
    'Phạm vi',
    'Mốc chính',
    'Thời hạn',
    'Hoàn thành (%)',
    'Rủi ro/Vấn đề',
    `Kết quả tuần ${data.isoWeek}`,
    'Kế hoạch tuần tiếp',
    'Đề xuất (nếu có)',
  ])

  const psPmPc = `PS: ${data.psName} | PM: ${data.pmName} | PC: ${data.pcName}`
  const riskText = data.risks
    .filter((r) => r.status !== 'MITIGATED')
    .map((r) => `${r.title} (${r.level})`)
    .join('\n')

  if (data.milestones.length === 0) {
    rows.push([
      1,
      data.project.code,
      data.project.name,
      psPmPc,
      data.contractPurchase,
      data.contractSale,
      data.contractDeadline,
      data.ttkDeadline,
      data.projectStateLabel,
      data.scope,
      '(chưa có milestone)',
      '',
      '',
      riskText,
      '',
      '',
      data.proposal,
    ])
  } else {
    data.milestones.forEach((m, i) => {
      const firstRow = i === 0
      rows.push([
        firstRow ? 1 : '',
        firstRow ? data.project.code : '',
        firstRow ? data.project.name : '',
        firstRow ? psPmPc : '',
        firstRow ? data.contractPurchase : '',
        firstRow ? data.contractSale : '',
        firstRow ? data.contractDeadline : '',
        firstRow ? data.ttkDeadline : '',
        firstRow ? data.projectStateLabel : '',
        firstRow ? data.scope : '',
        m.name,
        m.deadline,
        `${m.progress}%`,
        firstRow ? riskText : '',
        m.resultThisWeek,
        m.planNextWeek,
        firstRow ? data.proposal : '',
      ])
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Column widths xấp xỉ template.
  ws['!cols'] = [
    { wch: 4 },
    { wch: 18 },
    { wch: 36 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 32 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 32 },
    { wch: 28 },
    { wch: 28 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo tuần')
  XLSX.writeFile(wb, `BaoCaoTuan_${data.project.code}_${data.isoWeek}.xlsx`)
}

/** Sinh file Báo cáo giám sát — tất cả projects, mỗi project 1 row. */
export function exportMonitoringReportToExcel(
  rows: MonitoringRow[],
  userInputsByProjectId: Record<string, MonitoringUserInputs>,
  isoWeek: string,
): void {
  const wb = XLSX.utils.book_new()
  const out: (string | number)[][] = []
  out.push([`BẢNG ĐÁNH GIÁ CHI TIẾT TỔ TRIỂN KHAI TUẦN ${isoWeek}`])
  out.push([])
  out.push([
    'TT',
    'Khách hàng',
    'Mã dự án',
    'Tên dự án',
    'PS/PM/PC',
    'HĐ mua',
    'HĐ bán',
    'Theo HĐ',
    'KH TTK',
    'Trạng thái dự án',
    'Phạm vi dự án',
    'Mốc chính / Tiến độ',
    'Số lần thay đổi',
    'Rủi ro/Vấn đề',
    'Kết quả tuần hiện tại',
    'Kế hoạch tuần tiếp theo',
    'Đề xuất (nếu có)',
    'Đánh giá PMO',
    'Đánh giá ĐBCL',
    'Khuyến nghị',
    'Đánh giá tổng thể',
    'KLGB',
  ])

  rows.forEach((r) => {
    const u = userInputsByProjectId[r.project.id] ?? {
      proposal: '',
      pmoEvaluation: '',
      dbclEvaluation: '',
      recommendation: '',
      overallRating: 'Không đánh giá' as const,
      klgb: '',
    }
    out.push([
      r.index,
      r.customerLabel,
      r.project.code,
      r.project.name,
      `PS: ${r.psName} | PM: ${r.pmName} | PC: ${r.pcName}`,
      r.contractPurchase,
      r.contractSale,
      r.contractDeadline,
      r.ttkDeadline,
      r.projectStateLabel,
      r.scope,
      r.milestoneSummary,
      r.changeCount,
      r.riskSummary,
      r.resultThisWeek,
      r.planNextWeek,
      u.proposal,
      u.pmoEvaluation,
      u.dbclEvaluation,
      u.recommendation,
      u.overallRating,
      u.klgb,
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(out)
  ws['!cols'] = [
    { wch: 4 },
    { wch: 12 },
    { wch: 18 },
    { wch: 36 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 32 },
    { wch: 32 },
    { wch: 10 },
    { wch: 28 },
    { wch: 28 },
    { wch: 28 },
    { wch: 28 },
    { wch: 28 },
    { wch: 28 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'BC chi tiết')
  XLSX.writeFile(wb, `BaoCaoGiamSat_${isoWeek}.xlsx`)
}

/** Section grouping cho báo cáo giám sát. Khớp với row đề mục I/II trong file mẫu. */
export function groupMonitoringRows(rows: MonitoringRow[]) {
  const completed = rows.filter((r) => r.project.status === 'COMPLETED')
  const paused = rows.filter((r) => r.project.status === 'PAUSED')
  const closed = rows.filter((r) => r.project.status === 'CLOSED')
  const active = rows.filter((r) => r.project.status === 'ACTIVE')
  return [
    { title: 'I. DA Hoàn thành', rows: completed },
    { title: 'II. DA Đang triển khai', rows: active },
    { title: 'III. DA Tạm đóng', rows: paused },
    { title: 'IV. DA Đã đóng (chưa hoàn thành)', rows: closed },
  ].filter((g) => g.rows.length > 0)
}
