'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/ui/Skeleton'
import { MARKERS, type BloodtestCategory, type BloodtestMarker, type ZoneConfig, type ZoneBand, type SexSpecificZones } from '@/lib/bloodtestCatalog'
import { severityColor, type ZoneOverrides } from '@/lib/bloodtest'

type CustomMarkerRow = { id: string; marker_key: string; label: string; unit_canonical: string; category: string; zones: any }

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

type Source = 'catalog' | 'custom'
type Editable = {
  source: Source
  marker: BloodtestMarker
  customRowId?: string  // only for source==='custom'
  isOverridden: boolean // catalog: zones differ from default ; custom: always true (own)
}

export default function BloodtestZonesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState<ZoneOverrides>({})
  const [customs, setCustoms] = useState<CustomMarkerRow[]>([])
  const [editing, setEditing] = useState<Editable | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const [{ data: cp }, { data: cms }] = await Promise.all([
        supabase.from('coach_profiles').select('bloodtest_zone_overrides').eq('user_id', user.id).maybeSingle(),
        supabase.from('coach_custom_markers').select('id, marker_key, label, unit_canonical, category, zones').is('archived_at', null),
      ])
      setOverrides(((cp as any)?.bloodtest_zone_overrides as ZoneOverrides) || {})
      setCustoms((cms || []) as CustomMarkerRow[])
    } finally {
      setLoading(false)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const allEditables: Editable[] = useMemo(() => {
    const cataItems: Editable[] = MARKERS.map((m) => ({
      source: 'catalog' as const,
      marker: overrides[m.key] ? { ...m, zones: overrides[m.key] as any } : m,
      isOverridden: !!overrides[m.key],
    }))
    const customItems: Editable[] = customs.map((cm) => ({
      source: 'custom' as const,
      marker: {
        key: cm.marker_key,
        label: cm.label,
        unit_canonical: cm.unit_canonical,
        unit_aliases: [],
        category: cm.category as BloodtestCategory,
        zones: cm.zones,
        presets: [],
      },
      customRowId: cm.id,
      isOverridden: true,
    }))
    return [...cataItems, ...customItems]
  }, [overrides, customs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allEditables
    return allEditables.filter((e) => e.marker.label.toLowerCase().includes(q) || e.marker.key.toLowerCase().includes(q))
  }, [allEditables, search])

  const grouped = useMemo(() => {
    const map = new Map<BloodtestCategory, Editable[]>()
    for (const e of filtered) {
      const arr = map.get(e.marker.category) || []
      arr.push(e)
      map.set(e.marker.category, arr)
    }
    return map
  }, [filtered])

  async function saveCatalogOverride(key: string, zones: any) {
    if (!user?.id) return
    setSaving(true)
    const next = { ...overrides, [key]: zones }
    const { error } = await supabase.from('coach_profiles').update({ bloodtest_zone_overrides: next }).eq('user_id', user.id)
    setSaving(false)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return false }
    setOverrides(next)
    toast('Plages enregistrées', 'success')
    return true
  }

  async function resetCatalog(key: string) {
    if (!user?.id) return
    if (!confirm('Réinitialiser ce marqueur aux plages par défaut du catalogue ?')) return
    setSaving(true)
    const next = { ...overrides }
    delete next[key]
    const { error } = await supabase.from('coach_profiles').update({ bloodtest_zone_overrides: next }).eq('user_id', user.id)
    setSaving(false)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    setOverrides(next)
    toast('Réinitialisé', 'success')
    setEditing(null)
  }

  async function saveCustomZones(rowId: string, zones: any) {
    setSaving(true)
    const { error } = await supabase.from('coach_custom_markers').update({ zones }).eq('id', rowId)
    setSaving(false)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return false }
    setCustoms((prev) => prev.map((c) => (c.id === rowId ? { ...c, zones } : c)))
    toast('Plages enregistrées', 'success')
    return true
  }

  if (loading) return <Skeleton height={500} borderRadius={12} />

  const presentCats = CATEGORY_ORDER.filter((c) => grouped.has(c))
  const overrideCount = Object.keys(overrides).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => router.back()} className="btn btn-outline btn-sm">
          <i className="fas fa-arrow-left" /> Retour
        </button>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.4 }}>
          <i className="fas fa-flask-vial" style={{ color: '#ef4444', marginRight: 10 }} />
          Plages cliniques des marqueurs
        </h2>
      </div>

      <div style={{
        padding: 14, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            Personnalise les plages optimal / limite / hors zone
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            S'applique à <strong>tous tes athlètes</strong>. Chaque coach a ses propres plages.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Stat label="Catalogue" value={MARKERS.length} />
          <Stat label="Custom" value={customs.length} color="#a855f7" />
          <Stat label="Personnalisés" value={overrideCount} color={overrideCount > 0 ? '#22c55e' : 'var(--text3)'} />
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 320 }}>
        <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 12 }} />
        <input
          type="text" placeholder="Rechercher un marqueur..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="form-control"
          style={{ paddingLeft: 34 }}
        />
      </div>

      {presentCats.length === 0 && (
        <div style={{ textAlign: 'center', padding: 36, background: 'var(--bg2)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          Aucun marqueur ne correspond à <strong>« {search} »</strong>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {presentCats.map((cat) => {
          const items = grouped.get(cat)!
          const meta = CATEGORY_META[cat]
          const overriddenInCat = items.filter((i) => i.source === 'catalog' && i.isOverridden).length
          return (
            <section key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${meta.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 12 }} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{meta.label}</h3>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {items.length} marqueur{items.length > 1 ? 's' : ''}
                  {overriddenInCat > 0 && <> · <strong style={{ color: '#22c55e' }}>{overriddenInCat} personnalisé{overriddenInCat > 1 ? 's' : ''}</strong></>}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
                {items.map((e) => (
                  <MarkerRow key={e.marker.key} editable={e} onClick={() => setEditing(e)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {editing && (
        <ZoneEditorModal
          editable={editing}
          onClose={() => setEditing(null)}
          onSave={async (zones) => {
            const ok = editing.source === 'catalog'
              ? await saveCatalogOverride(editing.marker.key, zones)
              : await saveCustomZones(editing.customRowId!, zones)
            if (ok) setEditing(null)
          }}
          onReset={editing.source === 'catalog' && editing.isOverridden ? () => resetCatalog(editing.marker.key) : undefined}
          saving={saving}
        />
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function MarkerRow({ editable, onClick }: { editable: Editable; onClick: () => void }) {
  const meta = CATEGORY_META[editable.marker.category]
  const summary = useMemo(() => zoneSummary(editable.marker.zones), [editable.marker.zones])
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
        cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
        transition: 'all 100ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = meta.color }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{editable.marker.label}</span>
          {editable.source === 'custom' && (
            <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(168,85,247,0.18)', color: '#c4a8f7', borderRadius: 3, fontWeight: 700, letterSpacing: 0.3 }}>CUSTOM</span>
          )}
          {editable.source === 'catalog' && editable.isOverridden && (
            <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(34,197,94,0.18)', color: '#86efac', borderRadius: 3, fontWeight: 700, letterSpacing: 0.3 }}>PERSO</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summary}
        </div>
      </div>
      <i className="fas fa-pen" style={{ color: 'var(--text3)', fontSize: 11 }} />
    </button>
  )
}

function zoneSummary(zones: any): string {
  if (!zones) return 'Pas de plages définies'
  if ('direction' in zones) return bandsSummary(zones.bands)
  const ss = zones.sex_specific
  if (ss) {
    const parts: string[] = []
    if (ss.male) parts.push(`M: ${bandsSummary(ss.male.bands)}`)
    if (ss.female) parts.push(`F: ${bandsSummary(ss.female.bands)}`)
    return parts.join(' · ') || 'Pas de plages définies'
  }
  return 'Pas de plages définies'
}

function bandsSummary(bands: ZoneBand[]): string {
  if (!bands || bands.length === 0) return 'Aucune'
  return bands.map((b) => {
    const range = b.min != null && b.max != null ? `${b.min}-${b.max}` : b.min != null ? `≥${b.min}` : b.max != null ? `<${b.max}` : '—'
    return `${range}`
  }).join(' · ')
}

// ─────────────────────────────────────────────────────────────────────────
// Editor modal
// ─────────────────────────────────────────────────────────────────────────

type EditorState = {
  sexSpecific: boolean
  flat: ZoneConfig
  male: ZoneConfig
  female: ZoneConfig
}

function initialEditor(zones: any): EditorState {
  if (zones && 'direction' in zones) {
    return { sexSpecific: false, flat: cloneZone(zones) ?? emptyZone(), male: emptyZone(), female: emptyZone() }
  }
  if (zones?.sex_specific) {
    const male = cloneZone(zones.sex_specific.male) ?? emptyZone()
    const female = cloneZone(zones.sex_specific.female) ?? emptyZone()
    return { sexSpecific: true, flat: emptyZone(), male, female }
  }
  return { sexSpecific: false, flat: emptyZone(), male: emptyZone(), female: emptyZone() }
}

function emptyZone(): ZoneConfig {
  return { direction: 'range_is_normal', bands: [{ label: 'normal', severity: 1 }] }
}

function cloneZone(z: any): ZoneConfig | null {
  if (!z || !('direction' in z)) return null
  return { direction: z.direction, bands: z.bands.map((b: ZoneBand) => ({ ...b })) }
}

function ZoneEditorModal({
  editable, onClose, onSave, onReset, saving,
}: {
  editable: Editable
  onClose: () => void
  onSave: (zones: any) => void
  onReset?: () => void
  saving: boolean
}) {
  const [state, setState] = useState<EditorState>(() => initialEditor(editable.marker.zones))
  const meta = CATEGORY_META[editable.marker.category]

  function buildOutput() {
    if (state.sexSpecific) {
      const ss: SexSpecificZones = {}
      if (state.male.bands.length > 0) ss.male = state.male
      if (state.female.bands.length > 0) ss.female = state.female
      return { sex_specific: ss }
    }
    return state.flat
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', borderRadius: 14, maxWidth: 640, width: '100%',
          maxHeight: '90vh', overflow: 'auto',
          border: '1px solid var(--border)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: `linear-gradient(135deg, ${meta.color}10 0%, transparent 100%)`,
          position: 'sticky', top: 0, zIndex: 1,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${meta.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`fas ${meta.icon}`} style={{ color: meta.color, fontSize: 14 }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editable.marker.label}</h3>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{meta.label} · {editable.marker.unit_canonical}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Sex-specific toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={state.sexSpecific}
              onChange={(e) => setState((s) => ({ ...s, sexSpecific: e.target.checked }))}
            />
            <strong>Plages spécifiques par sexe</strong>
            <span style={{ color: 'var(--text3)', fontSize: 11 }}>(M et F séparés)</span>
          </label>

          {state.sexSpecific ? (
            <>
              <ZoneSubEditor
                title="Hommes"
                color="#3b82f6"
                zone={state.male}
                onChange={(z) => setState((s) => ({ ...s, male: z }))}
                unit={editable.marker.unit_canonical}
              />
              <ZoneSubEditor
                title="Femmes"
                color="#ec4899"
                zone={state.female}
                onChange={(z) => setState((s) => ({ ...s, female: z }))}
                unit={editable.marker.unit_canonical}
              />
            </>
          ) : (
            <ZoneSubEditor
              title="Plages"
              zone={state.flat}
              onChange={(z) => setState((s) => ({ ...s, flat: z }))}
              unit={editable.marker.unit_canonical}
            />
          )}
        </div>

        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap',
          position: 'sticky', bottom: 0, background: 'var(--bg)',
        }}>
          {onReset ? (
            <button className="btn btn-outline btn-sm" onClick={onReset} disabled={saving} style={{ color: 'var(--text3)' }}>
              <i className="fas fa-rotate-left" /> Réinitialiser au défaut
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>Annuler</button>
            <button className="btn btn-red" onClick={() => onSave(buildOutput())} disabled={saving}>
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ZoneSubEditor({
  title, color, zone, onChange, unit,
}: {
  title: string
  color?: string
  zone: ZoneConfig
  onChange: (z: ZoneConfig) => void
  unit: string
}) {
  function updateBand(idx: number, patch: Partial<ZoneBand>) {
    onChange({ ...zone, bands: zone.bands.map((b, i) => (i === idx ? { ...b, ...patch } : b)) })
  }
  function removeBand(idx: number) {
    onChange({ ...zone, bands: zone.bands.filter((_, i) => i !== idx) })
  }
  function addBand() {
    onChange({ ...zone, bands: [...zone.bands, { label: 'nouveau', severity: 1 }] })
  }

  return (
    <div style={{ padding: 12, background: 'var(--bg2)', borderRadius: 10, border: color ? `1px solid ${color}33` : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {color && <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />}
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <select
          value={zone.direction}
          onChange={(e) => onChange({ ...zone, direction: e.target.value as ZoneConfig['direction'] })}
          className="form-control"
          style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px', maxWidth: 220 }}
        >
          <option value="range_is_normal">Plage normale (range)</option>
          <option value="higher_is_better">Plus haut = mieux</option>
          <option value="lower_is_better">Plus bas = mieux</option>
        </select>
      </div>

      {/* Color preview bar */}
      <PreviewBar bands={zone.bands} unit={unit} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {zone.bands.map((b, i) => (
          <BandRow key={i} band={b} unit={unit} onChange={(patch) => updateBand(i, patch)} onRemove={() => removeBand(i)} />
        ))}
        <button
          onClick={addBand}
          style={{
            padding: '8px 12px', background: 'transparent',
            border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer',
            color: 'var(--text3)', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <i className="fas fa-plus" /> Ajouter une plage
        </button>
      </div>
    </div>
  )
}

const SEVERITY_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: 'Optimal',
  2: 'Surveiller',
  3: 'Hors zone',
  4: 'Critique',
}

function BandRow({
  band, unit, onChange, onRemove,
}: {
  band: ZoneBand
  unit: string
  onChange: (patch: Partial<ZoneBand>) => void
  onRemove: () => void
}) {
  const color = severityColor(band.severity)
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '14px minmax(110px, 1.4fr) minmax(120px, 1fr) minmax(80px, 0.7fr) minmax(80px, 0.7fr) 28px',
      gap: 6, alignItems: 'center',
      padding: 6, background: 'var(--bg)', borderRadius: 6,
    }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, justifySelf: 'center' }} />
      <input
        type="text"
        placeholder="Label (ex: optimal)"
        className="form-control"
        value={band.label}
        onChange={(e) => onChange({ label: e.target.value })}
        style={{ fontSize: 12, padding: '5px 8px' }}
      />
      <select
        value={band.severity}
        onChange={(e) => onChange({ severity: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
        className="form-control"
        style={{ fontSize: 12, padding: '5px 8px', color, fontWeight: 600 }}
      >
        {([1, 2, 3, 4] as const).map((s) => (
          <option key={s} value={s}>{s} — {SEVERITY_LABEL[s]}</option>
        ))}
      </select>
      <input
        type="number" step="any"
        placeholder="Min"
        className="form-control"
        value={band.min ?? ''}
        onChange={(e) => onChange({ min: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
        style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right' }}
      />
      <input
        type="number" step="any"
        placeholder="Max"
        className="form-control"
        value={band.max ?? ''}
        onChange={(e) => onChange({ max: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
        style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right' }}
      />
      <button
        onClick={onRemove}
        title="Supprimer"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
      >
        <i className="fas fa-times" />
      </button>
    </div>
  )
}

function PreviewBar({ bands, unit }: { bands: ZoneBand[]; unit: string }) {
  const valid = bands.filter((b) => b.min != null || b.max != null)
  if (valid.length === 0) return (
    <div style={{ fontSize: 11, color: 'var(--text3)', padding: 6, fontStyle: 'italic' }}>
      Pas d'aperçu : ajoute min/max pour visualiser les plages
    </div>
  )
  const mins = valid.map((b) => b.min).filter((v): v is number => typeof v === 'number')
  const maxs = valid.map((b) => b.max).filter((v): v is number => typeof v === 'number')
  if (mins.length === 0 || maxs.length === 0) return null
  const overallMin = Math.min(...mins)
  const overallMax = Math.max(...maxs)
  const range = overallMax - overallMin || 1
  return (
    <div style={{ marginTop: 4, marginBottom: 6 }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, marginBottom: 4 }}>Aperçu</div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {bands.map((b, i) => {
          const start = b.min ?? overallMin
          const end = b.max ?? overallMax
          const width = ((end - start) / range) * 100
          if (width <= 0) return null
          return (
            <div
              key={i}
              title={`${b.label}: ${b.min ?? '—'} → ${b.max ?? '+∞'} ${unit}`}
              style={{
                width: `${width}%`,
                background: severityColor(b.severity),
                borderRight: i < bands.length - 1 ? '1px solid var(--bg)' : 'none',
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>
        <span>{overallMin}</span>
        <span>{overallMax} {unit}</span>
      </div>
    </div>
  )
}
