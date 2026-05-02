'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/ui/Skeleton'
import { MARKERS } from '@/lib/bloodtestCatalog'
import { splitMarkers, classifyValue, severityColor, type BloodtestUploadRow, type ExtractedData, type ExtractedMarker } from '@/lib/bloodtest'

type CustomMarkerOpt = { key: string; label: string; unit_canonical: string }
type SignedFile = { path: string; url: string; mediaType: string }

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'hema', label: 'Hématologie' },
  { value: 'iron', label: 'Fer' },
  { value: 'vitamin', label: 'Vitamine' },
  { value: 'mineral', label: 'Minéral' },
  { value: 'hormone_sex', label: 'Hormone sexuelle' },
  { value: 'thyroid', label: 'Thyroïde' },
  { value: 'inflammation', label: 'Inflammation' },
  { value: 'metabolism', label: 'Métabolisme' },
  { value: 'liver', label: 'Hépatique' },
  { value: 'lipid', label: 'Lipide' },
]

export default function BloodtestValidatePage() {
  const params = useParams<{ id: string; upload_id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { accessToken } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [upload, setUpload] = useState<BloodtestUploadRow | null>(null)
  const [signedFiles, setSignedFiles] = useState<SignedFile[]>([])
  const [editedMarkers, setEditedMarkers] = useState<ExtractedMarker[]>([])
  const [tracked, setTracked] = useState<string[]>([])
  const [datedAt, setDatedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customMarkers, setCustomMarkers] = useState<CustomMarkerOpt[]>([])
  const [showUnidentified, setShowUnidentified] = useState(false)
  const [collapsePdf, setCollapsePdf] = useState(false)
  const [creatingFor, setCreatingFor] = useState<ExtractedMarker | null>(null)

  const load = useCallback(async () => {
    try {
      const [{ data: row }, urlRes, { data: cms }] = await Promise.all([
        supabase.from('bloodtest_uploads').select('*').eq('id', params.upload_id).single(),
        fetch(`/api/bloodtest/signed-url?id=${params.upload_id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()),
        supabase.from('coach_custom_markers').select('marker_key, label, unit_canonical').is('archived_at', null),
      ])
      if (!row) { toast('Upload introuvable', 'error'); return }
      setUpload(row as BloodtestUploadRow)
      const { data: ath } = await supabase.from('athletes').select('bloodtest_tracked_markers').eq('id', (row as any).athlete_id).single()
      setTracked(((ath as any)?.bloodtest_tracked_markers as string[]) || [])
      const files: SignedFile[] = Array.isArray(urlRes.urls) && urlRes.urls.length > 0
        ? urlRes.urls
        : urlRes.url ? [{ path: '', url: urlRes.url, mediaType: 'application/pdf' }] : []
      setSignedFiles(files)
      const data = ((row as any).validated_data || (row as any).extracted_data) as ExtractedData | null
      setEditedMarkers(data?.markers || [])
      setDatedAt((row as any).dated_at || (data?.detected_dated_at || ''))
      setCustomMarkers((cms || []).map((c: any) => ({ key: c.marker_key, label: c.label, unit_canonical: c.unit_canonical })))
    } finally { setLoading(false) }
  }, [params.upload_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const allMarkerOptions = useMemo(
    () => [...MARKERS.map((m) => ({ key: m.key, label: m.label, unit_canonical: m.unit_canonical })), ...customMarkers],
    [customMarkers],
  )
  const labelByKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of allMarkerOptions) m.set(o.key, o.label)
    return m
  }, [allMarkerOptions])
  const markerByKey = useMemo(() => {
    const m = new Map<string, any>()
    for (const mk of MARKERS) m.set(mk.key, mk)
    return m
  }, [])

  const split = useMemo(() => splitMarkers(editedMarkers, tracked), [editedMarkers, tracked])

  function updateMarkerByRef(target: ExtractedMarker, patch: Partial<ExtractedMarker>) {
    setEditedMarkers((prev) => prev.map((m) => (m === target ? { ...m, ...patch } : m)))
  }

  function bulkConfirmExtras() {
    setEditedMarkers((prev) => prev.map((m) => {
      if (!m.marker_key) return m
      const isExtra = !tracked.includes(m.marker_key)
      if (!isExtra) return m
      if (m.confirmed_by_coach) return m
      return { ...m, confirmed_by_coach: true }
    }))
  }

  function bulkIgnoreUnidentified() {
    setEditedMarkers((prev) => prev.map((m) => (m.marker_key ? m : { ...m, ignored: true })))
  }

  async function createCustomFromRow(target: ExtractedMarker, payload: { label: string; unit_canonical: string; category: string }) {
    if (!user?.id) { toast('Session expirée', 'error'); return }
    const key = payload.label.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!key) { toast('Label invalide', 'error'); return }
    if (allMarkerOptions.some((o) => o.key === key)) { toast('Un marqueur avec cette clé existe déjà', 'error'); return }
    const { error } = await supabase.from('coach_custom_markers').insert({
      coach_id: user.id,
      marker_key: key,
      label: payload.label.trim(),
      unit_canonical: payload.unit_canonical.trim() || (target.unit_canonical || target.unit || ''),
      category: payload.category,
      zones: { direction: 'range_is_normal', bands: [] },
    })
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    setCustomMarkers((prev) => [...prev, { key, label: payload.label.trim(), unit_canonical: payload.unit_canonical.trim() || (target.unit_canonical || target.unit || '') }])
    setEditedMarkers((prev) => prev.map((m) => (m === target ? { ...m, marker_key: key, matched_by_ai: false, ignored: false, confirmed_by_coach: true } : m)))
    setCreatingFor(null)
    toast('Marqueur custom créé et assigné', 'success')
  }

  async function submit() {
    if (!datedAt) { toast('Date du bilan requise', 'error'); return }
    const finalMarkers = editedMarkers.filter((m) => {
      if (!m.marker_key) return false
      if (m.value == null) return false
      if (m.ignored) return false
      const isExtra = m.marker_key && !tracked.includes(m.marker_key)
      if (isExtra && !m.confirmed_by_coach) return false
      return true
    })
    setSaving(true)
    try {
      const validated_data: ExtractedData = { detected_dated_at: datedAt, markers: finalMarkers }
      const res = await fetch('/api/bloodtest/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ upload_id: params.upload_id, validated_data, dated_at: datedAt }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'submit failed')
      toast('Validé !', 'success')
      router.push(`/athletes/${params.id}/bloodtest`)
    } catch (e: any) {
      toast(`Erreur: ${e.message}`, 'error')
    } finally { setSaving(false) }
  }

  async function rejectUpload() {
    if (!confirm('Rejeter ce bilan ?')) return
    const { error } = await supabase.from('bloodtest_uploads').update({ archived_at: new Date().toISOString() }).eq('id', params.upload_id)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Rejeté', 'success')
    router.push(`/athletes/${params.id}/bloodtest`)
  }

  if (loading) return <Skeleton height={400} />
  if (!upload) return <div>Upload introuvable</div>

  const totalIncluded = editedMarkers.filter((m) => m.marker_key && m.value != null && !m.ignored && (tracked.includes(m.marker_key) || m.confirmed_by_coach)).length

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={() => router.back()}><i className="fas fa-arrow-left" /> Retour</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Valider le bilan</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>· {signedFiles.length} fichier{signedFiles.length > 1 ? 's' : ''}</span>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{totalIncluded} marker{totalIncluded > 1 ? 's' : ''} sera{totalIncluded > 1 ? 'ont' : ''} validé{totalIncluded > 1 ? 's' : ''}</span>
        <button className="btn btn-outline btn-sm" onClick={() => setCollapsePdf((v) => !v)}>
          <i className={`fas fa-${collapsePdf ? 'expand' : 'compress'}`} /> {collapsePdf ? 'Voir PDF' : 'Plein écran tableau'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: collapsePdf ? '1fr' : 'minmax(0, 1fr) minmax(560px, 720px)', gap: 16, alignItems: 'start' }}>
        {!collapsePdf && (
          <div style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
            {signedFiles.length === 0 && <div style={{ color: 'var(--text3)' }}>Chargement des fichiers...</div>}
            {signedFiles.map((f, i) => (
              f.mediaType === 'application/pdf' ? (
                <iframe key={i} src={f.url} style={{ width: '100%', height: '85vh', border: '1px solid var(--border)', borderRadius: 6 }} title={`PDF ${i + 1}`} />
              ) : (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                  <img src={f.url} alt={`Screenshot ${i + 1}`} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                </a>
              )
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>Date du bilan :</label>
            <input type="date" className="form-control" value={datedAt} onChange={(e) => setDatedAt(e.target.value)} style={{ maxWidth: 200 }} />
          </div>

          <SectionCard
            icon="fa-bullseye"
            color="var(--primary)"
            title="Attendus"
            count={split.expected.length}
            subtitle="markers suivis pour cet athlète — pré-validés automatiquement"
          >
            <MarkerTable
              rows={split.expected.map((row) => ({
                kind: 'expected' as const,
                trackedKey: row.tracked_key,
                marker: row.marker,
                label: labelByKey.get(row.tracked_key) || row.tracked_key,
                catalogMarker: markerByKey.get(row.tracked_key),
              }))}
              tracked={tracked}
              allOptions={allMarkerOptions}
              onUpdate={updateMarkerByRef}
              onCreateCustom={(m) => setCreatingFor(m)}
            />
          </SectionCard>

          {split.extras.length > 0 && (
            <SectionCard
              icon="fa-plus"
              color="var(--green)"
              title="Extras détectés"
              count={split.extras.length}
              subtitle="markers hors suivi — clique 'Inclure' pour les ajouter à ce bilan"
              action={
                <button className="btn btn-outline btn-sm" onClick={bulkConfirmExtras}>
                  <i className="fas fa-check-double" /> Tout inclure
                </button>
              }
            >
              <MarkerTable
                rows={split.extras.map((m) => ({
                  kind: 'extra' as const,
                  marker: m,
                  label: labelByKey.get(m.marker_key!) || m.marker_key!,
                  catalogMarker: markerByKey.get(m.marker_key!),
                }))}
                tracked={tracked}
                allOptions={allMarkerOptions}
                onUpdate={updateMarkerByRef}
                onCreateCustom={(m) => setCreatingFor(m)}
              />
            </SectionCard>
          )}

          {split.unidentified.length > 0 && (
            <SectionCard
              icon="fa-circle-question"
              color="var(--text3)"
              title="Non identifiés"
              count={split.unidentified.length}
              subtitle="lignes que l'IA n'a pas su mapper — ignorées par défaut"
              collapsed={!showUnidentified}
              onToggle={() => setShowUnidentified((v) => !v)}
              action={showUnidentified ? (
                <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); bulkIgnoreUnidentified() }}>
                  <i className="fas fa-eye-slash" /> Tout ignorer
                </button>
              ) : undefined}
            >
              {showUnidentified && (
                <MarkerTable
                  rows={split.unidentified.map((m) => ({
                    kind: 'unidentified' as const,
                    marker: m,
                    label: m.raw_label,
                    catalogMarker: undefined,
                  }))}
                  tracked={tracked}
                  allOptions={allMarkerOptions}
                  onUpdate={updateMarkerByRef}
                  onCreateCustom={(m) => setCreatingFor(m)}
                />
              )}
            </SectionCard>
          )}

          <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, padding: 12, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <button className="btn btn-outline" onClick={rejectUpload}>Rejeter le bilan</button>
            <button className="btn btn-red" onClick={submit} disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Validation...' : `Valider et publier (${totalIncluded} marker${totalIncluded > 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      </div>

      {creatingFor && (
        <CreateCustomMarkerModal
          target={creatingFor}
          onClose={() => setCreatingFor(null)}
          onSubmit={(payload) => createCustomFromRow(creatingFor, payload)}
        />
      )}
    </div>
  )
}

function CreateCustomMarkerModal({
  target, onClose, onSubmit,
}: {
  target: ExtractedMarker
  onClose: () => void
  onSubmit: (payload: { label: string; unit_canonical: string; category: string }) => void
}) {
  const [label, setLabel] = useState(target.raw_label || '')
  const [unit, setUnit] = useState(target.unit_canonical || target.unit || '')
  const [category, setCategory] = useState('metabolism')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!label.trim()) return
    setSubmitting(true)
    try { await onSubmit({ label, unit_canonical: unit, category }) }
    finally { setSubmitting(false) }
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
          background: 'var(--bg)', borderRadius: 14, maxWidth: 460, width: '100%',
          border: '1px solid var(--border)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-plus-circle" style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>Créer un marqueur custom</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Nom du marqueur</label>
            <input className="form-control" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Hématocrite" autoFocus style={{ marginTop: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Unité</label>
              <input className="form-control" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g/L, %, mmol/L..." style={{ marginTop: 4 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Catégorie</label>
              <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginTop: 4 }}>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: 10, background: 'var(--bg2)', borderRadius: 6, lineHeight: 1.5 }}>
            <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
            Les plages cliniques (optimal/limite/hors zone) seront définissables plus tard depuis la page <strong>Paramètres &gt; Marqueurs sanguins</strong>.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-outline" onClick={onClose} disabled={submitting}>Annuler</button>
            <button className="btn btn-red" onClick={handleSubmit} disabled={submitting || !label.trim()}>
              {submitting ? '…' : 'Créer et assigner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  icon, color, title, count, subtitle, children, action, collapsed, onToggle,
}: {
  icon: string
  color: string
  title: string
  count: number
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
  collapsed?: boolean
  onToggle?: () => void
}) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'var(--bg3)',
          cursor: onToggle ? 'pointer' : 'default',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        }}
        onClick={onToggle}
      >
        <i className={`fas ${icon}`} style={{ color }} />
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <span style={{ fontSize: 11, padding: '2px 8px', background: color, color: 'white', borderRadius: 99, fontWeight: 700 }}>{count}</span>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{subtitle}</div>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {action}
          {onToggle && <i className={`fas fa-chevron-${collapsed ? 'right' : 'down'}`} style={{ fontSize: 11, color: 'var(--text3)' }} />}
        </div>
      </div>
      {!collapsed && children}
    </div>
  )
}

