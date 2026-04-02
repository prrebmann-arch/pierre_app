import type { ReactNode } from 'react'

interface FormGroupProps {
  label: string
  htmlFor?: string
  children: ReactNode
  error?: string
}

export default function FormGroup({ label, htmlFor, children, error }: FormGroupProps) {
  return (
    <div className="form-group">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{error}</p>
      )}
    </div>
  )
}
