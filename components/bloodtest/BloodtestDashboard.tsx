'use client'

import { useMemo, useState } from 'react'
import { MARKERS, type BloodtestCategory, type BloodtestMarker, type ZoneConfig } from '@/lib/bloodtestCatalog'
import { applyZoneOverride, classifyValue, severityColor, type BloodtestUploadRow, type ExtractedData, type ZoneOverrides } from '@/lib/bloodtest'

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
  zoneOverrides,
}: {
  uploads: BloodtestUploadRow[]
  tracked: string[]
  customMarkers: { marker_key: string; label: string; unit_canonical: string; category: string; zones: any }[]
  onDelete: (uploadId: string) => void
  onViewPdf: (uploadId: string) => void
  athleteSex?: 'M' | 'F'
  zoneOverrides?: ZoneOverrides
}) {
  const [tab, setTab] = useState<'snapshot' | 'trends' | 'bilans'>('snapshot')
  const [filterCat, setFilterCat] = useState<BloodtestCategory | 'all'>('all')
  const [detailMarker, setDetailMarker] = useState<string | null>(null)

  const allMarkers: BloodtestMarker[] = useMemo(() => [
    // Catalog markers — apply coach overrides
    ...MARKERS.map((m) => applyZoneOverride(m, zoneOverrides)),
    // Custom markers — zones edited directly in coach_custom_markers, no override layer
    ...customMarkers.map((cm) => ({
      key: cm.marker_key,
      label: cm.label,
      unit_canonical: cm.unit_canonical,
      unit_aliases: [],
      category: cm.category as BloodtestCategory,
      zones: cm.zones,
      presets: [],
    })),
  ], [customMarkers, zoneOverrides])

  const markerByKey = useMemo(() => {
    const m = new Map<string, BloodtestMarker>()
    for (const mk of allMarkers) m.set(mk.key, mk)
    return m
  }, [allMarkers])

  // Synthetic markers for keys not in catalog (AI-invented keys, legacy data) — built from first sighting in validated_data
  const orphanMarkers = useMemo(() => {
    const map = new Map<string, BloodtestMarker>()
    for (const up of uploads) {
      const data = up.validated_data as ExtractedData | null
      if (!data?.markers) continue
      for (const m of data.markers) {
        if (!m.marker_key || markerByKey.has(m.marker_key) || map.has(m.marker_key)) continue
        const label = m.raw_label || m.marker_key
        map.set(m.marker_key, {
          key: m.marker_key,
          label,
          unit_canonical: m.unit_canonical || m.unit || '',
          unit_aliases: [],
          category: 'metabolism',
          presets: [],
          zones: { direction: 'range_is_normal', bands: [] },
        })
      }
    }
    return map
  }, [uploads, markerByKey])

  const fullMarkerByKey = useMemo(() => {
    const m = new Map(markerByKey)
    for (const [k, v] of orphanMarkers) m.set(k, v)
    return m
  }, [markerByKey, orphanMarkers])

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

  const displayedKeys = useMemo(() => {
    const set = new Set<string>(tracked)
    for (const [key] of seriesByKey) set.add(key)
    return Array.from(set).filter((k) => fullMarkerByKey.has(k))
  }, [seriesByKey, tracked, fullMarkerByKey])

  const grouped = useMemo(() => {
    const map = new Map<BloodtestCategory, string[]>()
    for (const key of displayedKeys) {
      const m = fullMarkerByKey.get(key)
      if (!m) continue
      const arr = map.get(m.category) || []
      arr.push(key)
      map.set(m.category, arr)
    }
    return map
  }, [displayedKeys, fullMarkerByKey])

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

  const presentCategories = CATEGORY_ORDER.filter((c) => grouped.has(c))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero */}
      {totalValidated > 0 && (
        <Hero
          lastDate={lastDate}
          lastUpload={lastUpload}
          totalValidated={totalValidated}
          globalStats={globalStats}
          onDelete={onDelete}
          onViewPdf={onViewPdf}
        />
      )}

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 4, padding: 4,
        background: 'var(--bg2)',
        borderRadius: 12,
        alignSelf: 'flex-start',
        border: '1px solid var(--border)',
      }}>
        <TabBtn active={tab === 'snapshot'} onClick={() => setTab('snapshot')} icon="fa-th-large" label="Vue d'ensemble" />
        <TabBtn active={tab === 'trends'} onClick={() => setTab('trends')} icon="fa-chart-line" label="Tendances" />
        <TabBtn active={tab === 'bilans'} onClick={() => setTab('bilans')} icon="fa-folder-open" label={`Bilans (${totalValidated})`} />
      </div>

      {/* Category filter chips (snapshot + trends) */}
      {(tab === 'snapshot' || tab === 'trends') && presentCategories.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginRight: 4 }}>
            Filtrer :
          </span>
          <FilterChip label="Tout" active={filterCat === 'all'} onClick={() => setFilterCat('all')} count={displayedKeys.length} />
          {presentCategories.map((c) => {
            const meta = CATEGORY_META[c]
            return (
              <FilterChip
                key={c}
                label={meta.label}
                color={meta.color}
                active={filterCat === c}
                onClick={() => setFilterCat(c)}
                count={grouped.get(c)?.length || 0}
                icon={meta.icon}
              />
            )
          })}
        </div>
      )}

      {tab === 'snapshot' && (
        <SnapshotView
          grouped={grouped}
          markerByKey={fullMarkerByKey}
          seriesByKey={seriesByKey}
          tracked={tracked}
          categoryScores={categoryScores}
          athleteSex={athleteSex}
          filterCat={filterCat}
          onMarkerClick={(k) => setDetailMarker(k)}
        />
      )}

      {tab === 'trends' && (
        <TrendsView
          grouped={grouped}
          markerByKey={fullMarkerByKey}
          seriesByKey={seriesByKey}
          athleteSex={athleteSex}
          filterCat={filterCat}
        />
      )}

      {tab === 'bilans' && (
        <BilansListView uploads={uploads} onDelete={onDelete} onViewPdf={onViewPdf} />
      )}

      {/* Marker detail modal */}
      {detailMarker && fullMarkerByKey.get(detailMarker) && (
        <MarkerDetailModal
          marker={fullMarkerByKey.get(detailMarker)!}
          series={seriesByKey.get(detailMarker) || []}
          athleteSex={athleteSex}
          onClose={() => setDetailMarker(null)}
        />
      )}
    </div>
  )
}