type Row =
  | { kind: 'expected'; trackedKey: string; marker?: ExtractedMarker; label: string; catalogMarker?: any }
  | { kind: 'extra'; marker: ExtractedMarker; label: string; catalogMarker?: any }
  | { kind: 'unidentified'; marker: ExtractedMarker; label: string; catalogMarker?: any }

function MarkerTable({
  rows, tracked, allOptions, onUpdate, onCreateCustom,
}: {
  rows: Row[]
  tracked: string[]
  allOptions: { key: string; label: string; unit_canonical: string }[]
  onUpdate: (target: ExtractedMarker, patch: Partial<ExtractedMarker>) => void
  onCreateCustom: (target: ExtractedMarker) => void
}) {
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            <th style={th}>Marker</th>
            <th style={{ ...th, textAlign: 'right' }}>Valeur</th>
            <th style={th}>Unité</th>
            <th style={th}>Plage labo</th>
            <th style={{ ...th, textAlign: 'center' }}>État</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <MarkerRow key={i} row={row} tracked={tracked} allOptions={allOptions} onUpdate={onUpdate} onCreateCustom={onCreateCustom} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  borderBottom: '1px solid var(--border)',
}

const td: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}

function MarkerRow({
  row, tracked, allOptions, onUpdate, onCreateCustom,
}: {
  row: Row
  tracked: string[]
  allOptions: { key: string; label: string; unit_canonical: string }[]
  onUpdate: (target: ExtractedMarker, patch: Partial<ExtractedMarker>) => void
  onCreateCustom: (target: ExtractedMarker) => void
}) {
  const [editingKey, setEditingKey] = useState(false)
  const [editingValue, setEditingValue] = useState(false)

  if (row.kind === 'expected' && !row.marker) {
    return (
      <tr style={{ opacity: 0.5 }}>
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-bullseye" style={{ color: 'var(--text3)', fontSize: 10 }} />
            <span style={{ fontWeight: 600 }}>{row.label}</span>
          </div>
        </td>
        <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>—</td>
        <td style={td}>—</td>
        <td style={td}>—</td>
        <td style={{ ...td, textAlign: 'center' }}>
          <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg3)', borderRadius: 4, color: 'var(--text3)', whiteSpace: 'nowrap' }}>NON TROUVÉ</span>
        </td>
        <td style={td}></td>
      </tr>
    )
  }

  const m = row.marker!
  const value = m.value_canonical ?? m.value
  const unit = m.unit_canonical || m.unit
  const isExtra = row.kind === 'extra'
  const isExpected = row.kind === 'expected'
  const isUnidentified = row.kind === 'unidentified'
  const confirmed = !!m.confirmed_by_coach
  const ignored = !!m.ignored
  const includedInValidation = isExpected ? !ignored : (isExtra ? confirmed && !ignored : !!m.marker_key && !ignored)

  let zoneColor: string | undefined
  let zoneLabel: string | undefined
  if (row.catalogMarker && value != null) {
    try {
      const cls = classifyValue(row.catalogMarker, value, { sex: 'F', phase: 'folliculaire' })
      if (cls.ok) {
        zoneColor = severityColor(cls.band.severity)
        zoneLabel = cls.band.label
      }
    } catch {}
  }

  return (
    <tr style={{ background: ignored ? 'var(--bg)' : 'transparent', opacity: ignored ? 0.4 : 1 }}>
      <td style={td}>
        {editingKey ? (
          <select
            className="form-control"
            autoFocus
            value={m.marker_key || ''}
            onChange={(e) => {
              if (e.target.value === '__create__') { setEditingKey(false); onCreateCustom(m); return }
              onUpdate(m, { marker_key: e.target.value || null, matched_by_ai: false }); setEditingKey(false)
            }}
            onBlur={() => setEditingKey(false)}
            style={{ minWidth: 200, fontSize: 12 }}
          >
            <option value="">—</option>
            {allOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            <option value="__create__">＋ Créer un nouveau marqueur…</option>
          </select>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 24 }}>
            <span style={{ fontWeight: 600 }}>{row.label}</span>
            {isUnidentified && <span style={{ fontSize: 10, color: 'var(--text3)' }}>(brut)</span>}
            {m.matched_by_ai && <span title="Auto-matché par l'IA" style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(99, 102, 241, 0.18)', color: '#a5b4fc', borderRadius: 3, fontWeight: 700 }}>IA</span>}
            <button
              onClick={() => setEditingKey(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2, fontSize: 10 }}
              title="Changer le marker"
            >
              <i className="fas fa-pen" />
            </button>
          </div>
        )}
        {isUnidentified && m.raw_label && !editingKey && (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>raw: {m.raw_label}</div>
        )}
      </td>

      <td style={{ ...td, textAlign: 'right' }}>
        {editingValue ? (
          <input
            autoFocus
            type="number"
            step="any"
            className="form-control"
            value={m.value_canonical ?? m.value ?? ''}
            onChange={(e) => {
              const v = e.target.value ? parseFloat(e.target.value) : null
              onUpdate(m, { value_canonical: v, value: v })
            }}
            onBlur={() => setEditingValue(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingValue(false) }}
            style={{ width: 90, textAlign: 'right', fontSize: 13 }}
          />
        ) : (
          <span
            onClick={() => setEditingValue(true)}
            style={{
              cursor: 'pointer',
              fontWeight: 700,
              color: zoneColor || 'var(--text)',
              padding: '2px 6px',
              borderRadius: 4,
              borderBottom: '1px dashed transparent',
              whiteSpace: 'nowrap',
            }}
            title="Clic pour éditer"
          >
            {m.below_detection && '<'}
            {m.above_detection && '>'}
            {value ?? '—'}
          </span>
        )}
      </td>

      <td style={{ ...td, color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{unit || '—'}</td>

      <td style={{ ...td, color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>{m.lab_reference_range || '—'}</td>

      <td style={{ ...td, textAlign: 'center' }}>
        {ignored ? (
          <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg3)', borderRadius: 4, color: 'var(--text3)' }}>IGNORÉ</span>
        ) : zoneLabel ? (
          <span style={{ fontSize: 10, padding: '2px 6px', background: `${zoneColor}33`, color: zoneColor, borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {zoneLabel}
          </span>
        ) : isExtra && !confirmed ? (
          <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg3)', borderRadius: 4, color: 'var(--warning)' }}>À VALIDER</span>
        ) : includedInValidation ? (
          <i className="fas fa-check-circle" style={{ color: 'var(--green)', fontSize: 14 }} title="Inclus dans le bilan validé" />
        ) : (
          <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg3)', borderRadius: 4, color: 'var(--text3)' }}>—</span>
        )}
      </td>

      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {isExtra && !confirmed && !ignored && (
          <button className="btn btn-red btn-sm" onClick={() => onUpdate(m, { confirmed_by_coach: true })} style={{ padding: '2px 8px', fontSize: 11 }}>
            Inclure
          </button>
        )}
        {isExtra && confirmed && !ignored && (
          <button className="btn btn-outline btn-sm" onClick={() => onUpdate(m, { confirmed_by_coach: false })} style={{ padding: '2px 8px', fontSize: 11 }}>
            Retirer
          </button>
        )}
        <button
          onClick={() => onUpdate(m, { ignored: !ignored })}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, marginLeft: 4, fontSize: 11 }}
          title={ignored ? 'Ré-inclure' : 'Ignorer'}
        >
          <i className={`fas fa-${ignored ? 'eye' : 'eye-slash'}`} />
        </button>
      </td>
    </tr>
  )
}
