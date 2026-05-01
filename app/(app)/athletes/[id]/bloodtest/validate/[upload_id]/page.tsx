'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/ui/Skeleton'
import { MARKERS } from '@/lib/bloodtestCatalog'
import type { BloodtestUploadRow, ExtractedData, ExtractedMarker } from '@/lib/bloodtest'

export default function BloodtestValidatePage() {
  const params = useParams<{ id: string; upload_id: string }>()
  const router = useRouter()
  const { accessToken } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  type SignedFile = { path: string; url: string; mediaType: string }
  const [upload, setUpload] = useState<BloodtestUploadRow | null>(null)
  const [signedFiles, setSignedFiles] = useState<SignedFile[]>([])
  const [editedMarkers, setEditedMarkers] = useState<ExtractedMarker[]>([])
  const [datedAt, setDatedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customMarkers, setCustomMarkers] = useState<{ key: string; label: string; unit_canonical: string }[]>([])

  const load = useCallback(async () => {
    try {
      const [{ data: row }, urlRes, { data: cms }] = await Promise.all([
        supabase.from('bloodtest_uploads').select('*').eq('id', params.upload_id).single(),
        fetch(`/api/bloodtest/signed-url?id=${params.upload_id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()),
        supabase.from('coach_custom_markers').select('marker_key, label, unit_canonical').is('archived_at', null),
      ])
      if (!row) { toast('Upload introuvable', 'error'); return }
      setUpload(row as BloodtestUploadRow)
      const files: SignedFile[] = Array.isArray(urlRes.urls) && urlRes.urls.length > 0
        ? urlRes.urls
        : urlRes.url
          ? [{ path: '', url: urlRes.url, mediaType: 'application/pdf' }]
          : []
      setSignedFiles(files)
      const data = (row.validated_data || row.extracted_data) as ExtractedData | null
      setEditedMarkers(data?.markers || [])
      setDatedAt(row.dated_at || (data?.detected_dated_at || ''))
      setCustomMarkers((cms || []).map((c: any) => ({ key: c.marker_key, label: c.label, unit_canonical: c.unit_canonical })))
    } finally { setLoading(false) }
  }, [params.upload_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function updateMarker(idx: number, patch: Partial<ExtractedMarker>) {
    setEditedMarkers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }
  function toggleIgnore(idx: number) {
    setEditedMarkers((prev) => prev.map((m, i) => (i === idx ? { ...m, ignored: !m.ignored } : m)))
  }

  async function submit() {
    if (!datedAt) { toast('Date du bilan requise', 'error'); return }
    setSaving(true)
    try {
      const validated_data: ExtractedData = { detected_dated_at: datedAt, markers: editedMarkers }
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

  const allMarkerOptions = [...MARKERS.map((m) => ({ key: m.key, label: m.label, unit_canonical: m.unit_canonical })), ...customMarkers]

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

          <div style={{ maxHeight: '70vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {editedMarkers.map((m, i) => (
              <div key={i} style={{ padding: 10, background: m.ignored ? 'var(--bg3)' : 'var(--bg2)', opacity: m.ignored ? 0.5 : 1, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Raw : {m.raw_label}</div>
                <select className="form-control" style={{ marginBottom: 6 }} value={m.marker_key || ''} onChange={(e) => updateMarker(i, { marker_key: e.target.value || null })}>
                  <option value="">-- Choisir un marker --</option>
                  {allMarkerOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-control" type="number" step="any" placeholder="Valeur" value={m.value ?? ''} onChange={(e) => updateMarker(i, { value: e.target.value ? parseFloat(e.target.value) : null })} />
                  <input className="form-control" placeholder="Unité" value={m.unit || ''} onChange={(e) => updateMarker(i, { unit: e.target.value })} style={{ maxWidth: 100 }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>Plage labo : {m.lab_reference_range || '—'}</div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => toggleIgnore(i)}>
                  {m.ignored ? 'Ré-inclure' : 'Ignorer cette ligne'}
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={rejectUpload}>Rejeter le bilan</button>
            <button className="btn btn-red" onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Validation...' : 'Valider et publier'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
