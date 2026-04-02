import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'red' | 'danger' | 'icon' | 'logout'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClass: Record<Variant, string> = {
  primary: 'btn btn-primary',
  outline: 'btn btn-outline',
  red: 'btn btn-red',
  danger: 'btn btn-danger',
  icon: 'btn-icon',
  logout: 'btn-logout',
}

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${variantClass[variant]} ${sizeClass[size]} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <i className="fa-solid fa-spinner fa-spin" /> : children}
    </button>
  )
}
