export function formatEur(cents: number | null | undefined): string {
  if (!cents && cents !== 0) return '0,00\u00a0\u20ac'
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function adminFormatDate(d: string | null | undefined): string {
  if (!d) return '\u2014'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function timeAgo(d: string | null | undefined): string {
  if (!d) return '\u2014'
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 60) return "\u00e0 l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days}j`
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem`
  return adminFormatDate(d)
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
