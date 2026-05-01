import { useEffect, useState } from 'react'

import { GanttChart } from '../components/GanttChart'
import { SectionHeader } from '../components/SectionHeader'
import { useAppData } from '../context/AppContext'
import { buildGanttItems, getVisibleProjects } from '../lib/calculations'

export function GanttPage() {
  const { currentUser, projects, planItems, users } = useAppData()
  const visibleProjects = getVisibleProjects(projects, currentUser)
  const members =
    currentUser?.role === 'DELIVERY_MEMBER'
      ? users.filter((user) => user.id === currentUser.id)
      : users.filter((user) => user.role === 'DELIVERY_MEMBER')

  const [mode, setMode] = useState<'project' | 'member'>('project')
  const [targetId, setTargetId] = useState(visibleProjects[0]?.id ?? '')

  useEffect(() => {
    if (mode === 'project') {
      setTargetId(visibleProjects[0]?.id ?? '')
      return
    }

    setTargetId(members[0]?.id ?? '')
  }, [members, mode, visibleProjects])

  const items = targetId
    ? buildGanttItems(planItems, projects, users, mode, targetId)
    : []

  return (
    <div className="page-grid">
      <SectionHeader
        title="Biểu đồ Gantt"
        description="Xem kế hoạch theo dự án hoặc theo từng thành viên triển khai"
      />

      <section className="panel">
        <div className="filter-row">
          <label className="inline-field">
            <span>Chế độ</span>
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as 'project' | 'member')
              }
            >
              <option value="project">Theo dự án</option>
              <option value="member">Theo thành viên</option>
            </select>
          </label>

          {mode === 'project' ? (
            <label className="inline-field">
              <span>Dự án</span>
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                {visibleProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="inline-field">
              <span>Thành viên</span>
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <GanttChart items={items} />
    </div>
  )
}
