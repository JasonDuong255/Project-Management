import { CirclePlus, RotateCcw, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { ExternalPersonnelCatalogPanel } from '../components/ExternalPersonnelCatalogPanel'
import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import type { CatalogOption, Catalogs } from '../types'

interface CatalogGroupDef {
  key: keyof Catalogs
  title: string
  description: string
}

const CATALOG_GROUPS: CatalogGroupDef[] = [
  { key: 'projectStatuses', title: 'Trạng thái dự án', description: 'INITIATION → DONE' },
  { key: 'healthStatuses', title: 'Health status', description: 'GREEN / AMBER / RED' },
  { key: 'taskStatuses', title: 'Trạng thái công việc', description: 'NOT_STARTED → DONE' },
  { key: 'riskLevels', title: 'Mức độ rủi ro', description: 'LOW / MEDIUM / HIGH' },
  { key: 'documentCategories', title: 'Loại tài liệu', description: 'Hợp đồng, biên bản, ...' },
  { key: 'departments', title: 'Đơn vị', description: 'Khối / phòng ban' },
  {
    key: 'projectMemberRoles',
    title: 'Vai trò tổ triển khai',
    description: 'PM dự án, BA, Lập trình, ...',
  },
]

export function AdminCatalogPage() {
  const { catalogs, currentUser, updateCatalogGroup, resetDemoData } = useAppData()
  const [busyGroup, setBusyGroup] = useState<keyof Catalogs | null>(null)
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'busy'>('idle')
  const [message, setMessage] = useState('')

  const isPmo = currentUser?.role === 'PMO'

  async function handleAddOption(key: keyof Catalogs, draft: CatalogOption) {
    const trimmedValue = draft.value.trim()
    const trimmedLabel = draft.label.trim()
    if (!trimmedValue || !trimmedLabel) {
      setMessage('Hãy nhập cả mã (value) lẫn nhãn (label).')
      return
    }
    if (catalogs[key].some((opt) => opt.value === trimmedValue)) {
      setMessage(`Mã "${trimmedValue}" đã tồn tại trong nhóm này.`)
      return
    }

    setBusyGroup(key)
    try {
      const next = [
        ...catalogs[key],
        {
          value: trimmedValue,
          label: trimmedLabel,
          ...(draft.description ? { description: draft.description } : {}),
        },
      ]
      await updateCatalogGroup(key, next)
      setMessage(`Đã thêm "${trimmedLabel}" vào ${key}.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Cập nhật thất bại.')
    } finally {
      setBusyGroup(null)
    }
  }

  async function handleRemoveOption(key: keyof Catalogs, value: string) {
    setBusyGroup(key)
    try {
      const next = catalogs[key].filter((opt) => opt.value !== value)
      await updateCatalogGroup(key, next)
      setMessage(`Đã gỡ "${value}" khỏi ${key}.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Cập nhật thất bại.')
    } finally {
      setBusyGroup(null)
    }
  }

  async function handleReset() {
    setResetState('busy')
    try {
      await resetDemoData()
      setMessage('Đã reset toàn bộ dữ liệu demo từ seed.')
      setResetState('idle')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Reset thất bại.')
      setResetState('confirm')
    }
  }

  return (
    <div className="page-grid">
      <SectionHeader
        title="Danh mục hệ thống"
        description="Quản lý LOV dùng chung"
      />

      {message ? (
        <div className="form-error" style={{ marginBottom: '0.5rem' }}>
          {message}
        </div>
      ) : null}

      {isPmo ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Demo data</span>
              <h3>Reset dữ liệu demo</h3>
              <p>Khôi phục seed gốc. Thay đổi sẽ mất.</p>
            </div>
            {resetState === 'idle' ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setResetState('confirm')}
              >
                <RotateCcw size={15} /> Reset
              </button>
            ) : resetState === 'confirm' ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleReset()}
                >
                  Xác nhận reset
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setResetState('idle')}
                >
                  Huỷ
                </button>
              </div>
            ) : (
              <StatusPill label="Đang reset..." tone="warning" />
            )}
          </div>
        </section>
      ) : null}

      <section className="catalog-grid">
        {CATALOG_GROUPS.map((group) => (
          <CatalogGroupCard
            key={group.key}
            group={group}
            options={catalogs[group.key]}
            busy={busyGroup === group.key}
            canEdit={isPmo}
            onAdd={(draft) => handleAddOption(group.key, draft)}
            onRemove={(value) => handleRemoveOption(group.key, value)}
          />
        ))}
      </section>

      {/* v3.4: KH/Đối tác catalog (BRD IV.2.7). Lives outside catalog_groups
          because it's a per-row table with audit fields, not a JSONB blob. */}
      <ExternalPersonnelCatalogPanel />
    </div>
  )
}

interface CatalogGroupCardProps {
  group: CatalogGroupDef
  options: CatalogOption[]
  busy: boolean
  canEdit: boolean
  onAdd: (draft: CatalogOption) => void | Promise<void>
  onRemove: (value: string) => void | Promise<void>
}

function CatalogGroupCard({
  group,
  options,
  busy,
  canEdit,
  onAdd,
  onRemove,
}: CatalogGroupCardProps) {
  const [draft, setDraft] = useState<CatalogOption>({ value: '', label: '', description: '' })
  const [isAdding, setIsAdding] = useState(false)

  async function submit() {
    await onAdd(draft)
    setDraft({ value: '', label: '', description: '' })
    setIsAdding(false)
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{group.description}</span>
          <h3>{group.title}</h3>
        </div>
        <StatusPill label={`${options.length} giá trị`} tone="info" />
      </div>

      <div className="stack-list">
        {options.map((item) => (
          <div key={item.value} className="list-row">
            <div>
              <strong>{item.label}</strong>
              <p>{item.value}</p>
              {item.description ? <p style={{ opacity: 0.6 }}>{item.description}</p> : null}
            </div>
            {canEdit ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => void onRemove(item.value)}
                disabled={busy}
                title="Gỡ giá trị này"
              >
                <Trash2 size={15} />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {canEdit ? (
        isAdding ? (
          <div className="form-stack" style={{ marginTop: '0.75rem' }}>
            <label>
              <span>Mã (value)</span>
              <input
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                placeholder="VD: APPROVED"
              />
            </label>
            <label>
              <span>Nhãn hiển thị (label)</span>
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="VD: Đã duyệt"
              />
            </label>
            <label>
              <span>Mô tả (tuỳ chọn)</span>
              <input
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => void submit()}
                disabled={busy}
              >
                <CirclePlus size={15} /> Thêm
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setDraft({ value: '', label: '', description: '' })
                  setIsAdding(false)
                }}
              >
                <X size={15} /> Huỷ
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="ghost-button"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setIsAdding(true)}
            disabled={busy}
          >
            <CirclePlus size={15} /> Thêm giá trị
          </button>
        )
      ) : null}
    </article>
  )
}
