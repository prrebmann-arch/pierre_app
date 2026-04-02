'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { PROG_PHASES } from '@/lib/constants'
import { toDateStr, getWeekNumber, isBilanDate } from '@/lib/utils'
import MensurationCharts from './MensurationCharts'
import styles from '@/styles/bilans.module.css'
import type { Athlete } from '@/lib/types'
import type { PhotoType, PhotoEntry } from './PhotoCompare'

// ── Types ──

export interface DailyReport {
  id?: string
  date: string
  user_id?: string
  weight?: number | null
  energy?: number | null
  sleep_quality?: number | null
  stress?: number | null
  soreness?: number | null
  adherence?: number | null
  session_enjoyment?: number | null
  steps?: number | null
  cardio_minutes?: number | null
  sick_signs?: boolean | null
  general_notes?: string | null
  bedtime?: string | null
  wakeup?: string | null
  positive_week?: string | null
  negative_week?: string | null
  belly_measurement?: number | null
  hip_measurement?: number | null
  thigh_measurement?: number | null
  photo_front?: string | null
  photo_side?: string | null
  photo_back?: string | null
  sessions_executed?: string | null
  session_performance?: number | null
  _autoOnly?: boolean
  [key: string]: unknown
}

interface WorkoutLog {
  id: string
  date: string
  session_id?: string | null
  session_name?: string | null
  titre?: string | null
  type?: string | null
  started_at?: string | null
  finished_at?: string | null
  exercices_completes?: string | unknown[] | null
}

interface ProgWeek {
  week_date: string
  phase?: string | null
  _phaseNum?: number
  [key: string]: unknown
}

interface NutriPlan {
  id: string
  valid_from?: string | null
  meal_type?: string | null
  nom?: string | null
  calories_objectif?: number | null
  proteines?: number | null
  glucides?: number | null
  lipides?: number | null
  created_at?: string | null
  [key: string]: unknown
}

interface RoadmapPhase {
  phase?: string | null
  name?: string | null
  start_date?: string | null
  end_date?: string | null
}

interface BilanAccordionProps {
  bilans: DailyReport[]
  allWLogs: WorkoutLog[]
  progWeeks: ProgWeek[]
  nutriPlans: NutriPlan[]
  roadmapPhases: RoadmapPhase[]
  athlete: Athlete
  photoHistory: Record<PhotoType, PhotoEntry[]>
  onDeleteBilan: (id: string, date: string) => void
  onOpenPhoto: (type: PhotoType, date: string) => void
  onOpenBilanTraite: () => void
}

// ── Helpers ──

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d
}

