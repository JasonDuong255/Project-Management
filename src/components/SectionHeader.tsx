import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

export function SectionHeader({
  title,
  description,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{title}</p>
        <h2>{description}</h2>
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  )
}
