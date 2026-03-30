import dayjs from 'dayjs'
import { CirclePlus, Eye, FileText, ShieldAlert, Sparkles, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import {
  getHealthTone,
  getStatusTone,
  getVisibleProjects,
  isProjectCoordinator,
  normalizeUserRole,
} from '../lib/calculations'
import { formatDate, formatHours, getCatalogLabel } from '../lib/formatters'
import type { CreateProjectTeamMemberInput, Project, User } from '../types'

interface MemberDraft {
  selected: boolean
  role: string
  totalPlannedHours: number
}

interface ProjectSection {
  title: string
  description: string
  projects: Project[]
}

function buildProjectCode(projectCount: number) {
  return `PRJ-${dayjs().format('YYYY')}-${String(projectCount + 1).padStart(3, '0')}`
}

function buildInitialForm(projectCount: number, sponsorId: string) {
  return {
    code: buildProjectCode(projectCount),
    name: '',
    summary: '',
    sponsor: sponsorId,
    objective: '',
    adminId: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(4, 'month').endOf('month').format('YYYY-MM-DD'),
    approvalRequestFileName: '',
  }
}

function buildEmptyMemberDraft(): MemberDraft {
  return {
    selected: false,
    role: 'Thanh vien trien khai',
    totalPlannedHours: 0,
  }
}

function getApprovalTone(project: Project) {
  return project.approvalInfo.status === 'APPROVED' ? 'success' : 'warning'
}

function getApprovalLabel(project: Project) {
  return project.approvalInfo.status === 'APPROVED' ? 'Da duyet TTK' : 'Cho HC duyet'
}

function buildProjectSections(projects: Project[], currentUser: User): ProjectSection[] {
  const normalizedRole = normalizeUserRole(currentUser.role)

  if (normalizedRole === 'PMO') {
    return [
      {
        title: 'Cho to chuc hanh chinh phe duyet',
        description: 'Du an PMO vua tao va dang doi xac nhan thanh lap TTK.',
        projects: projects.filter((project) => project.approvalInfo.status === 'PENDING'),
      },
      {
        title: 'Da duyet / dang van hanh',
        description: 'Du an da thanh lap TTK va da ban giao cho PM dieu hanh.',
        projects: projects.filter(
          (project) => project.approvalInfo.status === 'APPROVED' && project.status !== 'DONE',
        ),
      },
      {
        title: 'Da hoan tat',
        description: 'Du an da dong va co the dung lam mau doi chieu capacity.',
        projects: projects.filter((project) => project.status === 'DONE'),
      },
    ].filter((section) => section.projects.length)
  }

  if (normalizedRole === 'ADMIN_HC') {
    return [
      {
        title: 'Can phe duyet',
        description: 'Danh sach de nghi thanh lap TTK dang cho hanh chinh xu ly.',
        projects: projects.filter((project) => project.approvalInfo.status === 'PENDING'),
      },
      {
        title: 'Da phe duyet',
        description: 'Du an da hoan thanh buoc hanh chinh va da ban giao cho PM.',
        projects: projects.filter((project) => project.approvalInfo.status === 'APPROVED'),
      },
    ].filter((section) => section.projects.length)
  }

  if (normalizedRole === 'PM') {
    return [
      {
        title: 'Du an toi phu trach',
        description: 'Cac du an ma ban duoc chi dinh lam PM.',
        projects: projects.filter((project) => project.adminId === currentUser.id),
      },
      {
        title: 'Du an toi dieu phoi',
        description: 'Cac du an ban tham gia voi vai tro dieu phoi du an.',
        projects: projects.filter(
          (project) =>
            project.adminId !== currentUser.id && isProjectCoordinator(project, currentUser.id),
        ),
      },
    ].filter((section) => section.projects.length)
  }

  return [
    {
      title: 'Du an tham gia',
      description: 'Danh sach du an thanh vien trong to trien khai dang tham gia.',
      projects,
    },
  ]
}

export function ProjectsPage() {
  const { currentUser, projects, users, catalogs, createProject, getUser } = useAppData()
  const [message, setMessage] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [documentInputKey, setDocumentInputKey] = useState(0)

  const normalizedRole = currentUser ? normalizeUserRole(currentUser.role) : null
  const visibleProjects = getVisibleProjects(projects, currentUser)
  const projectSections = currentUser ? buildProjectSections(visibleProjects, currentUser) : []
  const canCreate = normalizedRole === 'PMO'
  const sponsorCandidates = users.filter((user) => normalizeUserRole(user.role) !== 'DELIVERY_MEMBER')
  const deployableUsers = users.filter((user) => {
    const role = normalizeUserRole(user.role)
    return role === 'PM' || role === 'DELIVERY_MEMBER'
  })
  const roleOptions = catalogs.projectMemberRoles.length
    ? catalogs.projectMemberRoles
    : [{ value: 'Thanh vien trien khai', label: 'Thanh vien trien khai' }]
  const currentMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')
  const defaultSponsorId = sponsorCandidates[0]?.id ?? users[0]?.id ?? ''

  const [form, setForm] = useState(buildInitialForm(projects.length, defaultSponsorId))
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>({})

  const memberResourceRows = useMemo(() => {
    return deployableUsers
      .map((user) => {
        const currentMonthAllocated = projects.reduce((sum, project) => {
          const hours = project.monthlyAllocations
            .filter((allocation) => allocation.memberId === user.id && allocation.month === currentMonth)
            .reduce((projectSum, allocation) => projectSum + allocation.hours, 0)

          return sum + hours
        }, 0)
        const nextMonthAllocated = projects.reduce((sum, project) => {
          const hours = project.monthlyAllocations
            .filter((allocation) => allocation.memberId === user.id && allocation.month === nextMonth)
            .reduce((projectSum, allocation) => projectSum + allocation.hours, 0)

          return sum + hours
        }, 0)
        const remainingCurrent = user.monthlyCapacity - currentMonthAllocated
        const remainingNext = user.monthlyCapacity - nextMonthAllocated

        return {
          user,
          currentMonthAllocated,
          nextMonthAllocated,
          remainingCurrent,
          remainingNext,
          recommendationScore: remainingCurrent + remainingNext,
        }
      })
      .sort((left, right) => right.recommendationScore - left.recommendationScore)
  }, [currentMonth, nextMonth, deployableUsers, projects])

  const suggestedMemberIds = new Set(
    memberResourceRows
      .filter((row) => row.recommendationScore > 0)
      .slice(0, 4)
      .map((row) => row.user.id),
  )

  function getMemberDraft(userId: string) {
    return memberDrafts[userId] ?? buildEmptyMemberDraft()
  }

  function resetCreateState() {
    setForm(buildInitialForm(projects.length, defaultSponsorId))
    setMemberDrafts({})
    setDocumentInputKey((current) => current + 1)
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

    if (!currentUser || normalizeUserRole(currentUser.role) !== 'PMO') {
      setMessage('Chi PMO moi co quyen tao du an theo luong hien tai.')
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
        totalPlannedHours: Math.max(0, Math.round(draft.totalPlannedHours)),
      }))

    if (!selectedMembers.length) {
      setMessage('Hay chon it nhat mot nhan su trien khai cho du an.')
      return
    }

    if (!form.adminId || !selectedMembers.some((member) => member.userId === form.adminId)) {
      setMessage('Hay chon 1 PM thuoc danh sach nhan su trien khai.')
      return
    }

    if (!form.approvalRequestFileName) {
      setMessage('Hay chon file Phieu phe duyet trien khai truoc khi tao du an.')
      return
    }

    await createProject({
      code: form.code,
      name: form.name,
      summary: form.summary,
      sponsor: form.sponsor,
      objective: form.objective,
      createdById: currentUser.id,
      adminId: form.adminId,
      startDate: form.startDate,
      endDate: form.endDate,
      approvalRequestFileName: form.approvalRequestFileName,
      teamMembers: selectedMembers,
      department: currentUser.unit,
    })

    setMessage('Da tao du an moi va chuyen sang trang thai cho To chuc hanh chinh phe duyet.')
    setIsCreateOpen(false)
    resetCreateState()
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="page-grid">
      <SectionHeader
        title="Danh sach du an"
        description="Phan loai danh sach theo role de PMO, To chuc hanh chinh, PM va thanh vien theo doi dung nhom cong viec."
        actions={
          canCreate ? (
            <button type="button" className="primary-button" onClick={openCreateModal}>
              <CirclePlus size={16} />
              Tao du an
            </button>
          ) : null
        }
      />

      {message ? <p className="form-success">{message}</p> : null}

      {projectSections.length ? (
        projectSections.map((section) => (
          <section key={section.title} className="project-section-block">
            <div className="panel-heading panel-heading--compact">
              <div>
                <span className="eyebrow">Project section</span>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
              <StatusPill label={`${section.projects.length} du an`} tone="info" />
            </div>

            <div className="project-grid">
              {section.projects.map((project) => {
                const admin = getUser(project.adminId)
                const sponsor = getUser(project.sponsor)
                const memberNames = project.personnelInfo.aitsMembers
                  .map((member) => member.fullName || getUser(member.userId)?.name || member.userId)
                  .join(', ')

                return (
                  <article key={project.id} className="project-card">
                    <div className="project-card__header">
                      <div>
                        <span className="eyebrow">{project.code}</span>
                        <h3>{project.name}</h3>
                      </div>
                      <div className="inline-actions">
                        <StatusPill
                          label={getCatalogLabel(catalogs.projectStatuses, project.status)}
                          tone={getStatusTone(project.status)}
                        />
                        <StatusPill label={getApprovalLabel(project)} tone={getApprovalTone(project)} />
                      </div>
                    </div>

                    <p>{project.summary}</p>

                    <div className="project-meta-grid">
                      <div>
                        <span>PM</span>
                        <strong>{admin?.name ?? 'Chua xac dinh'}</strong>
                      </div>
                      <div>
                        <span>Sponsor</span>
                        <strong>{sponsor?.name ?? (project.sponsor || 'Dang cap nhat')}</strong>
                      </div>
                      <div>
                        <span>Thoi gian</span>
                        <strong>
                          {formatDate(project.startDate)} - {formatDate(project.endDate)}
                        </strong>
                      </div>
                      <div>
                        <span>Health</span>
                        <StatusPill
                          label={getCatalogLabel(catalogs.healthStatuses, project.health)}
                          tone={getHealthTone(project.health)}
                        />
                      </div>
                    </div>

                    <div className="progress-shell">
                      <div className="progress-bar" style={{ width: `${project.progress}%` }} />
                    </div>

                    <div className="inline-metrics">
                      <span>
                        <Users size={14} /> {project.personnelInfo.aitsMembers.length} nhan su
                      </span>
                      <span>
                        <FileText size={14} /> {project.documents.length} tai lieu
                      </span>
                      <span>
                        <ShieldAlert size={14} /> {project.risks.length} rui ro
                      </span>
                    </div>

                    <div className="member-list">
                      <strong>To trien khai:</strong>
                      <p>{memberNames}</p>
                    </div>

                    <Link to={`/projects/${project.id}`} className="secondary-button">
                      <Eye size={16} />
                      Xem chi tiet
                    </Link>
                  </article>
                )
              })}
            </div>
          </section>
        ))
      ) : (
        <section className="panel empty-panel">
          <h3>Chua co du an phu hop vai tro</h3>
          <p>Danh sach du an se duoc phan loai lai ngay khi co du lieu theo role hien tai.</p>
        </section>
      )}

      {isCreateOpen ? (
        <div className="modal-backdrop" onClick={closeCreateModal}>
          <section className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PMO workspace</span>
                <h3>Tao du an moi</h3>
                <p>PMO lap bo thong tin khoi tao, chon PM, roster trien khai va gui file de nghi thanh lap TTK.</p>
              </div>
              <button type="button" className="ghost-button icon-button" onClick={closeCreateModal}>
                <X size={16} />
              </button>
            </div>

            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                <span>Ma du an</span>
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Ten du an</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>

              <label className="span-2">
                <span>Tom tat</span>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  required
                />
              </label>

              <label>
                <span>Sponsor du an</span>
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
                <span>PM du an</span>
                <select
                  value={form.adminId}
                  onChange={(event) => handlePmChange(event.target.value)}
                >
                  <option value="">Hay chon PM tu roster ben duoi</option>
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
                <span>Ngay bat dau</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                />
              </label>

              <label>
                <span>Ngay ket thuc</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                />
              </label>

              <label className="span-2">
                <span>Nhiem vu to trien khai</span>
                <textarea
                  rows={2}
                  value={form.objective}
                  onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))}
                  required
                />
              </label>

              <label className="span-2">
                <span>Phieu phe duyet trien khai</span>
                <div className="document-upload-field">
                  <input
                    key={documentInputKey}
                    className="document-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        approvalRequestFileName: event.target.files?.[0]?.name ?? '',
                      }))
                    }
                  />
                  <div className="document-upload-meta">
                    <FileText size={15} />
                    <span>{form.approvalRequestFileName || 'Chua chon file de nghi phe duyet'}</span>
                  </div>
                </div>
              </label>

              <div className="span-2 roster-builder">
                <div className="roster-builder__header">
                  <div>
                    <span className="eyebrow">Roster builder</span>
                    <h4>Danh sach nhan su trien khai</h4>
                    <p>
                      Theo doi gio cong phan bo chung, gio cong da duoc phan bo thang nay/thang sau va nhap gio cong du an cho tung nhan su.
                    </p>
                  </div>
                  <div className="inline-actions">
                    <StatusPill label={`Thang nay ${currentMonth}`} tone="neutral" />
                    <StatusPill label={`Thang sau ${nextMonth}`} tone="neutral" />
                  </div>
                </div>

                <div className="table-wrapper roster-table-wrapper">
                  <table className="roster-table">
                    <thead>
                      <tr>
                        <th>Chon</th>
                        <th>Ho va ten</th>
                        <th>Chuc danh / Don vi</th>
                        <th>Vai tro</th>
                        <th>Ma NV</th>
                        <th>Gio cong chung</th>
                        <th>Da PB thang nay</th>
                        <th>Da PB thang sau</th>
                        <th>Gio cong du an</th>
                        <th>De xuat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberResourceRows.map((row) => {
                        const draft = getMemberDraft(row.user.id)
                        const isPmCandidate = normalizeUserRole(row.user.role) === 'PM'

                        return (
                          <tr key={row.user.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={draft.selected}
                                onChange={() => toggleMember(row.user)}
                              />
                            </td>
                            <td>
                              <strong>{row.user.name}</strong>
                              <p className="workload-cell-note">{row.user.email}</p>
                            </td>
                            <td>{row.user.title} - {row.user.unit}</td>
                            <td>
                              <select
                                value={row.user.id === form.adminId ? 'PM du an' : draft.role}
                                onChange={(event) =>
                                  updateMemberDraft(row.user.id, {
                                    role: event.target.value,
                                  })
                                }
                                disabled={!draft.selected || row.user.id === form.adminId}
                              >
                                {roleOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>{row.user.employeeCode}</td>
                            <td>
                              <strong>{formatHours(row.user.monthlyCapacity)}</strong>
                              <p className="workload-cell-note">Cap tu To chuc hanh chinh</p>
                            </td>
                            <td>
                              <strong>{formatHours(row.currentMonthAllocated)}</strong>
                              <p className="workload-cell-note">Con lai {formatHours(row.remainingCurrent)}</p>
                            </td>
                            <td>
                              <strong>{formatHours(row.nextMonthAllocated)}</strong>
                              <p className="workload-cell-note">Con lai {formatHours(row.remainingNext)}</p>
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                value={draft.totalPlannedHours}
                                onChange={(event) =>
                                  updateMemberDraft(row.user.id, {
                                    totalPlannedHours: Number(event.target.value),
                                  })
                                }
                                disabled={!draft.selected}
                              />
                            </td>
                            <td>
                              <div className="inline-actions">
                                {suggestedMemberIds.has(row.user.id) ? (
                                  <StatusPill label="Phu hop" tone="success" />
                                ) : (
                                  <StatusPill label="Can doi chieu" tone="neutral" />
                                )}
                                {isPmCandidate ? <StatusPill label="Ung vien PM" tone="info" /> : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="roster-builder__hint">
                  <Sparkles size={16} />
                  <span>
                    Danh dau `Phu hop` cho nhung nhan su con dung luong gio cong trong thang hien tai va thang tiep theo de PMO uu tien sap xep.
                  </span>
                </div>
              </div>

              <div className="modal-actions span-2">
                <button type="button" className="ghost-button" onClick={closeCreateModal}>
                  Huy
                </button>
                <button type="submit" className="primary-button">
                  <CirclePlus size={16} />
                  Tao du an va gui duyet
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
