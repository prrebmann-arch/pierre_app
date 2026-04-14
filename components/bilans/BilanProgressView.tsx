'use client'

import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
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

function formatDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface WeekGroup { weekStart: string; entries: DailyReport[] }

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
    .map(([weekStart, entries]) => ({ weekStart, entries: entries.sort((a, b) => a.date.localeCompare(b.date)) }))
}

function extractSeries(bilans: DailyReport[], field: string): { date: string; value: number }[] {
  return bilans
    .filter(b => b[field] != null && b[field] !== '')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(b => ({ date: b.date, value: parseFloat(String(b[field])) }))
    .filter(p => !isNaN(p.value))
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// ── Hero Strip ──

interface HeroCard {
  icon: string; iconColor: string; iconBg: string; gradient: string
  label: string; value: string; unit?: string; delta?: string; deltaColor?: string
}

function HeroStrip({ bilans }: { bilans: DailyReport[] }) {
  const cards = useMemo(() => {
    const result: HeroCard[] = []
    const weights = extractSeries(bilans, 'weight')
    if (weights.length) {
      const last = weights[weights.length - 1].value, first = weights[0].value, d = last - first
      result.push({ icon: 'fa-weight-scale', iconColor: '#B30808', iconBg: 'rgba(179,8,8,0.12)',
        gradient: 'linear-gradient(90deg,#B30808,#d40a0a)', label: 'Poids actuel',
        value: last.toFixed(1), unit: 'kg',
        delta: weights.length > 1 ? `${d > 0 ? '+' : ''}${d.toFixed(1)} kg` : undefined,
        deltaColor: d <= 0 ? 'var(--success)' : 'var(--warning)' })
    }
    const photoBilans = bilans.filter(b => b.photo_front || b.photo_side || b.photo_back)
    result.push({ icon: 'fa-camera', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)',
      gradient: 'linear-gradient(90deg,#3b82f6,#60a5fa)', label: 'Bilans photo', value: String(photoBilans.length) })
    const bellies = extractSeries(bilans, 'belly_measurement')
    if (bellies.length) {
      const last = bellies[bellies.length - 1].value, first = bellies[0].value, d = last - first
      result.push({ icon: 'fa-ruler-horizontal', iconColor: '#E85D04', iconBg: 'rgba(232,93,4,0.12)',
        gradient: 'linear-gradient(90deg,#E85D04,#f97316)', label: 'Ventre',
        value: last.toFixed(1), unit: 'cm',
        delta: bellies.length > 1 ? `${d > 0 ? '+' : ''}${d.toFixed(1)} cm` : undefined,
        deltaColor: d <= 0 ? 'var(--success)' : 'var(--danger)' })
    }
    const adherences = bilans.map(b => parseFloat(String(b.adherence ?? ''))).filter(v => !isNaN(v))
    if (adherences.length) {
      const a = avg(adherences)!
      result.push({ icon: 'fa-circle-check', iconColor: '#22c55e', iconBg: 'rgba(34,197,94,0.12)',
        gradient: 'linear-gradient(90deg,#22c55e,#4ade80)', label: 'Adherence moy.',
        value: a.toFixed(1), unit: '/10' })
    }
    const totalCardio = bilans.reduce((s, b) => s + ((b.cardio_minutes as number) || 0), 0)
    if (totalCardio > 0) {
      result.push({ icon: 'fa-heart-pulse', iconColor: '#7209B7', iconBg: 'rgba(114,9,183,0.12)',
        gradient: 'linear-gradient(90deg,#7209B7,#a855f7)', label: 'Cardio total',
        value: String(totalCardio), unit: 'min' })
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
          <div className={styles.bpHeroValue}>{c.value}{c.unit && <span className={styles.bpHeroUnit}>{c.unit}</span>}</div>
          {c.delta && <div className={styles.bpHeroDelta} style={{ color: c.deltaColor }}>{c.delta}</div>}
          <div className={styles.bpHeroLabel}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Photo Timeline Grid ──

function PhotoGrid({
  bilans, photoHistory, onOpenPhoto, onLoadPhotos,
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
  useEffect(() => { if (photoBilans.length > 0 && !hasLoadedPhotos) onLoadPhotos() }, [photoBilans.length, hasLoadedPhotos, onLoadPhotos])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
            <i className="fas fa-camera" />
          </div>
          Evolution photos
        </div>
        {photoBilans.length > 0 && <span className={styles.bpSectionBadge}>{photoBilans.length} date{photoBilans.length > 1 ? 's' : ''}</span>}
      </div>
      {photoBilans.length === 0 ? (
        <div className={styles.bpEmpty}>Aucune photo de bilan</div>
      ) : (
        <div className={styles.bpPhotoGrid}>
          {photoBilans.map((b, idx) => {
            const urls = urlsByDate[b.date]
            const isFirst = idx === photoBilans.length - 1
            const isLast = idx === 0
            return (
              <div key={b.date} className={styles.bpPhotoRow}>
                <div className={styles.bpPhotoRowLeft}>
                  <div className={styles.bpPhotoRowDate}>{formatMedium(b.date)}</div>
                  {isFirst && photoBilans.length > 1 && <span className={`${styles.bpPhotoRowBadge} ${styles.bpPhotoRowBadgeFirst}`}>Debut</span>}
                  {isLast && photoBilans.length > 1 && <span className={`${styles.bpPhotoRowBadge} ${styles.bpPhotoRowBadgeLast}`}>Dernier</span>}
                </div>
                <div className={styles.bpPhotoRowImages}>
                  {(['front', 'side', 'back'] as PhotoType[]).map(pos => {
                    const url = urls?.[pos]
                    const hasRaw = !!b[`photo_${pos}`]
                    if (!hasRaw) return null
                    return (
                      <div key={pos} className={styles.bpPhotoImgWrap} onClick={() => onOpenPhoto(pos, b.date)}>
                        {url ? <img src={url} alt={`${pos} ${b.date}`} /> : (
                          <div className={styles.bpPhotoPlaceholder}>
                            <i className="fas fa-spinner fa-spin" style={{ fontSize: 14, color: 'var(--text3)' }} />
                          </div>
                        )}
                        <div className={styles.bpPhotoOverlay}>{pos === 'front' ? 'Face' : pos === 'side' ? 'Profil' : 'Dos'}</div>
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
            <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: '#B30808' }}><i className="fas fa-weight-scale" /></div>
            Poids
          </div>
        </div>
        <div className={styles.bpEmpty}>Pas assez de donnees poids</div>
      </div>
    )
  }
  const W = 600, H = 220, PAD = { top: 24, bottom: 32, left: 48, right: 16 }
  const values = data.map(d => d.value)
  const min = Math.min(...values) - 0.5, max = Math.max(...values) + 0.5, range = max - min || 1
  const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom
  const points = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * plotW,
    y: PAD.top + plotH - ((d.value - min) / range) * plotH, ...d,
  }))
  const lineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillStr = lineStr + ` ${points[points.length - 1].x.toFixed(1)},${PAD.top + plotH} ${points[0].x.toFixed(1)},${PAD.top + plotH}`
  const step = range > 6 ? Math.ceil(range / 4) : range > 2 ? 1 : 0.5
  const yLabels: { y: number; val: string }[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) yLabels.push({ y: PAD.top + plotH - ((v - min) / range) * plotH, val: v.toFixed(1) })
  const xIndices = [...new Set([0, Math.floor(data.length / 2), data.length - 1])]
  const xLabels = xIndices.map(i => ({ x: points[i].x, label: formatShort(points[i].date) }))
  const last = points[points.length - 1], first = points[0]
  const delta = last.value - first.value, deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(1)
  const minW = Math.min(...values), maxW = Math.max(...values), avgW = values.reduce((a, b) => a + b, 0) / values.length

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const wrap = wrapRef.current; if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const ch = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tt = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (!ch || !tt) return
    const mouseX = (e.clientX - rect.left) / rect.width
    let nearest = points[0], minDist = Infinity
    for (const pt of points) { const dist = Math.abs(pt.x / W - mouseX); if (dist < minDist) { minDist = dist; nearest = pt } }
    const leftPx = (nearest.x / W) * rect.width
    ch.style.left = leftPx + 'px'; ch.style.display = 'block'
    const d = new Date(nearest.date + 'T00:00:00')
    tt.textContent = `${nearest.value.toFixed(1)} kg — ${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`
    tt.style.display = 'block'; tt.style.left = Math.min(Math.max(leftPx, 60), rect.width - 60) + 'px'
  }, [points])
  const handleMouseLeave = useCallback(() => {
    const wrap = wrapRef.current; if (!wrap) return
    const ch = wrap.querySelector<HTMLDivElement>('[data-crosshair]'); const tt = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (ch) ch.style.display = 'none'; if (tt) tt.style.display = 'none'
  }, [])

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(179,8,8,0.12)', color: '#B30808' }}><i className="fas fa-weight-scale" /></div>
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
              <stop offset="0%" stopColor="#B30808" stopOpacity={0.25} />
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
              r={i === points.length - 1 ? 5.5 : 2.5}
              fill={i === points.length - 1 ? '#B30808' : 'rgba(179,8,8,0.5)'}
              stroke={i === points.length - 1 ? 'var(--bg)' : 'none'}
              strokeWidth={i === points.length - 1 ? 2.5 : 0}
              style={i === points.length - 1 ? { filter: 'drop-shadow(0 0 8px rgba(179,8,8,0.6))' } : undefined}
            />
          ))}
          {xLabels.map((xl, i) => <text key={i} x={xl.x} y={H - 6} fill="var(--text3)" fontSize={10} textAnchor="middle">{xl.label}</text>)}
        </svg>
        <div data-crosshair className={styles.bpCrosshair} />
        <div data-tooltip className={styles.bpTooltip} />
      </div>
      <div className={styles.bpWeightStats}>
        <span className={styles.bpWeightStatPill}><i className="fas fa-arrow-down" style={{ color: 'var(--success)' }} /> Min <strong>{minW.toFixed(1)} kg</strong></span>
        <span className={styles.bpWeightStatPill}><i className="fas fa-minus" style={{ color: 'var(--text3)' }} /> Moy <strong>{avgW.toFixed(1)} kg</strong></span>
        <span className={styles.bpWeightStatPill}><i className="fas fa-arrow-up" style={{ color: 'var(--warning)' }} /> Max <strong>{maxW.toFixed(1)} kg</strong></span>
      </div>
    </div>
  )
}

// ── Radar Chart ──

const RADAR_METRICS = [
  { key: 'energy', label: 'Energie', inverted: false },
  { key: 'sleep_quality', label: 'Sommeil', inverted: false },
  { key: 'adherence', label: 'Adherence', inverted: false },
  { key: 'session_enjoyment', label: 'Plaisir', inverted: false },
  { key: 'soreness', label: 'Courb.', inverted: true },
  { key: 'stress', label: 'Stress', inverted: true },
]

function RadarChart({ bilans }: { bilans: DailyReport[] }) {
  const weeks = useMemo(() => groupByWeek(bilans), [bilans])
  const currentWeek = weeks[0]
  const prevWeek = weeks[1]

  const computeAvgs = useCallback((entries: DailyReport[] | undefined) => {
    if (!entries) return RADAR_METRICS.map(() => null)
    return RADAR_METRICS.map(m => {
      const vals = entries.map(b => parseFloat(String(b[m.key] ?? ''))).filter(v => !isNaN(v))
      if (!vals.length) return null
      let a = vals.reduce((s, v) => s + v, 0) / vals.length
      if (m.inverted) a = 10 - a // invert so higher = better on radar
      return a
    })
  }, [])

  const currentAvgs = useMemo(() => computeAvgs(currentWeek?.entries), [currentWeek, computeAvgs])
  const prevAvgs = useMemo(() => computeAvgs(prevWeek?.entries), [prevWeek, computeAvgs])

  const hasData = currentAvgs.some(v => v !== null)
  if (!hasData) return null

  const cx = 190, cy = 180, R = 140, n = 6
  const angles = RADAR_METRICS.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2)

  const toPoints = (avgs: (number | null)[]) => {
    return avgs.map((v, i) => {
      const r = v != null ? (v / 10) * R : 0
      return { x: cx + r * Math.cos(angles[i]), y: cy + r * Math.sin(angles[i]) }
    })
  }

  const currentPts = toPoints(currentAvgs)
  const prevPts = toPoints(prevAvgs)
  const currentStr = currentPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const prevStr = prevPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>
            <i className="fas fa-radar" />
          </div>
          Vue d&apos;ensemble bien-etre
        </div>
        <span className={styles.bpSectionBadge}>vs semaine precedente</span>
      </div>
      <div className={styles.bpRadarWrap}>
        <svg viewBox="0 0 380 360" className={styles.bpRadarSvg}>
          {/* Grid rings */}
          {rings.map((pct, ri) => {
            const pts = angles.map(a => `${(cx + R * pct * Math.cos(a)).toFixed(1)},${(cy + R * pct * Math.sin(a)).toFixed(1)}`).join(' ')
            return <polygon key={ri} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          })}
          {/* Axis lines */}
          {angles.map((a, i) => (
            <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          {/* Previous week polygon */}
          {prevAvgs.some(v => v !== null) && (
            <polygon points={prevStr} fill="rgba(142,142,154,0.08)" stroke="var(--text3)" strokeWidth={1.5} strokeDasharray="4 3" />
          )}
          {/* Current week polygon */}
          <polygon points={currentStr} fill="rgba(179,8,8,0.12)" stroke="#B30808" strokeWidth={2} />
          {/* Current dots */}
          {currentPts.map((p, i) => currentAvgs[i] != null && (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="#B30808" stroke="var(--bg)" strokeWidth={2}
              style={{ filter: 'drop-shadow(0 0 4px rgba(179,8,8,0.5))' }} />
          ))}
          {/* Labels */}
          {RADAR_METRICS.map((m, i) => {
            const labelR = R + 20
            const x = cx + labelR * Math.cos(angles[i])
            const y = cy + labelR * Math.sin(angles[i])
            const anchor = Math.abs(Math.cos(angles[i])) < 0.1 ? 'middle' : Math.cos(angles[i]) > 0 ? 'start' : 'end'
            const val = currentAvgs[i]
            const displayVal = val != null ? (RADAR_METRICS[i].inverted ? (10 - val).toFixed(1) : val.toFixed(1)) : ''
            return (
              <g key={i}>
                <text x={x} y={y - 6} fill="var(--text2)" fontSize={11} fontWeight={600} textAnchor={anchor}>{m.label}</text>
                {displayVal && <text x={x} y={y + 8} fill="var(--text3)" fontSize={10} fontWeight={700} textAnchor={anchor}>{displayVal}</text>}
              </g>
            )
          })}
        </svg>
      </div>
      <div className={styles.bpRadarLegend}>
        <div className={styles.bpRadarLegendItem}>
          <div className={styles.bpRadarLegendDot} style={{ background: '#B30808' }} />
          Sem. courante
        </div>
        {prevAvgs.some(v => v !== null) && (
          <div className={styles.bpRadarLegendItem}>
            <div className={styles.bpRadarLegendDot} style={{ background: 'var(--text3)', opacity: 0.5 }} />
            Sem. precedente
          </div>
        )}
      </div>
    </div>
  )
}

// ── Heatmap ──

const HEATMAP_METRICS = [
  { key: 'energy', label: 'Energie', inverted: false },
  { key: 'sleep_quality', label: 'Sommeil', inverted: false },
  { key: 'stress', label: 'Stress', inverted: true },
  { key: 'soreness', label: 'Courb.', inverted: true },
  { key: 'adherence', label: 'Adher.', inverted: false },
  { key: 'session_enjoyment', label: 'Plaisir', inverted: false },
]

function Heatmap({ bilans }: { bilans: DailyReport[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const sorted = useMemo(() => [...bilans].sort((a, b) => a.date.localeCompare(b.date)), [bilans])
  const dates = useMemo(() => sorted.map(b => b.date), [sorted])
  const byDate = useMemo(() => {
    const map: Record<string, DailyReport> = {}
    sorted.forEach(b => { map[b.date] = b })
    return map
  }, [sorted])

  if (dates.length < 3) return null

  const cellClass = (val: number | null, inverted: boolean): string => {
    if (val == null) return styles.bpHeatEmpty
    if (inverted) {
      if (val <= 3) return styles.bpHeatGood
      if (val <= 5) return styles.bpHeatOk
      return styles.bpHeatBad
    }
    if (val >= 7) return styles.bpHeatGood
    if (val >= 5) return styles.bpHeatOk
    return styles.bpHeatBad
  }

  const handleMouseEnter = (e: React.MouseEvent, metric: string, date: string, val: number | null) => {
    if (val == null) return
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, text: `${metric} ${val}/10 — ${formatDay(date)}` })
  }

  return (
    <div className={styles.bpSection}>
      <div className={styles.bpSectionHeader}>
        <div className={styles.bpSectionTitle}>
          <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            <i className="fas fa-th" />
          </div>
          Tendances quotidiennes
        </div>
        <span className={styles.bpSectionBadge}>{dates.length} jours</span>
      </div>
      <div className={styles.bpHeatmapWrap}>
        {/* Day headers */}
        <div className={styles.bpHeatmapDayHeaders}>
          {dates.map((d, i) => {
            const day = new Date(d + 'T00:00:00')
            const show = i === 0 || i === dates.length - 1 || i % 7 === 0
            return <div key={i} className={styles.bpHeatmapDayHeader}>{show ? formatShort(d) : ''}</div>
          })}
        </div>
        <div className={styles.bpHeatmapTable}>
          {HEATMAP_METRICS.map(m => (
            <div key={m.key} className={styles.bpHeatmapRow}>
              <div className={styles.bpHeatmapLabel}>{m.label}</div>
              {dates.map(d => {
                const b = byDate[d]
                const val = b ? parseFloat(String(b[m.key] ?? '')) : NaN
                const v = isNaN(val) ? null : val
                return (
                  <div
                    key={d}
                    className={`${styles.bpHeatmapCell} ${cellClass(v, m.inverted)}`}
                    onMouseEnter={(e) => handleMouseEnter(e, m.label, d, v)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className={styles.bpHeatmapLegend}>
          <div className={styles.bpHeatmapLegendBox} style={{ background: 'rgba(34,197,94,0.6)' }} /> Bon
          <div className={styles.bpHeatmapLegendBox} style={{ background: 'rgba(245,158,11,0.5)' }} /> Moyen
          <div className={styles.bpHeatmapLegendBox} style={{ background: 'rgba(239,68,68,0.5)' }} /> Mauvais
          <div className={styles.bpHeatmapLegendBox} style={{ background: 'rgba(255,255,255,0.03)' }} /> Vide
        </div>
      </div>
      {/* Tooltip portal */}
      {tooltip && (
        <div className={styles.bpHeatmapTooltip} style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

// ── Main ──

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
      <PhotoGrid bilans={sorted} photoHistory={photoHistory} onOpenPhoto={onOpenPhoto} onLoadPhotos={onLoadPhotos} />
      <WeightChart data={weightSeries} />
      {hasMens && (
        <div className={styles.bpSection}>
          <div className={styles.bpSectionHeader}>
            <div className={styles.bpSectionTitle}>
              <div className={styles.bpSectionTitleIcon} style={{ background: 'rgba(232,93,4,0.12)', color: '#E85D04' }}><i className="fas fa-ruler" /></div>
              Mensurations
            </div>
          </div>
          <div className={styles.bpMensWrap}><MensurationCharts bilans={sorted} upToDate={latestDate} suffix="progress" /></div>
        </div>
      )}
      <RadarChart bilans={sorted} />
      <Heatmap bilans={sorted} />
    </div>
  )
}
