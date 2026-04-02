'use client'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export default function Toggle({ checked, onChange, label }: ToggleProps) {
  const id = label ? `toggle-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined

  return (
    <label className="toggle-switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" />
      {label && <span style={{ marginLeft: 8, fontSize: 13 }}>{label}</span>}
    </label>
  )
}
