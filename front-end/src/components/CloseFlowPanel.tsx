import { Lock, Pause, Play, Send, X } from 'lucide-react'
import { useState } from 'react'

import { useAppData } from '../context/AppContext'
import { canManageProjectPlan, normalizeUserRole } from '../lib/calculations'
import type { Project } from '../types'
import { StatusPill } from './StatusPill'

interface Props {
  project: Project
}

type TransitionMode = 'pause' | 'resume' | 'close'

export function CloseFlowPanel({ project }: Props) {
  const { currentUser, pauseProject, resumeProject, requestProjectClose } = useAppData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<TransitionMode | null>(null)
  const [note, setNote] = useState('')

  if (!currentUser) return null

  const normalizedRole = normalizeUserRole(currentUser.role)
  const canManage = canManageProjectPlan(project, currentUser)
  const isAdmin = project.adminId === currentUser.id || normalizedRole === 'PMO'

  function openModal(nextMode: TransitionMode) {
    setMode(nextMode)
    setNote('')
    setError('')
  }

  function closeModal() {
    if (busy) return
    setMode(null)
    setNote('')
    setError('')
  }

  async function handleSubmit() {
    if (!mode) return
    const trimmedNote = note.trim()
    if ((mode === 'pause' || mode === 'resume') && !trimmedNote) {
      setError('Vui lòng nhập lý do.')
      return
    }

    setBusy(true)
    setError('')
    try {
      if (mode === 'pause') {
        await pauseProject(project.id, trimmedNote)
      } else if (mode === 'resume') {
        await resumeProject(project.id, trimmedNote)
      } else {
        await requestProjectClose(project.id, trimmedNote)
      }
      setMode(null)
      setNote('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const modalTitle =
    mode === 'pause'
      ? 'Tạm đóng dự án'
      : mode === 'resume'
        ? 'Mở lại dự án'
        : 'Gửi yêu cầu đóng TTK'
  const modalLabel =
    mode === 'close' ? 'Ghi chú gửi phê duyệt' : 'Lý do'
  const modalSubmit =
    mode === 'pause' ? 'Tạm đóng' : mode === 'resume' ? 'Mở lại' : 'Gửi yêu cầu'

  return (
    <>
      <div className="close-flow-compact">
        {project.status === 'CLOSED' ? (
          <StatusPill label="Đã đóng" tone="success" />
        ) : project.status === 'PAUSED' ? (
          <>
            <StatusPill label="Tạm đóng" tone="warning" />
            {isAdmin ? (
              <button
                type="button"
                className="primary-button primary-button--compact"
                onClick={() => openModal('resume')}
                disabled={busy}
              >
                <Play size={15} />
                Mở lại
              </button>
            ) : null}
          </>
        ) : canManage ? (
          <>
            <button
              type="button"
              className="ghost-button ghost-button--compact"
              onClick={() => openModal('pause')}
              disabled={busy}
            >
              <Pause size={15} />
              Tạm đóng
            </button>
            <button
              type="button"
              className="primary-button primary-button--compact"
              onClick={() => openModal('close')}
              disabled={busy}
            >
              <Send size={15} />
              Đóng
            </button>
          </>
        ) : (
          <StatusPill label="Đang triển khai" tone="info" />
        )}
        {project.status === 'CLOSED' ? <Lock size={16} aria-hidden="true" /> : null}
      </div>

      {mode ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card close-flow-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Trạng thái dự án</span>
                <h3>{modalTitle}</h3>
                <p>{project.code} · {project.name}</p>
              </div>
              <button
                type="button"
                className="ghost-button icon-button"
                onClick={closeModal}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <label>
              <span>{modalLabel}</span>
              <textarea
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  mode === 'close'
                    ? 'VD: Đã hoàn tất bàn giao và nghiệm thu.'
                    : 'Nhập lý do để lưu vào lịch sử thao tác.'
                }
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={closeModal} disabled={busy}>
                Hủy
              </button>
              <button type="button" className="primary-button" onClick={() => void handleSubmit()} disabled={busy}>
                {modalSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
