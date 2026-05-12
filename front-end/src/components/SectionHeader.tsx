import type { ReactNode } from 'react'

interface SectionHeaderProps {
  /** The page title (h2). */
  title: string
  /** Optional one-line description below the title. Omit for compact pages. */
  description?: string
  actions?: ReactNode
}

export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p className="section-header__sub">{description}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  )
}
