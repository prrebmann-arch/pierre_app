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

export default function PanelSuivi({
  tracked,
  customMarkers,
  onApplyPreset,
  onToggleMarker,
  onOpenCustomModal,
  athleteFirstName,
}: {
  tracked: string[]
  customMarkers: { marker_key: string; label: string; unit_canonical: string; category: string }[]
  onApplyPreset: (preset: BloodtestPreset) => void
  onToggleMarker: (key: string) => void
  onOpenCustomModal: () => void
  athleteFirstName?: string
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [copied, setCopied] = useState(false)

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

  const grouped = useMemo(() => {
    const map = new Map<BloodtestCategory, BloodtestMarker[]>()
    for (const m of allMarkers) {
      const arr = map.get(m.category) || []
      arr.push(m)
      map.set(m.category, arr)
    }
    return map
  }, [allMarkers])

  const trackedSet = new Set(tracked)

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
    <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', background: 'var(--bg3)' }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <i className="fas fa-list-check" style={{ color: 'var(--primary)' }} />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Panel suivi</h3>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {tracked.length} marker{tracked.length > 1 ? 's' : ''} sélectionné{tracked.length > 1 ? 's' : ''} · clique pour {collapsed ? 'modifier' : 'replier'}
          </div>
        </div>
        <button
          className="btn btn-red btn-sm"
          onClick={(e) => { e.stopPropagation(); copyForWhatsApp() }}
          disabled={trackedMarkers.length === 0}
          title="Copie la liste formatée pour WhatsApp"
        >
          <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} /> {copied ? 'Copié !' : 'Copier liste'}
        </button>
        <i className={`fas fa-chevron-${collapsed ? 'right' : 'down'}`} style={{ color: 'var(--text3)', fontSize: 11 }} />
      </div>

      {!collapsed && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginRight: 4 }}>Presets :</span>
            <button className="btn btn-outline btn-sm" onClick={() => onApplyPreset('basic')}>
              <i className="fas fa-circle-check" /> Basic
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => onApplyPreset('hormonal_plus')}>
              <i className="fas fa-dna" /> Hormonal+
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => onApplyPreset('total')}>
              <i className="fas fa-layer-group" /> Total
            </button>
            <button className="btn btn-outline btn-sm" onClick={onOpenCustomModal} style={{ marginLeft: 'auto' }}>
              <i className="fas fa-plus" /> Marker custom
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {present.map((cat) => {
              const meta = CATEGORY_META[cat]
              const ms = grouped.get(cat)!
              const onCount = ms.filter((m) => trackedSet.has(m.key)).length
              const allOn = onCount === ms.length
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: `${meta.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 11 }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>{meta.label.toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{onCount}/{ms.length}</div>
                    <button
                      onClick={() => {
                        // Toggle bulk : si tous on, off all ; sinon on all
                        const targets = ms.map((m) => m.key)
                        if (allOn) targets.forEach((k) => trackedSet.has(k) && onToggleMarker(k))
                        else targets.forEach((k) => !trackedSet.has(k) && onToggleMarker(k))
                      }}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text3)',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '2px 6px',
                      }}
                    >
                      {allOn ? 'Décocher tout' : 'Cocher tout'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4 }}>
                    {ms.map((m) => {
                      const on = trackedSet.has(m.key)
                      return (
                        <button
                          key={m.key}
                          onClick={() => onToggleMarker(m.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            background: on ? `${meta.color}1a` : 'var(--bg)',
                            border: on ? `1px solid ${meta.color}66` : '1px solid var(--border)',
                            borderRadius: 6,
                            fontSize: 12,
                            cursor: 'pointer',
                            color: 'var(--text)',
                            textAlign: 'left',
                            transition: 'all 100ms',
                          }}
                        >
                          <span style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            border: on ? `1.5px solid ${meta.color}` : '1.5px solid var(--text3)',
                            background: on ? meta.color : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {on && <i className="fas fa-check" style={{ color: 'white', fontSize: 8 }} />}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
