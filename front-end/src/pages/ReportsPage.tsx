/**
 * v3.17 (19/05/2026): Reports module rebuild — 2 tabs.
 * - Báo cáo tuần: chọn tuần + project, preview milestones, edit-in-place
 *   các text "Kết quả tuần / Kế hoạch tuần / Đề xuất", export Excel.
 * - Báo cáo giám sát: tất cả projects, từ cột "Đề xuất (nếu có)" trở đi
 *   để trống, popup form khi click Export.
 */
import { Fragment, useMemo, useState } from 'react'
import { Download } from 'lucide-react'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useToast } from '../components/Toast'
import { useAppData } from '../context/AppContext'
import { getVisibleProjects } from '../lib/calculations'
import {
  buildMonitoringRows,
  buildWeeklyReport,
  exportMonitoringReportToExcel,
  exportWeeklyReportToExcel,
  getIsoWeek,
  getWeekOptions,
  getWeekRange,
  groupMonitoringRows,
  type MonitoringUserInputs,
  type WeeklyMilestoneRow,
} from '../lib/reports'
import dayjs from 'dayjs'

type ReportsTab = 'WEEKLY' | 'MONITORING'

export function ReportsPage() {
  const { currentUser, projects, planItems, users } = useAppData()
  const visibleProjects = getVisibleProjects(projects, currentUser)
  const [activeTab, setActiveTab] = useState<ReportsTab>('WEEKLY')

  return (
    <div className="page-grid">
      <SectionHeader title="Báo cáo" />

      <nav className="tabs">
        <button
          type="button"
          className={activeTab === 'WEEKLY' ? 'tab tab--active' : 'tab'}
          onClick={() => setActiveTab('WEEKLY')}
        >
          Báo cáo tuần
        </button>
        <button
          type="button"
          className={activeTab === 'MONITORING' ? 'tab tab--active' : 'tab'}
          onClick={() => setActiveTab('MONITORING')}
        >
          Báo cáo giám sát
        </button>
      </nav>

      {activeTab === 'WEEKLY' ? (
        <WeeklyReportTab projects={visibleProjects} planItems={planItems} users={users} />
      ) : (
        <MonitoringReportTab
          projects={visibleProjects}
          planItems={planItems}
          users={users}
        />
      )}
    </div>
  )
}

/* ═══════════ TAB: Báo cáo tuần ═══════════ */

function WeeklyReportTab({
  projects,
  planItems,
  users,
}: {
  projects: ReturnType<typeof getVisibleProjects>
  planItems: ReturnType<typeof useAppData>['planItems']
  users: ReturnType<typeof useAppData>['users']
}) {
  const toast = useToast()
  const [isoWeek, setIsoWeek] = useState<string>(getIsoWeek())
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? '')
  const weekOptions = useMemo(() => getWeekOptions(dayjs(), 12, 4), [])

  const project = projects.find((p) => p.id === projectId)
  // Edit-in-place state cho 3 text fields trong preview.
  const [milestoneEdits, setMilestoneEdits] = useState<
    Record<number, { resultThisWeek: string; planNextWeek: string }>
  >({})
  const [proposalDraft, setProposalDraft] = useState('')

  const report = useMemo(() => {
    if (!project) return null
    const base = buildWeeklyReport(project, planItems, users, isoWeek, proposalDraft)
    return {
      ...base,
      milestones: base.milestones.map((m) => ({
        ...m,
        resultThisWeek: milestoneEdits[m.index]?.resultThisWeek ?? m.resultThisWeek,
        planNextWeek: milestoneEdits[m.index]?.planNextWeek ?? m.planNextWeek,
      })),
    }
  }, [project, planItems, users, isoWeek, milestoneEdits, proposalDraft])

  function updateMilestoneField(
    idx: number,
    field: 'resultThisWeek' | 'planNextWeek',
    value: string,
  ) {
    setMilestoneEdits((current) => ({
      ...current,
      [idx]: {
        resultThisWeek: current[idx]?.resultThisWeek ?? '',
        planNextWeek: current[idx]?.planNextWeek ?? '',
        [field]: value,
      },
    }))
  }

  function handleExport() {
    if (!report) {
      toast.warning('Chưa chọn dự án', 'Hãy chọn dự án để xuất báo cáo tuần.')
      return
    }
    try {
      exportWeeklyReportToExcel(report)
      toast.success('Đã xuất báo cáo tuần', `${report.project.code} – tuần ${report.isoWeek}`)
    } catch (err) {
      toast.error('Không xuất được file', err instanceof Error ? err.message : '')
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading panel-heading--compact">
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label>
            <span>Tuần báo cáo</span>
            <select value={isoWeek} onChange={(e) => setIsoWeek(e.target.value)}>
              {weekOptions.map((w) => {
                const r = getWeekRange(w)
                return (
                  <option key={w} value={w}>
                    {w} ({dayjs(r.start).format('DD/MM')} – {dayjs(r.end).format('DD/MM')})
                  </option>
                )
              })}
            </select>
          </label>
          <label>
            <span>Dự án</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Chọn dự án —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="primary-button" onClick={handleExport} disabled={!report}>
          <Download size={15} /> Xuất Excel
        </button>
      </div>

      {!report ? (
        <p style={{ padding: '1rem' }}>Hãy chọn 1 dự án để xem preview báo cáo tuần.</p>
      ) : (
        <WeeklyReportPreview
          report={report}
          onMilestoneChange={updateMilestoneField}
          proposalDraft={proposalDraft}
          onProposalChange={setProposalDraft}
        />
      )}
    </section>
  )
}

