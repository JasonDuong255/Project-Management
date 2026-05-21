import { BellRing, CalendarClock, FolderKanban, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import {
  getEffectiveTaskStatus,
  getStatusTone,
  getTaskDeadlineNotifications,
} from '../lib/calculations'
import { formatDate } from '../lib/formatters'

export function NotificationCenterPage() {
  const { currentUser, planItems, projects, users } = useAppData()
  const notifications = getTaskDeadlineNotifications(
    planItems,
    projects,
    users,
    currentUser,
  )
  const dueTodayCount = notifications.filter((item) => item.daysRemaining === 0).length
  const urgentCount = notifications.filter((item) => item.daysRemaining <= 3).length
  const unfinishedChildCount = notifications.reduce(
    (sum, item) => sum + item.childTasks.length,
    0,
  )

  return (
    <div className="page-grid">
      <SectionHeader title="Thông báo" />

      <section className="detail-grid detail-grid--compact">
        <div className="detail-card">
          <span>Dang mo</span>
          <strong>{notifications.length}</strong>
        </div>
        <div className="detail-card">
          <span>Khan</span>
          <strong>{urgentCount}</strong>
        </div>
        <div className="detail-card">
          <span>Den han hom nay</span>
          <strong>{dueTodayCount}</strong>
        </div>
        <div className="detail-card">
          <span>Subtask chua xong</span>
          <strong>{unfinishedChildCount}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h3>Cảnh báo deadline</h3>
          <StatusPill
            label={`${notifications.length} thông báo`}
            tone={notifications.length ? 'warning' : 'success'}
          />
        </div>

        {notifications.length ? (
          <div className="notification-list">
            {notifications.map((item) => (
              <article key={item.id} className="notification-card">
                <div className="notification-card__header">
                  <div>
                    <h3>{item.taskName}</h3>
                    <p>
                      {item.projectCode} | {item.projectName}
                    </p>
                  </div>
                  <StatusPill
                    label={item.daysRemaining === 0 ? 'Đến hạn hôm nay' : `Còn ${item.daysRemaining} ngày`}
                    tone={item.daysRemaining <= 3 ? 'danger' : 'warning'}
                  />
                </div>

                <div className="notification-meta">
                  <span className="notification-chip">
                    <FolderKanban size={15} />
                    PM: {item.projectManagerName}
                  </span>
                  <span className="notification-chip">
                    <BellRing size={15} />
                    Phu trach: {item.assigneeNames}
                  </span>
                  <span className="notification-chip">
                    <CalendarClock size={15} />
                    Han: {formatDate(item.endDate)}
                  </span>
                  <span className="notification-chip">
                    <TriangleAlert size={15} />
                    Tien do: {item.progress}%
                  </span>
                </div>

                <div className="notification-card__body">
                  <div className="notification-card__summary">
                    <strong>Ly do canh bao</strong>
                    <p>
                      Chua dat 100% trong cua so 7 ngay truoc han.
                    </p>
                  </div>

                  <div className="notification-card__children">
                    <div className="notification-card__children-header">
                      <strong>Subtask chua xong</strong>
                      <StatusPill
                        label={`${item.childTasks.length} task`}
                        tone={item.childTasks.length ? 'warning' : 'neutral'}
                      />
                    </div>

                    {item.childTasks.length ? (
                      <div className="notification-child-list">
                        {item.childTasks.map((childTask) => (
                          <div key={childTask.id} className="notification-child-row">
                            <div>
                              <strong>{childTask.name}</strong>
                              <p>
                                {childTask.assigneeNames} | Han {formatDate(childTask.endDate)}
                              </p>
                            </div>
                            <div className="notification-child-row__meta">
                              <StatusPill
                                label={`${childTask.progress}%`}
                                tone={childTask.progress >= 80 ? 'info' : 'warning'}
                              />
                              {(() => {
                                const eff = getEffectiveTaskStatus(childTask)
                                return (
                                  <StatusPill
                                    label={eff}
                                    tone={getStatusTone(eff)}
                                  />
                                )
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overview-empty-note">
                        <p>Khong co subtask. Task tong quan van chua dat 100%.</p>
                      </div>
                    )}
                  </div>

                  <div className="panel-actions">
                    <Link
                      to={`/projects/${item.projectId}`}
                      className="secondary-button secondary-button--compact"
                    >
                      Xem du an
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <h3>Khong co canh bao</h3>
            <p>Tat ca task trong 7 ngay toi deu dung tien do.</p>
          </div>
        )}
      </section>
    </div>
  )
}