function bwAvg(bilans: DailyReport[], field: string): number | null {
  const vals = bilans.map(b => parseFloat(String(b[field] ?? ''))).filter(v => !isNaN(v) && v > 0)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function bwLast(bilans: DailyReport[], field: string): number | null {
  const sorted = [...bilans].sort((a, b) => b.date.localeCompare(a.date))
  const found = sorted.find(b => b[field] != null && b[field] !== '')
  return found ? parseFloat(String(found[field])) : null
}

function bwAllTexts(bilans: DailyReport[], field: string): { date: string; text: string }[] {
  return [...bilans]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(b => b[field] && String(b[field]).trim())
    .map(b => {
      const d = new Date(b.date)
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
      const label = days[d.getUTCDay()] + ' ' + d.getUTCDate()
      return { date: label, text: String(b[field]).trim() }
    })
}

function parseExs(data: unknown): { series?: { reps?: string | number; kg?: string | number; charge?: string | number; load?: string | number }[] }[] {
  try {
    return (typeof data === 'string' ? JSON.parse(data) : data) || []
  } catch { return [] }
}

function TagBadge({ value, inverted }: { value: number | string | null | undefined; inverted?: boolean }) {
  if (value == null || value === '') return <span>{'\u2014'}</span>
  const v = parseFloat(String(value))
  if (isNaN(v)) return <span>{'\u2014'}</span>
  let cls: string
  if (!inverted) {
    cls = v >= 7 ? styles.tagGood : v >= 5 ? styles.tagOk : styles.tagBad
  } else {
    cls = v <= 3 ? styles.tagGood : v <= 5 ? styles.tagOk : styles.tagBad
  }
  return <span className={`${styles.tag} ${cls}`}>{v}/10</span>
}

function StatValue({ val, inverted }: { val: number | null; inverted?: boolean }) {
  if (val == null) return <>{'\u2014'}</>
  const v = val.toFixed(1)
  let color: string
  if (!inverted) {
    color = val >= 7 ? 'var(--success)' : val >= 5 ? 'var(--warning)' : 'var(--danger)'
  } else {
    color = val <= 3 ? 'var(--success)' : val <= 5 ? 'var(--warning)' : 'var(--danger)'
  }
  return <span style={{ color }}>{v}</span>
}

// ── Main Component ──

export default function BilanAccordion({
  bilans,
  allWLogs,
  progWeeks,
  nutriPlans,
  roadmapPhases,
  athlete,
  photoHistory,
  onDeleteBilan,
  onOpenPhoto,
  onOpenBilanTraite,
}: BilanAccordionProps) {
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set())
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set())

  // Bilan scheduling config
  const cbFreq = athlete.complete_bilan_frequency || 'weekly'
  const cbIntv = athlete.complete_bilan_interval || 7
  const cbDay = athlete.complete_bilan_day ?? 0
  const cbAnchor = athlete.complete_bilan_anchor_date
  const cbMonthDay = athlete.complete_bilan_month_day || 1

  // Index workout logs by date
  const wlogsByDate: Record<string, WorkoutLog[]> = {}
  allWLogs.forEach(l => {
    if (!wlogsByDate[l.date]) wlogsByDate[l.date] = []
    wlogsByDate[l.date].push(l)
  })

  // Inject days with workout logs but no bilan
  const bilanDates = new Set(bilans.map(b => b.date))
  const allBilans = [...bilans]
  Object.keys(wlogsByDate).filter(d => !bilanDates.has(d)).forEach(d => {
    allBilans.push({ date: d, _autoOnly: true })
  })

  // Group by week
  const weeks: Record<string, { monday: Date; bilans: DailyReport[]; bilansByDayIdx: Record<number, DailyReport> }> = {}
  allBilans.forEach(b => {
    const date = new Date(b.date + 'T00:00:00')
    const monday = getMonday(date)
    const key = toDateStr(monday)
    if (!weeks[key]) weeks[key] = { monday, bilans: [], bilansByDayIdx: {} }
    weeks[key].bilans.push(b)
    let dayIdx = date.getDay() - 1
    if (dayIdx < 0) dayIdx = 6
    weeks[key].bilansByDayIdx[dayIdx] = b
  })

  const sortedKeys = Object.keys(weeks).sort().reverse()
  const todayMonday = toDateStr(getMonday(new Date()))

  // Programming weeks lookup with phase counters
  let lastPh: string | null = null
  let phCtr = 0
  progWeeks.forEach(pw => {
    if (pw.phase && pw.phase === lastPh) { phCtr++ }
    else if (pw.phase) { phCtr = 1; lastPh = pw.phase }
    else { phCtr = 0; lastPh = null }
    pw._phaseNum = phCtr
  })
  const progLookup: Record<string, ProgWeek> = {}
  progWeeks.forEach(pw => {
    if (pw.week_date) {
      progLookup[String(pw.week_date).substring(0, 10)] = pw
    }
  })

  // Nutrition plans sorted
  const nutriSorted = [...nutriPlans].sort((a, b) =>
    (b.valid_from || '').localeCompare(a.valid_from || '') || (b.created_at || '').localeCompare(a.created_at || '')
  )

  function getNutriPeriodsForWeek(weekMonday: Date) {
    const mondayStr = toDateStr(weekMonday)
    const sunday = new Date(weekMonday)
    sunday.setDate(sunday.getDate() + 6)
    const sundayStr = toDateStr(sunday)

    const changeDates = [...new Set(
      nutriSorted
        .filter(p => p.valid_from && p.valid_from > mondayStr && p.valid_from <= sundayStr)
        .map(p => p.valid_from!)
    )].sort()

    const timePoints = [mondayStr, ...changeDates]
    const periods: { from: string; training: NutriPlan | null; rest: NutriPlan | null }[] = []

    timePoints.forEach(dateStr => {
      const validAtDate = nutriSorted.filter(p => !p.valid_from || p.valid_from <= dateStr)
      const training = validAtDate.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || null
      const rest = validAtDate.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null
      const last = periods[periods.length - 1]
      if (last && last.training?.id === training?.id && last.rest?.id === rest?.id) return
      periods.push({ from: dateStr, training, rest })
    })
    return periods
  }

  // Compute weekly data
  const weekData = sortedKeys.map((key, _wIdx) => {
    const w = weeks[key]
    const bb = w.bilans

    const perfSummary = (() => {
      const perfs: string[] = []
      bb.forEach(b => {
        (wlogsByDate[b.date] || []).forEach(log => {
          const prev = allWLogs.find(l => l.session_id && l.session_id === log.session_id && l.date < log.date)
          if (!prev) return
          const curExs = parseExs(log.exercices_completes)
          const prevExs = parseExs(prev.exercices_completes)
          let cv = 0, pv = 0
          curExs.forEach(e => { (e.series || []).forEach(s => { cv += (parseFloat(String(s.reps ?? '0')) || 0) * (parseFloat(String(s.kg ?? s.charge ?? s.load ?? '1')) || 1) }) })
          prevExs.forEach(e => { (e.series || []).forEach(s => { pv += (parseFloat(String(s.reps ?? '0')) || 0) * (parseFloat(String(s.kg ?? s.charge ?? s.load ?? '1')) || 1) }) })
          if (pv === 0) return
          const ratio = cv / pv
          if (ratio > 1.02) perfs.push('Progres')
          else if (ratio < 0.98) perfs.push('Regression')
          else perfs.push('Maintien')
        })
      })
      if (!perfs.length) return null
      const p = perfs.filter(x => x === 'Progres').length
      const r = perfs.filter(x => x === 'Regression').length
      const s = perfs.length - p - r
      return { p, s, r }
    })()

    return {
      key, ...w,
      avgWeight: bwAvg(bb, 'weight'),
      avgEnergy: bwAvg(bb, 'energy'),
      avgSleep: bwAvg(bb, 'sleep_quality'),
      avgStress: bwAvg(bb, 'stress'),
      avgSoreness: bwAvg(bb, 'soreness'),
      avgAdherence: bwAvg(bb, 'adherence'),
      totalSessions: bb.filter(b => (wlogsByDate[b.date] || []).length > 0).length,
      avgSteps: bwAvg(bb, 'steps'),
      avgEnjoyment: bwAvg(bb, 'session_enjoyment'),
      totalCardio: bb.reduce((s, b) => s + ((b.cardio_minutes as number) || 0), 0),
      anySick: bb.some(b => b.sick_signs),
      perfSummary,
      belly: bwLast(bb, 'belly_measurement'),
      hip: bwLast(bb, 'hip_measurement'),
      thigh: bwLast(bb, 'thigh_measurement'),
      positiveWeeks: bwAllTexts(bb, 'positive_week'),
      negativeWeeks: bwAllTexts(bb, 'negative_week'),
    }
  })

  // Weight & mensuration deltas
  weekData.forEach((w, i) => {
    const prev = weekData[i + 1]
    ;(w as Record<string, unknown>).deltaKg = (prev && w.avgWeight !== null && prev.avgWeight !== null)
      ? +(w.avgWeight - prev.avgWeight).toFixed(1) : null
    ;(w as Record<string, unknown>).deltaBelly = (prev && w.belly !== null && prev.belly !== null)
      ? +(w.belly - prev.belly).toFixed(1) : null
    ;(w as Record<string, unknown>).deltaHip = (prev && w.hip !== null && prev.hip !== null)
      ? +(w.hip - prev.hip).toFixed(1) : null
    ;(w as Record<string, unknown>).deltaThigh = (prev && w.thigh !== null && prev.thigh !== null)
      ? +(w.thigh - prev.thigh).toFixed(1) : null
  })

  // Initialize open weeks (current + first) via effect
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current || weekData.length === 0) return
    didInit.current = true
    const init = new Set<string>()
    weekData.forEach((w, idx) => {
      if (w.key === todayMonday || idx === 0) init.add(w.key)
    })
    if (init.size > 0) setOpenWeeks(init)
  }, [weekData, todayMonday])

  const toggleWeek = useCallback((key: string) => {
    setOpenWeeks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleNote = useCallback((id: string) => {
    setOpenNotes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className={styles.container}>
      {weekData.map((w) => {
        const isCurrent = w.key === todayMonday
        const isFuture = w.key > todayMonday
        const sunday = new Date(w.monday)
        sunday.setDate(sunday.getDate() + 6)
        const weekNum = getWeekNumber(w.monday)
        const isOpen = openWeeks.has(w.key) || (openWeeks.size === 0 && (isCurrent || weekData.indexOf(w) === 0))

        const prog = progLookup[w.key]
        let phase: { label: string; short: string; color: string } | null = prog ? (PROG_PHASES as Record<string, { label: string; short: string; color: string }>)[prog.phase || ''] || null : null
        let phaseCounter = prog?._phaseNum ? ` S${prog._phaseNum}` : ''

        // Fallback to roadmap phases
        if (!phase && roadmapPhases.length) {
          const mondayStr = w.key
          const sundayStr = toDateStr(sunday)
          const rp = roadmapPhases.find(p => p.start_date && p.start_date <= sundayStr && (!p.end_date || p.end_date >= mondayStr))
          if (rp) {
            phase = (PROG_PHASES as Record<string, { label: string; short: string; color: string }>)[rp.phase || ''] || { label: rp.name || rp.phase || '', short: rp.name || rp.phase || '', color: 'var(--primary)' }
            const phaseStart = new Date((rp.start_date || w.key) + 'T00:00:00')
            const weeksSinceStart = Math.floor((w.monday.getTime() - phaseStart.getTime()) / (7 * 86400000)) + 1
            phaseCounter = ` S${weeksSinceStart}`
          }
        }

        const mondayLabel = w.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        const sundayLabel = sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        const deltaKg = (w as Record<string, unknown>).deltaKg as number | null
        const deltaBelly = (w as Record<string, unknown>).deltaBelly as number | null
        const deltaHip = (w as Record<string, unknown>).deltaHip as number | null
        const deltaThigh = (w as Record<string, unknown>).deltaThigh as number | null
        const hasMensWeek = w.belly !== null || w.hip !== null || w.thigh !== null

        // Nutrition periods
        const nutriPeriods = getNutriPeriodsForWeek(w.monday)
        const sorted = [...w.bilans].sort((a, b) => a.date.localeCompare(b.date))

        // Performance display
        const perfDisplay = (() => {
          if (!w.perfSummary) return '\u2014'
          const { p, s, r } = w.perfSummary
          const parts: React.ReactNode[] = []
          if (p) parts.push(<span key="p" style={{ color: 'var(--success)' }}>{p}\u2191</span>)
          if (s) parts.push(<span key="s" style={{ color: 'var(--warning)' }}>{s}\u2192</span>)
          if (r) parts.push(<span key="r" style={{ color: 'var(--danger)' }}>{r}\u2193</span>)
          return <>{parts.map((p, i) => <span key={i}>{i > 0 && ' '}{p}</span>)}</>
        })()

        const cardClasses = [
          styles.card,
          isCurrent ? styles.cardCurrent : '',
          isOpen ? styles.cardOpen : '',
        ].filter(Boolean).join(' ')

        return (
          <div
            key={w.key}
            className={cardClasses}
            style={phase ? { borderLeft: `3px solid ${phase.color}` } : undefined}
          >
            {/* Header */}
            <div className={styles.header} onClick={() => toggleWeek(w.key)}>
              <div className={styles.headerTop}>
                <div className={styles.headerLeft}>
                  <span className={styles.weekLabel}>S{weekNum} &middot; {mondayLabel} &mdash; {sundayLabel}</span>
                  {phase && (
                    <span className={styles.phase} style={{ background: phase.color }}>
                      {phase.short || phase.label}{phaseCounter}
                    </span>
                  )}
                  {isCurrent && <span className={`${styles.status} ${styles.statusCurrent}`}>EN COURS</span>}
                  {isFuture && <span className={`${styles.status} ${styles.statusFuture}`}>A VENIR</span>}
                </div>
                <div className={styles.headerRight}>
                  <button
                    className={styles.noteBtn}
                    style={{ color: 'var(--success)', fontSize: 12 }}
                    onClick={(e) => { e.stopPropagation(); onOpenBilanTraite() }}
                    title="Bilan traite"
                  >
                    <i className="fas fa-check-circle" />
                  </button>
                  <div className={styles.dots}>
                    {DAY_LABELS.map((l, di) => (
                      <span key={di} className={`${styles.dot} ${w.bilansByDayIdx[di] ? styles.dotFilled : ''}`}>
                        {l}
                      </span>
                    ))}
                  </div>
                  <i className={`fas fa-chevron-down ${styles.chevron}`} />
                </div>
              </div>

              {/* Stats row */}
              <div className={styles.stats}>
                <div className={styles.stat} />
                <div className={styles.stat}>
                  <span className={styles.statLabel}>POIDS</span>
                  <span className={styles.statValue}>
                    {w.avgWeight !== null ? w.avgWeight.toFixed(1) : '\u2014'}
                    {deltaKg !== null && (
                      <span className={`${styles.statSub} ${deltaKg < 0 ? styles.deltaNeg : deltaKg > 0 ? styles.deltaPos : ''}`}>
                        {deltaKg > 0 ? '+' : ''}{deltaKg}
                      </span>
                    )}
                  </span>
                </div>
                <div className={styles.stat}><span className={styles.statLabel}>ADHER.</span><span className={styles.statValue}><StatValue val={w.avgAdherence} /></span></div>
                <div className={styles.stat}><span className={styles.statLabel}>SEANCES</span><span className={styles.statValue}>{w.totalSessions}</span></div>
                <div className={styles.stat}><span className={styles.statLabel}>PERF.</span><span className={styles.statValue}>{perfDisplay}</span></div>
                <div className={styles.stat}><span className={styles.statLabel}>PLAISIR</span><span className={styles.statValue}><StatValue val={w.avgEnjoyment} /></span></div>
                <div className={styles.stat}><span className={styles.statLabel}>CARDIO</span><span className={styles.statValue}>{w.totalCardio ? w.totalCardio + "'" : '\u2014'}</span></div>
                <div className={styles.stat}><span className={styles.statLabel}>COURB.</span><span className={styles.statValue}><StatValue val={w.avgSoreness} inverted /></span></div>
                <div className={styles.stat}><span className={styles.statLabel}>STRESS</span><span className={styles.statValue}><StatValue val={w.avgStress} inverted /></span></div>
                <div className={styles.stat}><span className={styles.statLabel}>ENERGIE</span><span className={styles.statValue}><StatValue val={w.avgEnergy} /></span></div>
                <div className={styles.stat}><span className={styles.statLabel}>MALAD.</span><span className={styles.statValue}>{w.anySick ? <i className="fas fa-triangle-exclamation" style={{ color: 'var(--danger)' }} /> : <i className="fas fa-check" style={{ color: 'var(--success)' }} />}</span></div>
                <div className={styles.stat}><span className={styles.statLabel}>SOMMEIL</span><span className={styles.statValue}><StatValue val={w.avgSleep} /></span></div>
                <div className={styles.stat}><span className={styles.statLabel}>PAS</span><span className={styles.statValue}>{w.avgSteps !== null ? Math.round(w.avgSteps).toLocaleString('fr-FR') : '\u2014'}</span></div>
                <div className={styles.stat} />
              </div>
            </div>

            {/* Body */}
            <div className={styles.body}>
              {/* Nutrition */}
              {nutriPeriods.length > 0 && nutriPeriods.map((period, pIdx) => {
                const showDate = nutriPeriods.length > 1
                const periodName = period.training?.nom || period.rest?.nom || ''
                const prevName = pIdx > 0 ? (nutriPeriods[pIdx - 1].training?.nom || nutriPeriods[pIdx - 1].rest?.nom || '') : ''
                const nameChanged = pIdx === 0 || periodName !== prevName
                const dietLabel = nameChanged && periodName ? <span style={{ fontWeight: 600, color: 'var(--text1)', marginRight: 6 }}>{periodName}</span> : null

                return (
                  <div key={pIdx} className={`${styles.nutri} ${showDate ? styles.nutriMulti : ''}`}>
                    {(showDate || dietLabel) && (
                      <div className={styles.nutriDate}>
                        {dietLabel}
                        {showDate && `A partir du ${new Date(period.from + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                      </div>
                    )}
                    <div className={styles.nutriItems}>
                      {period.training && (
                        <div className={styles.nutriItem}>
                          <span className={styles.nutriLabel}>Jour ON</span>
                          <span>{period.training.calories_objectif || 0} kcal &middot; P:{period.training.proteines || 0}g G:{period.training.glucides || 0}g L:{period.training.lipides || 0}g</span>
                        </div>
                      )}
                      {period.rest && (
                        <div className={styles.nutriItem}>
                          <span className={styles.nutriLabel}>Jour OFF</span>
                          <span>{period.rest.calories_objectif || 0} kcal &middot; P:{period.rest.proteines || 0}g G:{period.rest.glucides || 0}g L:{period.rest.lipides || 0}g</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Weekly notes */}
              {(w.positiveWeeks.length > 0 || w.negativeWeeks.length > 0) && (
                <div className={styles.weekNotes}>
                  {w.positiveWeeks.length > 0 && (
                    <div className={styles.weekNote}>
                      <span className={styles.weekNoteIcon} style={{ color: 'var(--success)' }}>
                        <i className="fas fa-plus-circle" />
                      </span>
                      <div>
                        <span className={styles.weekNoteLabel}>Points positifs</span>
                        {w.positiveWeeks.map((e, i) => (
                          <span key={i} className={styles.weekNoteText}>
                            <strong style={{ color: 'var(--text2)', marginRight: 6 }}>{e.date}</strong>
                            {e.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {w.negativeWeeks.length > 0 && (
                    <div className={styles.weekNote}>
                      <span className={styles.weekNoteIcon} style={{ color: 'var(--danger)' }}>
                        <i className="fas fa-minus-circle" />
                      </span>
                      <div>
                        <span className={styles.weekNoteLabel}>A ameliorer</span>
                        {w.negativeWeeks.map((e, i) => (
                          <span key={i} className={styles.weekNoteText}>
                            <strong style={{ color: 'var(--text2)', marginRight: 6 }}>{e.date}</strong>
                            {e.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mensuration summary + charts */}
              {hasMensWeek && (
                <>
                  <div className={styles.mens}>
                    {w.belly !== null && (
                      <div className={styles.mensItem}>
                        <span className={styles.mensLabel}><i className="fas fa-ruler-horizontal" style={{ color: '#E85D04', marginRight: 4 }} />Ventre</span>
                        <span className={styles.mensVal}>{w.belly} cm</span>
                        {deltaBelly !== null && (
                          <span style={{ fontSize: 11, color: deltaBelly < 0 ? 'var(--success)' : deltaBelly > 0 ? 'var(--danger)' : 'var(--text3)' }}>
                            {deltaBelly > 0 ? '+' : ''}{deltaBelly}
                          </span>
                        )}
                      </div>
                    )}
                    {w.hip !== null && (
                      <div className={styles.mensItem}>
                        <span className={styles.mensLabel}><i className="fas fa-ruler-combined" style={{ color: '#7209B7', marginRight: 4 }} />Hanches</span>
                        <span className={styles.mensVal}>{w.hip} cm</span>
                        {deltaHip !== null && (
                          <span style={{ fontSize: 11, color: deltaHip < 0 ? 'var(--success)' : deltaHip > 0 ? 'var(--danger)' : 'var(--text3)' }}>
                            {deltaHip > 0 ? '+' : ''}{deltaHip}
                          </span>
                        )}
                      </div>
                    )}
                    {w.thigh !== null && (
                      <div className={styles.mensItem}>
                        <span className={styles.mensLabel}><i className="fas fa-ruler" style={{ color: '#0096C7', marginRight: 4 }} />Cuisses</span>
                        <span className={styles.mensVal}>{w.thigh} cm</span>
                        {deltaThigh !== null && (
                          <span style={{ fontSize: 11, color: deltaThigh < 0 ? 'var(--success)' : deltaThigh > 0 ? 'var(--danger)' : 'var(--text3)' }}>
                            {deltaThigh > 0 ? '+' : ''}{deltaThigh}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <MensurationCharts
                    bilans={bilans}
                    upToDate={sorted[sorted.length - 1]?.date || w.key}
                    suffix={w.key.replace(/-/g, '') + '_wk'}
                  />
                </>
              )}

              {/* Daily detail table */}
              <div className={styles.daysTable}>
                <div className={styles.dayHdr}>
                  <span className={styles.dhDate}>DATE</span>
                  <span>POIDS</span>
                  <span>ADHER.</span>
                  <span>SEANCE</span>
                  <span>PERF.</span>
                  <span>PLAISIR</span>
                  <span>CARDIO</span>
                  <span>COURB.</span>
                  <span>STRESS</span>
                  <span>ENERGIE</span>
                  <span>MALAD.</span>
                  <span>SOMM.</span>
                  <span>NUIT</span>
                  <span className={styles.dhEnd} />
                </div>

                {sorted.map(b => {
                  const d = new Date(b.date + 'T00:00:00')
                  let di = d.getDay() - 1
                  if (di < 0) di = 6
                  const dayStr = DAY_NAMES[di] + ' ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  const noteId = 'bn-' + (b.id || b.date)
                  const isBDay = isBilanDate(b.date, cbFreq, cbIntv, cbDay, cbAnchor, cbMonthDay)
                  const hasPhotos = b.photo_front || b.photo_side || b.photo_back
                  const hasMens = b.belly_measurement || b.hip_measurement || b.thigh_measurement
                  const hasDetails = b.general_notes || b.steps || hasPhotos || hasMens

                  // Session name from workout logs
                  const dayLogs = wlogsByDate[b.date] || []
                  let sessionCell: React.ReactNode = '\u2014'
                  if (dayLogs.length) {
                    const names = dayLogs.map(l => l.session_name || l.titre || 'Seance').filter(Boolean)
                    sessionCell = <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)' }}>{names.join(', ')}</span>
                  }

                  // Performance
                  let perfCell: React.ReactNode = '\u2014'
                  if (dayLogs.length) {
                    const perfs = dayLogs.map(log => {
                      const prevLog = allWLogs.find(l => l.session_id && l.session_id === log.session_id && l.date < log.date)
                      if (!prevLog) return null
                      const curExs = parseExs(log.exercices_completes)
                      const prevExs = parseExs(prevLog.exercices_completes)
                      let curVol = 0, prevVol = 0
                      curExs.forEach(e => { (e.series || []).forEach(s => { curVol += (parseFloat(String(s.reps ?? '0')) || 0) * (parseFloat(String(s.kg ?? s.charge ?? s.load ?? '1')) || 1) }) })
                      prevExs.forEach(e => { (e.series || []).forEach(s => { prevVol += (parseFloat(String(s.reps ?? '0')) || 0) * (parseFloat(String(s.kg ?? s.charge ?? s.load ?? '1')) || 1) }) })
                      if (prevVol === 0) return null
                      const ratio = curVol / prevVol
                      if (ratio > 1.02) return 'Progres'
                      if (ratio < 0.98) return 'Regression'
                      return 'Maintien'
                    }).filter(Boolean) as string[]
                    if (perfs.length) {
                      const best = perfs.includes('Progres') ? 'Progres' : perfs.includes('Regression') ? 'Regression' : 'Maintien'
                      const pc = best === 'Progres' ? 'var(--success)' : best === 'Regression' ? 'var(--danger)' : 'var(--warning)'
                      perfCell = <span style={{ fontSize: 10, fontWeight: 600, color: pc }}>{best}</span>
                    }
                  }

                  return (
                    <div key={b.date}>
                      <div className={`${styles.dayRow} ${isBDay ? styles.bilanDay : ''}`}>
                        <span className={styles.drDate}>
                          {dayStr}
                          {isBDay && <> <i className="fas fa-star" style={{ color: 'var(--warning)', fontSize: 9 }} /></>}
                        </span>
                        <span className={styles.dr}>{b.weight != null ? String(b.weight) : '\u2014'}</span>
                        <span className={styles.dr}><TagBadge value={b.adherence} /></span>
                        <span className={styles.dr}>{sessionCell}</span>
                        <span className={styles.dr}>{perfCell}</span>
                        <span className={styles.dr}><TagBadge value={b.session_enjoyment} /></span>
                        <span className={styles.dr}>{b.cardio_minutes != null ? b.cardio_minutes + "'" : '\u2014'}</span>
                        <span className={styles.dr}><TagBadge value={b.soreness} inverted /></span>
                        <span className={styles.dr}><TagBadge value={b.stress} inverted /></span>
                        <span className={styles.dr}><TagBadge value={b.energy} /></span>
                        <span className={styles.dr}>
                          {b.sick_signs
                            ? <i className="fas fa-triangle-exclamation" style={{ color: 'var(--danger)', fontSize: 10 }} />
                            : '\u2014'}
                        </span>
                        <span className={styles.dr}><TagBadge value={b.sleep_quality} /></span>
                        <span className={`${styles.dr} ${styles.drNuit}`}>
                          {b.bedtime && b.wakeup
                            ? <span style={{ fontSize: 10 }}>{b.bedtime.slice(0, 5)}<span style={{ color: 'var(--text3)', margin: '0 1px' }}>&rarr;</span>{b.wakeup.slice(0, 5)}</span>
                            : '\u2014'}
                        </span>
                        <span className={styles.drEnd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                          {hasPhotos && (
                            <button
                              className={styles.noteBtn}
                              onClick={(e) => { e.stopPropagation(); onOpenPhoto('front', b.date) }}
                              title="Photos"
                            >
                              <i className="fas fa-camera" style={{ color: 'var(--primary)', fontSize: 11 }} />
                            </button>
                          )}
                          {hasDetails && (
                            <button
                              className={styles.noteBtn}
                              onClick={(e) => { e.stopPropagation(); toggleNote(noteId) }}
                            >
                              <i className="fas fa-chevron-down" />
                            </button>
                          )}
                          {b.id && (
                            <button
                              className={styles.noteBtn}
                              onClick={(e) => { e.stopPropagation(); onDeleteBilan(b.id!, b.date) }}
                              title="Supprimer ce bilan"
                              style={{ marginLeft: 2 }}
                            >
                              <i className="fas fa-trash" style={{ color: 'var(--danger)', fontSize: 10, opacity: 0.5 }} />
                            </button>
                          )}
                        </span>
                      </div>

                      {/* Expandable detail */}
                      {hasDetails && (
                        <div className={`${styles.noteRow} ${openNotes.has(noteId) ? styles.noteRowOpen : ''}`}>
                          {hasMens && (
                            <MensurationCharts
                              bilans={bilans}
                              upToDate={b.date}
                              suffix={(b.id || b.date).replace(/-/g, '')}
                            />
                          )}
                          {b.steps != null && (
                            <div className={styles.detailGrid}>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Pas</span>
                                <span>{Number(b.steps).toLocaleString('fr-FR')}</span>
                              </div>
                            </div>
                          )}
                          {b.general_notes && (
                            <div className={styles.detailNote}>
                              <i className="fas fa-pen" style={{ color: 'var(--text3)', marginRight: 6, fontSize: 11 }} />
                              {b.general_notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
