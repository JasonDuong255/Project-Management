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
          variant === 'embedded' ? 'gantt-panel gantt-panel--embedded empty-panel' : 'panel empty-panel'
        }
      >
        <h3>Chua co du lieu Gantt</h3>
        <p>Hay them task hoac cap nhat ke hoach de hien thi timeline.</p>
      </div>
    )
  }

  const sortedItems = [...items].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  )
  const rangeStart = dayjs(sortedItems[0].startDate).startOf('month')
  const rangeEnd = dayjs(sortedItems[sortedItems.length - 1].endDate).endOf('month')
  const totalDays = rangeEnd.diff(rangeStart, 'day') + 1
  const today = dayjs()

  const monthSegments: Array<{ label: string; width: number }> = []
  let cursor = rangeStart

  while (cursor.isBefore(rangeEnd) || cursor.isSame(rangeEnd, 'month')) {
    const segmentStart = cursor.isBefore(rangeStart) ? rangeStart : cursor
    const segmentEnd = cursor.endOf('month').isAfter(rangeEnd)
      ? rangeEnd
      : cursor.endOf('month')

    monthSegments.push({
      label: cursor.format('MM/YYYY'),
      width: ((segmentEnd.diff(segmentStart, 'day') + 1) / totalDays) * 100,
    })

    cursor = cursor.add(1, 'month').startOf('month')
  }

  const todayLeft =
    today.isBefore(rangeStart) || today.isAfter(rangeEnd)
      ? null
      : (today.diff(rangeStart, 'day') / totalDays) * 100

  return (
    <div
      className={
        variant === 'embedded'
          ? 'gantt-panel gantt-panel--embedded gantt-panel--compact'
          : 'panel gantt-panel'
      }
    >
      <div className="gantt-header">
        <div className="gantt-sticky">Dau muc cong viec</div>
        <div className="gantt-timeline-header">
          {monthSegments.map((segment) => (
            <div
              key={segment.label}
              className="gantt-month"
              style={{ width: `${segment.width}%` }}
            >
              {segment.label}
            </div>
          ))}
        </div>
      </div>

      <div className="gantt-body">
        {sortedItems.map((item) => {
          const start = dayjs(item.startDate)
          const end = dayjs(item.endDate)
          const left = (start.diff(rangeStart, 'day') / totalDays) * 100
          const width = ((end.diff(start, 'day') + 1) / totalDays) * 100
          const isActive = item.id === activeId
          const rowClassName = [
            'gantt-row',
            isActive ? 'gantt-row--active' : '',
            onSelect ? 'gantt-row--interactive' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={item.id}
              className={rowClassName}
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
              <div className="gantt-sticky">
                <strong>{item.label}</strong>
                <span>{item.sublabel}</span>
              </div>

              <div className="gantt-track">
                {todayLeft !== null ? (
                  <div
                    className="gantt-today"
                    style={{ left: `${todayLeft}%` }}
                    aria-hidden="true"
                  />
                ) : null}

                <div
                  className={`gantt-bar tone-${getStatusTone(item.status)}${isActive ? ' gantt-bar--active' : ''}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 3)}%` }}
                >
                  <span>{item.progress}%</span>
                </div>
                <small>
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </small>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
