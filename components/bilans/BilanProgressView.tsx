'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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

function formatLong(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
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

function ratingColor(val: number | null): string {
  if (val == null) return 'var(--text3)'
  if (val >= 7) return 'var(--success)'
  if (val >= 5) return 'var(--warning)'
  return 'var(--danger)'
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// ── SVG Weight Chart ──

function WeightChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length < 2) {
    return <div className={styles.bpEmpty}>Pas assez de données poids</div>
  }

  const W = 600
  const H = 160
  const PAD = { top: 20, bottom: 28, left: 45, right: 15 }

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

  // Y-axis labels
  const step = range > 6 ? Math.ceil(range / 4) : range > 2 ? 1 : 0.5
  const yLabels: { y: number; val: string }[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    yLabels.push({ y: PAD.top + plotH - ((v - min) / range) * plotH, val: v.toFixed(1) })
  }

  // X-axis labels (first, middle, last)
  const xLabels = [
    { x: points[0].x, label: formatShort(points[0].date) },
    ...(points.length > 4 ? [{ x: points[Math.floor(points.length / 2)].x, label: formatShort(points[Math.floor(points.length / 2)].date) }] : []),
    { x: points[points.length - 1].x, label: formatShort(points[points.length - 1].date) },
  ]

  const first = points[0]
  const last = points[points.length - 1]
  const delta = last.value - first.value
  const deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(1)

  return (
    <div className={styles.bpChartCard}>
      <div className={styles.bpChartHeader}>
        <div className={styles.bpChartTitle}>
          <i className="fas fa-weight-scale" style={{ color: 'var(--primary)', fontSize: 13 }} />
          Poids
        </div>
        <div className={styles.bpChartValues}>
          <span className={styles.bpChartCurrent}>{last.value.toFixed(1)} kg</span>
          <span className={styles.bpChartDelta} style={{ color: delta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
            {deltaStr} kg
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.bpSvg}>
        <defs>
          <linearGradient id="bp_weight_grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Grid */}
        {yLabels.map((yl, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yl.y} x2={W - PAD.right} y2={yl.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD.left - 6} y={yl.y} fill="var(--text3)" fontSize={10} textAnchor="end" dominantBaseline="middle">{yl.val}</text>
          </g>
        ))}
        {/* Fill */}
        <polygon points={fillStr} fill="url(#bp_weight_grad)" />
        {/* Line */}
        <polyline points={lineStr} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        <circle cx={first.x} cy={first.y} r={3.5} fill="var(--text3)" />
        <circle cx={last.x} cy={last.y} r={4.5} fill="var(--primary)" stroke="var(--bg)" strokeWidth={2} />
        {/* X labels */}
        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={H - 4} fill="var(--text3)" fontSize={10} textAnchor="middle">{xl.label}</text>
        ))}
      </svg>
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

  // Build URL lookup from photoHistory
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

  // Trigger load on mount if photos exist
  useEffect(() => {
    if (photoBilans.length > 0 && !hasLoadedPhotos) {
      onLoadPhotos()
    }
  }, [photoBilans.length, hasLoadedPhotos, onLoadPhotos])

  if (photoBilans.length === 0) {
    return (
      <div className={styles.bpChartCard}>
        <div className={styles.bpChartHeader}>
          <div className={styles.bpChartTitle}>
            <i className="fas fa-camera" style={{ color: 'var(--primary)', fontSize: 13 }} />
            Photos
          </div>
        </div>
        <div className={styles.bpEmpty}>Aucune photo de bilan</div>
      </div>
    )
  }

  return (
    <div className={styles.bpChartCard}>
      <div className={styles.bpChartHeader}>
        <div className={styles.bpChartTitle}>
          <i className="fas fa-camera" style={{ color: 'var(--primary)', fontSize: 13 }} />
          Evolution photos
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{photoBilans.length} bilans</span>
      </div>
      <div className={styles.bpPhotoScroll}>
        {photoBilans.map(b => {
          const urls = urlsByDate[b.date]
          return (
            <div key={b.date} className={styles.bpPhotoGroup}>
              <div className={styles.bpPhotoDate}>{formatShort(b.date)}</div>
              <div className={styles.bpPhotoRow}>
                {(['front', 'side', 'back'] as PhotoType[]).map(pos => {
                  const url = urls?.[pos]
                  const hasRaw = !!b[`photo_${pos}`]
                  if (!hasRaw) return null
                  return (
                    <div
                      key={pos}
                      className={styles.bpPhotoThumb}
                      onClick={() => onOpenPhoto(pos, b.date)}
                    >
                      {url ? (
                        <img src={url} alt={`${pos} ${b.date}`} />
                      ) : (
                        <div className={styles.bpPhotoPlaceholder}>
                          <i className="fas fa-spinner fa-spin" style={{ fontSize: 11, color: 'var(--text3)' }} />
                        </div>
                      )}
                      <span className={styles.bpPhotoLabel}>
                        {pos === 'front' ? 'F' : pos === 'side' ? 'P' : 'D'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Weekly Averages ──

const RATING_FIELDS: readonly { key: string; label: string; icon: string; inverted?: boolean }[] = [
  { key: 'energy', label: 'Energie', icon: 'fa-bolt' },
  { key: 'sleep_quality', label: 'Sommeil', icon: 'fa-moon' },
  { key: 'stress', label: 'Stress', icon: 'fa-face-grimace', inverted: true },
  { key: 'soreness', label: 'Courb.', icon: 'fa-dumbbell', inverted: true },
  { key: 'adherence', label: 'Adher.', icon: 'fa-circle-check' },
  { key: 'session_enjoyment', label: 'Plaisir', icon: 'fa-heart' },
]

function WeeklyAverages({ weeks }: { weeks: WeekGroup[] }) {
  return (
    <div className={styles.bpChartCard}>
      <div className={styles.bpChartHeader}>
        <div className={styles.bpChartTitle}>
          <i className="fas fa-chart-bar" style={{ color: 'var(--primary)', fontSize: 13 }} />
          Moyennes hebdomadaires
        </div>
      </div>
      <div className={styles.bpWeeksTable}>
        {/* Header */}
        <div className={styles.bpWeekRow} style={{ borderBottom: '1px solid var(--border)' }}>
          <div className={styles.bpWeekDate} style={{ fontWeight: 700, fontSize: 9, color: 'var(--text3)' }}>SEMAINE</div>
          {RATING_FIELDS.map(f => (
            <div key={f.key} className={styles.bpWeekCell} style={{ fontWeight: 700, fontSize: 9, color: 'var(--text3)' }}>
              {f.label.toUpperCase()}
            </div>
          ))}
          <div className={styles.bpWeekCell} style={{ fontWeight: 700, fontSize: 9, color: 'var(--text3)' }}>CARDIO</div>
        </div>
        {weeks.slice(0, 8).map(week => {
          const monday = new Date(week.weekStart + 'T00:00:00')
          const sunday = new Date(monday)
          sunday.setDate(sunday.getDate() + 6)
          const label = `${formatShort(week.weekStart)} — ${formatShort(toDateStr(sunday))}`

          const totalCardio = week.entries.reduce((s, b) => s + ((b.cardio_minutes as number) || 0), 0)

          return (
            <div key={week.weekStart} className={styles.bpWeekRow}>
              <div className={styles.bpWeekDate}>{label}</div>
              {RATING_FIELDS.map(f => {
                const vals = week.entries.map(b => parseFloat(String(b[f.key] ?? ''))).filter(v => !isNaN(v))
                const a = avg(vals)
                const color = a != null
                  ? (f.inverted
                    ? (a <= 3 ? 'var(--success)' : a <= 5 ? 'var(--warning)' : 'var(--danger)')
                    : ratingColor(a))
                  : 'var(--text3)'
                return (
                  <div key={f.key} className={styles.bpWeekCell} style={{ color, fontWeight: 700 }}>
                    {a != null ? a.toFixed(1) : '\u2014'}
                  </div>
                )
              })}
              <div className={styles.bpWeekCell} style={{ color: totalCardio ? 'var(--info)' : 'var(--text3)' }}>
                {totalCardio ? `${totalCardio}'` : '\u2014'}
              </div>
            </div>
          )
        })}
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
  const weeks = useMemo(() => groupByWeek(sorted), [sorted])

  // Get the latest date for mensurations
  const latestDate = sorted.length > 0 ? sorted[sorted.length - 1].date : ''

  return (
    <div className={styles.bpContainer}>
      {/* 1. Photos */}
      <PhotoTimeline
        bilans={sorted}
        photoHistory={photoHistory}
        onOpenPhoto={onOpenPhoto}
        onLoadPhotos={onLoadPhotos}
      />

      {/* 2. Weight */}
      <WeightChart data={weightSeries} />

      {/* 3. Mensurations - reuse existing component */}
      {sorted.some(b => b.belly_measurement || b.hip_measurement || b.thigh_measurement) && (
        <div className={styles.bpChartCard}>
          <div className={styles.bpChartHeader}>
            <div className={styles.bpChartTitle}>
              <i className="fas fa-ruler" style={{ color: 'var(--primary)', fontSize: 13 }} />
              Mensurations
            </div>
          </div>
          <div style={{ padding: '4px 12px 12px' }}>
            <MensurationCharts bilans={sorted} upToDate={latestDate} suffix="progress" />
          </div>
        </div>
      )}

      {/* 4. Weekly Averages */}
      <WeeklyAverages weeks={weeks} />
    </div>
  )
}
