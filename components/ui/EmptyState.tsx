import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: string
  message: string
  action?: ReactNode
}

export default function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && (
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>
          <i className={icon} />
        </div>
      )}
      <p>{message}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
