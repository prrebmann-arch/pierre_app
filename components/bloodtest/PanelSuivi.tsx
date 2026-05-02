'use client'

import { useMemo, useState } from 'react'
import { MARKERS, PRESETS, type BloodtestPreset, type BloodtestCategory, type BloodtestMarker } from '@/lib/bloodtestCatalog'

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

const PRESET_META: Record<BloodtestPreset, { label: string; icon: string; subtitle: string }> = {
  basic: { label: 'Basic', icon: 'fa-circle-check', subtitle: '~9 marqueurs' },
  hormonal_plus: { label: 'Hormonal+', icon: 'fa-dna', subtitle: '~18 marqueurs' },
  total: { label: 'Total', icon: 'fa-layer-group', subtitle: 'tous les marqueurs' },
}

export default function PanelSuivi({
  tracked,
  customMarkers,
  onApplyPreset,
  onToggleMarker,
  onSetTrackedKeys,
  onOpenCustomModal,
  athleteFirstName,
}: {
  tracked: string[]
  customMarkers: { marker_key: string; label: string; unit_canonical: string; category: string }[]
  onApplyPreset: (preset: BloodtestPreset) => void
  onToggleMarker: (key: string) => void
  onSetTrackedKeys?: (next: string[]) => void
  onOpenCustomModal: () => void
  athleteFirstName?: string
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')

  const allMarkers: BloodtestMarker[] = useMemo(() => [
    ...MARKERS,
    ...customMarkers.map((cm) => ({
      key: cm.marker_key,
      label: cm.label,
      unit_canonical: cm.unit_canonical,
      unit_aliases: [],
      category: cm.category as BloodtestCategory,
      zones: { direction: 'higher_is_better' as const, bands: [] },
      presets: [],
    })),
  ], [customMarkers])

  const filteredMarkers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allMarkers
    return allMarkers.filter((m) => m.label.toLowerCase().includes(q) || m.key.toLowerCase().includes(q))
  }, [allMarkers, search])

  const grouped = useMemo(() => {
    const map = new Map<BloodtestCategory, BloodtestMarker[]>()
    for (const m of filteredMarkers) {
      const arr = map.get(m.category) || []
      arr.push(m)
      map.set(m.category, arr)
    }
    return map
  }, [filteredMarkers])

  const trackedSet = useMemo(() => new Set(tracked), [tracked])

  const trackedMarkers = useMemo(
    () => tracked.map((k) => allMarkers.find((m) => m.key === k)).filter(Boolean) as BloodtestMarker[],
    [tracked, allMarkers],
  )

  function copyForWhatsApp() {
    const groupedTracked = new Map<BloodtestCategory, BloodtestMarker[]>()
    for (const m of trackedMarkers) {
      const arr = groupedTracked.get(m.category) || []
      arr.push(m)
      groupedTracked.set(m.category, arr)
    }
    const lines: string[] = []
    lines.push(`🩸 Prise de sang à demander${athleteFirstName ? ` pour ${athleteFirstName}` : ''} :`)
    lines.push('')
    for (const cat of CATEGORY_ORDER) {
      const ms = groupedTracked.get(cat)
      if (!ms || ms.length === 0) continue
      const meta = CATEGORY_META[cat]
      lines.push(`*${meta.label}*`)
      for (const m of ms) lines.push(`• ${m.label}`)
      lines.push('')
    }
    lines.push(`Total : ${trackedMarkers.length} marqueur${trackedMarkers.length > 1 ? 's' : ''}`)
    const text = lines.join('\n').trim()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const present = CATEGORY_ORDER.filter((c) => grouped.has(c))

  return (
    <div style={{
      background: 'var(--bg2)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 18px',
          background: collapsed
            ? 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(168,85,247,0.04) 100%)'
            : 'var(--bg3)',
          cursor: 'pointer',
          transition: 'background 200ms',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg, #ef4444 0%, #a855f7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(239,68,68,0.25)',
        }}>
          <i className="fas fa-flask-vial" style={{ color: 'white', fontSize: 15 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>Marqueurs à demander</h3>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            {tracked.length === 0
              ? 'Aucun marqueur sélectionné'
              : <><strong style={{ color: 'var(--text)' }}>{tracked.length}</strong> sélectionné{tracked.length > 1 ? 's' : ''} · clique pour {collapsed ? 'modifier la sélection' : 'replier'}</>
            }
          </div>
        </div>
        <button
          className="btn btn-sm"
          onClick={(e) => { e.stopPropagation(); copyForWhatsApp() }}
          disabled={trackedMarkers.length === 0}
          title="Copie la liste formatée pour WhatsApp"
          style={{
            background: copied ? '#22c55e' : 'linear-gradient(135deg, #ef4444 0%, #c026d3 100%)',
            color: 'white',
            border: 'none',
            fontWeight: 600,
            padding: '8px 14px',
            opacity: trackedMarkers.length === 0 ? 0.4 : 1,
            transition: 'background 200ms, transform 100ms',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: trackedMarkers.length === 0 ? 'none' : '0 2px 8px rgba(239,68,68,0.3)',
          }}
        >
          <i className={`fab fa-whatsapp`} style={{ fontSize: 14 }} />
          {copied ? 'Copié !' : 'Copier pour WhatsApp'}
        </button>
        <i className={`fas fa-chevron-${collapsed ? 'down' : 'up'}`} style={{ color: 'var(--text3)', fontSize: 12 }} />
      </div>

      {!collapsed && (
        <div style={{ padding: 18, background: 'var(--bg2)' }}>
          {/* Search + presets bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
              <i className="fas fa-search" style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', fontSize: 12,
              }} />
              <input
                type="text"
                placeholder="Rechercher un marqueur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border 100ms',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text3)',
                    cursor: 'pointer', padding: 4,
                  }}
                >
                  <i className="fas fa-times" style={{ fontSize: 11 }} />
                </button>
              )}
            </div>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
            {(['basic', 'hormonal_plus', 'total'] as BloodtestPreset[]).map((p) => {
              const meta = PRESET_META[p]
              return (
                <button
                  key={p}
                  onClick={() => onApplyPreset(p)}
                  style={{
                    flex: '1 1 130px',
                    padding: '10px 14px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 120ms',
                    textAlign: 'left',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <i className={`fas ${meta.icon}`} style={{ fontSize: 12, color: 'var(--primary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{meta.subtitle}</div>
                </button>
              )
            })}
            <button
              onClick={onOpenCustomModal}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 10,
                cursor: 'pointer',
                color: 'var(--text3)',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600,
                transition: 'all 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
            >
              <i className="fas fa-plus" style={{ fontSize: 11 }} />
              Marker custom
            </button>
          </div>

          {/* Categories */}
          {present.length === 0 && (
            <div style={{
              textAlign: 'center', padding: 32,
              background: 'var(--bg)', borderRadius: 10,
              color: 'var(--text3)', fontSize: 13,
            }}>
              <i className="fas fa-search" style={{ fontSize: 24, marginBottom: 8, display: 'block', opacity: 0.4 }} />
              Aucun marqueur ne correspond à <strong>« {search} »</strong>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {present.map((cat) => {
              const meta = CATEGORY_META[cat]
              const ms = grouped.get(cat)!
              const onCount = ms.filter((m) => trackedSet.has(m.key)).length
              const allOn = onCount === ms.length && ms.length > 0
              return (
                <CategorySection
                  key={cat}
                  category={cat}
                  meta={meta}
                  markers={ms}
                  trackedSet={trackedSet}
                  tracked={tracked}
                  onCount={onCount}
                  allOn={allOn}
                  onToggle={onToggleMarker}
                  onSetTrackedKeys={onSetTrackedKeys}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CategorySection({
  meta, markers, trackedSet, tracked, onCount, allOn, onToggle, onSetTrackedKeys,
}: {
  category: BloodtestCategory
  meta: { label: string; icon: string; color: string }
  markers: BloodtestMarker[]
  trackedSet: Set<string>
  tracked: string[]
  onCount: number
  allOn: boolean
  onToggle: (key: string) => void
  onSetTrackedKeys?: (next: string[]) => void
}) {
  function bulkToggle() {
    const keys = markers.map((m) => m.key)
    if (onSetTrackedKeys) {
      // Bulk = single DB write, évite les race conditions de toggle séquentiel
      const next = allOn
        ? tracked.filter((k) => !keys.includes(k))
        : Array.from(new Set([...tracked, ...keys]))
      onSetTrackedKeys(next)
      return
    }
    // Fallback : toggle séquentiel (ne marche bien que pour 1 marker)
    if (allOn) keys.forEach((k) => trackedSet.has(k) && onToggle(k))
    else keys.forEach((k) => !trackedSet.has(k) && onToggle(k))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${meta.color}1f`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 12 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
            {onCount} sur {markers.length} sélectionné{onCount > 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={bulkToggle}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            padding: '5px 10px',
            borderRadius: 6,
            transition: 'all 100ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg)' }}
        >
          {allOn ? 'Tout décocher' : 'Tout cocher'}
        </button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 6,
      }}>
        {markers.map((m) => (
          <MarkerChip
            key={m.key}
            marker={m}
            on={trackedSet.has(m.key)}
            color={meta.color}
            onClick={() => onToggle(m.key)}
          />
        ))}
      </div>
    </div>
  )
}

function MarkerChip({ marker, on, color, onClick }: {
  marker: BloodtestMarker
  on: boolean
  color: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 11px',
        background: on
          ? `${color}1a`
          : hover ? 'var(--bg3)' : 'var(--bg)',
        border: on
          ? `1.5px solid ${color}80`
          : `1px solid var(--border)`,
        borderRadius: 8,
        fontSize: 12,
        cursor: 'pointer',
        color: 'var(--text)',
        textAlign: 'left',
        transition: 'all 100ms',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        border: on ? `1.5px solid ${color}` : '1.5px solid var(--text3)',
        background: on ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 100ms',
      }}>
        {on && <i className="fas fa-check" style={{ color: 'white', fontSize: 9 }} />}
      </span>
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
        fontWeight: on ? 600 : 500,
      }}>{marker.label}</span>
      <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{marker.unit_canonical}</span>
    </button>
  )
}
