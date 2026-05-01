import dayjs from 'dayjs'
import { AlertTriangle, FolderOpenDot, ListTodo, Siren } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SectionHeader } from '../components/SectionHeader'
import { StatCard } from '../components/StatCard'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import {
  getAllMonths,
  getDashboardSummary,
  getHealthChart,
  getMonthlyUtilizationChart,
  getOpenRisks,
  getProjectStatusChart,
  getVisibleProjects,
  getWorkloadRows,
} from '../lib/calculations'
import {
  formatHours,
  formatMonthLabel,
  getCatalogLabel,
  getRoleLabel,
} from '../lib/formatters'

const chartColors = ['#0f766e', '#d97706', '#2563eb', '#7c3aed', '#dc2626']

export function DashboardPage() {
  const { currentUser, projects, planItems, delayRaises, worklogs, users, catalogs } =
    useAppData()

  const visibleProjects = getVisibleProjects(projects, currentUser)
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id))
  const visiblePlanItems = planItems.filter((item) =>
    visibleProjectIds.has(item.projectId),
  )
  const visibleDelayRaises = delayRaises.filter((item) =>
    visibleProjectIds.has(item.projectId),
  )
  const summary = getDashboardSummary(
    visibleProjects,
    visiblePlanItems,
    visibleDelayRaises,
  )
  const statusChart = getProjectStatusChart(visibleProjects, catalogs)
  const healthChart = getHealthChart(visibleProjects, catalogs)
  const utilizationChart = getMonthlyUtilizationChart(users, projects, worklogs)
  const currentMonth =
    getAllMonths(projects, worklogs).at(-1) ?? dayjs().format('YYYY-MM')
  const workloadWarnings = getWorkloadRows(users, projects, worklogs, currentMonth)
    .filter((row) => Math.abs(row.delta) > 10)
    .slice(0, 5)
  const openRisks = getOpenRisks(visibleProjects).slice(0, 4)

  return (
    <div className="page-grid">
      <SectionHeader
        title={`Xin chào ${currentUser?.name ?? ''}`}
        description={`Tổng quan điều hành cho ${getRoleLabel(
          currentUser?.role ?? 'PROJECT_ADMIN',
        )}`}
      />

      <section className="stats-grid">
        <StatCard
          label="Dự án đang quản lý"
          value={summary.totalProjects}
          helper="Tổng số dự án nhìn thấy theo vai trò hiện tại"
          accent="#0f766e"
          icon={<FolderOpenDot size={18} />}
        />
        <StatCard
          label="Dự án có rủi ro"
          value={summary.atRiskProjects}
          helper="Bao gồm dự án trạng thái cảnh báo hoặc health đỏ"
          accent="#d97706"
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          label="Đầu mục bị chặn"
          value={summary.blockedTasks}
          helper="Các task BLOCKED hoặc cần cập nhật lại kế hoạch"
          accent="#be123c"
          icon={<ListTodo size={18} />}
        />
        <StatCard
          label="Raise đang mở"
          value={summary.openRaises}
          helper="Yêu cầu thành viên gửi lên PM để re-plan"
          accent="#4338ca"
          icon={<Siren size={18} />}
        />
      </section>

      <section className="two-column">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Project mix</span>
              <h3>Phân bổ trạng thái dự án</h3>
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={94}
                  innerRadius={48}
                >
                  {statusChart.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Delivery health</span>
              <h3>Xu hướng kế hoạch và giờ công</h3>
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={utilizationChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="capacity"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="planned"
                  stroke="#ea580c"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#2563eb"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="two-column">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Health board</span>
              <h3>Sức khỏe dự án theo mức cảnh báo</h3>
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {healthChart.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={chartColors[(index + 1) % chartColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Rủi ro cần theo dõi</span>
              <h3>Danh sách nổi bật</h3>
            </div>
            <StatusPill label={`${openRisks.length} risk`} tone="warning" />
          </div>
          <div className="stack-list">
            {openRisks.map((risk) => (
              <div key={risk.id} className="list-row">
                <div>
                  <strong>{risk.title}</strong>
                  <p>
                    {risk.projectCode} • {risk.projectName}
                  </p>
                </div>
                <StatusPill
                  label={getCatalogLabel(catalogs.riskLevels, risk.level)}
                  tone={risk.level === 'HIGH' ? 'danger' : 'warning'}
                />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Cảnh báo lệch giờ</span>
              <h3>Tổng hợp tháng {formatMonthLabel(currentMonth)}</h3>
            </div>
            <StatusPill label={`${workloadWarnings.length} cảnh báo`} tone="warning" />
          </div>
          <div className="stack-list">
            {workloadWarnings.map((row) => (
              <div key={row.user.id} className="list-row">
                <div>
                  <strong>{row.user.name}</strong>
                  <p>{row.projectNames.join(', ') || 'Chưa phân bổ dự án'}</p>
                </div>
                <div className="metric-pair">
                  <span>
                    Planned: <strong>{formatHours(row.planned)}</strong>
                  </span>
                  <span>
                    Delta:{' '}
                    <strong className={row.delta > 0 ? 'text-danger' : 'text-warning'}>
                      {formatHours(row.delta)}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Tài khoản đang đăng nhập</span>
              <h3>Thông tin vai trò</h3>
            </div>
            <StatusPill label={currentUser?.unit ?? ''} tone="info" />
          </div>
          <div className="profile-summary">
            <div
              className="avatar-lg"
              style={{ backgroundColor: currentUser?.avatarColor }}
            >
              {currentUser?.name.slice(0, 1)}
            </div>
            <div>
              <h3>{currentUser?.name}</h3>
              <p>{getRoleLabel(currentUser?.role ?? 'PROJECT_ADMIN')}</p>
              <small>
                Tài khoản demo hiện dùng để kiểm tra flow, cảnh báo và phân quyền.
              </small>
            </div>
          </div>
          <div className="detail-grid compact-grid">
            <div className="detail-card">
              <span>Username</span>
              <strong>{currentUser?.username}</strong>
            </div>
            <div className="detail-card">
              <span>Đơn vị</span>
              <strong>{currentUser?.unit}</strong>
            </div>
            <div className="detail-card">
              <span>Giờ công chuẩn/tháng</span>
              <strong>{currentUser?.monthlyCapacity}h</strong>
            </div>
            <div className="detail-card">
              <span>Ngày tổng hợp</span>
              <strong>{dayjs().format('DD/MM/YYYY')}</strong>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
