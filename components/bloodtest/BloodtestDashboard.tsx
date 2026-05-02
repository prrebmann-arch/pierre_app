'use client'

import { useMemo, useState } from 'react'
import { MARKERS, type BloodtestCategory, type BloodtestMarker, type ZoneConfig, type ZoneBand } from '@/lib/bloodtestCatalog'
import { classifyValue, severityColor, type BloodtestUploadRow, type ExtractedData } from '@/lib/bloodtest'

const CATEGORY_META: Record<BloodtestCategory, { label: string; icon: string; color: string }> = {
  hema: { label: 'Hématologie', icon: 'fa-droplet', color: '#ef4444' },
  hormone_sex: { label: 'Hormones sexuelles', icon: 'fa-dna', color: '#a855f7' },
  thyroid: { label: 'Thyroïde', icon: 'fa-feather-pointed', color: '#3b82f6' },
  vitamin: { label: 'Vitamines', icon: 'fa-pills', color: '#f59e0b' },
  mineral: { label: 'Minéraux', icon: 'fa-bolt', color: '#10b981' },
  iron: { label: 'Fer', icon: 'fa-link', color: '#dc2626' },
  inflammation: { label: 'Inflammation', icon: 'fa-fire', color: '#f97316' },
  metabolism: { label: 'Métabolisme', icon: 'fa-bolt-lightning', color: '#facc15' },
  liver: { label: 'Hépatique', icon: 'fa-heart-pulse', color: '#84cc16' },
  lipid: { label: 'Lipides', icon: 'fa-circle', color: '#06b6d4' },
}

const CATEGORY_ORDER: BloodtestCategory[] = ['hema', 'iron', 'vitamin', 'mineral', 'hormone_sex', 'thyroid', 'metabolism', 'liver', 'lipid', 'inflammation']

type ValidatedPoint = {
  date: string
  value: number
  band?: string
  severity?: 1 | 2 | 3 | 4
  uploadId: string
}

