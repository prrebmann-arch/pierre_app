'use client'

import { useMemo, useCallback, useEffect, useRef } from 'react'
import MensurationCharts from './MensurationCharts'
import styles from '@/styles/bilans.module.css'
import type { DailyReport } from './BilanAccordion'
import type { PhotoType, PhotoEntry } from './PhotoCompare'

// ── Helpers ──

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatMedium(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getWeekNum(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime()
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

interface WeekGroup {
  weekStart: string
  entries: DailyReport[]
}

function groupByWeek(bilans: DailyReport[]): WeekGroup[] {
  const weeks: Record<string, DailyReport[]> = {}
  for (const b of bilans) {
    const d = new Date(b.date + 'T12:00:00')
    const monday = getMonday(d)
    const key = toDateStr(monday)
    if (!weeks[key]) weeks[key] = []
    weeks[key].push(b)
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, entries]) => ({
      weekStart,
      entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
    }))
}

function extractSeries(bilans: DailyReport[], field: string): { date: string; value: number }[] {
  return bilans
    .filter(b => b[field] != null && b[field] !== '')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(b => ({ date: b.date, value: parseFloat(String(b[field])) }))
    .filter(p => !isNaN(p.value))
}

function weeklyAvgSeries(bilans: DailyReport[], field: string): { date: string; value: number; label: string }[] {
  const weeks = groupByWeek(bilans)
  return weeks
    .map(w => {
      const vals = w.entries.map(b => parseFloat(String(b[field] ?? ''))).filter(v => !isNaN(v))
      if (!vals.length) return null
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      const monday = new Date(w.weekStart + 'T00:00:00')
      const label = formatShort(w.weekStart)
      return { date: w.weekStart, value: parseFloat(avg.toFixed(1)), label }
    })
    .filter(Boolean)
    .reverse() as { date: string; value: number; label: string }[]
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// ── Hero Strip ──

interface HeroCard {
  icon: string
  iconColor: string
  iconBg: string
  gradient: string
  label: string
  value: string
  unit?: string
  delta?: string
  deltaColor?: string
}

function HeroStrip({ bilans }: { bilans: DailyReport[] }) {
  const cards = useMemo(() => {
    const result: HeroCard[] = []
    const weights = extractSeries(bilans, 'weight')
    if (weights.length) {
      const last = weights[weights.length - 1].value
      const first = weights[0].value
      const d = last - first
      result.push({
        icon: 'fa-weight-scale', iconColor: '#B30808', iconBg: 'rgba(179,8,8,0.12)',
        gradient: 'linear-gradient(90deg,#B30808,#d40a0a)', label: 'Poids actuel',
        value: last.toFixed(1), unit: 'kg',
        delta: weights.length > 1 ? `${d > 0 ? '+' : ''}${d.toFixed(1)} kg` : undefined,
        deltaColor: d <= 0 ? 'var(--success)' : 'var(--warning)',
      })
    }

    const photoBilans = bilans.filter(b => b.photo_front || b.photo_side || b.photo_back)
    result.push({
      icon: 'fa-camera', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)',
      gradient: 'linear-gradient(90deg,#3b82f6,#60a5fa)', label: 'Bilans photo',
      value: String(photoBilans.length),
    })

    const bellies = extractSeries(bilans, 'belly_measurement')
    if (bellies.length) {
      const last = bellies[bellies.length - 1].value
      const first = bellies[0].value
      const d = last - first
      result.push({
        icon: 'fa-ruler-horizontal', iconColor: '#E85D04', iconBg: 'rgba(232,93,4,0.12)',
        gradient: 'linear-gradient(90deg,#E85D04,#f97316)', label: 'Ventre',
        value: last.toFixed(1), unit: 'cm',
        delta: bellies.length > 1 ? `${d > 0 ? '+' : ''}${d.toFixed(1)} cm` : undefined,
        deltaColor: d <= 0 ? 'var(--success)' : 'var(--danger)',
      })
    }

    const adherences = bilans.map(b => parseFloat(String(b.adherence ?? ''))).filter(v => !isNaN(v))
    if (adherences.length) {
      const a = avg(adherences)!
      result.push({
        icon: 'fa-circle-check', iconColor: '#22c55e', iconBg: 'rgba(34,197,94,0.12)',
        gradient: 'linear-gradient(90deg,#22c55e,#4ade80)', label: 'Adherence moy.',
        value: a.toFixed(1), unit: '/10',
      })
    }

    const totalCardio = bilans.reduce((s, b) => s + ((b.cardio_minutes as number) || 0), 0)
    if (totalCardio > 0) {
      result.push({
        icon: 'fa-heart-pulse', iconColor: '#7209B7', iconBg: 'rgba(114,9,183,0.12)',
        gradient: 'linear-gradient(90deg,#7209B7,#a855f7)', label: 'Cardio total',
        value: String(totalCardio), unit: 'min',
      })
    }

    return result
  }, [bilans])

  if (!cards.length) return null

  return (
    <div className={styles.bpHeroStrip}>
      {cards.map((c, i) => (
        <div key={i} className={styles.bpHeroCard}>
          <div className={styles.bpHeroBar} style={{ background: c.gradient }} />
          <div className={styles.bpHeroIcon} style={{ background: c.iconBg, color: c.iconColor }}>
            <i className={`fas ${c.icon}`} />
          </div>
          <div className={styles.bpHeroValue}>
            {c.value}
            {c.unit && <span className={styles.bpHeroUnit}>{c.unit}</span>}
          </div>
          {c.delta && (
            <div className={styles.bpHeroDelta} style={{ color: c.deltaColor }}>{c.delta}</div>
          )}
          <div className={styles.bpHeroLabel}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Photo Timeline ──

function PhotoTimeline({
  bilans,
  photoHistory,
  onOpenPhoto,
  onLoadPhotos,
}: {
  bilans: DailyReport[]
  photoHistory: Record<PhotoType, PhotoEntry[]>
  onOpenPhoto: (type: PhotoType, date: string) => void
  onLoadPhotos: () => void
}) {
  const photoBilans = useMemo(
    () => bilans.filter(b => b.photo_front || b.photo_side || b.photo_back).sort((a, b) => b.date.localeCompare(a.date)),
    [bilans],
  )

  const urlsByDate = useMemo(() => {
    const map: Record<string, Record<PhotoType, string>> = {}
    for (const type of ['front', 'side', 'back'] as PhotoType[]) {
      for (const entry of photoHistory[type] || []) {
        if (!map[entry.date]) map[entry.date] = {} as Record<PhotoType, string>
        map[entry.date][type] = entry.url
      }
    }
    return map
  }, [photoHistory])

  const hasLoadedPhotos = Object.values(photoHistory).some(arr => arr.length > 0)

  useEffect(() => {
    if (photoBilans.length > 0 && !hasLoadedPhotos) onLoadPhotos()
  }, [photoBilans.length, hasLoadedPhotos, onLoadPhotos])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
            <i className="fas fa-camera" />
          </div>
          Evolution photos
        </div>
        {photoBilans.length > 0 && (
          <span className={styles.bpSectionBadge}>{photoBilans.length} bilan{photoBilans.length > 1 ? 's' : ''}</span>
        )}
      </div>
      {photoBilans.length === 0 ? (
        <div className={styles.bpEmpty}>Aucune photo de bilan</div>
      ) : (
        <div className={styles.bpPhotoScroll}>
          {photoBilans.map((b, idx) => {
            const urls = urlsByDate[b.date]
            const isFirst = idx === photoBilans.length - 1
            const isLast = idx === 0
            let cardClass = styles.bpPhotoCard
            if (photoBilans.length > 1) {
              if (isFirst) cardClass += ' ' + styles.bpPhotoCardFirst
              if (isLast) cardClass += ' ' + styles.bpPhotoCardLast
            }
            return (
              <div key={b.date} className={cardClass}>
                <div className={styles.bpPhotoCardHeader}>
                  <span className={styles.bpPhotoCardDate}>{formatMedium(b.date)}</span>
                  <span className={styles.bpPhotoCardBadge}>
                    {isFirst && photoBilans.length > 1 ? 'Debut' : isLast && photoBilans.length > 1 ? 'Dernier' : `S${getWeekNum(b.date)}`}
                  </span>
                </div>
                <div className={styles.bpPhotoCardGrid}>
                  {(['front', 'side', 'back'] as PhotoType[]).map(pos => {
                    const url = urls?.[pos]
                    const hasRaw = !!b[`photo_${pos}`]
                    if (!hasRaw) return null
                    return (
                      <div key={pos} className={styles.bpPhotoImg} onClick={() => onOpenPhoto(pos, b.date)}>
                        {url ? (
                          <img src={url} alt={`${pos} ${b.date}`} />
                        ) : (
                          <div className={styles.bpPhotoPlaceholder}>
                            <i className="fas fa-spinner fa-spin" style={{ fontSize: 12, color: 'var(--text3)' }} />
                          </div>
                        )}
                        <div className={styles.bpPhotoOverlay}>
                          {pos === 'front' ? 'Face' : pos === 'side' ? 'Profil' : 'Dos'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Weight Chart ──

function WeightChart({ data }: { data: { date: string; value: number }[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  if (data.length < 2) {
    return (
      <div className={styles.bpSection}>
        <div className={styles.bpSectionHeader}>
          <div className={styles.bpSectionTitle}>
            <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: '#B30808' }}>
              <i className="fas fa-weight-scale" />
            </div>
            Poids
          </div>
        </div>
        <div className={styles.bpEmpty}>Pas assez de donnees poids</div>
      </div>
    )
  }

  const W = 600, H = 200
  const PAD = { top: 24, bottom: 32, left: 48, right: 16 }
  const values = data.map(d => d.value)
  const min = Math.min(...values) - 0.5
  const max = Math.max(...values) + 0.5
  const range = max - min || 1
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - ((d.value - min) / range) * plotH,
    ...d,
  }))

  const lineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillStr = lineStr + ` ${points[points.length - 1].x.toFixed(1)},${PAD.top + plotH} ${points[0].x.toFixed(1)},${PAD.top + plotH}`

  const step = range > 6 ? Math.ceil(range / 4) : range > 2 ? 1 : 0.5
  const yLabels: { y: number; val: string }[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    yLabels.push({ y: PAD.top + plotH - ((v - min) / range) * plotH, val: v.toFixed(1) })
  }

  const xIndices = [...new Set([0, Math.floor(data.length / 2), data.length - 1])]
  const xLabels = xIndices.map(i => ({ x: points[i].x, label: formatShort(points[i].date) }))

  const last = points[points.length - 1]
  const first = points[0]
  const delta = last.value - first.value
  const deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(1)
  const minW = Math.min(...values), maxW = Math.max(...values), avgW = values.reduce((a, b) => a + b, 0) / values.length

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const crosshair = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tooltip = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (!crosshair || !tooltip) return
    const mouseX = (e.clientX - rect.left) / rect.width
    let nearest = points[0]
    let minDist = Infinity
    for (const pt of points) {
      const dist = Math.abs(pt.x / W - mouseX)
      if (dist < minDist) { minDist = dist; nearest = pt }
    }
    const leftPx = (nearest.x / W) * rect.width
    crosshair.style.left = leftPx + 'px'
    crosshair.style.display = 'block'
    const d = new Date(nearest.date + 'T00:00:00')
    tooltip.textContent = `${nearest.value.toFixed(1)} kg — ${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`
    tooltip.style.display = 'block'
    tooltip.style.left = Math.min(Math.max(leftPx, 60), rect.width - 60) + 'px'
  }, [points])

  const handleMouseLeave = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ch = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tt = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (ch) ch.style.display = 'none'
    if (tt) tt.style.display = 'none'
  }, [])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: '#B30808' }}>
            <i className="fas fa-weight-scale" />
          </div>
          Poids
        </div>
        <div className={styles.bpChartValues}>
          <span className={styles.bpChartCurrent}>{last.value.toFixed(1)}<span className={styles.bpChartUnit}> kg</span></span>
          <span className={styles.bpChartDelta} style={{ color: delta <= 0 ? 'var(--success)' : 'var(--warning)' }}>{deltaStr} kg</span>
        </div>
      </div>
      <div ref={wrapRef} className={styles.bpChartWrap} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.bpSvg}>
          <defs>
            <linearGradient id="bp_wg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B30808" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#B30808" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {yLabels.map((yl, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={yl.y} x2={W - PAD.right} y2={yl.y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <text x={PAD.left - 8} y={yl.y} fill="var(--text3)" fontSize={10} textAnchor="end" dominantBaseline="middle">{yl.val}</text>
            </g>
          ))}
          <polygon points={fillStr} fill="url(#bp_wg)" />
          <polyline points={lineStr} fill="none" stroke="#B30808" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y}
              r={i === points.length - 1 ? 5 : 2.5}
              fill={i === points.length - 1 ? '#B30808' : 'rgba(179,8,8,0.5)'}
              stroke={i === points.length - 1 ? 'var(--bg)' : 'none'}
              strokeWidth={i === points.length - 1 ? 2.5 : 0}
              style={i === points.length - 1 ? { filter: 'drop-shadow(0 0 6px rgba(179,8,8,0.5))' } : undefined}
            />
          ))}
          {xLabels.map((xl, i) => (
            <text key={i} x={xl.x} y={H - 6} fill="var(--text3)" fontSize={10} textAnchor="middle">{xl.label}</text>
          ))}
        </svg>
        <div data-crosshair className={styles.bpCrosshair} />
        <div data-tooltip className={styles.bpTooltip} />
      </div>
      <div className={styles.bpWeightStats}>
        <span className={styles.bpWeightStatPill}>Min <strong>{minW.toFixed(1)} kg</strong></span>
        <span className={styles.bpWeightStatPill}>Moy <strong>{avgW.toFixed(1)} kg</strong></span>
        <span className={styles.bpWeightStatPill}>Max <strong>{maxW.toFixed(1)} kg</strong></span>
      </div>
    </div>
  )
}

