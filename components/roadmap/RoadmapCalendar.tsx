'use client'

import { useState, useMemo } from 'react'
import { PROG_PHASES, type ProgPhaseKey } from '@/lib/constants'
import { toDateStr } from '@/lib/utils'
import type { RoadmapPhase } from './RoadmapTimeline'
import styles from '@/styles/roadmap.module.css'

interface ProgramRef {
  id: string
  nom: string
}

interface NutritionRef {
  id: string
  nom: string
}

interface DailyReport {
  date: string
  weight: number | null
}

interface RoadmapCalendarProps {
  phases: RoadmapPhase[]
  programs: ProgramRef[]
  nutritions: NutritionRef[]
  reports: DailyReport[]
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

export default function RoadmapCalendar({ phases, programs, nutritions, reports }: RoadmapCalendarProps) {
  const [calOffset, setCalOffset] = useState<number | null>(null)

  const todayStr = toDateStr(new Date())

  // Date range
  const { minDate, maxDate, totalMonths } = useMemo(() => {
    if (!phases.length) return { minDate: new Date(), maxDate: new Date(), totalMonths: 0 }
    const allDates = phases.flatMap((p) => [
      new Date(p.start_date + 'T00:00:00'),
      new Date(p.end_date + 'T00:00:00'),
    ])
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())))
    const minD = new Date(min.getFullYear(), min.getMonth(), 1)
    const maxD = new Date(max.getFullYear(), max.getMonth() + 1, 0)
    const total = (maxD.getFullYear() - minD.getFullYear()) * 12 + (maxD.getMonth() - minD.getMonth()) + 1
    return { minDate: minD, maxDate: maxD, totalMonths: total }
  }, [phases])

  // Default offset: current month if in range
  const effectiveOffset = useMemo(() => {
    if (calOffset !== null) return calOffset
    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    if (currentMonth >= minDate && currentMonth <= maxDate) {
      return (currentMonth.getFullYear() - minDate.getFullYear()) * 12 + (currentMonth.getMonth() - minDate.getMonth())
    }
    return 0
  }, [calOffset, minDate, maxDate])

  if (!phases.length) return null

  const visibleCount = Math.min(4, totalMonths)
  const offset = Math.max(0, Math.min(effectiveOffset, totalMonths - visibleCount))
  const canPrev = offset > 0
  const canNext = offset + visibleCount < totalMonths

  const months: React.ReactNode[] = []
  for (let m = 0; m < visibleCount; m++) {
    const monthDate = new Date(minDate.getFullYear(), minDate.getMonth() + offset + m, 1)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const firstDay = new Date(year, month, 1)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: React.ReactNode[] = []
    for (let i = 0; i < startDay; i++) {
      days.push(<span key={`e-${i}`} className={styles.rmCalDay + ' ' + styles.rmCalEmpty} />)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const phase = phases.find((p) => p.start_date <= dateStr && p.end_date >= dateStr)
      const pi = phase ? PROG_PHASES[phase.phase as ProgPhaseKey] : null
      const color = pi ? pi.color : null
      const isToday = dateStr === todayStr

      let style: React.CSSProperties = {}
      if (isToday) {
        style = { background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }
      } else if (color) {
        style = { background: `${color}22`, borderColor: color }
      }

      days.push(
        <span
          key={d}
          className={`${styles.rmCalDay} ${isToday ? styles.rmCalToday : ''} ${phase ? styles.rmCalInPhase : ''}`}
          style={style}
        >
          {d}
        </span>,
      )
    }

    months.push(
      <div key={m} className={styles.rmCalMonth}>
        <div className={styles.rmCalMonthName}>
          {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        </div>
        <div className={styles.rmCalDaysHdr}>
          <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>
        <div className={styles.rmCalDays}>{days}</div>
      </div>,
    )
  }

  // Week table
  const weekTableRows = useMemo(() => {
    if (!phases.length) return []
    const allDates = phases.flatMap((p) => [
      new Date(p.start_date + 'T00:00:00'),
      new Date(p.end_date + 'T00:00:00'),
    ])
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())))
    // Align to Monday
    const dow = min.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    min.setDate(min.getDate() + diff)

    const weightByDate: Record<string, number> = {}
    reports.forEach((r) => {
      if (r.weight) weightByDate[r.date] = parseFloat(String(r.weight))
    })

    const weeks: {
      num: number
      start: string
      end: string
      phase: RoadmapPhase | undefined
      avgWeight: string | null
    }[] = []
    let weekStart = new Date(min)
    let weekNum = 1
    while (weekStart <= max) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekKey = toDateStr(weekStart)
      const weekEndKey = toDateStr(weekEnd)

      const phase = phases.find((p) => p.start_date <= weekEndKey && p.end_date >= weekKey)

      const weightVals: number[] = []
      for (let d = 0; d < 7; d++) {
        const dt = new Date(weekStart)
        dt.setDate(dt.getDate() + d)
        const v = weightByDate[toDateStr(dt)]
        if (v) weightVals.push(v)
      }
      const avgWeight = weightVals.length
        ? (weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1)
        : null

      weeks.push({ num: weekNum++, start: weekKey, end: weekEndKey, phase, avgWeight })
      weekStart.setDate(weekStart.getDate() + 7)
    }
    return weeks
  }, [phases, reports])

  return (
    <>
      {/* Calendar view */}
      <div className={styles.rmCalendarSection}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className={styles.rmSectionTitle} style={{ margin: 0 }}>Vue calendrier</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setCalOffset(offset - 1)}
              disabled={!canPrev}
              style={canPrev ? undefined : { opacity: 0.3, cursor: 'default' }}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setCalOffset(offset + 1)}
              disabled={!canNext}
              style={canNext ? undefined : { opacity: 0.3, cursor: 'default' }}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
        <div className={styles.rmCalGrid} style={{ gridTemplateColumns: `repeat(${visibleCount}, 1fr)` }}>
          {months}
        </div>
        <div className={styles.rmCalLegend}>
          {phases.map((p) => {
            const pi = PROG_PHASES[p.phase as ProgPhaseKey]
            const color = pi ? pi.color : '#555'
            return (
              <span key={p.id} className={styles.rmLegendItem}>
                <span className={styles.rmLegendDot} style={{ background: color }} />
                {p.name}{' '}
                <span className={styles.rmLegendDates}>
                  {formatDateShort(p.start_date)} — {formatDateShort(p.end_date)}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Week table */}
      {weekTableRows.length > 0 && (
        <div className={styles.rmWeektableSection}>
          <h3 className={styles.rmSectionTitle}>Vue semaine par semaine</h3>
          <div className={styles.rmWt}>
            <div className={styles.rmWtHdr}>
              <span className={styles.rmWtH} style={{ textAlign: 'left' }}>Semaine</span>
              <span className={styles.rmWtH}>Phase</span>
              <span className={styles.rmWtH}>Poids moyen</span>
              <span className={styles.rmWtH}>Programme</span>
              <span className={styles.rmWtH}>Nutrition</span>
            </div>
            {weekTableRows.map((w) => {
              const isCurrent = w.start <= todayStr && w.end >= todayStr
              const p = w.phase
              const pi = p ? PROG_PHASES[p.phase as ProgPhaseKey] : null
              const color = pi ? pi.color : null
              const prog = p ? programs.find((pr) => pr.id === p.programme_id) : null
              const nutri = p ? nutritions.find((n) => n.id === p.nutrition_id) : null

              return (
                <div key={w.num} className={`${styles.rmWtRow} ${isCurrent ? styles.rmWtCurrent : ''}`}>
                  <span className={`${styles.rmWtCell} ${styles.rmWtWeek}`}>
                    <strong>S{w.num}</strong>
                    <span className={styles.rmWtDates}>
                      {formatDateShort(w.start)} — {formatDateShort(w.end)}
                    </span>
                  </span>
                  <span className={styles.rmWtCell}>
                    {pi && p ? (
                      <span className={styles.rmWtPhase} style={{ background: color! }}>
                        {p.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                  <span className={styles.rmWtCell}>{w.avgWeight ? `${w.avgWeight} kg` : '\u2014'}</span>
                  <span className={styles.rmWtCell}>
                    {prog ? (
                      <span className={styles.rmWtProg}>
                        <i className="fa-solid fa-dumbbell" /> {prog.nom}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                  <span className={styles.rmWtCell}>
                    {nutri ? (
                      <span className={styles.rmWtNutri}>
                        <i className="fa-solid fa-utensils" /> {nutri.nom}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>&mdash;</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