export default function BloodtestDashboard({
  uploads,
  tracked,
  customMarkers,
  onDelete,
  onViewPdf,
  athleteSex,
}: {
  uploads: BloodtestUploadRow[]
  tracked: string[]
  customMarkers: { marker_key: string; label: string; unit_canonical: string; category: string; zones: any }[]
  onDelete: (uploadId: string) => void
  onViewPdf: (uploadId: string) => void
  athleteSex?: 'M' | 'F'
}) {
  const [tab, setTab] = useState<'snapshot' | 'trends' | 'bilans'>('snapshot')

  const allMarkers: BloodtestMarker[] = useMemo(() => [
    ...MARKERS,
    ...customMarkers.map((cm) => ({
      key: cm.marker_key,
      label: cm.label,
      unit_canonical: cm.unit_canonical,
      unit_aliases: [],
      category: cm.category as BloodtestCategory,
      zones: cm.zones,
      presets: [],
    })),
  ], [customMarkers])

  const markerByKey = useMemo(() => {
    const m = new Map<string, BloodtestMarker>()
    for (const mk of allMarkers) m.set(mk.key, mk)
    return m
  }, [allMarkers])

  // Toutes les séries chronologiques par marker_key
  const seriesByKey = useMemo(() => {
    const map = new Map<string, ValidatedPoint[]>()
    const sortedUps = [...uploads].sort((a, b) => {
      const da = a.dated_at || a.uploaded_at.slice(0, 10)
      const db = b.dated_at || b.uploaded_at.slice(0, 10)
      return da.localeCompare(db)
    })
    for (const up of sortedUps) {
      const data = up.validated_data as ExtractedData | null
      if (!data?.markers) continue
      const date = up.dated_at || up.uploaded_at.slice(0, 10)
      for (const m of data.markers) {
        if (!m.marker_key || m.value == null || m.ignored) continue
        const v = m.value_canonical ?? m.value!
        const cat = markerByKey.get(m.marker_key)
        let band: string | undefined
        let severity: 1 | 2 | 3 | 4 | undefined
        if (cat) {
          try {
            const cls = classifyValue(cat, v, { sex: athleteSex || 'M' })
            if (cls.ok) { band = cls.band.label; severity = cls.band.severity }
          } catch {}
          if (!band) {
            try {
              const cls = classifyValue(cat, v, { sex: 'F', phase: 'folliculaire' })
              if (cls.ok) { band = cls.band.label; severity = cls.band.severity }
            } catch {}
          }
        }
        const arr = map.get(m.marker_key) || []
        arr.push({ date, value: v, band, severity, uploadId: up.id })
        map.set(m.marker_key, arr)
      }
    }
    return map
  }, [uploads, markerByKey, athleteSex])

  // Markers à afficher : tracked + tout marker avec ≥1 data point
  const displayedKeys = useMemo(() => {
    const set = new Set<string>(tracked)
    for (const [key] of seriesByKey) set.add(key)
    return Array.from(set).filter((k) => markerByKey.has(k))
  }, [seriesByKey, tracked, markerByKey])

  const grouped = useMemo(() => {
    const map = new Map<BloodtestCategory, string[]>()
    for (const key of displayedKeys) {
      const m = markerByKey.get(key)
      if (!m) continue
      const arr = map.get(m.category) || []
      arr.push(key)
      map.set(m.category, arr)
    }
    return map
  }, [displayedKeys, markerByKey])

  // Score par catégorie : nb optimal / total avec data
  const categoryScores = useMemo(() => {
    const scores = new Map<BloodtestCategory, { optimal: number; outOfRange: number; total: number }>()
    for (const [cat, keys] of grouped) {
      let optimal = 0, outOfRange = 0, total = 0
      for (const key of keys) {
        const series = seriesByKey.get(key)
        if (!series || series.length === 0) continue
        const last = series[series.length - 1]
        if (last.severity == null) continue
        total++
        if (last.severity === 1) optimal++
        if (last.severity >= 3) outOfRange++
      }
      scores.set(cat, { optimal, outOfRange, total })
    }
    return scores
  }, [grouped, seriesByKey])

  const totalValidated = uploads.length
  const lastUpload = uploads[0]
  const lastDate = lastUpload ? (lastUpload.dated_at || lastUpload.uploaded_at.slice(0, 10)) : null

  // Stats globales pour le bandeau de tête
  const globalStats = useMemo(() => {
    let optimal = 0, attention = 0, outOfRange = 0, totalWithBand = 0
    for (const [, keys] of grouped) {
      for (const key of keys) {
        const series = seriesByKey.get(key)
        if (!series?.length) continue
        const last = series[series.length - 1]
        if (last.severity == null) continue
        totalWithBand++
        if (last.severity === 1) optimal++
        else if (last.severity === 2) attention++
        else outOfRange++
      }
    }
    return { optimal, attention, outOfRange, totalWithBand }
  }, [grouped, seriesByKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Bandeau de tête : stats globales */}
      {totalValidated > 0 && globalStats.totalWithBand > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 16,
          background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Dernier bilan</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
              {lastDate ? new Date(lastDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
          <StatPill icon="fa-circle-check" color="#22c55e" value={globalStats.optimal} label="Optimal" />
          <StatPill icon="fa-circle-exclamation" color="#eab308" value={globalStats.attention} label="Surveiller" />
          <StatPill icon="fa-triangle-exclamation" color="#ef4444" value={globalStats.outOfRange} label="Hors zone" />
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
            {globalStats.totalWithBand} marker{globalStats.totalWithBand > 1 ? 's' : ''} évalué{globalStats.totalWithBand > 1 ? 's' : ''} · {totalValidated} bilan{totalValidated > 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg2)', borderRadius: 10, alignSelf: 'flex-start' }}>
        <TabBtn active={tab === 'snapshot'} onClick={() => setTab('snapshot')} icon="fa-th-large" label="Snapshot" />
        <TabBtn active={tab === 'trends'} onClick={() => setTab('trends')} icon="fa-chart-line" label="Tendances" />
        <TabBtn active={tab === 'bilans'} onClick={() => setTab('bilans')} icon="fa-folder-open" label={`Bilans (${totalValidated})`} />
      </div>

      {tab === 'snapshot' && (
        <SnapshotView
          grouped={grouped}
          markerByKey={markerByKey}
          seriesByKey={seriesByKey}
          tracked={tracked}
          categoryScores={categoryScores}
          athleteSex={athleteSex}
        />
      )}

      {tab === 'trends' && (
        <TrendsView
          grouped={grouped}
          markerByKey={markerByKey}
          seriesByKey={seriesByKey}
          athleteSex={athleteSex}
        />
      )}

      {tab === 'bilans' && (
        <BilansListView uploads={uploads} onDelete={onDelete} onViewPdf={onViewPdf} />
      )}
    </div>
  )
}

function StatPill({ icon, color, value, label }: { icon: string; color: string; value: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className={`fas ${icon}`} style={{ color, fontSize: 13 }} />
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        border: 'none',
        background: active ? 'var(--bg3)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text3)',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <i className={`fas ${icon}`} style={{ fontSize: 11 }} />{label}
    </button>
  )
}

function SnapshotView({
  grouped, markerByKey, seriesByKey, tracked, categoryScores, athleteSex,
}: {
  grouped: Map<BloodtestCategory, string[]>
  markerByKey: Map<string, BloodtestMarker>
  seriesByKey: Map<string, ValidatedPoint[]>
  tracked: string[]
  categoryScores: Map<BloodtestCategory, { optimal: number; outOfRange: number; total: number }>
  athleteSex?: 'M' | 'F'
}) {
  const present = CATEGORY_ORDER.filter((c) => grouped.has(c))
  if (present.length === 0) return <EmptyState icon="fa-droplet" text="Aucun bilan validé pour le moment" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {present.map((cat) => {
        const meta = CATEGORY_META[cat]
        const keys = grouped.get(cat)!
        const score = categoryScores.get(cat)
        return (
          <section key={cat}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 13 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: 0.3 }}>{meta.label}</h4>
                {score && score.total > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {score.optimal} optimal · {score.outOfRange > 0 && <span style={{ color: '#ef4444' }}>{score.outOfRange} hors zone · </span>}{keys.length} marker{keys.length > 1 ? 's' : ''} suivi{keys.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {score && score.total > 0 && <ScoreRing optimal={score.optimal} total={score.total} color={meta.color} />}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {keys.map((key) => (
                <MarkerSnapshotCard
                  key={key}
                  marker={markerByKey.get(key)!}
                  series={seriesByKey.get(key) || []}
                  isTracked={tracked.includes(key)}
                  athleteSex={athleteSex}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ScoreRing({ optimal, total, color }: { optimal: number; total: number; color: string }) {
  const pct = total > 0 ? optimal / total : 0
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - pct * circumference
  return (
    <div style={{ position: 'relative', width: 44, height: 44 }}>
      <svg width={44} height={44} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={22} cy={22} r={radius} stroke="var(--bg3)" strokeWidth={4} fill="none" />
        <circle
          cx={22} cy={22} r={radius}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 400ms' }}
        />
      </svg>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
        {optimal}/{total}
      </div>
    </div>
  )
}

function MarkerSnapshotCard({
  marker, series, isTracked, athleteSex,
}: {
  marker: BloodtestMarker
  series: ValidatedPoint[]
  isTracked: boolean
  athleteSex?: 'M' | 'F'
}) {
  const last = series[series.length - 1]
  const prev = series.length >= 2 ? series[series.length - 2] : undefined
  const color = last?.severity ? severityColor(last.severity) : 'var(--text3)'
  const trend = prev && last ? last.value - prev.value : 0

  // Récupère la zone config pour la barre de range
  const zoneConfig = useResolveZoneConfig(marker, athleteSex)

  return (
    <div
      style={{
        padding: 14,
        background: 'var(--bg2)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        borderLeft: last?.severity ? `3px solid ${color}` : '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', lineHeight: 1.2 }}>{marker.label}</div>
        {!isTracked && (
          <span style={{ fontSize: 9, padding: '1px 5px', background: 'var(--bg3)', borderRadius: 3, color: 'var(--text3)', fontWeight: 700 }}>EXTRA</span>
        )}
      </div>

      {!last ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune donnée</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{formatVal(last.value)}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{marker.unit_canonical}</span>
            </div>
            {prev && trend !== 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text3)' }}>
                <i className={`fas fa-arrow-${trend > 0 ? 'up' : 'down'}`} style={{ fontSize: 9 }} />
                {trend > 0 ? '+' : ''}{formatVal(trend)}
              </div>
            )}
          </div>

          {/* Reference range bar */}
          {zoneConfig && (
            <RangeBar zone={zoneConfig} value={last.value} unit={marker.unit_canonical} />
          )}

          {last.band && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: `${color}26`, color, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {last.band}
              </span>
              {series.length >= 2 && (
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                  {series.length} valeur{series.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {series.length >= 2 && <Sparkline series={series} color={color} />}
        </>
      )}
    </div>
  )
}

function useResolveZoneConfig(marker: BloodtestMarker, sex?: 'M' | 'F'): ZoneConfig | null {
  const z = marker.zones as any
  if (z?.direction) return z as ZoneConfig
  const ss = z?.sex_specific
  if (!ss) return null
  if (sex === 'M' && ss.male) return ss.male
  if (sex === 'F' && ss.female) return ss.female
  if (sex === 'F' && ss.female_by_phase?.folliculaire) return ss.female_by_phase.folliculaire
  return ss.male || ss.female || null
}

function RangeBar({ zone, value, unit }: { zone: ZoneConfig; value: number; unit: string }) {
  // Détermine min/max visuel
  const explicitMins = zone.bands.map((b) => b.min).filter((v): v is number => typeof v === 'number')
  const explicitMaxs = zone.bands.map((b) => b.max).filter((v): v is number => typeof v === 'number')
  if (explicitMins.length === 0 || explicitMaxs.length === 0) return null

  const overallMin = Math.min(...explicitMins)
  const overallMax = Math.max(...explicitMaxs)
  // padding visuel pour values qui dépassent
  const visualMin = Math.min(overallMin, value) - (overallMax - overallMin) * 0.05
  const visualMax = Math.max(overallMax, value) + (overallMax - overallMin) * 0.05
  const range = visualMax - visualMin || 1

  const W = 100 // pourcentage
  const segments = zone.bands.map((b) => {
    const start = b.min ?? visualMin
    const end = b.max ?? visualMax
    const startPct = ((start - visualMin) / range) * W
    const endPct = ((end - visualMin) / range) * W
    return {
      band: b,
      startPct,
      width: endPct - startPct,
      color: severityColor(b.severity),
    }
  })

  const cursorPct = ((value - visualMin) / range) * W

  return (
    <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
      {/* Reference bands */}
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', position: 'absolute', top: 4, left: 0, right: 0 }}>
        {segments.map((s, i) => (
          <div key={i} style={{
            width: `${s.width}%`,
            background: `${s.color}88`,
            position: 'relative',
          }} title={`${s.band.label}: ${s.band.min ?? '–'} à ${s.band.max ?? '+'} ${unit}`} />
        ))}
      </div>
      {/* Cursor */}
      <div style={{
        position: 'absolute',
        left: `${Math.max(0, Math.min(100, cursorPct))}%`,
        top: 0,
        transform: 'translateX(-50%)',
        width: 3,
        height: 14,
        background: 'var(--text)',
        borderRadius: 2,
        boxShadow: '0 0 0 2px var(--bg2)',
      }} />
    </div>
  )
}

function Sparkline({ series, color }: { series: ValidatedPoint[]; color: string }) {
  const W = 200
  const H = 24
  const values = series.map((s) => s.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = series.map((s, i) => {
    const x = (i / (series.length - 1 || 1)) * W
    const y = H - ((s.value - min) / range) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, marginTop: 2 }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {series.map((s, i) => {
        const x = (i / (series.length - 1 || 1)) * W
        const y = H - ((s.value - min) / range) * H
        const c = s.severity ? severityColor(s.severity) : color
        return <circle key={i} cx={x} cy={y} r={i === series.length - 1 ? 2.5 : 1.5} fill={c} />
      })}
    </svg>
  )
}

function TrendsView({
  grouped, markerByKey, seriesByKey, athleteSex,
}: {
  grouped: Map<BloodtestCategory, string[]>
  markerByKey: Map<string, BloodtestMarker>
  seriesByKey: Map<string, ValidatedPoint[]>
  athleteSex?: 'M' | 'F'
}) {
  const present = CATEGORY_ORDER.filter((c) => grouped.has(c))
  if (present.length === 0) return <EmptyState icon="fa-chart-line" text="Aucune tendance — ajoute au moins un bilan validé" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {present.map((cat) => {
        const meta = CATEGORY_META[cat]
        const keys = grouped.get(cat)!
        return (
          <section key={cat}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className={`fas ${meta.icon}`} style={{ color: meta.color }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{meta.label}</h4>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
              {keys.map((key) => (
                <TrendChart
                  key={key}
                  marker={markerByKey.get(key)!}
                  series={seriesByKey.get(key) || []}
                  athleteSex={athleteSex}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TrendChart({ marker, series, athleteSex }: { marker: BloodtestMarker; series: ValidatedPoint[]; athleteSex?: 'M' | 'F' }) {
  const W = 360
  const H = 140
  const padX = 36
  const padY = 16
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const last = series[series.length - 1]
  const lastColor = last?.severity ? severityColor(last.severity) : 'var(--text3)'
  const zone = useResolveZoneConfig(marker, athleteSex)

  // Calcul du domain Y : englobe les bands + valeurs
  let yMin = Number.POSITIVE_INFINITY, yMax = Number.NEGATIVE_INFINITY
  if (zone) {
    for (const b of zone.bands) {
      if (b.min != null && b.min < yMin) yMin = b.min
      if (b.max != null && b.max > yMax) yMax = b.max
    }
  }
  for (const s of series) {
    if (s.value < yMin) yMin = s.value
    if (s.value > yMax) yMax = s.value
  }
  if (!isFinite(yMin) || !isFinite(yMax)) { yMin = 0; yMax = 1 }
  if (yMax === yMin) yMax = yMin + 1
  const yPad = (yMax - yMin) * 0.05
  yMin -= yPad
  yMax += yPad

  function yToPx(v: number) {
    return padY + innerH - ((v - yMin) / (yMax - yMin)) * innerH
  }

  let chart: React.ReactNode
  if (series.length === 0) {
    chart = (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }}>
        Aucune donnée
      </div>
    )
  } else {
    const xs = series.map((s, i) => (series.length === 1 ? padX + innerW / 2 : padX + (i / (series.length - 1)) * innerW))
    const ys = series.map((s) => yToPx(s.value))
    const pathD = series.length >= 2 ? series.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]},${ys[i]}`).join(' ') : ''

    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        {/* Reference bands */}
        {zone && zone.bands.map((b, i) => {
          const top = yToPx(b.max ?? yMax)
          const bottom = yToPx(b.min ?? yMin)
          if (top >= bottom) return null
          return (
            <rect
              key={i}
              x={padX}
              y={top}
              width={innerW}
              height={bottom - top}
              fill={severityColor(b.severity)}
              opacity={0.13}
            />
          )
        })}
        {/* Y axis labels */}
        <text x={padX - 6} y={padY + 4} fill="var(--text3)" fontSize={9} textAnchor="end">{formatVal(yMax)}</text>
        <text x={padX - 6} y={H - padY + 4} fill="var(--text3)" fontSize={9} textAnchor="end">{formatVal(yMin)}</text>
        {/* Path */}
        {pathD && <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
        {/* Points */}
        {series.map((s, i) => {
          const c = s.severity ? severityColor(s.severity) : 'var(--primary)'
          return (
            <g key={i}>
              <circle cx={xs[i]} cy={ys[i]} r={i === series.length - 1 ? 4.5 : 3} fill={c} stroke="var(--bg2)" strokeWidth={2} />
              {i === series.length - 1 && (
                <text x={xs[i]} y={ys[i] - 9} fill={c} fontSize={10} fontWeight={700} textAnchor="middle">
                  {formatVal(s.value)}
                </text>
              )}
            </g>
          )
        })}
        {/* X axis dates */}
        {series.length >= 2 && (
          <>
            <text x={padX} y={H - 2} fill="var(--text3)" fontSize={9} textAnchor="start">{shortDate(series[0].date)}</text>
            <text x={W - padX} y={H - 2} fill="var(--text3)" fontSize={9} textAnchor="end">{shortDate(series[series.length - 1].date)}</text>
          </>
        )}
        {series.length === 1 && (
          <text x={xs[0]} y={H - 2} fill="var(--text3)" fontSize={9} textAnchor="middle">{shortDate(series[0].date)}</text>
        )}
      </svg>
    )
  }

  return (
    <div style={{ padding: 12, background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{marker.label}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{marker.unit_canonical}</div>
      </div>
      {chart}
      {last?.band && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, padding: '1px 6px', background: `${lastColor}26`, color: lastColor, borderRadius: 3, fontWeight: 700, textTransform: 'uppercase' }}>
            {last.band}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>· {series.length} valeur{series.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

function BilansListView({
  uploads, onDelete, onViewPdf,
}: {
  uploads: BloodtestUploadRow[]
  onDelete: (uploadId: string) => void
  onViewPdf: (uploadId: string) => void
}) {
  if (uploads.length === 0) return <EmptyState icon="fa-folder-open" text="Aucun bilan validé" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {uploads.map((u) => {
        const data = u.validated_data as ExtractedData | null
        const date = u.dated_at || u.uploaded_at.slice(0, 10)
        const fileCount = (u.file_path || '').split('|').filter((p: string) => p).length
        const markersCount = data?.markers?.length || 0
        return (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-file-medical" style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Bilan du {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {markersCount} marker{markersCount > 1 ? 's' : ''} · {fileCount} fichier{fileCount > 1 ? 's' : ''}
                {u.validated_at && ` · validé ${new Date(u.validated_at).toLocaleDateString('fr-FR')}`}
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => onViewPdf(u.id)} title="Voir le PDF d'origine">
              <i className="fas fa-eye" /> PDF
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { if (confirm('Supprimer ce bilan ? Les valeurs validées seront perdues.')) onDelete(u.id) }}
              title="Supprimer"
              style={{ color: 'var(--red)' }}
            >
              <i className="fas fa-trash" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 36, background: 'var(--bg2)', borderRadius: 12, border: '1px dashed var(--border)' }}>
      <i className={`fas ${icon}`} style={{ fontSize: 28, color: 'var(--text3)', marginBottom: 10, display: 'block' }} />
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>{text}</div>
    </div>
  )
}

function formatVal(v: number | null | undefined): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
  if (Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1)
  if (Math.abs(v) >= 1) return v.toFixed(2)
  return v.toFixed(3)
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  } catch {
    return iso
  }
}
