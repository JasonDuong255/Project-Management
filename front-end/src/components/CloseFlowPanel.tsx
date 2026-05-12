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
      <section className="panel panel--compact" data-close-flow="closed">
        <div className="panel-heading panel-heading--compact">
          <div className="close-flow__title">
            <Lock size={16} />
            <span>
              Đã đóng •{' '}
              {project.closedAt ? new Date(project.closedAt).toLocaleString('vi-VN') : '-'}
            </span>
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
      <section className="panel panel--compact" data-close-flow="paused">
        <div className="panel-heading panel-heading--compact">
          <div className="close-flow__title">
            <Pause size={16} />
            <span>
              Tạm đóng •{' '}
              {project.pausedAt ? new Date(project.pausedAt).toLocaleString('vi-VN') : '-'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <StatusPill label="Tạm đóng" tone="warning" />
            {isAdmin ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleResume()}
                disabled={busy}
              >
                <Play size={15} /> Mở lại
              </button>
            ) : null}
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </section>
    )
  }

  // status === 'ACTIVE'
  if (!canManage) {
    return null  // user has no controls; keep the panel hidden
  }

  return (
    <section className="panel panel--compact" data-close-flow="active">
      {error ? <p className="form-error">{error}</p> : null}

      {showCloseForm ? (
        <div className="form-stack">
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
        <div className="panel-heading panel-heading--compact">
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
          <StatusPill label="Đang triển khai" tone="info" />
        </div>
      )}
    </section>
  )
}
