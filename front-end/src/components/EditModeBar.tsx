import { Pencil, Save, X } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'

interface Props {
  isEditing: boolean
  canEdit: boolean
  /** Text shown in read-only mode (e.g. "Đang xem"). */
  readingLabel?: string
  /** Text shown in edit mode (e.g. "Đang chỉnh sửa — bấm Lưu để xác nhận"). */
  editingLabel?: string
  /** Click handler for "Cập nhật" — switch into edit mode. */
  onStartEdit: () => void
  /** Click handler for "Lưu thay đổi" — submit (the form handler should call this). */
  onSave: () => void | Promise<void>
  /** Click handler for "Huỷ" — exit edit mode and restore. */
  onCancel: () => void
  /** Optional extra controls rendered next to the action buttons. */
  trailing?: ReactNode
  /** Saving lock (disables the buttons while a save is in flight). */
  saving?: boolean
  /** Optional custom labels. */
  startLabel?: string
  saveLabel?: string
  cancelLabel?: string
}

/**
 * Read-only by default → click "Cập nhật" → the surrounding form's inputs
 * become editable + buttons switch to "Lưu thay đổi" / "Huỷ". Saving exits
 * edit mode (cancel restores draft from upstream snapshot via parent).
 */
export function EditModeBar({
  isEditing,
  canEdit,
  readingLabel = 'Đang xem',
  editingLabel = 'Đang chỉnh sửa — bấm Lưu để xác nhận',
  onStartEdit,
  onSave,
  onCancel,
  trailing,
  saving,
  startLabel = 'Cập nhật',
  saveLabel = 'Lưu thay đổi',
  cancelLabel = 'Huỷ',
}: Props) {
  return (
    <div className={isEditing ? 'edit-mode-bar edit-mode-bar--editing' : 'edit-mode-bar'}>
      <div className="edit-mode-bar__label">
        <strong>{isEditing ? '● Chế độ chỉnh sửa' : '○ Chế độ xem'}</strong>
        <span>·</span>
        <span>{isEditing ? editingLabel : readingLabel}</span>
      </div>
      <div className="edit-mode-bar__actions">
        {trailing}
        {!isEditing && canEdit ? (
          <button type="button" className="primary-button" onClick={onStartEdit}>
            <Pencil size={14} /> {startLabel}
          </button>
        ) : null}
        {isEditing ? (
          <>
            <button
              type="button"
              className="ghost-button"
              onClick={onCancel}
              disabled={saving}
            >
              <X size={14} /> {cancelLabel}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void onSave()}
              disabled={saving}
            >
              <Save size={14} /> {saving ? 'Đang lưu…' : saveLabel}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Hook helper. Tracks editing flag + a saving flag, plus offers a `withSave`
 * wrapper that runs the supplied async task, automatically exits edit mode
 * on success, and rethrows on failure so the caller can show errors.
 */
export function useEditMode() {
  const [isEditing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const start = useCallback(() => setEditing(true), [])
  const exit = useCallback(() => setEditing(false), [])

  const withSave = useCallback(async (task: () => Promise<void>) => {
    setSaving(true)
    try {
      await task()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [])

  return { isEditing, saving, start, exit, withSave }
}
