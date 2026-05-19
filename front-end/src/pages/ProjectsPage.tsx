import dayjs from 'dayjs'
import { CirclePlus, Eye, FileText, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useConfirm } from '../components/ConfirmDialog'
import { useLoading } from '../components/LoadingOverlay'
import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useToast } from '../components/Toast'
import { useAppData } from '../context/AppContext'
import {
  getHealthTone,
  getStatusTone,
  getVisibleProjects,
  normalizeUserRole,
} from '../lib/calculations'
import { readDocumentAttachment } from '../lib/fileAttachment'
import { formatDate, getCatalogLabel } from '../lib/formatters'
import type {
  BusinessCenterCode,
  CreateProjectTeamMemberInput,
  CustomerGroupCode,
  DocumentAttachmentInput,
  DomainCode,
  MarketCode,
  Project,
  ProjectKindCode,
  User,
} from '../types'

interface MemberDraft {
  selected: boolean
  role: string
  responsibility: string
  totalPlannedHours: number
}

interface ProjectSection {
  title: string
  projects: Project[]
}

type ProjectListFilter = 'ALL' | 'ACTIVE' | 'CLOSED'

const businessCenterOptions: BusinessCenterCode[] = ['BU1', 'BU2', 'BU3', 'BU4', 'BU5']
const customerGroupOptions: CustomerGroupCode[] = ['VNA', 'LDLK', 'OT', 'NB']
const marketOptions: MarketCode[] = ['HK', 'CHK', 'AN', 'CP', 'XD', 'TC', 'GD', 'NL', 'DN', 'YT', 'HH']
const domainOptions: DomainCode[] = ['PM', 'HT', 'DV']
const projectKindOptions: ProjectKindCode[] = ['NC', 'KT', 'HĐ', 'NB']
const projectListFilters: Array<{ id: ProjectListFilter; label: string }> = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'ACTIVE', label: 'Đang triển khai' },
  { id: 'CLOSED', label: 'Đã đóng/tạm đóng' },
]

function getProjectYear(value: string) {
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY') : dayjs().format('YYYY')
}

function buildProjectCode(projects: Project[], form: ReturnType<typeof buildInitialForm>) {
  const year = getProjectYear(form.startDate)
  const sequence = projects.filter((project) => getProjectYear(project.startDate) === year).length + 1
  return [
    year,
    String(sequence).padStart(3, '0'),
    form.businessCenterCode,
    form.customerGroupCode,
    form.domainCode,
    form.projectKindCode,
  ].join('-')
}

function buildInitialForm(sponsorId: string) {
  return {
    name: '',
    sponsor: sponsorId,
    objective: '',
    adminId: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(4, 'month').endOf('month').format('YYYY-MM-DD'),
    ttkDecisionNumber: '',
    ttkDecisionFileName: '',
    ttkDecisionAttachment: null as DocumentAttachmentInput | null,
    businessCenterCode: 'BU1' as BusinessCenterCode,
    customerGroupCode: 'VNA' as CustomerGroupCode,
    marketCode: 'HK' as MarketCode,
    domainCode: 'PM' as DomainCode,
    projectKindCode: 'NC' as ProjectKindCode,
  }
}

function buildEmptyMemberDraft(): MemberDraft {
  return {
    selected: false,
    role: 'Thanh vien trien khai',
    responsibility: '',
    totalPlannedHours: 0,
  }
}

function buildProjectSections(projects: Project[], activeFilter: ProjectListFilter): ProjectSection[] {
  if (activeFilter === 'ACTIVE') {
    return [{ title: 'Đang triển khai', projects: projects.filter((p) => p.status === 'ACTIVE') }]
  }

  if (activeFilter === 'CLOSED') {
    return [
      {
        title: 'Đã đóng/tạm đóng',
        projects: projects.filter((p) => p.status === 'PAUSED' || p.status === 'CLOSED'),
      },
    ]
  }

  return [{ title: 'Tất cả dự án', projects }]
}