function Hero({
  lastDate, lastUpload, totalValidated, globalStats, onDelete, onViewPdf,
}: {
  lastDate: string | null
  lastUpload: BloodtestUploadRow | undefined
  totalValidated: number
  globalStats: { optimal: number; attention: number; outOfRange: number; totalWithBand: number }
  onDelete: (uploadId: string) => void
  onViewPdf: (uploadId: string) => void
}) {
  const total = globalStats.totalWithBand
  const pctOptimal = total > 0 ? Math.round((globalStats.optimal / total) * 100) : 0

  return (
    <div style={{
      position: 'relative',
      padding: 20,
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(168,85,247,0.06) 50%, rgba(59,130,246,0.05) 100%)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -50, right: -50, width: 200, height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', position: 'relative' }}>
        {/* Left: latest bilan info */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>
            Dernier bilan
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
              {lastDate ? new Date(lastDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>
              · {totalValidated} bilan{totalValidated > 1 ? 's' : ''} au total
            </span>
          </div>
          {lastUpload && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm"
                onClick={() => onViewPdf(lastUpload.id)}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  padding: '7px 12px',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className="fas fa-eye" style={{ fontSize: 11 }} />
                Voir le document
              </button>
              <button
                className="btn btn-sm"
                onClick={() => { if (confirm('Supprimer ce bilan ? Les valeurs validées seront perdues.')) onDelete(lastUpload.id) }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: '#ef4444',
                  padding: '7px 12px',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className="fas fa-trash-can" style={{ fontSize: 11 }} />
                Supprimer
              </button>
            </div>
          )}
        </div>

        {/* Right: score ring + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <BigScoreRing pctOptimal={pctOptimal} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatRow color="#22c55e" label="Optimal" value={globalStats.optimal} />
            <StatRow color="#eab308" label="Surveiller" value={globalStats.attention} />
            <StatRow color="#ef4444" label="Hors zone" value={globalStats.outOfRange} />
          </div>
        </div>
      </div>
    </div>
  )
}

function BigScoreRing({ pctOptimal }: { pctOptimal: number }) {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pctOptimal / 100) * circumference
  const color = pctOptimal >= 70 ? '#22c55e' : pctOptimal >= 40 ? '#eab308' : '#ef4444'

  return (
    <div style={{ position: 'relative', width: 84, height: 84 }}>
      <svg width={84} height={84} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={42} cy={42} r={radius} stroke="var(--bg3)" strokeWidth={6} fill="none" />
        <circle
          cx={42} cy={42} r={radius}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{pctOptimal}%</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginTop: 2 }}>optimal</div>
      </div>
    </div>
  )
}

function StatRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: 'var(--text2)', flex: 1 }}>{label}</span>
      <strong style={{ fontSize: 14, color, fontWeight: 800 }}>{value}</strong>
    </div>
  )
}

function FilterChip({ label, active, onClick, count, color, icon }: {
  label: string
  active: boolean
  onClick: () => void
  count: number
  color?: string
  icon?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px',
        background: active ? (color || 'var(--primary)') : 'var(--bg2)',
        border: active ? `1px solid ${color || 'var(--primary)'}` : '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        color: active ? 'white' : 'var(--text)',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 100ms',
      }}
    >
      {icon && <i className={`fas ${icon}`} style={{ fontSize: 10 }} />}
      {label}
      <span style={{
        fontSize: 10, fontWeight: 700,
        padding: '1px 6px', borderRadius: 8,
        background: active ? 'rgba(255,255,255,0.2)' : 'var(--bg3)',
        color: active ? 'white' : 'var(--text3)',
      }}>{count}</span>
    </button>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        border: 'none',
        background: active ? 'var(--bg)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text3)',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      <i className={`fas ${icon}`} style={{ fontSize: 11 }} />{label}
    </button>
  )
}

function SnapshotView({
  grouped, markerByKey, seriesByKey, tracked, categoryScores, athleteSex, filterCat, onMarkerClick,
}: {
  grouped: Map<BloodtestCategory, string[]>
  markerByKey: Map<string, BloodtestMarker>
  seriesByKey: Map<string, ValidatedPoint[]>
  tracked: string[]
  categoryScores: Map<BloodtestCategory, { optimal: number; outOfRange: number; total: number }>
  athleteSex?: 'M' | 'F'
  filterCat: BloodtestCategory | 'all'
  onMarkerClick: (key: string) => void
}) {
  const present = CATEGORY_ORDER.filter((c) => grouped.has(c) && (filterCat === 'all' || filterCat === c))
  if (present.length === 0) return <EmptyState icon="fa-droplet" text="Aucun bilan validé pour le moment" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {present.map((cat) => {
        const meta = CATEGORY_META[cat]
        const keys = grouped.get(cat)!
        const score = categoryScores.get(cat)
        return (
          <section key={cat}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${meta.color}1f`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${meta.color}33`,
              }}>
                <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 15 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>{meta.label}</h4>
                {score && score.total > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    <strong style={{ color: '#22c55e' }}>{score.optimal} optimal</strong>
                    {score.outOfRange > 0 && <> · <strong style={{ color: '#ef4444' }}>{score.outOfRange} hors zone</strong></>}
                    {' · '}{keys.length} marqueur{keys.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {score && score.total > 0 && <ScoreRing optimal={score.optimal} total={score.total} color={meta.color} />}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: 12,
            }}>
              {keys.map((key) => (
                <MarkerSnapshotCard
                  key={key}
                  marker={markerByKey.get(key)!}
                  series={seriesByKey.get(key) || []}
                  isTracked={tracked.includes(key)}
                  athleteSex={athleteSex}
                  onClick={() => onMarkerClick(key)}
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
        {optimal}/{total}
      </div>
    </div>
  )
}

function MarkerSnapshotCard({
  marker, series, isTracked, athleteSex, onClick,
}: {
  marker: BloodtestMarker
  series: ValidatedPoint[]
  isTracked: boolean
  athleteSex?: 'M' | 'F'
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  const last = series[series.length - 1]
  const prev = series.length >= 2 ? series[series.length - 2] : undefined
  const color = last?.severity ? severityColor(last.severity) : 'var(--text3)'
  const trend = prev && last ? last.value - prev.value : 0
  const zoneConfig = useResolveZoneConfig(marker, athleteSex)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 14,
        background: 'var(--bg2)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        borderLeft: last?.severity ? `3px solid ${color}` : '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? '0 6px 20px rgba(0,0,0,0.08)' : 'none',
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', lineHeight: 1.2 }}>{marker.label}</div>
        {!isTracked && (
          <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--bg3)', borderRadius: 3, color: 'var(--text3)', fontWeight: 700, letterSpacing: 0.3 }}>EXTRA</span>
        )}
      </div>

      {!last ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune donnée</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: -0.5 }}>{formatVal(last.value)}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{marker.unit_canonical}</span>
            </div>
            {prev && trend !== 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 600,
                color: 'var(--text2)',
                padding: '2px 6px',
                background: 'var(--bg3)',
                borderRadius: 4,
              }}>
                <i className={`fas fa-arrow-${trend > 0 ? 'up' : 'down'}`} style={{ fontSize: 9 }} />
                {trend > 0 ? '+' : ''}{formatVal(trend)}
              </div>
            )}
          </div>

          {zoneConfig && <RangeBar zone={zoneConfig} value={last.value} unit={marker.unit_canonical} />}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            {last.band ? (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 8px',
                background: `${color}26`, color, borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: 0.3,
              }}>
                {last.band}
              </span>
            ) : <span />}
            {series.length >= 2 && (
              <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>
                {series.length} valeur{series.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {series.length >= 2 && <Sparkline series={series} color={color} />}
        </>
      )}
    </button>
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
  const explicitMins = zone.bands.map((b) => b.min).filter((v): v is number => typeof v === 'number')
  const explicitMaxs = zone.bands.map((b) => b.max).filter((v): v is number => typeof v === 'number')
  if (explicitMins.length === 0 || explicitMaxs.length === 0) return null

  const overallMin = Math.min(...explicitMins)
  const overallMax = Math.max(...explicitMaxs)
  const visualMin = Math.min(overallMin, value) - (overallMax - overallMin) * 0.05
  const visualMax = Math.max(overallMax, value) + (overallMax - overallMin) * 0.05
  const range = visualMax - visualMin || 1

  const W = 100
  const segments = zone.bands.map((b) => {
    const start = b.min ?? visualMin
    const end = b.max ?? visualMax
    const startPct = ((start - visualMin) / range) * W
    const endPct = ((end - visualMin) / range) * W
    return { band: b, startPct, width: endPct - startPct, color: severityColor(b.severity) }
  })

  const cursorPct = ((value - visualMin) / range) * W

  return (
    <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', position: 'absolute', top: 4, left: 0, right: 0 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.width}%`, background: `${s.color}88` }}
            title={`${s.band.label}: ${s.band.min ?? '–'} à ${s.band.max ?? '+'} ${unit}`} />
        ))}
      </div>
      <div style={{
        position: 'absolute',
        left: `${Math.max(0, Math.min(100, cursorPct))}%`,
        top: 0,
        transform: 'translateX(-50%)',
        width: 3, height: 14,
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
  grouped, markerByKey, seriesByKey, athleteSex, filterCat,
}: {
  grouped: Map<BloodtestCategory, string[]>
  markerByKey: Map<string, BloodtestMarker>
  seriesByKey: Map<string, ValidatedPoint[]>
  athleteSex?: 'M' | 'F'
  filterCat: BloodtestCategory | 'all'
}) {
  const present = CATEGORY_ORDER.filter((c) => grouped.has(c) && (filterCat === 'all' || filterCat === c))
  if (present.length === 0) return <EmptyState icon="fa-chart-line" text="Aucune tendance — ajoute au moins un bilan validé" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {present.map((cat) => {
        const meta = CATEGORY_META[cat]
        const keys = grouped.get(cat)!
        return (
          <section key={cat}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <i className={`fas ${meta.icon}`} style={{ color: meta.color }} />
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{meta.label}</h4>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
              {keys.map((key) => (
                <TrendChart key={key} marker={markerByKey.get(key)!} series={seriesByKey.get(key) || []} athleteSex={athleteSex} />
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
    const xs = series.map((_, i) => (series.length === 1 ? padX + innerW / 2 : padX + (i / (series.length - 1)) * innerW))
    const ys = series.map((s) => yToPx(s.value))
    const pathD = series.length >= 2 ? series.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]},${ys[i]}`).join(' ') : ''

    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        {zone && zone.bands.map((b, i) => {
          const top = yToPx(b.max ?? yMax)
          const bottom = yToPx(b.min ?? yMin)
          if (top >= bottom) return null
          return <rect key={i} x={padX} y={top} width={innerW} height={bottom - top} fill={severityColor(b.severity)} opacity={0.13} />
        })}
        <text x={padX - 6} y={padY + 4} fill="var(--text3)" fontSize={9} textAnchor="end">{formatVal(yMax)}</text>
        <text x={padX - 6} y={H - padY + 4} fill="var(--text3)" fontSize={9} textAnchor="end">{formatVal(yMin)}</text>
        {pathD && <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
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
    <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{marker.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{marker.unit_canonical}</div>
      </div>
      {chart}
      {last?.band && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, padding: '2px 7px', background: `${lastColor}26`, color: lastColor, borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {last.band}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {series.length} valeur{series.length > 1 ? 's' : ''}</span>
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
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 12,
    }}>
      {uploads.map((u) => {
        const data = u.validated_data as ExtractedData | null
        const date = u.dated_at || u.uploaded_at.slice(0, 10)
        const fileCount = (u.file_path || '').split('|').filter((p: string) => p).length
        const markersCount = data?.markers?.filter((m) => !m.ignored).length || 0
        return (
          <BilanCard
            key={u.id}
            uploadId={u.id}
            date={date}
            fileCount={fileCount}
            markersCount={markersCount}
            validatedAt={u.validated_at}
            onDelete={() => onDelete(u.id)}
            onViewPdf={() => onViewPdf(u.id)}
          />
        )
      })}
    </div>
  )
}

function BilanCard({
  uploadId, date, fileCount, markersCount, validatedAt, onDelete, onViewPdf,
}: {
  uploadId: string
  date: string
  fileCount: number
  markersCount: number
  validatedAt?: string | null
  onDelete: () => void
  onViewPdf: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 16,
        background: 'var(--bg2)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'all 150ms',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? '0 6px 20px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(168,85,247,0.10) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid var(--border)',
        }}>
          <i className="fas fa-file-medical" style={{ color: '#ef4444', fontSize: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
            {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            <strong style={{ color: 'var(--text2)' }}>{markersCount}</strong> marqueur{markersCount > 1 ? 's' : ''}
            {' · '}{fileCount} fichier{fileCount > 1 ? 's' : ''}
          </div>
          {validatedAt && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 600,
              marginTop: 6,
              padding: '2px 7px',
              background: 'rgba(34,197,94,0.12)',
              color: '#22c55e',
              borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              <i className="fas fa-check" style={{ fontSize: 8 }} />
              Validé {new Date(validatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={onViewPdf}
          style={{
            flex: '1 1 auto',
            padding: '8px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', color: 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 100ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg)' }}
        >
          <i className="fas fa-eye" style={{ fontSize: 11 }} />
          Voir le document
        </button>
        <button
          onClick={() => { if (confirm('Supprimer ce bilan ? Les valeurs validées seront perdues.')) onDelete() }}
          title="Supprimer"
          style={{
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 100ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = '#ef4444' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          <i className="fas fa-trash-can" style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  )
}

function MarkerDetailModal({
  marker, series, athleteSex, onClose,
}: {
  marker: BloodtestMarker
  series: ValidatedPoint[]
  athleteSex?: 'M' | 'F'
  onClose: () => void
}) {
  const last = series[series.length - 1]
  const color = last?.severity ? severityColor(last.severity) : 'var(--text3)'
  const meta = CATEGORY_META[marker.category]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 16,
          maxWidth: 540, width: '100%',
          maxHeight: '85vh', overflow: 'auto',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{
          padding: 20,
          borderBottom: '1px solid var(--border)',
          background: `linear-gradient(135deg, ${meta.color}10 0%, transparent 100%)`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${meta.color}1f`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 16 }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{marker.label}</h3>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {meta.label} · {marker.unit_canonical}
            </div>
          </div>
          <a
            href="/profile/marqueurs-sanguins"
            title="Personnaliser les plages cliniques"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            <i className="fas fa-sliders" style={{ fontSize: 12 }} />
          </a>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text)',
            }}
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!last ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Aucune donnée</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1, letterSpacing: -1 }}>{formatVal(last.value)}</span>
                <span style={{ fontSize: 14, color: 'var(--text3)' }}>{marker.unit_canonical}</span>
                {last.band && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 11, fontWeight: 700,
                    padding: '4px 10px',
                    background: `${color}20`, color, borderRadius: 6,
                    textTransform: 'uppercase', letterSpacing: 0.3,
                  }}>
                    {last.band}
                  </span>
                )}
              </div>

              <TrendChart marker={marker} series={series} athleteSex={athleteSex} />

              {series.length > 1 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginBottom: 8 }}>
                    Historique ({series.length} valeurs)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[...series].reverse().map((p, i) => {
                      const pColor = p.severity ? severityColor(p.severity) : 'var(--text3)'
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px',
                          background: i === 0 ? 'var(--bg2)' : 'transparent',
                          borderRadius: 8,
                          fontSize: 13,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: pColor, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text2)', flex: 1 }}>
                            {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <strong style={{ color: pColor, fontWeight: 700 }}>
                            {formatVal(p.value)} {marker.unit_canonical}
                          </strong>
                          {p.band && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              padding: '1px 6px',
                              background: `${pColor}20`, color: pColor, borderRadius: 3,
                              textTransform: 'uppercase', letterSpacing: 0.3,
                            }}>
                              {p.band}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
