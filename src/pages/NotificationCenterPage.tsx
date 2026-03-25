import { BellRing, CalendarClock, FolderKanban, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import {
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
      <SectionHeader
        title="Trung tam thong bao"
        description="Canh bao task tong quan sap den han trong 7 ngay va cac task con chua hoan thanh."
      />

      <section className="detail-grid detail-grid--compact">
        <div className="detail-card">
          <span>Thong bao dang mo</span>
          <strong>{notifications.length}</strong>
        </div>
        <div className="detail-card">
          <span>Can xu ly gap</span>
          <strong>{urgentCount}</strong>
        </div>
        <div className="detail-card">
          <span>Den han hom nay</span>
          <strong>{dueTodayCount}</strong>
        </div>
        <div className="detail-card">
          <span>Task con chua xong</span>
          <strong>{unfinishedChildCount}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Deadline watcher</span>
            <h3>Danh sach canh bao</h3>
          </div>
          <StatusPill
            label={`${notifications.length} thong bao`}
            tone={notifications.length ? 'warning' : 'success'}
          />
        </div>

        {notifications.length ? (
          <div className="notification-list">
            {notifications.map((item) => (
              <article key={item.id} className="notification-card">
                <div className="notification-card__header">
                  <div>
                    <span className="eyebrow">Task tong quan</span>
                    <h3>{item.taskName}</h3>
                    <p>
                      {item.projectCode} | {item.projectName}
                    </p>
                  </div>
                  <StatusPill
                    label={item.daysRemaining === 0 ? 'Den han hom nay' : `Con ${item.daysRemaining} ngay`}
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
                    Nguoi thuc hien: {item.assigneeNames}
                  </span>
                  <span className="notification-chip">
                    <CalendarClock size={15} />
                    Han cuoi: {formatDate(item.endDate)}
                  </span>
                  <span className="notification-chip">
                    <TriangleAlert size={15} />
                    Tien do hien tai: {item.progress}%
                  </span>
                </div>

                <div className="notification-card__body">
                  <div className="notification-card__summary">
                    <strong>Noi dung canh bao</strong>
                    <p>
                      Task tong quan chua dat 100% trong khi da nam trong cua so canh bao 7 ngay truoc han.
                    </p>
                  </div>

                  <div className="notification-card__children">
                    <div className="notification-card__children-header">
                      <strong>Task con chua hoan thanh</strong>
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
                              <StatusPill
                                label={childTask.status}
                                tone={getStatusTone(childTask.status)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overview-empty-note">
                        <p>Khong co task con chua hoan thanh, nhung task tong quan van chua dat 100%.</p>
                      </div>
                    )}
                  </div>

                  <div className="panel-actions">
                    <Link
                      to={`/projects/${item.projectId}`}
                      className="secondary-button secondary-button--compact"
                    >
                      Mo chi tiet du an
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <h3>Khong co canh bao moi</h3>
            <p>
              Khong co task tong quan nao trong 7 ngay toi han ma chua dat 100% doi voi tai khoan hien tai.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
