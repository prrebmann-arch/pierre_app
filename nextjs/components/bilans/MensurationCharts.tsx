'use client'

import { useRef, useCallback } from 'react'
import styles from '@/styles/bilans.module.css'

interface DailyReport {
  date: string
  belly_measurement?: number | null
  hip_measurement?: number | null
  thigh_measurement?: number | null
  [key: string]: unknown
}

interface MensurationChartsProps {
  bilans: DailyReport[]
  upToDate: string
  suffix: string
}

interface ChartPoint {
  idx: number
  value: number
  label: string
  total: number
}

const METRICS = [
  { key: 'belly_measurement', label: 'Ventre', icon: 'fa-ruler-horizontal', color: '#E85D04' },
  { key: 'hip_measurement', label: 'Hanches', icon: 'fa-ruler-combined', color: '#7209B7' },
  { key: 'thigh_measurement', label: 'Cuisses', icon: 'fa-ruler', color: '#0096C7' },
] as const

function MiniChart({ points, color, uid }: { points: ChartPoint[]; color: string; uid: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  const values = points.map(p => p.value)
  const vMin = Math.min(...values)
  const vMax = Math.max(...values)
  const range = vMax - vMin || 1
  const pad = 0.08
  const yScale = (v: number) => 100 - ((v - vMin) / range) * (100 * (1 - 2 * pad)) - 100 * pad
  const VB_X = -12
  const VB_W = 116

  const pts = points.map((p) => {
    const x = (p.idx / (points.length - 1)) * 100
    const y = yScale(p.value)
    return { xf: x.toFixed(2), yf: y.toFixed(2) }
  })
  const lineStr = pts.map(p => `${p.xf},${p.yf}`).join(' ')
  const fillStr = lineStr + ` ${pts[pts.length - 1].xf},104 ${pts[0].xf},104`

  // Build Y-axis labels
  const yLabels: { y: number; val: number }[] = []
  const step = range > 4 ? Math.ceil(range / 3) : range > 1 ? 1 : 0.5
  for (let v = Math.floor(vMin); v <= Math.ceil(vMax); v += step) {
    yLabels.push({ y: yScale(v), val: v })
  }

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
      const ptX = (pt.idx / (points.length - 1)) * 100
      const dist = Math.abs(ptX - mouseDataX)
      if (dist < minDist) { minDist = dist; nearest = pt }
    }
    const snapDataX = (nearest.idx / (points.length - 1)) * 100
    const leftPx = ((snapDataX - VB_X) / VB_W) * rect.width
    crosshair.style.left = leftPx + 'px'
    crosshair.style.display = 'block'
    tooltip.textContent = `${nearest.value} cm \u2014 ${nearest.label}`
    tooltip.style.display = 'block'
    tooltip.style.left = Math.min(Math.max(leftPx, 50), rect.width - 50) + 'px'
  }, [points])

  const handleMouseLeave = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const crosshair = wrap.querySelector<HTMLDivElement>('[data-crosshair]')
    const tooltip = wrap.querySelector<HTMLDivElement>('[data-tooltip]')
    if (crosshair) crosshair.style.display = 'none'
    if (tooltip) tooltip.style.display = 'none'
  }, [])

  return (
    <div
      ref={wrapRef}
      className={styles.mensChartWrap}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        viewBox={`${VB_X} -4 ${VB_W} 108`}
        style={{ width: '100%', height: 90 }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`mg_${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {yLabels.map((yl, i) => (
          <g key={i}>
            <line x1={0} y1={yl.y} x2={100} y2={yl.y} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            <text x={-2} y={yl.y} fill="var(--text3)" fontSize={3.5} textAnchor="end" dominantBaseline="middle">{yl.val}</text>
          </g>
        ))}
        <polygon points={fillStr} fill={`url(#mg_${uid})`} />
        <polyline points={lineStr} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        data-crosshair
        className="ap-weight-crosshair bw-mens-xhair"
        style={{ display: 'none' }}
      />
      <div
        data-tooltip
        className="ap-weight-tooltip bw-mens-tip"
        style={{ display: 'none', background: color, boxShadow: `0 2px 8px ${color}66` }}
      />
    </div>
  )
}

export default function MensurationCharts({ bilans, upToDate, suffix }: MensurationChartsProps) {
  const filtered = bilans.filter(b => b.date <= upToDate)
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))

  const charts: React.ReactNode[] = []

  METRICS.forEach(m => {
    const points: ChartPoint[] = []
    sorted.forEach(b => {
      const v = parseFloat(String(b[m.key] ?? ''))
      if (!isNaN(v) && v > 0) {
        const d = new Date(b.date + 'T00:00:00')
        points.push({
          idx: points.length,
          value: v,
          label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
          total: 0,
        })
      }
    })
    if (points.length < 2) return

    points.forEach(p => { p.total = points.length })

    const lastVal = points[points.length - 1].value
    const firstVal = points[0].value
    const diff = (lastVal - firstVal).toFixed(1)
    const diffNum = parseFloat(diff)
    const diffColor = diffNum < 0 ? 'var(--success)' : diffNum > 0 ? 'var(--danger)' : 'var(--text3)'
    const uid = m.key + '_' + suffix

    charts.push(
      <div key={m.key} className={styles.mensChartCard}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text2)',
          padding: '12px 16px 2px', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <i className={`fas ${m.icon}`} style={{ color: m.color, fontSize: 11 }} />
          {m.label}
          <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {lastVal} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>cm</span>
          </span>
          <span style={{ fontSize: 12, marginLeft: 8, color: diffColor }}>
            {diffNum > 0 ? '+' : ''}{diff} cm
          </span>
        </div>
        <div style={{ padding: '2px 16px 10px' }}>
          <MiniChart points={points} color={m.color} uid={uid} />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 9, color: 'var(--text3)', marginTop: 1,
          }}>
            <span>{points[0].label}</span>
            {points.length > 2 && <span>{points[Math.floor(points.length / 2)].label}</span>}
            <span>{points[points.length - 1].label}</span>
          </div>
        </div>
      </div>
    )
  })

  if (!charts.length) return null
  return <div className={styles.mensChartsRow}>{charts}</div>
}
