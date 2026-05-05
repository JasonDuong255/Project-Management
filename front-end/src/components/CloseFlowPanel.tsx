import { Lock, Pause, Play, Send } from 'lucide-react'
import { useState } from 'react'

import { useAppData } from '../context/AppContext'
import { canManageProjectPlan, normalizeUserRole } from '../lib/calculations'
import type { Project } from '../types'
import { StatusPill } from './StatusPill'

interface Props {
  project: Project
}

/**
 * BRD IV.6: project-close-workflow controls. Renders different UIs depending
 * on the project's status and the current user's role.
 *
 * - ACTIVE  + can-manage  → "Tạm đóng" + "Yêu cầu đóng TTK"
 * - PAUSED  + admin/PMO   → "Mở lại"
 * - CLOSED                 → read-only badge
 */
export function CloseFlowPanel({ project }: Props) {
  const { currentUser, pauseProject, resumeProject, requestProjectClose } = useAppData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [closeNote, setCloseNote] = useState('')

  if (!currentUser) return null

  const normalizedRole = normalizeUserRole(currentUser.role)
  const canManage = canManageProjectPlan(project, currentUser)
  const isAdmin = project.adminId === currentUser.id || normalizedRole === 'PMO'

  if (project.status === 'CLOSED') {
    return (
      <section className="panel" data-close-flow="closed">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Trạng thái dự án</span>
            <h3>
              <Lock size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
              Dự án đã đóng
            </h3>
            <p>
              Mọi thao tác chỉnh sửa thông tin, kế hoạch, nguồn lực, tài liệu và rủi ro đều bị
              khóa. Đóng vào: {project.closedAt ? new Date(project.closedAt).toLocaleString('vi-VN') : '-'}
            </p>
          </div>
          <StatusPill label="Đã đóng" tone="success" />
        </div>
      </section>
    )
  }

  async function handlePause() {
    setBusy(true); setError('')
    try { await pauseProject(project.id) } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  async function handleResume() {
    setBusy(true); setError('')
    try { await resumeProject(project.id) } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  async function handleSubmitCloseRequest() {
    setBusy(true); setError('')
    try {
      await requestProjectClose(project.id, closeNote)
      setShowCloseForm(false)
      setCloseNote('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (project.status === 'PAUSED') {
    return (
      <section className="panel" data-close-flow="paused">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Trạng thái dự án</span>
            <h3>Tạm đóng</h3>
            <p>
              Tạm dừng vào: {project.pausedAt ? new Date(project.pausedAt).toLocaleString('vi-VN') : '-'}.
              {isAdmin ? ' Bạn có thể mở lại để tiếp tục triển khai.' : ' Liên hệ PM hoặc PMO để mở lại.'}
            </p>
          </div>
          <StatusPill label="Tạm đóng" tone="warning" />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {isAdmin ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleResume()}
              disabled={busy}
            >
              <Play size={15} /> Mở lại dự án
            </button>
          </div>
        ) : null}
      </section>
    )
  }

  // status === 'ACTIVE'
  if (!canManage) {
    return null  // user has no controls; keep the panel hidden
  }

  return (
    <section className="panel" data-close-flow="active">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Quy trình đóng dự án</span>
          <h3>Tạm đóng / Đóng TTK</h3>
          <p>
            Tạm đóng có thể mở lại bất cứ lúc nào. Đóng TTK đi qua quy trình
            QLDA → KSV → TCNL và sẽ khóa toàn bộ dự án.
          </p>
        </div>
        <StatusPill label="Đang triển khai" tone="info" />
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {showCloseForm ? (
        <div className="form-stack" style={{ marginTop: '0.75rem' }}>
          <label>
            <span>Ghi chú gửi KSV (tuỳ chọn)</span>
            <textarea
              rows={3}
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="VD: Đã hoàn tất bàn giao và biên bản nghiệm thu."
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSubmitCloseRequest()}
              disabled={busy}
            >
              <Send size={15} /> Gửi yêu cầu đóng
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => { setShowCloseForm(false); setCloseNote('') }}
              disabled={busy}
            >
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void handlePause()}
            disabled={busy}
          >
            <Pause size={15} /> Tạm đóng
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCloseForm(true)}
            disabled={busy}
          >
            <Send size={15} /> Yêu cầu đóng TTK
          </button>
        </div>
      )}
    </section>
  )
}
