import dayjs from 'dayjs'
import { RefreshCcw, Save, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { SectionHeader } from '../components/SectionHeader'
import { StatusPill } from '../components/StatusPill'
import { useAppData } from '../context/AppContext'
import { formatDate, formatHours, formatMonthLabel } from '../lib/formatters'
import type { Project, ProjectAitsPersonnel, User } from '../types'

interface ResolvedAitsMember {
  memberId: string
  user: User
  personnel: ProjectAitsPersonnel
}

function getEstimatedProjectEndDate(project: Project) {
  if (project.basisInfo.durationDays > 0) {
    return dayjs(project.startDate).add(project.basisInfo.durationDays - 1, 'day')
  }

  return dayjs(project.endDate)
}

function getProjectAllocationMonths(project: Project) {
  const startMonth = dayjs(project.startDate).startOf('month')
  const endMonth = getEstimatedProjectEndDate(project).startOf('month')
  const months: string[] = []
  let cursor = startMonth

  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, 'month')) {
    months.push(cursor.format('YYYY-MM'))
    cursor = cursor.add(1, 'month')
  }

  return months
}

function resolveAitsUser(personnel: ProjectAitsPersonnel, users: User[]) {
  if (personnel.userId) {
    return users.find((user) => user.id === personnel.userId) ?? null
  }

  if (personnel.email) {
    const byEmail = users.find(
      (user) => user.email.toLowerCase() === personnel.email.toLowerCase(),
    )

    if (byEmail) {
      return byEmail
    }
  }

  if (personnel.fullName) {
    return (
      users.find((user) => user.name.toLowerCase() === personnel.fullName.toLowerCase()) ??
      null
    )
  }

  return null
}

function buildFallbackAitsPersonnel(
  user: User,
  project: Project,
  totalPlannedHours: number,
): ProjectAitsPersonnel {
  return {
    userId: user.id,
    fullName: user.name,
    titleUnit: `${user.title} - ${user.unit}`,
    role: user.id === project.adminId ? 'PM phu trach' : 'Nhan su AITS',
    responsibility: '',
    totalPlannedHours,
    email: user.email,
    phone: '',
  }
}

function distributeHoursEvenly(totalHours: number, months: string[]) {
  if (!months.length) {
    return {}
  }

  const safeTotal = Math.max(0, Math.round(totalHours))
  const base = Math.floor(safeTotal / months.length)
  const remainder = safeTotal % months.length

  return months.reduce<Record<string, number>>((accumulator, month, index) => {
    accumulator[month] = base + (index < remainder ? 1 : 0)
    return accumulator
  }, {})
}

function buildAllocationKey(memberId: string, month: string) {
  return `${memberId}:${month}`
}

function buildProjectDraftAllocations(
  project: Project,
  members: ResolvedAitsMember[],
  months: string[],
) {
  const nextDraft: Record<string, number> = {}
  const monthSet = new Set(months)

  members.forEach((member) => {
    const savedAllocations = project.monthlyAllocations.filter(
      (allocation) =>
        allocation.memberId === member.memberId && monthSet.has(allocation.month),
    )
    const savedTotal = savedAllocations.reduce((sum, allocation) => sum + allocation.hours, 0)
    const targetTotal = Math.max(0, Math.round(member.personnel.totalPlannedHours))
    const hoursByMonth =
      savedAllocations.length > 0 && savedTotal === targetTotal
        ? months.reduce<Record<string, number>>((accumulator, month) => {
            accumulator[month] =
              savedAllocations.find((allocation) => allocation.month === month)?.hours ?? 0
            return accumulator
          }, {})
        : distributeHoursEvenly(targetTotal, months)

    months.forEach((month) => {
      nextDraft[buildAllocationKey(member.memberId, month)] = hoursByMonth[month] ?? 0
    })
  })

  return nextDraft
}

