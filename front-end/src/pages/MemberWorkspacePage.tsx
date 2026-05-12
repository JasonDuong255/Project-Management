import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import { getMemberTasks, getStatusTone } from '../lib/calculations'
import { formatDate, formatHours, getCatalogLabel } from '../lib/formatters'

export function MemberWorkspacePage() {
  const { currentUser, planItems, projects, catalogs, getUser, delayRaises } =
    useAppData()

  if (!currentUser || currentUser.role !== 'DELIVERY_MEMBER') {
    return (
      <div className="page-grid">
        <SectionHeader title="Việc của tôi" />
        <section className="panel empty-panel">
          <h3>Cần tài khoản thành viên</h3>
          <p>Dùng `dev.binh` hoặc `dev.duy` để xem dữ liệu mẫu.</p>
        </section>
      </div>
    )
  }

  const tasks = getMemberTasks(planItems, currentUser.id)
  const raises = delayRaises.filter((item) => item.requesterId === currentUser.id)

  return (
    <div className="page-grid">
      <SectionHeader title="Việc của tôi" />

      <section className="panel">
        <div className="panel-heading">
          <h3>Công việc của tôi</h3>
          <StatusPill label={`${tasks.length} task`} tone="info" />
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Công việc</th>
                <th>Trạng thái</th>
                <th>Planned / Actual</th>
                <th>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{projects.find((project) => project.id === task.projectId)?.code}</td>
                  <td>
                    <strong>{task.name}</strong>
                    <p>{task.deliverable}</p>
                  </td>
                  <td>
                    <StatusPill
                      label={getCatalogLabel(catalogs.taskStatuses, task.status)}
                      tone={getStatusTone(task.status)}
                    />
                  </td>
                  <td>
                    {formatHours(task.plannedHours)} / {formatHours(task.actualHours)}
                  </td>
                  <td>
                    {formatDate(task.startDate)} - {formatDate(task.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h3>Raise đã gửi</h3>
          <StatusPill label={`${raises.length} raise`} tone="warning" />
        </div>
        <div className="stack-list">
          {raises.map((item) => (
            <div key={item.id} className="list-row">
              <div>
                <strong>{getUser(item.requesterId)?.name}</strong>
                <p>{item.reason}</p>
              </div>
              <StatusPill label={item.status} tone="warning" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