function WeeklyReportPreview({
  report,
  onMilestoneChange,
  proposalDraft,
  onProposalChange,
}: {
  report: ReturnType<typeof buildWeeklyReport>
  onMilestoneChange: (idx: number, field: 'resultThisWeek' | 'planNextWeek', value: string) => void
  proposalDraft: string
  onProposalChange: (v: string) => void
}) {
  return (
    <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
      <table className="data-table report-preview-table">
        <thead>
          <tr>
            <th>TT</th>
            <th>Mã dự án</th>
            <th>Tên dự án</th>
            <th>PS/PM/PC</th>
            <th>HĐ mua</th>
            <th>HĐ bán</th>
            <th>Theo HĐ</th>
            <th>KH TTK</th>
            <th>Trạng thái</th>
            <th>Phạm vi</th>
            <th>Mốc chính</th>
            <th>Thời hạn</th>
            <th>Hoàn thành</th>
            <th>Rủi ro/Vấn đề</th>
            <th>Kết quả tuần {report.isoWeek}</th>
            <th>Kế hoạch tuần tiếp</th>
            <th>Đề xuất</th>
          </tr>
        </thead>
        <tbody>
          {report.milestones.length === 0 ? (
            <tr>
              <td colSpan={17} style={{ textAlign: 'center', padding: '1rem' }}>
                Dự án chưa có task tổng quan nào.
              </td>
            </tr>
          ) : (
            report.milestones.map((m: WeeklyMilestoneRow, idx) => {
              const first = idx === 0
              return (
                <tr key={m.index}>
                  <td>{first ? 1 : ''}</td>
                  <td>{first ? report.project.code : ''}</td>
                  <td>{first ? report.project.name : ''}</td>
                  <td>
                    {first ? (
                      <>
                        PS: {report.psName || '—'}
                        <br />
                        PM: {report.pmName || '—'}
                        <br />
                        PC: {report.pcName || '—'}
                      </>
                    ) : null}
                  </td>
                  <td>{first ? report.contractPurchase : ''}</td>
                  <td>{first ? report.contractSale : ''}</td>
                  <td>{first ? report.contractDeadline : ''}</td>
                  <td>{first ? report.ttkDeadline : ''}</td>
                  <td>{first ? <StatusPill label={report.projectStateLabel} tone="info" /> : ''}</td>
                  <td>{first ? report.scope : ''}</td>
                  <td>{m.name}</td>
                  <td>{m.deadline ? dayjs(m.deadline).format('DD/MM/YYYY') : ''}</td>
                  <td>{m.progress}%</td>
                  <td>
                    {first
                      ? report.risks
                          .filter((r) => r.status !== 'MITIGATED')
                          .map((r) => `${r.title} (${r.level})`)
                          .join('; ') || '—'
                      : ''}
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      value={m.resultThisWeek}
                      onChange={(e) =>
                        onMilestoneChange(m.index, 'resultThisWeek', e.target.value)
                      }
                      placeholder="Mô tả kết quả thực hiện trong tuần"
                    />
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      value={m.planNextWeek}
                      onChange={(e) =>
                        onMilestoneChange(m.index, 'planNextWeek', e.target.value)
                      }
                      placeholder="Kế hoạch tuần tiếp"
                    />
                  </td>
                  <td>
                    {first ? (
                      <textarea
                        rows={2}
                        value={proposalDraft}
                        onChange={(e) => onProposalChange(e.target.value)}
                        placeholder="Đề xuất / kiến nghị"
                      />
                    ) : null}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ═══════════ TAB: Báo cáo giám sát ═══════════ */

function MonitoringReportTab({
  projects,
  planItems,
  users,
}: {
  projects: ReturnType<typeof getVisibleProjects>
  planItems: ReturnType<typeof useAppData>['planItems']
  users: ReturnType<typeof useAppData>['users']
}) {
  const toast = useToast()
  const [isoWeek, setIsoWeek] = useState<string>(getIsoWeek())
  const [showExportModal, setShowExportModal] = useState(false)
  const [userInputs, setUserInputs] = useState<Record<string, MonitoringUserInputs>>({})
  const weekOptions = useMemo(() => getWeekOptions(dayjs(), 12, 4), [])

  const rows = useMemo(
    () => buildMonitoringRows(projects, planItems, users),
    [projects, planItems, users],
  )
  const groups = useMemo(() => groupMonitoringRows(rows), [rows])

  function patchInput(projectId: string, patch: Partial<MonitoringUserInputs>) {
    setUserInputs((current) => ({
      ...current,
      [projectId]: {
        proposal: '',
        pmoEvaluation: '',
        dbclEvaluation: '',
        recommendation: '',
        overallRating: 'Không đánh giá',
        klgb: '',
        ...current[projectId],
        ...patch,
      },
    }))
  }

  function handleExportClick() {
    if (rows.length === 0) {
      toast.warning('Không có dự án', 'Chưa có dự án nào để xuất.')
      return
    }
    setShowExportModal(true)
  }

  function handleConfirmExport() {
    try {
      exportMonitoringReportToExcel(rows, userInputs, isoWeek)
      setShowExportModal(false)
      toast.success('Đã xuất báo cáo giám sát', `Tuần ${isoWeek} · ${rows.length} dự án`)
    } catch (err) {
      toast.error('Không xuất được file', err instanceof Error ? err.message : '')
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading panel-heading--compact">
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'end' }}>
          <label>
            <span>Tuần báo cáo</span>
            <select value={isoWeek} onChange={(e) => setIsoWeek(e.target.value)}>
              {weekOptions.map((w) => {
                const r = getWeekRange(w)
                return (
                  <option key={w} value={w}>
                    {w} ({dayjs(r.start).format('DD/MM')} – {dayjs(r.end).format('DD/MM')})
                  </option>
                )
              })}
            </select>
          </label>
          <StatusPill label={`${rows.length} dự án`} tone="info" />
        </div>
        <button type="button" className="primary-button" onClick={handleExportClick}>
          <Download size={15} /> Xuất Excel
        </button>
      </div>

      <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
        <table className="data-table report-preview-table">
          <thead>
            <tr>
              <th>TT</th>
              <th>Khách hàng</th>
              <th>Mã dự án</th>
              <th>Tên dự án</th>
              <th>PS/PM/PC</th>
              <th>HĐ mua</th>
              <th>HĐ bán</th>
              <th>Theo HĐ</th>
              <th>KH TTK</th>
              <th>Trạng thái</th>
              <th>Phạm vi</th>
              <th>Mốc chính / Tiến độ</th>
              <th>Rủi ro/Vấn đề</th>
              <th>Kết quả tuần</th>
              <th>Kế hoạch tiếp</th>
              <th
                colSpan={6}
                style={{ background: 'rgba(220,177,51,0.12)', color: 'var(--muted)' }}
              >
                Khai báo khi export ↓
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.title}>
                <tr className="report-section-row">
                  <td colSpan={21}>
                    <strong>{g.title}</strong>
                  </td>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.project.id}>
                    <td>{r.index}</td>
                    <td>{r.customerLabel}</td>
                    <td>{r.project.code}</td>
                    <td>{r.project.name}</td>
                    <td>
                      PS: {r.psName || '—'}
                      <br />
                      PM: {r.pmName || '—'}
                      <br />
                      PC: {r.pcName || '—'}
                    </td>
                    <td>{r.contractPurchase}</td>
                    <td>{r.contractSale}</td>
                    <td>{r.contractDeadline}</td>
                    <td>{r.ttkDeadline}</td>
                    <td>
                      <StatusPill label={r.projectStateLabel} tone="info" />
                    </td>
                    <td>{r.scope}</td>
                    <td style={{ whiteSpace: 'pre-line' }}>{r.milestoneSummary || '—'}</td>
                    <td style={{ whiteSpace: 'pre-line' }}>{r.riskSummary || '—'}</td>
                    <td>{r.resultThisWeek}</td>
                    <td>{r.planNextWeek}</td>
                    <td colSpan={6} style={{ background: 'rgba(220,177,51,0.05)' }}>
                      <em style={{ color: 'var(--muted)' }}>(Đề xuất / Đánh giá PMO / ĐBCL / Khuyến nghị / Đánh giá tổng thể / KLGB)</em>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showExportModal ? (
        <MonitoringExportModal
          rows={rows}
          userInputs={userInputs}
          onChangeInput={patchInput}
          onClose={() => setShowExportModal(false)}
          onConfirm={handleConfirmExport}
        />
      ) : null}
    </section>
  )
}

function MonitoringExportModal({
  rows,
  userInputs,
  onChangeInput,
  onClose,
  onConfirm,
}: {
  rows: ReturnType<typeof buildMonitoringRows>
  userInputs: Record<string, MonitoringUserInputs>
  onChangeInput: (projectId: string, patch: Partial<MonitoringUserInputs>) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1100px', width: 'min(1100px, 96vw)', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="panel-heading">
          <div>
            <h3>Khai báo trước khi xuất báo cáo giám sát</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã dự án</th>
                <th>Đề xuất (nếu có)</th>
                <th>Đánh giá PMO</th>
                <th>Đánh giá ĐBCL</th>
                <th>Khuyến nghị</th>
                <th>Đánh giá tổng thể</th>
                <th>KLGB</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const u = userInputs[r.project.id] ?? {
                  proposal: '',
                  pmoEvaluation: '',
                  dbclEvaluation: '',
                  recommendation: '',
                  overallRating: 'Không đánh giá' as const,
                  klgb: '',
                }
                return (
                  <tr key={r.project.id}>
                    <td>
                      <strong>{r.project.code}</strong>
                      <p className="workload-cell-note">{r.project.name}</p>
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={u.proposal}
                        onChange={(e) => onChangeInput(r.project.id, { proposal: e.target.value })}
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={u.pmoEvaluation}
                        onChange={(e) =>
                          onChangeInput(r.project.id, { pmoEvaluation: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={u.dbclEvaluation}
                        onChange={(e) =>
                          onChangeInput(r.project.id, { dbclEvaluation: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={u.recommendation}
                        onChange={(e) =>
                          onChangeInput(r.project.id, { recommendation: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={u.overallRating}
                        onChange={(e) =>
                          onChangeInput(r.project.id, {
                            overallRating: e.target.value as MonitoringUserInputs['overallRating'],
                          })
                        }
                      >
                        <option value="Tốt">Tốt</option>
                        <option value="Đạt">Đạt</option>
                        <option value="Cần cải thiện">Cần cải thiện</option>
                        <option value="Không đánh giá">Không đánh giá</option>
                      </select>
                    </td>
                    <td>
                      <input
                        value={u.klgb}
                        onChange={(e) => onChangeInput(r.project.id, { klgb: e.target.value })}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="confirm-card__actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="ghost-button" onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            <Download size={15} /> Xuất Excel
          </button>
        </div>
      </section>
    </div>
  )
}
