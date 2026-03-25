import { CirclePlus, Eye, FileText, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import { getHealthTone, getStatusTone, getVisibleProjects } from '../lib/calculations'
import { formatDate, getCatalogLabel } from '../lib/formatters'

function buildInitialForm(adminId: string) {
  return {
    code: 'PRJ-2026-010',
    name: '',
    summary: '',
    sponsor: '',
    department: 'PMO',
    objective: '',
    adminId,
    memberIds: [] as string[],
    startDate: '2026-04-01',
    endDate: '2026-08-30',
  }
}

export function ProjectsPage() {
  const { currentUser, projects, users, catalogs, createProject, getUser } =
    useAppData()
  const visibleProjects = getVisibleProjects(projects, currentUser)
  const deliveryMembers = users.filter((user) => user.role === 'DELIVERY_MEMBER')
  const projectAdmins = users.filter((user) => user.role === 'PROJECT_ADMIN')
  const canCreate = currentUser?.role !== 'DELIVERY_MEMBER'
  const defaultAdminId =
    currentUser?.role === 'PROJECT_ADMIN'
      ? currentUser.id
      : projectAdmins[0]?.id ?? ''

  const [message, setMessage] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState(buildInitialForm(defaultAdminId))

  function openCreateModal() {
    setForm(buildInitialForm(defaultAdminId))
    setIsCreateOpen(true)
    setMessage('')
  }

  function closeCreateModal() {
    setIsCreateOpen(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await createProject(form)

    setMessage('Da tao du an moi. Ban co the mo chi tiet de cap nhat thong tin va ke hoach.')
    setIsCreateOpen(false)
    setForm(buildInitialForm(defaultAdminId))
  }

  function toggleMember(memberId: string) {
    setForm((current) => ({
      ...current,
      memberIds: current.memberIds.includes(memberId)
        ? current.memberIds.filter((item) => item !== memberId)
        : [...current.memberIds, memberId],
    }))
  }

  return (
    <div className="page-grid">
      <SectionHeader
        title="Danh sach du an"
        description="Uu tien xem danh sach du an truoc, sau do tao moi qua popup rieng"
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

      <section className="project-grid">
        {visibleProjects.map((project) => {
          const admin = getUser(project.adminId)
          const memberNames = project.memberIds
            .map((memberId) => getUser(memberId)?.name ?? memberId)
            .join(', ')

          return (
            <article key={project.id} className="project-card">
              <div className="project-card__header">
                <div>
                  <span className="eyebrow">{project.code}</span>
                  <h3>{project.name}</h3>
                </div>
                <StatusPill
                  label={getCatalogLabel(catalogs.projectStatuses, project.status)}
                  tone={getStatusTone(project.status)}
                />
              </div>

              <p>{project.summary}</p>

              <div className="project-meta-grid">
                <div>
                  <span>PM phu trach</span>
                  <strong>{admin?.name ?? 'Chua xac dinh'}</strong>
                </div>
                <div>
                  <span>Health</span>
                  <StatusPill
                    label={getCatalogLabel(catalogs.healthStatuses, project.health)}
                    tone={getHealthTone(project.health)}
                  />
                </div>
                <div>
                  <span>Thoi gian</span>
                  <strong>
                    {formatDate(project.startDate)} - {formatDate(project.endDate)}
                  </strong>
                </div>
                <div>
                  <span>Tien do</span>
                  <strong>{project.progress}%</strong>
                </div>
              </div>

              <div className="progress-shell">
                <div
                  className="progress-bar"
                  style={{ width: `${project.progress}%` }}
                />
              </div>

              <div className="inline-metrics">
                <span>
                  <FileText size={14} /> {project.documents.length} tai lieu
                </span>
                <span>
                  <ShieldAlert size={14} /> {project.risks.length} rui ro
                </span>
              </div>

              <div className="member-list">
                <strong>Thanh vien:</strong>
                <p>{memberNames}</p>
              </div>

              <Link to={`/projects/${project.id}`} className="secondary-button">
                <Eye size={16} />
                Xem chi tiet
              </Link>
            </article>
          )
        })}
      </section>

      {isCreateOpen ? (
        <div className="modal-backdrop" onClick={closeCreateModal}>
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Create project</span>
                <h3>Tao du an moi</h3>
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
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Ten du an</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="span-2">
                <span>Tom tat</span>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, summary: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Don vi tai tro</span>
                <input
                  value={form.sponsor}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sponsor: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Don vi quan ly</span>
                <select
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                >
                  {catalogs.departments.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                <span>Muc tieu</span>
                <textarea
                  rows={2}
                  value={form.objective}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      objective: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>PM phu trach</span>
                <select
                  value={form.adminId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, adminId: event.target.value }))
                  }
                  disabled={currentUser?.role === 'PROJECT_ADMIN'}
                >
                  {projectAdmins.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ngay bat dau</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>Ngay ket thuc</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                />
              </label>

              <div className="span-2">
                <span className="field-label">Thanh vien to trien khai</span>
                <div className="checkbox-grid">
                  {deliveryMembers.map((member) => (
                    <label key={member.id} className="check-card">
                      <input
                        type="checkbox"
                        checked={form.memberIds.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                      />
                      <span>
                        <strong>{member.name}</strong>
                        <small>{member.title}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions span-2">
                <button type="button" className="ghost-button" onClick={closeCreateModal}>
                  Huy
                </button>
                <button type="submit" className="primary-button">
                  <CirclePlus size={16} />
                  Tao du an
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
