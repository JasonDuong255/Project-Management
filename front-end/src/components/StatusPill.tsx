interface StatusPillProps {
  label: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}

export function StatusPill({
  label,
  tone = 'neutral',
}: StatusPillProps) {
  return <span className={`status-pill tone-${tone}`}>{label}</span>
}
