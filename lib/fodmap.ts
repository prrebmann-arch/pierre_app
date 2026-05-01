import { GROUPS, type FodmapPortionSize } from './fodmapCatalog'

export type FodmapLog = {
  id: string
  athlete_id: string
  group_key: string
  food_key: string
  portion_size: FodmapPortionSize
  rating: 'green' | 'yellow' | 'red'
  note: string | null
  logged_at: string
  iso_week_start: string
  archived_at: string | null
}

export function getISOWeekStart(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isMonday(date: Date): boolean {
  return date.getDay() === 1
}

export type GroupStatus =
  | 'not_started'
  | 'in_progress'
  | 'done_all_green'
  | 'done_yellow'
  | 'done_red'

const PORTION_ORDER: Record<FodmapPortionSize, number> = { S: 0, M: 1, L: 2 }

function sortPortion(a: FodmapLog, b: FodmapLog): number {
  return PORTION_ORDER[a.portion_size] - PORTION_ORDER[b.portion_size]
}

export function deriveGroupStatus(allLogs: FodmapLog[], group_key: string): GroupStatus {
  const logs = allLogs.filter((l) => !l.archived_at && l.group_key === group_key).sort(sortPortion)
  if (logs.length === 0) return 'not_started'
  const sLog = logs.find((l) => l.portion_size === 'S')
  if (sLog && sLog.rating === 'red') return 'done_red'
  const hasRed = logs.some((l) => l.rating === 'red')
  if (logs.length === 3) {
    if (hasRed) return 'done_red'
    if (logs.some((l) => l.rating === 'yellow')) return 'done_yellow'
    return 'done_all_green'
  }
  return 'in_progress'
}

export type ActiveWeek = {
  iso_week_start: string
  group_key: string
  food_key: string
  logs: FodmapLog[]
} | null

export function deriveActiveWeek(allLogs: FodmapLog[], today: Date): ActiveWeek {
  const wk = getISOWeekStart(today)
  const wkLogs = allLogs.filter((l) => !l.archived_at && l.iso_week_start === wk).sort(sortPortion)
  if (wkLogs.length === 0) return null
  const status = deriveGroupStatus(wkLogs, wkLogs[0].group_key)
  if (status === 'done_red' || status === 'done_yellow' || status === 'done_all_green') return null
  return {
    iso_week_start: wk,
    group_key: wkLogs[0].group_key,
    food_key: wkLogs[0].food_key,
    logs: wkLogs,
  }
}

export function deriveProgress(allLogs: FodmapLog[]): { done: number; total: number } {
  const total = GROUPS.length
  const done = GROUPS.filter((g) => {
    const s = deriveGroupStatus(allLogs, g.key)
    return s === 'done_all_green' || s === 'done_yellow' || s === 'done_red'
  }).length
  return { done, total }
}

export function getNextPortionToLog(activeLogs: FodmapLog[]): FodmapPortionSize | null {
  const sizes: FodmapPortionSize[] = ['S', 'M', 'L']
  const logged = new Set(activeLogs.map((l) => l.portion_size))
  for (const s of sizes) if (!logged.has(s)) return s
  return null
}
