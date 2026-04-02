import { MS_PER_DAY } from './constants'

// ===== DATE UTILITIES =====

/** Format a Date to 'YYYY-MM-DD' string */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Format a 'YYYY-MM-DD' string to localized French short date (e.g. '12 mars') */
export function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/** Get ISO week number for a date */
export function getWeekNumber(date: Date | string): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7)
}

// ===== FILE VALIDATION =====

/** Validate file type and size for uploads */
export function validateFile(file: File, type: 'image' | 'video'): boolean {
  const MAX_IMAGE = 10 * 1024 * 1024
  const MAX_VIDEO = 100 * 1024 * 1024
  const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const VID_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

  const maxSize = type === 'video' ? MAX_VIDEO : MAX_IMAGE
  const allowed = type === 'video' ? VID_TYPES : IMG_TYPES

  if (file.size > maxSize) return false
  if (!allowed.includes(file.type)) return false
  return true
}

/** Validate file magic bytes to verify actual file type */
export async function validateFileMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 4).arrayBuffer()
    const hex = [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')
    const valid = ['ffd8ffe0', 'ffd8ffe1', '89504e47', '52494646', '00000018', '00000020', '0000001c', '1a45dfa3']
    return valid.some(sig => hex.startsWith(sig))
  } catch {
    return true
  }
}

/** Generate a secure random password */
export function generateSecurePassword(length = 12): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, b => charset[b % charset.length]).join('')
}

// ===== BILAN SCHEDULING =====

/**
 * Check if a given date is a bilan date according to the athlete's config.
 * @param dateStr - 'YYYY-MM-DD'
 * @param frequency - 'none','daily','weekly','biweekly','monthly','custom'
 * @param interval - days between bilans (for 'custom')
 * @param day - JS getDay index(es). Single for weekly, array of 2 for biweekly
 * @param anchorDate - reference date 'YYYY-MM-DD'
 * @param monthDay - day of month (1-31) for 'monthly'
 */
export function isBilanDate(
  dateStr: string,
  frequency: string,
  interval?: number,
  day?: number | number[],
  anchorDate?: string,
  monthDay?: number
): boolean {
  if (frequency === 'none') return false
  if (frequency === 'daily') return true

  const date = new Date(dateStr + 'T12:00:00')

  if (frequency === 'weekly') {
    return date.getDay() === (typeof day === 'number' ? day : (Array.isArray(day) ? day[0] : 1))
  }

  if (frequency === 'biweekly') {
    const days = Array.isArray(day) ? day : [day ?? 1]
    return days.includes(date.getDay())
  }

  if (frequency === 'monthly') {
    return date.getDate() === (monthDay || 1)
  }

  if (frequency === 'custom') {
    const anchor = new Date((anchorDate || dateStr) + 'T12:00:00')
    const diffDays = Math.round((date.getTime() - anchor.getTime()) / MS_PER_DAY)
    return diffDays >= 0 && diffDays % (interval || 1) === 0
  }

  return false
}

/** Find next bilan date from today (within 60 days). */
export function getNextBilanDate(
  frequency: string,
  interval?: number,
  day?: number | number[],
  anchorDate?: string,
  monthDay?: number
): string | null {
  const today = new Date()
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const str = toDateStr(d)
    if (isBilanDate(str, frequency, interval, day, anchorDate, monthDay)) return str
  }
  return null
}

/** Find last expected bilan date (looking back up to 60 days). */
export function getLastExpectedBilanDate(
  frequency: string,
  interval?: number,
  day?: number | number[],
  anchorDate?: string,
  monthDay?: number
): string | null {
  const today = new Date()
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const str = toDateStr(d)
    if (isBilanDate(str, frequency, interval, day, anchorDate, monthDay)) return str
  }
  return null
}

/** Format frequency label for display */
export function formatFrequency(freq: string, interval?: number): string {
  const labels: Record<string, string> = {
    none: 'Desactive',
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    biweekly: 'Bi-hebdomadaire',
    monthly: 'Mensuel',
    custom: `Tous les ${interval || '?'} jours`,
  }
  return labels[freq] || '\u2014'
}