export function WorkloadPage() {
  const { currentUser, projects, users, updateProject, getUser } = useAppData()
  const managedProjects =
    currentUser?.role === 'SYSTEM_ADMIN'
      ? projects
      : projects.filter((project) => project.adminId === currentUser?.id)
  const [selectedProjectId, setSelectedProjectId] = useState(managedProjects[0]?.id ?? '')
  const [draftAllocations, setDraftAllocations] = useState<Record<string, number>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!managedProjects.length) {
      setSelectedProjectId('')
      return
    }

    if (!managedProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(managedProjects[0].id)
    }
  }, [managedProjects, selectedProjectId])

  const selectedProject =
    managedProjects.find((project) => project.id === selectedProjectId) ?? null
  const projectMonths = selectedProject ? getProjectAllocationMonths(selectedProject) : []
  const resolvedMembers = selectedProject
    ? (() => {
        const mappedMembers = selectedProject.personnelInfo.aitsMembers
          .map((personnel) => {
            const user = resolveAitsUser(personnel, users)

            if (!user) {
              return null
            }

            return {
              memberId: user.id,
              user,
              personnel,
            } satisfies ResolvedAitsMember
          })
          .filter((item): item is ResolvedAitsMember => item !== null)
        const mappedIds = new Set(mappedMembers.map((item) => item.memberId))
        const fallbackMembers = [...new Set([selectedProject.adminId, ...selectedProject.memberIds])]
          .filter((memberId) => !mappedIds.has(memberId))
          .map((memberId) => {
            const user = users.find((item) => item.id === memberId)

            if (!user) {
              return null
            }

            const savedTotal = selectedProject.monthlyAllocations
              .filter((allocation) => allocation.memberId === memberId)
              .reduce((sum, allocation) => sum + allocation.hours, 0)

            return {
              memberId,
              user,
              personnel: buildFallbackAitsPersonnel(user, selectedProject, savedTotal),
            } satisfies ResolvedAitsMember
          })
          .filter((item): item is ResolvedAitsMember => item !== null)

        return [...mappedMembers, ...fallbackMembers]
      })()
    : []
  const unmappedMembers = selectedProject
    ? selectedProject.personnelInfo.aitsMembers.filter(
        (personnel) => !resolveAitsUser(personnel, users),
      )
    : []
  const estimatedEndDate = selectedProject ? getEstimatedProjectEndDate(selectedProject) : null

  useEffect(() => {
    if (!selectedProject) {
      setDraftAllocations({})
      return
    }

    setDraftAllocations(buildProjectDraftAllocations(selectedProject, resolvedMembers, projectMonths))
    setMessage('')
  }, [selectedProject, projectMonths.length, projects])

  if (!currentUser) {
    return null
  }

  if (!managedProjects.length) {
    return (
      <div className="page-grid">
        <SectionHeader
          title="Phan bo gio cong"
          description="Chuc nang nay chi hien thi du an do ban quan tri hoac co quyen he thong."
        />
        <section className="panel empty-panel">
          <h3>Khong co du an de phan bo</h3>
          <p>Hay tao du an hoac gan quyen PM cho tai khoan nay de bat dau lap ke hoach gio cong.</p>
        </section>
      </div>
    )
  }

  if (!selectedProject) {
    return null
  }

  const activeProject = selectedProject

  function getDraftHours(memberId: string, month: string) {
    return draftAllocations[buildAllocationKey(memberId, month)] ?? 0
  }

  function updateDraftHours(memberId: string, month: string, value: number) {
    setDraftAllocations((current) => ({
      ...current,
      [buildAllocationKey(memberId, month)]: Math.max(0, Number.isFinite(value) ? Math.round(value) : 0),
    }))
  }

  function autoDistributeMember(member: ResolvedAitsMember) {
    const evenDistribution = distributeHoursEvenly(member.personnel.totalPlannedHours, projectMonths)

    setDraftAllocations((current) => {
      const nextDraft = { ...current }

      projectMonths.forEach((month) => {
        nextDraft[buildAllocationKey(member.memberId, month)] = evenDistribution[month] ?? 0
      })

      return nextDraft
    })
  }

  function autoDistributeAllMembers() {
    setDraftAllocations(buildProjectDraftAllocations(activeProject, resolvedMembers, projectMonths))
  }

  const rowSummaries = resolvedMembers.map((member) => {
    const targetHours = Math.max(0, Math.round(member.personnel.totalPlannedHours))
    const monthDetails = projectMonths.map((month) => {
      const currentProjectHours = getDraftHours(member.memberId, month)
      const otherProjectsHours = projects
        .filter((project) => project.id !== activeProject.id)
        .reduce((sum, project) => {
          const allocated = project.monthlyAllocations
            .filter((allocation) => allocation.memberId === member.memberId && allocation.month === month)
            .reduce((projectSum, allocation) => projectSum + allocation.hours, 0)

          return sum + allocated
        }, 0)
      const totalMonthHours = currentProjectHours + otherProjectsHours
      const remainingHours = member.user.monthlyCapacity - totalMonthHours

      return {
        month,
        currentProjectHours,
        otherProjectsHours,
        totalMonthHours,
        remainingHours,
        capacity: member.user.monthlyCapacity,
      }
    })
    const allocatedHours = monthDetails.reduce((sum, detail) => sum + detail.currentProjectHours, 0)
    const deltaHours = targetHours - allocatedHours
    const overloadedMonths = monthDetails.filter((detail) => detail.remainingHours < 0).length

    return {
      member,
      targetHours,
      allocatedHours,
      deltaHours,
      monthDetails,
      overloadedMonths,
    }
  })

  const totalTargetHours = rowSummaries.reduce((sum, row) => sum + row.targetHours, 0)
  const totalDraftHours = rowSummaries.reduce((sum, row) => sum + row.allocatedHours, 0)
  const invalidRows = rowSummaries.filter((row) => row.deltaHours !== 0).length
  const overloadedCells = rowSummaries.reduce((sum, row) => sum + row.overloadedMonths, 0)
  const canSave = invalidRows === 0

  async function handleSaveAllocations() {
    const editableMemberIds = new Set(resolvedMembers.map((member) => member.memberId))
    const editableMonths = new Set(projectMonths)
    const preservedAllocations = activeProject.monthlyAllocations.filter(
      (allocation) =>
        !(editableMemberIds.has(allocation.memberId) && editableMonths.has(allocation.month)),
    )
    const nextAllocations = [...preservedAllocations]

    rowSummaries.forEach((row) => {
      row.monthDetails.forEach((detail) => {
        if (detail.currentProjectHours > 0) {
          nextAllocations.push({
            memberId: row.member.memberId,
            month: detail.month,
            hours: detail.currentProjectHours,
          })
        }
      })
    })

    await updateProject({
      projectId: activeProject.id,
      patch: {
        monthlyAllocations: nextAllocations.sort((left, right) =>
          left.month.localeCompare(right.month) || left.memberId.localeCompare(right.memberId),
        ),
      },
    })

    setMessage('Da luu phan bo gio cong theo thang cho du an dang chon.')
  }

  return (
    <div className="page-grid">
      <SectionHeader
        title="Phan bo gio cong"
        description="PM phan bo gio cong theo du an, theo thanh vien va theo tung thang trong ky trien khai."
      />

      {message ? <p className="form-success">{message}</p> : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Project scope</span>
            <h3>Chon du an can phan bo</h3>
          </div>
          <div className="panel-actions">
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              {managedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} - {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="detail-grid detail-grid--compact workload-project-summary">
          <div className="detail-card">
            <span>PM quan tri</span>
            <strong>{getUser(activeProject.adminId)?.name ?? activeProject.adminId}</strong>
          </div>
          <div className="detail-card">
            <span>Bat dau du an</span>
            <strong>{formatDate(activeProject.startDate)}</strong>
          </div>
          <div className="detail-card">
            <span>Du kien ket thuc</span>
            <strong>{estimatedEndDate ? formatDate(estimatedEndDate.format('YYYY-MM-DD')) : '-'}</strong>
          </div>
          <div className="detail-card">
            <span>So thang phan bo</span>
            <strong>{projectMonths.length}</strong>
          </div>
        </div>
      </section>

      <section className="detail-grid detail-grid--compact">
        <div className="detail-card">
          <span>Tong gio cong muc tieu</span>
          <strong>{formatHours(totalTargetHours)}</strong>
        </div>
        <div className="detail-card">
          <span>Tong gio da draft</span>
          <strong>{formatHours(totalDraftHours)}</strong>
        </div>
        <div className="detail-card">
          <span>Dong can dieu chinh</span>
          <strong>{invalidRows}</strong>
        </div>
        <div className="detail-card">
          <span>Canh bao qua tai thang</span>
          <strong>{overloadedCells}</strong>
        </div>
      </section>

      {unmappedMembers.length ? (
        <section className="panel panel--compact">
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Mapping</span>
              <h3>Nhan su AITS chua lien ket tai khoan</h3>
            </div>
            <StatusPill label={`${unmappedMembers.length} nhan su`} tone="warning" />
          </div>
          <div className="stack-list">
            {unmappedMembers.map((member, index) => (
              <div key={`${member.fullName}-${index}`} className="list-row list-row--compact">
                <div>
                  <strong>{member.fullName || 'Chua co ten'}</strong>
                  <p>{member.email || 'Chua co email'} | {member.titleUnit || 'Chua cap nhat chuc danh'}</p>
                </div>
                <StatusPill label="Chua doi chieu capacity" tone="warning" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Allocation planner</span>
            <h3>Phan bo theo thanh vien va theo thang</h3>
            <p>
              He thong chia deu tong gio cong cua tung nhan su theo cac thang trong du an. PM co the dieu chinh
              tung thang, nhung tong gio cong cua moi dong van phai bang muc gio cong duoc phep.
            </p>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={autoDistributeAllMembers}
            >
              <Sparkles size={16} />
              Chia deu tat ca
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleSaveAllocations}
              disabled={!canSave}
            >
              <Save size={16} />
              Luu phan bo
            </button>
          </div>
        </div>

        <div className="table-wrapper workload-planner-table-wrapper">
          <table className="workload-planner-table">
            <thead>
              <tr>
                <th>Thanh vien</th>
                <th>Tong gio cong du an</th>
                <th>Da phan bo</th>
                <th>Can bang</th>
                <th>Tai tao</th>
                {projectMonths.map((month) => (
                  <th key={month}>{formatMonthLabel(month)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowSummaries.map((row) => (
                <tr key={row.member.memberId}>
                  <td className="workload-member-cell">
                    <strong>{row.member.personnel.fullName || row.member.user.name}</strong>
                    <p>{row.member.personnel.role || row.member.user.title}</p>
                    <small>{row.member.user.email}</small>
                  </td>
                  <td>
                    <strong>{formatHours(row.targetHours)}</strong>
                    <p className="workload-cell-note">Lay tu thong tin nhan su AITS</p>
                  </td>
                  <td>
                    <strong>{formatHours(row.allocatedHours)}</strong>
                    <p className="workload-cell-note">
                      {row.monthDetails.length} thang trong ky trien khai
                    </p>
                  </td>
                  <td>
                    <StatusPill
                      label={`${row.deltaHours > 0 ? 'Thieu' : row.deltaHours < 0 ? 'Vuot' : 'Can bang'} ${formatHours(Math.abs(row.deltaHours))}`}
                      tone={row.deltaHours === 0 ? 'success' : 'warning'}
                    />
                    <p className="workload-cell-note">
                      {row.overloadedMonths
                        ? `${row.overloadedMonths} thang vuot capacity`
                        : 'Khong vuot capacity'}
                    </p>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ghost-button ghost-button--compact"
                      onClick={() => autoDistributeMember(row.member)}
                    >
                      <RefreshCcw size={15} />
                      Chia deu
                    </button>
                  </td>
                  {row.monthDetails.map((detail) => (
                    <td key={`${row.member.memberId}-${detail.month}`}>
                      <div className="workload-month-cell">
                        <input
                          type="number"
                          min={0}
                          value={detail.currentProjectHours}
                          onChange={(event) =>
                            updateDraftHours(
                              row.member.memberId,
                              detail.month,
                              Number(event.target.value),
                            )
                          }
                        />
                        <div className="workload-month-cell__meta">
                          <span>Khac du an: {formatHours(detail.otherProjectsHours)}</span>
                          <span>
                            Tong thang: {formatHours(detail.totalMonthHours)}/{formatHours(detail.capacity)}
                          </span>
                          <span className={detail.remainingHours < 0 ? 'text-danger' : 'text-warning'}>
                            Con lai: {formatHours(detail.remainingHours)}
                          </span>
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="workload-footer-note">
          <span>Ky trien khai: {formatDate(activeProject.startDate)} - {estimatedEndDate ? formatDate(estimatedEndDate.format('YYYY-MM-DD')) : '-'}</span>
          <span>Neu tong gio cong da phan bo khong khop muc tieu, nut luu se bi khoa.</span>
        </div>
      </section>
    </div>
  )
}
