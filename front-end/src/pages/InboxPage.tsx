import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import { fetchCloseInbox, type CloseInboxItem } from '../lib/apiClient'
import { formatDate } from '../lib/formatters'

type Decision = 'APPROVED' | 'REJECTED'

/**
 * Inbox role determines which stage of the close-flow this user can approve.
 * - 'KSV'      → users with functionalTitle = 'KSV' (decide stage-1)
 * - 'TCHC'     → users with role = 'ADMIN_HC'      (decide stage-2)
 * - 'REQUESTER' → anyone else, sees their own submitted close requests
 *
 * BA 14/05/2026: TCNL was removed; stage-2 is now TCHC = ADMIN_HC role.
 */
type InboxRole = 'KSV' | 'TCHC' | 'REQUESTER'

export function InboxPage() {
  const { currentUser, ksvDecideClose, tchcDecideClose, getUser } = useAppData()
  const [items, setItems] = useState<CloseInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({})

  async function reload() {
    try {
      setLoading(true)
      const res = await fetchCloseInbox()
      setItems(res.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  if (!currentUser) {
    return (
      <div className="page-grid">
        <SectionHeader title="Hộp thư duyệt" />
      </div>
    )
  }

  const role: InboxRole =
    currentUser.functionalTitle === 'KSV'
      ? 'KSV'
      : currentUser.role === 'ADMIN_HC'
        ? 'TCHC'
        : 'REQUESTER'
  const isReviewer = role === 'KSV' || role === 'TCHC'

  async function handleDecide(item: CloseInboxItem, decision: Decision) {
    setBusyId(item.id)
    setError('')
    const reason = reasonDraft[item.id] ?? ''
    try {
      if (role === 'KSV') {
        await ksvDecideClose(item.projectId, item.id, decision, reason)
      } else if (role === 'TCHC') {
        await tchcDecideClose(item.projectId, item.id, decision, reason)
      }
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page-grid">
      <SectionHeader title="Hộp thư duyệt" />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="panel">
        <div className="panel-heading">
          <h3>{loading ? 'Đang tải…' : `${items.length} yêu cầu`}</h3>
          <StatusPill
            label={items.length ? `${items.length} chờ xử lý` : 'Trống'}
            tone={items.length ? 'warning' : 'success'}
          />
        </div>

        {!loading && items.length === 0 ? (
          <div className="empty-panel">
            <h3>Không có yêu cầu nào</h3>
            <p>
              {isReviewer
                ? 'Tất cả yêu cầu đã được xử lý.'
                : 'Bạn chưa gửi yêu cầu đóng TTK nào.'}
            </p>
          </div>
        ) : null}

        {items.map((item) => {
          const requester = getUser(item.requestedById)
          const showDecisionControls =
            (role === 'KSV' && item.ksvDecision === 'PENDING') ||
            (role === 'TCHC' &&
              item.ksvDecision === 'APPROVED' &&
              item.tchcDecision === 'PENDING')
          return (
            <article
              key={item.id}
              className="list-row"
              style={{ flexDirection: 'column', alignItems: 'stretch' }}
            >
              <div className="panel-heading" style={{ marginBottom: '0.5rem' }}>
                <div>
                  <Link to={`/projects/${item.projectId}`} style={{ textDecoration: 'none' }}>
                    <strong>{item.project.code}</strong> — {item.project.name}
                  </Link>
                  <p>
                    Người gửi: {requester?.name ?? item.requestedById} •{' '}
                    {formatDate(item.requestedAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <StatusPill
                    label={`KSV: ${item.ksvDecision}`}
                    tone={
                      item.ksvDecision === 'APPROVED'
                        ? 'success'
                        : item.ksvDecision === 'REJECTED'
                          ? 'danger'
                          : 'warning'
                    }
                  />
                  <StatusPill
                    label={`TCHC: ${item.tchcDecision}`}
                    tone={
                      item.tchcDecision === 'APPROVED'
                        ? 'success'
                        : item.tchcDecision === 'REJECTED'
                          ? 'danger'
                          : 'warning'
                    }
                  />
                </div>
              </div>

              {item.note ? (
                <p>
                  <strong>Ghi chú: </strong>
                  {item.note}
                </p>
              ) : null}
              {item.ksvRejectReason ? (
                <p style={{ color: 'var(--danger)' }}>
                  <strong>KSV từ chối: </strong>
                  {item.ksvRejectReason}
                </p>
              ) : null}
              {item.tchcRejectReason ? (
                <p style={{ color: 'var(--danger)' }}>
                  <strong>TCHC từ chối: </strong>
                  {item.tchcRejectReason}
                </p>
              ) : null}

              {showDecisionControls ? (
                <div className="form-stack">
                  <label>
                    <span>Lý do từ chối (chỉ điền khi từ chối)</span>
                    <input
                      value={reasonDraft[item.id] ?? ''}
                      onChange={(e) =>
                        setReasonDraft((d) => ({ ...d, [item.id]: e.target.value }))
                      }
                      placeholder="VD: Hồ sơ chưa đầy đủ"
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleDecide(item, 'APPROVED')}
                      disabled={busyId === item.id}
                    >
                      <Check size={15} /> Phê duyệt
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleDecide(item, 'REJECTED')}
                      disabled={busyId === item.id}
                    >
                      <X size={15} /> Từ chối
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>
    </div>
  )
}
