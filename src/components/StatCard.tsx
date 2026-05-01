import type { CSSProperties, ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  helper: string
  accent?: string
  icon?: ReactNode
}

export function StatCard({
  label,
  value,
  helper,
  accent = 'var(--accent)',
  icon,
}: StatCardProps) {
  return (
    <article className="stat-card" style={{ '--card-accent': accent } as CSSProperties}>
      <div className="stat-card__header">
        <span>{label}</span>
        {icon ? <div className="stat-card__icon">{icon}</div> : null}
      </div>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  )
}