export function ProjectsPage() {
  const { currentUser, projects, users, catalogs, createProject, getUser } = useAppData()
  const toast = useToast()
  const { confirm } = useConfirm()
  const loading = useLoading()
  const [message, setMessage] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [activeProjectFilter, setActiveProjectFilter] = useState<ProjectListFilter>('ALL')

  const normalizedRole = currentUser ? normalizeUserRole(currentUser.role) : null
  const visibleProjects = getVisibleProjects(projects, currentUser)
  const projectSections = currentUser
    ? buildProjectSections(visibleProjects, activeProjectFilter).filter((section) => section.projects.length)
    : []
  // BA decision 12/05/2026: only ADMIN_HC (TCHC) can create projects.
  const canCreate = normalizedRole === 'ADMIN_HC'
  const sponsorCandidates = users.filter((user) => normalizeUserRole(user.role) !== 'DELIVERY_MEMBER')
  const deployableUsers = users.filter((user) => {
    const role = normalizeUserRole(user.role)
    return role === 'PM' || role === 'DELIVERY_MEMBER'
  })
  const roleOptions = catalogs.projectMemberRoles.length
    ? catalogs.projectMemberRoles
    : [{ value: 'Thanh vien trien khai', label: 'Thành viên triển khai' }]
  const defaultSponsorId = sponsorCandidates[0]?.id ?? users[0]?.id ?? ''

  const [form, setForm] = useState(buildInitialForm(defaultSponsorId))
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>({})

  const selectedMemberCount = Object.values(memberDrafts).filter((d) => d.selected).length
  const generatedProjectCode = buildProjectCode(projects, form)

  function getMemberDraft(userId: string) {
    return memberDrafts[userId] ?? buildEmptyMemberDraft()
  }

  function resetCreateState() {
    setForm(buildInitialForm(defaultSponsorId))
    setMemberDrafts({})
  }

  function openCreateModal() {
    resetCreateState()
    setIsCreateOpen(true)
    setMessage('')
  }

  function closeCreateModal() {
    setIsCreateOpen(false)
  }

  function updateMemberDraft(userId: string, patch: Partial<MemberDraft>) {
    setMemberDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? buildEmptyMemberDraft()),
        ...patch,
      },
    }))
  }

  function toggleMember(user: User) {
    const draft = getMemberDraft(user.id)
    const nextSelected = !draft.selected
    const isPmCandidate = normalizeUserRole(user.role) === 'PM'

    updateMemberDraft(user.id, {
      selected: nextSelected,
      role:
        form.adminId === user.id
          ? 'PM du an'
          : draft.role || 'Thanh vien trien khai',
    })

    if (!nextSelected && form.adminId === user.id) {
      setForm((current) => ({ ...current, adminId: '' }))
    }

    if (nextSelected && isPmCandidate && !form.adminId) {
      setForm((current) => ({ ...current, adminId: user.id }))
      updateMemberDraft(user.id, {
        selected: true,
        role: 'PM du an',
      })
    }
  }

  function handlePmChange(pmUserId: string) {
    setForm((current) => ({ ...current, adminId: pmUserId }))
    updateMemberDraft(pmUserId, {
      selected: true,
      role: 'PM du an',
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentUser || normalizeUserRole(currentUser.role) !== 'ADMIN_HC') {
      setMessage('Chỉ Tổ chức Hành chính (TCHC) mới có quyền tạo dự án.')
      return
    }

    const selectedMembers: CreateProjectTeamMemberInput[] = deployableUsers
      .map((user) => ({
        user,
        draft: getMemberDraft(user.id),
      }))
      .filter(({ draft }) => draft.selected)
      .map(({ user, draft }) => ({
        userId: user.id,
        role: user.id === form.adminId ? 'PM du an' : draft.role || 'Thanh vien trien khai',
        responsibility: draft.responsibility.trim(),
        totalPlannedHours: Math.max(0, Math.round(draft.totalPlannedHours)),
      }))

    if (!selectedMembers.length) {
      setMessage('Hãy chọn ít nhất một nhân sự triển khai cho dự án.')
      return
    }

    if (!form.adminId || !selectedMembers.some((member) => member.userId === form.adminId)) {
      setMessage('Hãy chọn 1 PM thuộc danh sách nhân sự triển khai.')
      return
    }

    const ok = await confirm({
      title: 'Tạo dự án mới?',
      description: `Mã ${generatedProjectCode} - ${selectedMembers.length} thành viên. Sau khi lưu, dự án sẽ ở trạng thái Đang triển khai.`,
      tone: 'primary',
      confirmLabel: 'Tạo dự án',
    })
    if (!ok) return

    try {
      await loading.run('Đang tạo dự án…', () =>
        createProject({
          code: generatedProjectCode,
          name: form.name,
          sponsor: form.sponsor,
          objective: form.objective,
          ttkDecisionNumber: form.ttkDecisionNumber,
          ttkDecisionAttachment: form.ttkDecisionAttachment
            ? {
                ...form.ttkDecisionAttachment,
                title: form.ttkDecisionAttachment.fileName,
              }
            : undefined,
          businessCenterCode: form.businessCenterCode,
          customerGroupCode: form.customerGroupCode,
          marketCode: form.marketCode,
          domainCode: form.domainCode,
          projectKindCode: form.projectKindCode,
          createdById: currentUser.id,
          adminId: form.adminId,
          startDate: form.startDate,
          endDate: form.endDate,
          teamMembers: selectedMembers,
          department: currentUser.unit,
        }),
      )
      toast.success('Đã tạo dự án mới', generatedProjectCode)
      setIsCreateOpen(false)
      resetCreateState()
      setMessage('')
    } catch (err) {
      toast.error('Không tạo được dự án', err instanceof Error ? err.message : '')
    }
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="page-grid">
      <SectionHeader
        title="Dự án"
        actions={
          canCreate ? (
            <button type="button" className="primary-button" onClick={openCreateModal}>
              <CirclePlus size={16} />
              Tạo dự án
            </button>
          ) : null
        }
      />

      {message ? <p className="form-success">{message}</p> : null}

      <section className="panel panel--compact project-filter-panel">
        <div className="segmented-control" aria-label="Lọc danh sách dự án">
          {projectListFilters.map((filter) => {
            const count =
              filter.id === 'ALL'
                ? visibleProjects.length
                : filter.id === 'ACTIVE'
                  ? visibleProjects.filter((project) => project.status === 'ACTIVE').length
                  : visibleProjects.filter(
                      (project) => project.status === 'PAUSED' || project.status === 'CLOSED',
                    ).length
            return (
              <button
                key={filter.id}
                type="button"
                className={activeProjectFilter === filter.id ? 'segmented-control__item--active' : ''}
                onClick={() => setActiveProjectFilter(filter.id)}
              >
                {filter.label}
                <span>{count}</span>
              </button>
            )
          })}
        </div>
      </section>

      {projectSections.length ? (
        projectSections.map((section) => (
          <section key={section.title} className="project-section-block">
            <div className="panel-heading panel-heading--compact">
              <h3>{section.title}</h3>
              <StatusPill label={`${section.projects.length} dự án`} tone="info" />
            </div>

            <div className="table-wrapper project-table-wrapper">
              <table className="project-table">
                <thead>
                  <tr>
                    <th>Mã dự án</th>
                    <th>Tên dự án</th>
                    <th>PM</th>
                    <th>Sponsor</th>
                    <th>Trạng thái</th>
                    <th>Health</th>
                    <th>Tiến độ</th>
                    <th>Nhân sự</th>
                    <th>Tài liệu</th>
                    <th>Rủi ro</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {section.projects.map((project) => {
                    const admin = getUser(project.adminId)
                    const sponsor = getUser(project.sponsor)

                    return (
                      <tr key={project.id}>
                        <td>
                          <strong>{project.code}</strong>
                        </td>
                        <td className="project-table__name">
                          <strong>{project.name}</strong>
                          {project.summary ? <p>{project.summary}</p> : null}
                        </td>
                        <td>{admin?.name ?? 'Chưa xác định'}</td>
                        <td>{sponsor?.name ?? (project.sponsor || 'Đang cập nhật')}</td>
                        <td>
                          <StatusPill
                            label={getCatalogLabel(catalogs.projectStatuses, project.status)}
                            tone={getStatusTone(project.status)}
                          />
                        </td>
                        <td>
                          <StatusPill
                            label={getCatalogLabel(catalogs.healthStatuses, project.health)}
                            tone={getHealthTone(project.health)}
                          />
                        </td>
                        <td className="project-table__progress">
                          <strong>{project.progress}%</strong>
                          <div className="progress-shell">
                            <div className="progress-bar" style={{ width: `${project.progress}%` }} />
                          </div>
                        </td>
                        <td>{project.personnelInfo.aitsMembers.length}</td>
                        <td>{project.documents.length}</td>
                        <td>{project.risks.length}</td>
                        <td>
                          {formatDate(project.startDate)} - {formatDate(project.endDate)}
                        </td>
                        <td>
                          <Link to={`/projects/${project.id}`} className="secondary-button secondary-button--compact">
                            <Eye size={15} />
                            Xem
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <section className="panel empty-panel">
          <h3>Chưa có dự án</h3>
          <p>Không có dự án phù hợp vai trò hiện tại.</p>
        </section>
      )}

      {isCreateOpen ? (
        <div className="modal-backdrop" onClick={closeCreateModal}>
          <section className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PMO workspace</span>
                <h3>Tạo dự án mới</h3>
                <p>Khởi tạo thông tin, PM và tổ triển khai.</p>
              </div>
              <button type="button" className="ghost-button icon-button" onClick={closeCreateModal}>
                <X size={16} />
              </button>
            </div>

            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                <span>Mã dự án</span>
                <input
                  value={generatedProjectCode}
                  readOnly
                  required
                />
              </label>

              <label>
                <span>Mã trung tâm kinh doanh</span>
                <select
                  value={form.businessCenterCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      businessCenterCode: event.target.value as BusinessCenterCode,
                    }))
                  }
                >
                  {businessCenterOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>

              <label>
                <span>Mã nhóm khách hàng</span>
                <select
                  value={form.customerGroupCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customerGroupCode: event.target.value as CustomerGroupCode,
                    }))
                  }
                >
                  {customerGroupOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>

              <label>
                <span>Mã thị trường</span>
                <select
                  value={form.marketCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      marketCode: event.target.value as MarketCode,
                    }))
                  }
                >
                  {marketOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>

              <label>
                <span>Mã lĩnh vực</span>
                <select
                  value={form.domainCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      domainCode: event.target.value as DomainCode,
                    }))
                  }
                >
                  {domainOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>

              <label>
                <span>Mã loại dự án</span>
                <select
                  value={form.projectKindCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      projectKindCode: event.target.value as ProjectKindCode,
                    }))
                  }
                >
                  {projectKindOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>

              <label>
                <span>Tên dự án</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Sponsor dự án</span>
                <select
                  value={form.sponsor}
                  onChange={(event) => setForm((current) => ({ ...current, sponsor: event.target.value }))}
                >
                  {sponsorCandidates.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>PM dự án</span>
                <select
                  value={form.adminId}
                  onChange={(event) => handlePmChange(event.target.value)}
                >
                  <option value="">Chọn PM</option>
                  {deployableUsers
                    .filter((user) => normalizeUserRole(user.role) === 'PM' && getMemberDraft(user.id).selected)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.employeeCode}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>Ngày bắt đầu</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                />
              </label>

              <label>
                <span>Ngày kết thúc</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                />
              </label>

              <label className="span-2">
                <span>Nhiệm vụ</span>
                <textarea
                  rows={2}
                  value={form.objective}
                  onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Số quyết định TTK</span>
                <input
                  value={form.ttkDecisionNumber}
                  placeholder="Ví dụ: QD-2026/001"
                  onChange={(event) => setForm((current) => ({ ...current, ttkDecisionNumber: event.target.value }))}
                />
              </label>

              <label>
                <span>Tệp đính kèm QĐ TTK</span>
                <div className="document-upload-field">
                  <input
                    className="document-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) {
                        setForm((current) => ({
                          ...current,
                          ttkDecisionFileName: '',
                          ttkDecisionAttachment: null,
                        }))
                        return
                      }

                      try {
                        const attachment = await readDocumentAttachment(file)
                        setForm((current) => ({
                          ...current,
                          ttkDecisionFileName: attachment.fileName,
                          ttkDecisionAttachment: attachment,
                        }))
                      } catch (err) {
                        toast.error('Không đọc được file', err instanceof Error ? err.message : '')
                        setForm((current) => ({
                          ...current,
                          ttkDecisionFileName: '',
                          ttkDecisionAttachment: null,
                        }))
                      }
                    }}
                  />
                  <div className="document-upload-meta">
                    <FileText size={15} />
                    <span>{form.ttkDecisionFileName || 'Chưa chọn file'}</span>
                  </div>
                </div>
              </label>

              <div className="span-2 roster-builder">
                <div className="roster-builder__header">
                  <div>
                    <span className="eyebrow">Roster builder</span>
                    <h4>Tổ triển khai</h4>
                    <p>Chọn nhân sự tham gia dự án.</p>
                  </div>
                  <div className="inline-actions">
                    <StatusPill label={`${selectedMemberCount} đã chọn`} tone={selectedMemberCount ? 'info' : 'neutral'} />
                    <select
                      className="ghost-button ghost-button--compact"
                      value=""
                      onChange={(event) => {
                        const userId = event.target.value
                        if (!userId) return
                        const user = deployableUsers.find((u) => u.id === userId)
                        if (user) toggleMember(user)
                        event.target.value = ''
                      }}
                    >
                      <option value="">+ Thêm nhân sự...</option>
                      {deployableUsers
                        .filter((u) => !getMemberDraft(u.id).selected)
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} - {user.employeeCode} - {user.title}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="table-wrapper roster-table-wrapper">
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Họ và tên</th>
                        <th>Chức danh</th>
                        <th>Đơn vị</th>
                        <th>Vai trò</th>
                        <th>Nhiệm vụ</th>
                        <th>Mã NV</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deployableUsers
                        .filter((user) => getMemberDraft(user.id).selected)
                        .map((user, index) => {
                          const draft = getMemberDraft(user.id)

                          return (
                            <tr key={user.id}>
                              <td>{index + 1}</td>
                              <td>
                                <strong>{user.name}</strong>
                                <p className="workload-cell-note">{user.email}</p>
                              </td>
                              <td>{user.title}</td>
                              <td>{user.unit}</td>
                              <td>
                                <select
                                  value={user.id === form.adminId ? 'PM du an' : draft.role}
                                  onChange={(event) =>
                                    updateMemberDraft(user.id, { role: event.target.value })
                                  }
                                  disabled={user.id === form.adminId}
                                >
                                  {roleOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  value={draft.responsibility}
                                  placeholder="Nhập nhiệm vụ"
                                  onChange={(event) =>
                                    updateMemberDraft(user.id, { responsibility: event.target.value })
                                  }
                                />
                              </td>
                              <td>{user.employeeCode}</td>
                              <td>
                                <button
                                  type="button"
                                  className="ghost-button ghost-button--compact"
                                  style={{ color: 'var(--danger, #dc2626)' }}
                                  onClick={() => toggleMember(user)}
                                >
                                  <Trash2 size={14} />
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      {!selectedMemberCount ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                            Chưa chọn nhân sự.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-actions span-2">
                <button type="button" className="ghost-button" onClick={closeCreateModal}>
                  Hủy
                </button>
                <button type="submit" className="primary-button">
                  <CirclePlus size={16} />
                  Tạo dự án
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}

