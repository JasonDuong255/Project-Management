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
        <SectionHeader
          title="Không gian thành viên"
          description="Đăng nhập bằng tài khoản thành viên để xem task cá nhân"
        />
        <section className="panel empty-panel">
          <h3>Mô đun này dành cho thành viên tổ triển khai</h3>
          <p>
            Bạn có thể dùng tài khoản `dev.binh` hoặc `dev.duy` để xem dữ liệu mẫu
            theo góc nhìn người thực thi.
          </p>
        </section>
      </div>
    )
  }

  const tasks = getMemberTasks(planItems, currentUser.id)
  const raises = delayRaises.filter((item) => item.requesterId === currentUser.id)

  return (
    <div className="page-grid">
      <SectionHeader
        title="Không gian thành viên"
        description="Theo dõi công việc được giao, tiến độ và các raise đã gửi"
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Assigned tasks</span>
            <h3>Công việc đang phụ trách</h3>
          </div>
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
          <div>
            <span className="eyebrow">Delay raises</span>
            <h3>Yêu cầu cập nhật kế hoạch đã gửi</h3>
          </div>
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
