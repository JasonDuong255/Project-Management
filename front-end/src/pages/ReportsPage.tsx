import dayjs from 'dayjs'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import {
  getAllMonths,
  getProjectPerformanceRows,
  getRecentDelayRaises,
  getVisibleProjects,
  getWorkloadRows,
} from '../lib/calculations'
import { formatDateTime, formatHours, formatMonthLabel } from '../lib/formatters'

export function ReportsPage() {
  const { currentUser, projects, planItems, worklogs, users, delayRaises, getUser } =
    useAppData()
  const visibleProjects = getVisibleProjects(projects, currentUser)
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id))
  const visiblePlanItems = planItems.filter((item) =>
    visibleProjectIds.has(item.projectId),
  )
  const month = getAllMonths(projects, worklogs).at(-1) ?? dayjs().format('YYYY-MM')
  const projectRows = getProjectPerformanceRows(visibleProjects, visiblePlanItems, worklogs)
  const workloadRows = getWorkloadRows(users, projects, worklogs, month)
  const raises = getRecentDelayRaises(delayRaises).filter((item) =>
    visibleProjectIds.has(item.projectId),
  )

  return (
    <div className="page-grid">
      <SectionHeader title="Báo cáo" />

      <section className="panel">
        <div className="panel-heading">
          <h3>Hiệu quả dự án</h3>
          <StatusPill label={`${projectRows.length} dự án`} tone="info" />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Dự án</th>
                <th>Tiến độ</th>
                <th>Task trễ/chặn</th>
                <th>Rủi ro mở</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              {projectRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.progress}%</td>
                  <td>{row.delayedTasks}</td>
                  <td>{row.openRisks}</td>
                  <td>{formatHours(row.actualHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-heading">
            <h3>Lệch giờ tháng {formatMonthLabel(month)}</h3>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>Capacity</th>
                  <th>Planned</th>
                  <th>Lệch</th>
                </tr>
              </thead>
              <tbody>
                {workloadRows.map((row) => (
                  <tr key={row.user.id}>
                    <td>{row.user.name}</td>
                    <td>{formatHours(row.capacity)}</td>
                    <td>{formatHours(row.planned)}</td>
                    <td>{formatHours(row.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h3>Raise chậm tiến độ</h3>
            <StatusPill label={`${raises.length} raise`} tone="warning" />
          </div>
          <div className="stack-list">
            {raises.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{getUser(item.requesterId)?.name}</strong>
                  <p>{item.reason}</p>
                </div>
                <small>{formatDateTime(item.requestedAt)}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
