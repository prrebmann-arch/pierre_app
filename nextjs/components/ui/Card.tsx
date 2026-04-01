import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  headerRight?: ReactNode
  children: ReactNode
  className?: string
}

export default function Card({ title, headerRight, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`.trim()}>
      {(title || headerRight) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {headerRight}
        </div>
      )}
      {children}
    </div>
  )
}
