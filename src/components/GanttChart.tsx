import dayjs from 'dayjs'

import { getStatusTone } from '../lib/calculations'
import { formatDate } from '../lib/formatters'
import type { GanttItem } from '../types'

interface GanttChartProps {
  items: GanttItem[]
  variant?: 'page' | 'embedded'
  activeId?: string
  onSelect?: (id: string) => void
}

/* ── colour map for gantt bars ── */
const BAR_COLORS: Record<string, { bg: string; fill: string }> = {
  success: { bg: '#dcfce7', fill: '#16a34a' },
  info: { bg: '#dbeafe', fill: '#2563eb' },
  warning: { bg: '#fef3c7', fill: '#d97706' },
  danger: { bg: '#fee2e2', fill: '#dc2626' },
  neutral: { bg: '#f3f4f6', fill: '#9ca3af' },
}

function getBarColors(status: GanttItem['status']) {
  const tone = getStatusTone(status)
  return BAR_COLORS[tone] ?? BAR_COLORS.neutral
}

/* ── status label mapping ── */
function getStatusLabel(status: string) {
  switch (status) {
    case 'DONE': return 'Hoàn tất'
    case 'IN_PROGRESS': return 'Đang thực hiện'
    case 'NOT_STARTED': return 'Chưa bắt đầu'
    case 'BLOCKED': return 'Bị chặn'
    case 'NEEDS_REPLAN': return 'Cần lập lại KH'
    default: return status
  }
}

/* ── work-type icon ── */
function WorkTypeIcon({ type }: { type: string }) {
  if (type === 'MILESTONE') {
    return <span className="gantt-wt-icon gantt-wt-icon--milestone">◆</span>
  }
  if (type === 'SUBTASK') {
    return <span className="gantt-wt-icon gantt-wt-icon--subtask">○</span>
  }
  return <span className="gantt-wt-icon">●</span>
}

export function GanttChart({
  items,
  variant = 'page',
  activeId,
  onSelect,
}: GanttChartProps) {
  if (!items.length) {
    return (
      <div
        className={
          variant === 'embedded'
            ? 'gantt-panel gantt-panel--embedded empty-panel'
            : 'panel empty-panel'
        }
      >
        <h3>Chưa có dữ liệu Gantt</h3>
        <p>Hãy thêm task hoặc cập nhật kế hoạch để hiển thị timeline.</p>
      </div>
    )
  }

  /* ── time range ── */
  const allDates = items.flatMap((i) => [i.startDate, i.endDate])
  allDates.sort()
  const rangeStart = dayjs(allDates[0]).startOf('month')
  const rangeEnd = dayjs(allDates[allDates.length - 1]).endOf('month')
  const totalDays = rangeEnd.diff(rangeStart, 'day') + 1
  const today = dayjs()

  /* ── month segments ── */
  const monthSegments: Array<{ label: string; width: number }> = []
  let cursor = rangeStart
  while (cursor.isBefore(rangeEnd) || cursor.isSame(rangeEnd, 'month')) {
    const segEnd = cursor.endOf('month').isAfter(rangeEnd)
      ? rangeEnd
      : cursor.endOf('month')
    const segStart = cursor.isBefore(rangeStart) ? rangeStart : cursor
    monthSegments.push({
      label: cursor.format('MM/YYYY'),
      width: ((segEnd.diff(segStart, 'day') + 1) / totalDays) * 100,
    })
    cursor = cursor.add(1, 'month').startOf('month')
  }

  /* ── today marker position ── */
  const todayLeft =
    today.isBefore(rangeStart) || today.isAfter(rangeEnd)
      ? null
      : (today.diff(rangeStart, 'day') / totalDays) * 100

  const isCompact = variant === 'embedded'

  return (
    <div
      className={[
        'gantt-panel',
        isCompact ? 'gantt-panel--embedded gantt-panel--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* ── Header ── */}
      <div className="gantt-header">
        <div className="gantt-sticky gantt-sticky--header">
          <strong>Đầu mục công việc</strong>
        </div>
        <div className="gantt-timeline-header">
          {monthSegments.map((seg) => (
            <div
              key={seg.label}
              className="gantt-month"
              style={{ width: `${seg.width}%` }}
            >
              {seg.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="gantt-body">
        {items.map((item) => {
          const start = dayjs(item.startDate)
          const end = dayjs(item.endDate)
          const left = (start.diff(rangeStart, 'day') / totalDays) * 100
          const width = ((end.diff(start, 'day') + 1) / totalDays) * 100
          const isActive = item.id === activeId
          const colors = getBarColors(item.status)
          const indent = item.depth * (isCompact ? 16 : 22)

          const rowClass = [
            'gantt-row',
            isActive ? 'gantt-row--active' : '',
            onSelect ? 'gantt-row--interactive' : '',
            item.depth > 0 ? 'gantt-row--child' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={item.id}
              className={rowClass}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={onSelect ? () => onSelect(item.id) : undefined}
              onKeyDown={
                onSelect
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(item.id)
                      }
                    }
                  : undefined
              }
            >
              {/* ── Left sticky column ── */}
              <div className="gantt-sticky" style={{ paddingLeft: `${12 + indent}px` }}>
                <div className="gantt-task-name">
                  <WorkTypeIcon type={item.workType} />
                  <div className="gantt-task-name__text">
                    <strong>{item.label}</strong>
                    {item.childCount > 0 && (
                      <span className="gantt-child-badge">
                        {item.childCount} subtask
                      </span>
                    )}
                  </div>
                </div>
                {!isCompact && (
                  <span className="gantt-task-sublabel">{item.sublabel}</span>
                )}
              </div>

              {/* ── Timeline track ── */}
              <div className="gantt-track">
                {todayLeft !== null && (
                  <div
                    className="gantt-today"
                    style={{ left: `${todayLeft}%` }}
                    aria-hidden="true"
                  />
                )}

                {/* Date label above bar */}
                <div
                  className="gantt-date-label"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 5)}%`,
                  }}
                >
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </div>

                {/* Bar container */}
                <div
                  className={`gantt-bar${isActive ? ' gantt-bar--active' : ''}`}
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 5)}%`,
                    backgroundColor: colors.bg,
                    borderColor: colors.fill,
                  }}
                  title={`${item.label}: ${item.progress}% – ${getStatusLabel(item.status)}`}
                >
                  {/* Progress fill */}
                  <div
                    className="gantt-bar__fill"
                    style={{
                      width: `${item.progress}%`,
                      backgroundColor: colors.fill,
                    }}
                  />
                  {/* Progress label */}
                  <span
                    className="gantt-bar__label"
                    style={{
                      color: item.progress > 45 ? '#fff' : colors.fill,
                    }}
                  >
                    {item.progress}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
