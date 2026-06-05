import { BellRing, CalendarClock, FolderKanban, Layers, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import {
  getTaskDeadlineNotifications,
  type TaskDeadlineNotification,
} from '../lib/calculations'
import { formatDate } from '../lib/formatters'

function NotificationCard({ item }: { item: TaskDeadlineNotification }) {
  const isOverdue = item.severity === 'OVERDUE'

  const deadlineLabel = isOverdue
    ? `Quá hạn ${item.daysOverdue} ngày`
    : item.daysRemaining === 0
      ? 'Đến hạn hôm nay'
      : `Còn ${item.daysRemaining} ngày`
  const deadlineTone = isOverdue || item.daysRemaining === 0 ? 'danger' : 'warning'

  const reason = isOverdue
    ? 'Đã quá hạn nhưng tiến độ chưa đạt 100%.'
    : 'Còn ≤ 4 ngày tới hạn, tiến độ chưa đạt 100%.'

  return (
    <article className="notification-card">
      <div className="notification-card__header">
        <div>
          <h3>{item.taskName}</h3>
          <p>
            {item.projectCode} | {item.projectName}
          </p>
        </div>
        <StatusPill label={deadlineLabel} tone={deadlineTone} />
      </div>

      <div className="notification-meta">
        <span className="notification-chip">
          <Layers size={15} />
          {item.isSubtask ? `Subtask${item.parentName ? ` · ${item.parentName}` : ''}` : 'Task'}
        </span>
        <span className="notification-chip">
          <FolderKanban size={15} />
          PM: {item.projectManagerName}
        </span>
        <span className="notification-chip">
          <BellRing size={15} />
          Phụ trách: {item.assigneeNames}
        </span>
        <span className="notification-chip">
          <CalendarClock size={15} />
          Hạn: {formatDate(item.endDate)}
        </span>
        <span className="notification-chip">
          <TriangleAlert size={15} />
          Tiến độ: {item.progress}%
        </span>
      </div>

      <div className="notification-card__body">
        <div className="notification-card__summary">
          <strong>Lý do cảnh báo</strong>
          <p>{reason}</p>
          <StatusPill
            label={`Trạng thái dự án: ${item.projectHealthLabel}`}
            tone={isOverdue ? 'danger' : 'warning'}
          />
        </div>

        <div className="panel-actions">
          <Link
            to={`/projects/${item.projectId}`}
            className="secondary-button secondary-button--compact"
          >
            Xem dự án
          </Link>
        </div>
      </div>
    </article>
  )
}

function NotificationSection({
  title,
  description,
  healthLabel,
  tone,
  items,
  emptyText,
}: {
  title: string
  description: string
  healthLabel: string
  tone: 'danger' | 'warning'
  items: TaskDeadlineNotification[]
  emptyText: string
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="section-header__sub">{description}</p>
        </div>
        <StatusPill label={`${healthLabel} · ${items.length}`} tone={items.length ? tone : 'success'} />
      </div>

      {items.length ? (
        <div className="notification-list">
          {items.map((item) => (
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <h3>Không có cảnh báo</h3>
          <p>{emptyText}</p>
        </div>
      )}
    </section>
  )
}

export function NotificationCenterPage() {
  const { currentUser, planItems, projects, users } = useAppData()
  const notifications = getTaskDeadlineNotifications(planItems, projects, users, currentUser)

  const overdue = notifications.filter((item) => item.severity === 'OVERDUE')
  const dueSoon = notifications.filter((item) => item.severity === 'DUE_SOON')
  const dueTodayCount = dueSoon.filter((item) => item.daysRemaining === 0).length

  return (
    <div className="page-grid">
      <SectionHeader
        title="Thông báo"
        description="Cảnh báo deadline task/subtask cho toàn bộ nhân sự trong TTK."
      />

      <section className="detail-grid detail-grid--compact">
        <div className="detail-card">
          <span>Tổng cảnh báo</span>
          <strong>{notifications.length}</strong>
        </div>
        <div className="detail-card">
          <span>Quá hạn (Có rủi ro)</span>
          <strong>{overdue.length}</strong>
        </div>
        <div className="detail-card">
          <span>Gần đến hạn (Cần xem xét)</span>
          <strong>{dueSoon.length}</strong>
        </div>
        <div className="detail-card">
          <span>Đến hạn hôm nay</span>
          <strong>{dueTodayCount}</strong>
        </div>
      </section>

      <NotificationSection
        title="Cảnh báo quá hạn"
        description="Task/subtask đã đến hạn nhưng chưa hoàn thành (BRD 6.2)."
        healthLabel="Có rủi ro"
        tone="danger"
        items={overdue}
        emptyText="Không có task/subtask nào quá hạn."
      />

      <NotificationSection
        title="Cảnh báo gần đến hạn"
        description="Task/subtask còn ≤ 4 ngày tới hạn nhưng chưa hoàn thành (BRD 6.1)."
        healthLabel="Cần xem xét"
        tone="warning"
        items={dueSoon}
        emptyText="Không có task/subtask nào sắp tới hạn trong 4 ngày."
      />
    </div>
  )
}
