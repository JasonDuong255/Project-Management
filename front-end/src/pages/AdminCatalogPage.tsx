import { CirclePlus, RotateCcw, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { useConfirm } from '../components/ConfirmDialog'
import { ExternalPersonnelCatalogPanel } from '../components/ExternalPersonnelCatalogPanel'
import { useLoading } from '../components/LoadingOverlay'
import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useToast } from '../components/Toast'
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
  const toast = useToast()
  const { confirm } = useConfirm()
  const loading = useLoading()
  const [busyGroup, setBusyGroup] = useState<keyof Catalogs | null>(null)
  const [resetState, setResetState] = useState<'idle' | 'busy'>('idle')

  const isPmo = currentUser?.role === 'PMO'

  async function handleAddOption(key: keyof Catalogs, draft: CatalogOption) {
    const trimmedValue = draft.value.trim()
    const trimmedLabel = draft.label.trim()
    if (!trimmedValue || !trimmedLabel) {
      toast.warning('Thiếu thông tin', 'Hãy nhập cả mã (value) lẫn nhãn (label).')
      return
    }
    if (catalogs[key].some((opt) => opt.value === trimmedValue)) {
      toast.warning('Mã đã tồn tại', `"${trimmedValue}" đã có trong nhóm này.`)
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
      await loading.run('Đang lưu danh mục…', () => updateCatalogGroup(key, next))
      toast.success('Đã thêm giá trị', `"${trimmedLabel}" vào nhóm ${key}.`)
    } catch (err) {
      toast.error('Cập nhật thất bại', err instanceof Error ? err.message : '')
    } finally {
      setBusyGroup(null)
    }
  }

  async function handleRemoveOption(key: keyof Catalogs, value: string) {
    const opt = catalogs[key].find((o) => o.value === value)
    const ok = await confirm({
      title: `Xoá giá trị "${opt?.label ?? value}"?`,
      description: `Giá trị này sẽ bị gỡ khỏi nhóm "${key}". Các bản ghi hiện đang dùng giá trị này sẽ vẫn giữ mã cũ — nhưng nhãn hiển thị có thể trống. Hành động không thể hoàn tác.`,
      tone: 'danger',
      confirmLabel: 'Xoá giá trị',
    })
    if (!ok) return

    setBusyGroup(key)
    try {
      const next = catalogs[key].filter((o) => o.value !== value)
      await loading.run('Đang xoá giá trị…', () => updateCatalogGroup(key, next))
      toast.success('Đã gỡ giá trị', `"${opt?.label ?? value}" khỏi nhóm ${key}.`)
    } catch (err) {
      toast.error('Xoá thất bại', err instanceof Error ? err.message : '')
    } finally {
      setBusyGroup(null)
    }
  }

  async function handleReset() {
    const ok = await confirm({
      title: 'Reset toàn bộ dữ liệu demo?',
      description: 'Mọi thay đổi của bạn (dự án, kế hoạch, worklog, rủi ro, tài liệu, phân bổ giờ công) sẽ bị xoá và thay bằng seed gốc. Hành động không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Reset dữ liệu',
    })
    if (!ok) {
      setResetState('idle')
      return
    }
    setResetState('busy')
    try {
      await loading.run('Đang reset dữ liệu demo…', () => resetDemoData())
      toast.success('Đã reset dữ liệu demo', 'Toàn bộ snapshot được khôi phục từ seed.')
    } catch (err) {
      toast.error('Reset thất bại', err instanceof Error ? err.message : '')
    } finally {
      setResetState('idle')
    }
  }

  return (
    <div className="page-grid">
      <SectionHeader title="Danh mục hệ thống" />

      {isPmo ? (
        <section className="panel panel--compact">
          <div className="panel-heading panel-heading--compact">
            <h3>Reset dữ liệu demo</h3>
            {resetState === 'idle' ? (
              <button type="button" className="ghost-button" onClick={() => void handleReset()}>
                <RotateCcw size={15} /> Reset
              </button>
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
