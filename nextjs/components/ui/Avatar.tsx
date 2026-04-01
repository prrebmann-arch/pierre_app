interface AvatarProps {
  name: string
  url?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes: Record<string, number> = {
  sm: 28,
  md: 40,
  lg: 56,
}

export default function Avatar({ name, url, size = 'md' }: AvatarProps) {
  const px = sizes[size]
  const letter = name.charAt(0).toUpperCase()

  const base: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: px * 0.4,
    fontWeight: 700,
    overflow: 'hidden',
  }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ ...base, objectFit: 'cover' }}
      />
    )
  }

  return (
    <div
      style={{
        ...base,
        background: 'var(--primary)',
        color: '#fff',
      }}
    >
      {letter}
    </div>
  )
}
