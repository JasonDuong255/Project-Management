import { CirclePlus, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  createExternalPersonnel,
  deleteExternalPersonnel,
  fetchExternalPersonnel,
  updateExternalPersonnel,
  type ExternalPersonnelRow,
} from '../lib/apiClient'
import { useConfirm } from './ConfirmDialog'
import { useLoading } from './LoadingOverlay'
import { StatusPill } from './StatusPill'
import { useToast } from './Toast'

type Kind = 'CUSTOMER' | 'PARTNER'

interface DraftFields {
  kind: Kind
  fullName: string
  employeeCode: string
  title: string
  unit: string
  email: string
  phone: string
}

const EMPTY_DRAFT: DraftFields = {
  kind: 'CUSTOMER',
  fullName: '',
  employeeCode: '',
  title: '',
  unit: '',
  email: '',
  phone: '',
}

/**
 * BRD IV.2.7 — Customer / Partner personnel catalog. Reusable across projects.
 * PMO can CRUD; QLDA can read.
 */
export function ExternalPersonnelCatalogPanel() {
  const toast = useToast()
  const { confirm } = useConfirm()
  const loadingOverlay = useLoading()
  const [items, setItems] = useState<ExternalPersonnelRow[]>([])
  const [filter, setFilter] = useState<'ALL' | Kind>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)

  async function reload() {
    setLoading(true); setError('')
    try {
      const res = await fetchExternalPersonnel()
      setItems(res.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void reload() }, [])

  function startEdit(row: ExternalPersonnelRow) {
    setEditingId(row.id)
    setDraft({
      kind: row.kind,
      fullName: row.fullName,
      employeeCode: row.employeeCode,
      title: row.title,
      unit: row.unit,
      email: row.email,
      phone: row.phone,
    })
    setShowCreate(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  function startCreate() {
    setShowCreate(true)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  async function handleSave() {
    if (!draft.fullName.trim()) {
      toast.warning('Thiếu họ tên', 'Họ tên không được để trống.')
      return
    }
    const isEdit = !!editingId
    const ok = await confirm({
      title: isEdit ? 'Lưu thay đổi nhân sự?' : 'Thêm nhân sự KH/Đối tác?',
      description: `${draft.fullName} (${draft.kind === 'CUSTOMER' ? 'Khách hàng' : 'Đối tác'})`,
      tone: 'primary',
      confirmLabel: isEdit ? 'Lưu thay đổi' : 'Tạo mới',
    })
    if (!ok) return
    setBusy(true); setError('')
    try {
      await loadingOverlay.run(isEdit ? 'Đang lưu nhân sự…' : 'Đang thêm nhân sự…', async () => {
        if (editingId) {
          await updateExternalPersonnel(editingId, draft)
        } else {
          await createExternalPersonnel(draft)
        }
      })
      cancelEdit(); setShowCreate(false)
      await reload()
      toast.success(isEdit ? 'Đã cập nhật nhân sự' : 'Đã thêm nhân sự', draft.fullName)
    } catch (e) {
      toast.error('Không lưu được', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(row: ExternalPersonnelRow) {
    const ok = await confirm({
      title: `Xoá "${row.fullName}" khỏi danh mục?`,
      description: `${row.kind === 'CUSTOMER' ? 'Khách hàng' : 'Đối tác'} này sẽ bị gỡ khỏi danh mục dùng chung. Các dự án đang liên kết qua external_personnel_id sẽ mất tham chiếu. Hành động không thể hoàn tác.`,
      tone: 'danger',
      confirmLabel: 'Xoá khỏi danh mục',
    })
    if (!ok) return
    setBusy(true); setError('')
    try {
      await loadingOverlay.run('Đang xoá nhân sự…', () => deleteExternalPersonnel(row.id))
      await reload()
      toast.success('Đã xoá khỏi danh mục', row.fullName)
    } catch (e) {
      toast.error('Không xoá được', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const visible = filter === 'ALL' ? items : items.filter((r) => r.kind === filter)
  const isEditing = editingId !== null || showCreate

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Catalog · BRD IV.2.7</span>
          <h3>Nhân sự Khách hàng / Đối tác</h3>
          <p>Danh mục dùng chung — có thể tái sử dụng giữa các dự án.</p>
        </div>
        <StatusPill label={`${items.length} bản ghi`} tone="info" />
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'ALL' | Kind)}
          disabled={busy}
        >
          <option value="ALL">Tất cả</option>
          <option value="CUSTOMER">Khách hàng</option>
          <option value="PARTNER">Đối tác</option>
        </select>
        {!isEditing ? (
          <button type="button" className="primary-button" onClick={startCreate}>
            <CirclePlus size={15} /> Thêm nhân sự KH/Đối tác
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <div className="form-stack" style={{ marginBottom: '1rem' }}>
          <label>
            <span>Loại</span>
            <select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}
            >
              <option value="CUSTOMER">Khách hàng</option>
              <option value="PARTNER">Đối tác</option>
            </select>
          </label>
          <label>
            <span>Họ và tên</span>
            <input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
          </label>
          <label>
            <span>Mã nhân viên</span>
            <input value={draft.employeeCode} onChange={(e) => setDraft({ ...draft, employeeCode: e.target.value })} />
          </label>
          <label>
            <span>Chức danh</span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label>
            <span>Đơn vị</span>
            <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </label>
          <label>
            <span>Số điện thoại</span>
            <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={busy}>
              {editingId ? 'Lưu thay đổi' : 'Tạo mới'}
            </button>
            <button type="button" className="ghost-button" onClick={() => { cancelEdit(); setShowCreate(false) }}>
              <X size={15} /> Huỷ
            </button>
          </div>
        </div>
      ) : null}

      <div className="stack-list">
        {loading && items.length === 0 ? <p>Đang tải…</p> : null}
        {visible.map((row) => (
          <div key={row.id} className="list-row">
            <div>
              <strong>{row.fullName}</strong>
              <p>
                <StatusPill label={row.kind === 'CUSTOMER' ? 'KH' : 'Đối tác'} tone="neutral" />
                {' '}{row.title}{row.unit ? ` · ${row.unit}` : ''}
              </p>
              {row.email || row.phone ? (
                <p style={{ opacity: 0.7 }}>
                  {row.email}{row.email && row.phone ? ' · ' : ''}{row.phone}
                </p>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                className="ghost-button"
                onClick={() => startEdit(row)}
                disabled={busy}
                title="Sửa"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleDelete(row)}
                disabled={busy}
                title="Gỡ khỏi danh mục"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!loading && visible.length === 0 ? (
          <div className="empty-panel">
            <p>Chưa có bản ghi nào trong danh mục.</p>
          </div>
        ) : null}
      </div>
    </article>
  )
}