// ── Metric Sparkline Card (same SVG pattern as MensurationCharts) ──

interface MetricDef {
  key: string
  label: string
  icon: string
  color: string
  inverted?: boolean
}

const METRICS: MetricDef[] = [
  { key: 'energy', label: 'Energie', icon: 'fa-bolt', color: '#f59e0b' },
  { key: 'sleep_quality', label: 'Sommeil', icon: 'fa-moon', color: '#818cf8' },
  { key: 'stress', label: 'Stress', icon: 'fa-face-grimace', color: '#ef4444', inverted: true },
  { key: 'soreness', label: 'Courbatures', icon: 'fa-dumbbell', color: '#f97316', inverted: true },
  { key: 'adherence', label: 'Adherence', icon: 'fa-circle-check', color: '#22c55e' },
  { key: 'session_enjoyment', label: 'Plaisir', icon: 'fa-heart', color: '#ec4899' },
]

function MetricMiniChart({ points, color, uid }: { points: { idx: number; value: number; label: string }[]; color: string; uid: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  const values = points.map(p => p.value)
  const vMin = Math.min(...values)
  const vMax = Math.max(...values)
  const range = vMax - vMin || 1
  const pad = 0.08
  const yScale = (v: number) => 100 - ((v - vMin) / range) * (100 * (1 - 2 * pad)) - 100 * pad
  const VB_X = -12
  const VB_W = 116

  const pts = points.map(p => {
    const x = (p.idx / Math.max(points.length - 1, 1)) * 100
    const y = yScale(p.value)
    return { xf: x.toFixed(2), yf: y.toFixed(2) }
  })
  const lineStr = pts.map(p => `${p.xf},${p.yf}`).join(' ')
  const fillStr = lineStr + ` ${pts[pts.length - 1].xf},104 ${pts[0].xf},104`

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const crosshair = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tooltip = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (!crosshair || !tooltip) return
    const mouseDataX = ((e.clientX - rect.left) / rect.width) * VB_W + VB_X
    let nearest = points[0]
    let minDist = Infinity
    for (const pt of points) {
      const ptX = (pt.idx / Math.max(points.length - 1, 1)) * 100
      if (Math.abs(ptX - mouseDataX) < minDist) { minDist = Math.abs(ptX - mouseDataX); nearest = pt }
    }
    const snapX = (nearest.idx / Math.max(points.length - 1, 1)) * 100
    const leftPx = ((snapX - VB_X) / VB_W) * rect.width
    crosshair.style.left = leftPx + 'px'
    crosshair.style.display = 'block'
    tooltip.textContent = `${nearest.value.toFixed(1)} — ${nearest.label}`
    tooltip.style.display = 'block'
    tooltip.style.left = Math.min(Math.max(leftPx, 40), rect.width - 40) + 'px'
  }, [points])

  const handleMouseLeave = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ch = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tt = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (ch) ch.style.display = 'none'
    if (tt) tt.style.display = 'none'
  }, [])

  return (
    <div ref={wrapRef} className={styles.bpMetricChartWrap} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <svg viewBox={`${VB_X} -4 ${VB_W} 108`} style={{ width: '100%', height: 70 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`mg_${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={fillStr} fill={`url(#mg_${uid})`} />
        <polyline points={lineStr} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div data-crosshair className={styles.bpMetricCrosshair} />
      <div data-tooltip className={styles.bpMetricTooltip} style={{ background: color, boxShadow: `0 2px 8px ${color}66` }} />
    </div>
  )
}

function MetricSparklines({ bilans }: { bilans: DailyReport[] }) {
  const cards = useMemo(() => {
    return METRICS.map(m => {
      const series = weeklyAvgSeries(bilans, m.key)
      if (series.length < 2) return null
      const points = series.map((s, i) => ({ idx: i, value: s.value, label: s.label }))
      const lastVal = series[series.length - 1].value
      const firstVal = series[0].value
      const diff = parseFloat((lastVal - firstVal).toFixed(1))
      const diffColor = m.inverted
        ? (diff <= 0 ? 'var(--success)' : 'var(--danger)')
        : (diff >= 0 ? 'var(--success)' : 'var(--danger)')
      return { ...m, points, lastVal, diff, diffColor }
    }).filter(Boolean) as (MetricDef & { points: { idx: number; value: number; label: string }[]; lastVal: number; diff: number; diffColor: string })[]
  }, [bilans])

  if (!cards.length) return null

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
            <i className="fas fa-chart-line" />
          </div>
          Tendances bien-etre
        </div>
        <span className={styles.bpSectionBadge}>par semaine</span>
      </div>
      <div className={styles.bpMetricsGrid}>
        {cards.map(c => (
          <div key={c.key} className={styles.bpMetricCard}>
            <div className={styles.bpMetricHeader}>
              <div className={styles.bpMetricIcon} style={{ background: c.color + '1a', color: c.color }}>
                <i className={`fas ${c.icon}`} />
              </div>
              <span className={styles.bpMetricLabel}>{c.label}</span>
              <div className={styles.bpMetricValues}>
                <span className={styles.bpMetricCurrent}>{c.lastVal.toFixed(1)}</span>
                <span className={styles.bpMetricDelta} style={{ color: c.diffColor }}>
                  {c.diff > 0 ? '+' : ''}{c.diff.toFixed(1)}
                </span>
              </div>
            </div>
            <MetricMiniChart points={c.points} color={c.color} uid={c.key} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ──

interface BilanProgressViewProps {
  bilans: DailyReport[]
  photoHistory: Record<PhotoType, PhotoEntry[]>
  onOpenPhoto: (type: PhotoType, date: string) => void
  onLoadPhotos: () => void
}

export default function BilanProgressView({ bilans, photoHistory, onOpenPhoto, onLoadPhotos }: BilanProgressViewProps) {
  const sorted = useMemo(() => [...bilans].sort((a, b) => a.date.localeCompare(b.date)), [bilans])
  const weightSeries = useMemo(() => extractSeries(sorted, 'weight'), [sorted])
  const latestDate = sorted.length > 0 ? sorted[sorted.length - 1].date : ''
  const hasMens = sorted.some(b => b.belly_measurement || b.hip_measurement || b.thigh_measurement)

  return (
    <div className={styles.bpContainer}>
      <HeroStrip bilans={sorted} />

      <PhotoTimeline
        bilans={sorted}
        photoHistory={photoHistory}
        onOpenPhoto={onOpenPhoto}
        onLoadPhotos={onLoadPhotos}
      />

      <WeightChart data={weightSeries} />

      {hasMens && (
        <div className={styles.bpSection}>
          <div className={styles.bpSectionHeader}>
            <div className={styles.bpSectionTitle}>
              <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(232,93,4,0.12)', color: '#E85D04' }}>
                <i className="fas fa-ruler" />
              </div>
              Mensurations
            </div>
          </div>
          <div className={styles.bpMensWrap}>
            <MensurationCharts bilans={sorted} upToDate={latestDate} suffix="progress" />
          </div>
        </div>
      )}

      <MetricSparklines bilans={sorted} />
    </div>
  )
}
