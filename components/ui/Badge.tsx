import type { ReactNode } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'error'

interface BadgeProps {
  children: ReactNode
  variant?: Variant
}

const colors: Record<Variant, { bg: string; color: string }> = {
  default: { bg: 'var(--glass-bg)', color: 'var(--text2)' },
  success: { bg: 'rgba(34,197,94,0.12)', color: 'var(--success)' },
  warning: { bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
  error: { bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)' },
}

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  const { bg, color } = colors[variant]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  )
}
