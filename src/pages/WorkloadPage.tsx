import dayjs from 'dayjs'
import { useState } from 'react'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import { getAllMonths, getWorkloadRows } from '../lib/calculations'
import { formatHours, formatMonthLabel } from '../lib/formatters'

export function WorkloadPage() {
  const { projects, users, worklogs } = useAppData()
  const months = getAllMonths(projects, worklogs)
  const [selectedMonth, setSelectedMonth] = useState(
    months.at(-1) ?? dayjs().format('YYYY-MM'),
  )
  const rows = getWorkloadRows(users, projects, worklogs, selectedMonth)

  return (
    <div className="page-grid">
      <SectionHeader
        title="Phân bổ giờ công"
        description="Theo dõi planned/actual/capacity theo từng thành viên triển khai"
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Month filter</span>
            <h3>Chọn kỳ theo dõi</h3>
          </div>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Capacity</th>
                <th>Planned</th>
                <th>Actual</th>
                <th>Lệch</th>
                <th>Dự án tham gia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user.id}>
                  <td>
                    <strong>{row.user.name}</strong>
                    <p>{row.user.title}</p>
                  </td>
                  <td>{formatHours(row.capacity)}</td>
                  <td>{formatHours(row.planned)}</td>
                  <td>{formatHours(row.actual)}</td>
                  <td>
                    <StatusPill
                      label={formatHours(row.delta)}
                      tone={
                        Math.abs(row.delta) <= 10
                          ? 'success'
                          : row.delta > 0
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </td>
                  <td>{row.projectNames.join(', ') || 'Chưa phân công'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
