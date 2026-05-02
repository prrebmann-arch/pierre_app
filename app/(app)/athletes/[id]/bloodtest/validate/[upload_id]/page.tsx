'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/ui/Skeleton'
import { MARKERS } from '@/lib/bloodtestCatalog'
import { splitMarkers, type BloodtestUploadRow, type ExtractedData, type ExtractedMarker } from '@/lib/bloodtest'

type CustomMarkerOpt = { key: string; label: string; unit_canonical: string }
type SignedFile = { path: string; url: string; mediaType: string }

export default function BloodtestValidatePage() {
  const params = useParams<{ id: string; upload_id: string }>()
  const router = useRouter()
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

  const split = useMemo(() => splitMarkers(editedMarkers, tracked), [editedMarkers, tracked])

  function updateMarkerByRef(target: ExtractedMarker, patch: Partial<ExtractedMarker>) {
    setEditedMarkers((prev) => prev.map((m) => (m === target ? { ...m, ...patch } : m)))
  }

  async function submit() {
    if (!datedAt) { toast('Date du bilan requise', 'error'); return }
    const finalMarkers = editedMarkers.filter((m) => {
      if (!m.marker_key) return false
      if (m.value == null) return false
      if (m.ignored) return false
      // Pour les extras, on n'inclut QUE ceux explicitement confirmés par le coach.
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => router.back()}><i className="fas fa-arrow-left" /> Retour</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Valider le bilan</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{signedFiles.length} fichier{signedFiles.length > 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 480px)', gap: 16, alignItems: 'start' }}>
        <div style={{ maxHeight: '85vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
          {signedFiles.length === 0 && <div style={{ color: 'var(--text3)' }}>Chargement des fichiers...</div>}
          {signedFiles.map((f, i) => (
            f.mediaType === 'application/pdf' ? (
              <iframe key={i} src={f.url} style={{ width: '100%', height: '80vh', border: '1px solid var(--border)', borderRadius: 6 }} title={`PDF ${i + 1}`} />
            ) : (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                <img src={f.url} alt={`Screenshot ${i + 1}`} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
              </a>
            )
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>Date du bilan</label>
            <input type="date" className="form-control" value={datedAt} onChange={(e) => setDatedAt(e.target.value)} />
          </div>

          {/* SECTION ATTENDUS */}
          <SectionHeader icon="fa-bullseye" label={`Attendus (${split.expected.length})`} subLabel="markers suivis pour cet athlète" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {split.expected.map((row) => (
              <ExpectedMarkerRow
                key={row.tracked_key}
                trackedKey={row.tracked_key}
                marker={row.marker}
                label={labelByKey.get(row.tracked_key) || row.tracked_key}
                onUpdate={(patch) => row.marker && updateMarkerByRef(row.marker, patch)}
                allOptions={allMarkerOptions}
              />
            ))}
            {split.expected.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucun marker suivi configuré.</div>}
          </div>

          {/* SECTION EXTRAS */}
          {split.extras.length > 0 && (
            <>
              <SectionHeader icon="fa-plus" label={`Extras détectés (${split.extras.length})`} subLabel="hors suivi — clique pour valider individuellement" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {split.extras.map((m, i) => (
                  <ExtraMarkerRow
                    key={`${m.marker_key}_${i}`}
                    marker={m}
                    label={labelByKey.get(m.marker_key!) || m.marker_key!}
                    onUpdate={(patch) => updateMarkerByRef(m, patch)}
                    allOptions={allMarkerOptions}
                  />
                ))}
              </div>
            </>
          )}

          {/* SECTION NON IDENTIFIÉS */}
          {split.unidentified.length > 0 && (
            <>
              <button
                className="btn btn-outline btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowUnidentified((v) => !v)}
              >
                <i className={`fas fa-chevron-${showUnidentified ? 'down' : 'right'}`} />
                {' '}Non identifiés ({split.unidentified.length})
              </button>
              {showUnidentified && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {split.unidentified.map((m, i) => (
                    <UnidentifiedRow
                      key={`u_${i}`}
                      marker={m}
                      onUpdate={(patch) => updateMarkerByRef(m, patch)}
                      allOptions={allMarkerOptions}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-outline" onClick={rejectUpload}>Rejeter le bilan</button>
            <button className="btn btn-red" onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Validation...' : 'Valider et publier'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label, subLabel }: { icon: string; label: string; subLabel?: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className={`fas ${icon}`} style={{ color: 'var(--primary)' }} />{label}
      </div>
      {subLabel && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{subLabel}</div>}
    </div>
  )
}

function AiBadge() {
  return (
    <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: 4, fontWeight: 600 }}>
      <i className="fas fa-wand-magic-sparkles" /> auto IA
    </span>
  )
}

function ExpectedMarkerRow({
  trackedKey, marker, label, onUpdate, allOptions,
}: {
  trackedKey: string
  marker?: ExtractedMarker
  label: string
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
}) {
  const [editing, setEditing] = useState(false)
  if (!marker) {
    return (
      <div style={{ padding: 10, background: 'var(--bg3)', opacity: 0.6, borderRadius: 8, border: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Non trouvé dans ce PDF</div>
      </div>
    )
  }
  const value = marker.value_canonical ?? marker.value
  const unit = marker.unit_canonical || marker.unit
  return (
    <div style={{ padding: 10, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', opacity: marker.ignored ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</div>
        {marker.matched_by_ai && !editing && <AiBadge />}
      </div>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{value ?? '—'} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{unit}</span></div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>
            <i className="fas fa-pen" /> Modifier
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onUpdate({ ignored: !marker.ignored })}>
            {marker.ignored ? 'Ré-inclure' : 'Ignorer'}
          </button>
        </div>
      ) : (
        <EditFields marker={marker} onUpdate={onUpdate} allOptions={allOptions} onDone={() => setEditing(false)} />
      )}
      {marker.lab_reference_range && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Plage labo : {marker.lab_reference_range}</div>}
    </div>
  )
}

function ExtraMarkerRow({
  marker, label, onUpdate, allOptions,
}: {
  marker: ExtractedMarker
  label: string
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const value = marker.value_canonical ?? marker.value
  const unit = marker.unit_canonical || marker.unit
  const confirmed = !!marker.confirmed_by_coach
  return (
    <div style={{ padding: 10, background: 'var(--bg2)', borderRadius: 8, border: confirmed ? '1px solid var(--green)' : '1px solid var(--border)', opacity: marker.ignored ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</div>
        {marker.matched_by_ai && !editing && <AiBadge />}
      </div>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{value ?? '—'} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{unit}</span></div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>
            <i className="fas fa-pen" /> Modifier
          </button>
          <button
            className={confirmed ? 'btn btn-outline btn-sm' : 'btn btn-red btn-sm'}
            onClick={() => onUpdate({ confirmed_by_coach: !confirmed })}
          >
            {confirmed ? <><i className="fas fa-check" /> Inclus</> : 'Valider'}
          </button>
        </div>
      ) : (
        <EditFields marker={marker} onUpdate={onUpdate} allOptions={allOptions} onDone={() => setEditing(false)} />
      )}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
        {confirmed ? 'Inclus dans ce bilan (one-shot, n\'ajoute pas au suivi permanent)' : 'À valider explicitement pour être inclus'}
      </div>
    </div>
  )
}

function UnidentifiedRow({
  marker, onUpdate, allOptions,
}: {
  marker: ExtractedMarker
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
}) {
  return (
    <div style={{ padding: 10, background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)', opacity: marker.ignored ? 0.5 : 1 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Raw : {marker.raw_label}</div>
      <select className="form-control" style={{ marginBottom: 6 }} value={marker.marker_key || ''} onChange={(e) => onUpdate({ marker_key: e.target.value || null, matched_by_ai: false })}>
        <option value="">-- Choisir un marker --</option>
        {allOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="form-control" type="number" step="any" placeholder="Valeur" value={marker.value ?? ''} onChange={(e) => onUpdate({ value: e.target.value ? parseFloat(e.target.value) : null })} />
        <input className="form-control" placeholder="Unité" value={marker.unit || ''} onChange={(e) => onUpdate({ unit: e.target.value })} style={{ maxWidth: 100 }} />
      </div>
      {marker.lab_reference_range && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>Plage labo : {marker.lab_reference_range}</div>}
      <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => onUpdate({ ignored: !marker.ignored })}>
        {marker.ignored ? 'Ré-inclure' : 'Ignorer cette ligne'}
      </button>
    </div>
  )
}

function EditFields({
  marker, onUpdate, allOptions, onDone,
}: {
  marker: ExtractedMarker
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
  onDone: () => void
}) {
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <select
        className="form-control"
        value={marker.marker_key || ''}
        onChange={(e) => onUpdate({ marker_key: e.target.value || null, matched_by_ai: false })}
      >
        <option value="">-- Choisir un marker --</option>
        {allOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="form-control" type="number" step="any" placeholder="Valeur (canonique)"
          value={marker.value_canonical ?? marker.value ?? ''}
          onChange={(e) => onUpdate({ value_canonical: e.target.value ? parseFloat(e.target.value) : null, value: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <input
          className="form-control" placeholder="Unité"
          value={marker.unit_canonical || marker.unit || ''}
          onChange={(e) => onUpdate({ unit_canonical: e.target.value, unit: e.target.value })}
          style={{ maxWidth: 120 }}
        />
      </div>
      <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-end' }} onClick={onDone}>OK</button>
    </div>
  )
}
