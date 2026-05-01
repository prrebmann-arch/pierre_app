'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Toggle from '@/components/ui/Toggle'
import Skeleton from '@/components/ui/Skeleton'
import Modal from '@/components/ui/Modal'
import { MARKERS, PRESETS, type BloodtestPreset } from '@/lib/bloodtestCatalog'
import { classifyValue, severityColor, type BloodtestUploadRow, type ExtractedData } from '@/lib/bloodtest'

type CustomMarker = { id: string; marker_key: string; label: string; unit_canonical: string; category: string; zones: any }

export default function BloodtestPage() {
  const params = useParams<{ id: string }>()
  const { user, accessToken } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [tracked, setTracked] = useState<string[]>([])
  const [uploads, setUploads] = useState<BloodtestUploadRow[]>([])
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([])
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [{ data: ath, error: athErr }, { data: ups }, { data: cms }] = await Promise.all([
        supabase.from('athletes').select('bloodtest_enabled, bloodtest_tracked_markers').eq('id', params.id).single(),
        supabase.from('bloodtest_uploads')
          .select('id, athlete_id, uploaded_by, uploader_user_id, file_path, dated_at, uploaded_at, validated_at, validated_by, extracted_data, validated_data, ai_extraction_meta, archived_at, created_at')
          .eq('athlete_id', params.id).is('archived_at', null)
          .order('dated_at', { ascending: false, nullsFirst: false })
          .order('uploaded_at', { ascending: false }).limit(50),
        supabase.from('coach_custom_markers').select('id, marker_key, label, unit_canonical, category, zones').is('archived_at', null),
      ])
      if (athErr) { console.error('[bloodtest] athlete', athErr); toast(`Erreur: ${athErr.message}`, 'error'); return }
      setEnabled(ath?.bloodtest_enabled || false)
      setTracked(ath?.bloodtest_tracked_markers || [])
      setUploads((ups || []) as BloodtestUploadRow[])
      setCustomMarkers((cms || []) as CustomMarker[])
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (params.id) loadData() }, [params.id, loadData])
  useRefetchOnResume(loadData, loading)

  async function toggleEnabled(on: boolean) {
    const update: any = { bloodtest_enabled: on }
    if (on && tracked.length === 0) update.bloodtest_tracked_markers = PRESETS.basic
    const { error } = await supabase.from('athletes').update(update).eq('id', params.id)
    if (error) { console.error('[bloodtest] toggle', error); toast(`Erreur: ${error.message}`, 'error'); return }
    toast(on ? 'Prise de sang activée' : 'Prise de sang désactivée', 'success')
    setEnabled(on)
    if (on && tracked.length === 0) setTracked(PRESETS.basic)
  }

  async function applyPreset(preset: BloodtestPreset) {
    const list = PRESETS[preset]
    const { error } = await supabase.from('athletes').update({ bloodtest_tracked_markers: list }).eq('id', params.id)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    setTracked(list)
    toast(`Preset ${preset} appliqué`, 'success')
  }

  async function toggleMarker(key: string) {
    const next = tracked.includes(key) ? tracked.filter((k) => k !== key) : [...tracked, key]
    const { error } = await supabase.from('athletes').update({ bloodtest_tracked_markers: next }).eq('id', params.id)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    setTracked(next)
  }

  async function uploadImages(files: File[]) {
    if (!user) return
    if (files.length === 0) return
    if (files.length > 10) { toast('Maximum 10 screenshots par bilan', 'error'); return }
    setUploading(true)
    try {
      const ts = Date.now()
      const paths: string[] = []
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (!f.type.startsWith('image/')) { throw new Error(`${f.name} n'est pas une image`) }
        if (f.size > 8 * 1024 * 1024) { throw new Error(`${f.name} dépasse 8 MB`) }
        const ext = f.type === 'image/png' ? 'png' : 'jpg'
        const path = `coach/${user.id}/${params.id}/${ts}_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('coach-bloodtest').upload(path, f, { contentType: f.type || 'image/jpeg', upsert: false })
        if (upErr) throw upErr
        paths.push(path)
      }
      const res = await fetch('/api/bloodtest/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ athlete_id: params.id, uploaded_by: 'coach', file_paths: paths }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'upload failed')
      fetch('/api/bloodtest/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ upload_id: json.upload_id }),
      }).then(() => loadData()).catch((e) => console.error('[bloodtest] extract bg', e))
      toast(`${paths.length} screenshot${paths.length > 1 ? 's' : ''} envoyé${paths.length > 1 ? 's' : ''}, extraction en cours...`, 'success')
      loadData()
    } catch (e: any) {
      console.error('[bloodtest] upload', e)
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <Skeleton height={400} borderRadius={12} />

  if (!enabled) {
    return (
      <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
        <i className="fas fa-droplet" style={{ fontSize: 36, color: 'var(--text3)', marginBottom: 16, display: 'block' }} />
        <p style={{ color: 'var(--text3)', marginBottom: 16 }}>Prise de sang désactivée pour cet athlète</p>
        <Toggle checked={false} onChange={toggleEnabled} />
      </div>
    )
  }

  const pendingValidation = uploads.filter((u) => u.extracted_data && !u.validated_at)
  const pendingExtraction = uploads.filter((u) => !u.extracted_data && !u.validated_at)
  const validated = uploads.filter((u) => u.validated_at)

  async function triggerExtract(uploadId: string) {
    const res = await fetch('/api/bloodtest/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ upload_id: uploadId }),
    })
    const json = await res.json()
    if (!res.ok) {
      console.error('[bloodtest] extract', json)
      toast(`Erreur extraction: ${json.error || 'unknown'}`, 'error')
      return
    }
    toast('Extraction terminée', 'success')
    loadData()
  }
  const allMarkers = [...MARKERS, ...customMarkers.map((cm) => ({
    key: cm.marker_key, label: cm.label, unit_canonical: cm.unit_canonical, unit_aliases: [],
    category: cm.category as any, zones: cm.zones, presets: [] as BloodtestPreset[],
  }))]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Toggle checked={enabled} onChange={toggleEnabled} label="Prise de sang activée" />
        <input type="file" accept="image/jpeg,image/png" multiple id="bt-upload" hidden onChange={(e) => { const fs = e.target.files; if (fs && fs.length > 0) { uploadImages(Array.from(fs)); e.target.value = '' } }} />
        <button className="btn btn-red btn-sm" disabled={uploading} onClick={() => document.getElementById('bt-upload')?.click()}>
          <i className="fas fa-images" /> {uploading ? 'Upload...' : 'Upload screenshots'}
        </button>
      </div>

      <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg2)', borderRadius: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Panel suivi</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['basic','hormonal_plus','total'] as const).map((p) => (
            <button key={p} className="btn btn-outline btn-sm" onClick={() => applyPreset(p)}>Preset {p}</button>
          ))}
          <button className="btn btn-outline btn-sm" onClick={() => setShowCustomModal(true)}><i className="fas fa-plus" /> Marker custom</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
          {allMarkers.map((m) => {
            const on = tracked.includes(m.key)
            return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: on ? 'var(--bg3)' : 'transparent', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => toggleMarker(m.key)} />{m.label}
              </label>
            )
          })}
        </div>
      </div>

      {pendingExtraction.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            <i className="fas fa-cog" style={{ color: 'var(--text3)', marginRight: 6 }} />En attente d'extraction ({pendingExtraction.length})
          </h3>
          {pendingExtraction.map((u) => {
            const fileCount = (u.file_path || '').split('|').filter((p: string) => p).length
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg2)', borderLeft: '3px solid var(--text3)', borderRadius: 8, marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Upload {u.uploaded_by} · {new Date(u.uploaded_at).toLocaleDateString('fr-FR')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fileCount} fichier{fileCount > 1 ? 's' : ''} · pas encore analysé{fileCount > 1 ? 's' : ''}</div>
                </div>
                <button className="btn btn-red btn-sm" onClick={() => triggerExtract(u.id)}>
                  <i className="fas fa-play" /> Lancer extraction
                </button>
              </div>
            )
          })}
        </>
      )}

      {pendingValidation.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, marginTop: 16 }}>
            <i className="fas fa-hourglass-half" style={{ color: 'var(--warning)', marginRight: 6 }} />À valider ({pendingValidation.length})
          </h3>
          {pendingValidation.map((u) => (
            <Link key={u.id} href={`/athletes/${params.id}/bloodtest/validate/${u.id}`} style={{ display: 'block', padding: 12, background: 'var(--bg2)', borderLeft: '3px solid var(--warning)', borderRadius: 8, marginBottom: 8, textDecoration: 'none', color: 'var(--text)' }}>
              <div style={{ fontWeight: 600 }}>Upload {u.uploaded_by} · {new Date(u.uploaded_at).toLocaleDateString('fr-FR')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {u.extracted_data ? `${(u.extracted_data as ExtractedData).markers.length} markers extraits — clique pour valider` : 'Extraction en cours...'}
              </div>
            </Link>
          ))}
        </>
      )}

      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '24px 0 10px' }}>
        <i className="fas fa-chart-line" style={{ color: 'var(--primary)', marginRight: 6 }} />Historique ({validated.length})
      </h3>
      {validated.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 13 }}>Aucun upload validé pour le moment</div>
      ) : (
        <BloodtestHistoryGraphs uploads={validated} tracked={tracked} allMarkers={allMarkers} />
      )}

      <CustomMarkerModal open={showCustomModal} onClose={() => setShowCustomModal(false)} onCreated={() => { setShowCustomModal(false); loadData() }} coachId={user?.id || ''} />
    </div>
  )
}

function BloodtestHistoryGraphs({ uploads, tracked, allMarkers }: { uploads: BloodtestUploadRow[]; tracked: string[]; allMarkers: any[] }) {
  const perMarker = useMemo(() => {
    const map = new Map<string, { date: string; value: number }[]>()
    for (const up of uploads) {
      const data = up.validated_data as ExtractedData
      if (!data?.markers) continue
      const date = up.dated_at || up.uploaded_at.slice(0, 10)
      for (const m of data.markers) {
        if (!m.marker_key || m.value == null || m.ignored) continue
        const arr = map.get(m.marker_key) || []
        arr.push({ date, value: m.value })
        map.set(m.marker_key, arr)
      }
    }
    for (const [, arr] of map) arr.sort((a, b) => a.date.localeCompare(b.date))
    return map
  }, [uploads])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {tracked.map((key) => {
        const marker = allMarkers.find((m) => m.key === key)
        if (!marker) return null
        const series = perMarker.get(key) || []
        const W = 240, H = 50
        let pts = ''
        if (series.length >= 2) {
          const min = Math.min(...series.map((s) => s.value))
          const max = Math.max(...series.map((s) => s.value))
          pts = series.map((s, i) => `${(i / (series.length - 1)) * W},${H - ((s.value - min) / (max - min || 1)) * H}`).join(' ')
        }
        const last = series[series.length - 1]
        return (
          <div key={key} style={{ padding: 12, background: 'var(--bg2)', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{marker.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{marker.unit_canonical} · {series.length} valeur(s)</div>
            {series.length === 0 && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Aucune donnée</div>}
            {series.length === 1 && <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{last.value}</div>}
            {series.length >= 2 && (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 50, marginTop: 6 }}>
                <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2} />
              </svg>
            )}
            {last && (() => {
              const cls = classifyValue(marker, last.value, { sex: 'F', phase: 'folliculaire' })
              if (cls.ok) return <div style={{ fontSize: 12, marginTop: 6, color: severityColor(cls.band.severity) }}>Dernier : {last.value} {marker.unit_canonical} — {cls.band.label}</div>
              return <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Dernier : {last.value} {marker.unit_canonical}</div>
            })()}
          </div>
        )
      })}
    </div>
  )
}

function CustomMarkerModal({ open, onClose, onCreated, coachId }: { open: boolean; onClose: () => void; onCreated: () => void; coachId: string }) {
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('vitamin')
  const [direction, setDirection] = useState<'higher_is_better'|'lower_is_better'|'range_is_normal'>('higher_is_better')
  const [b1, setB1] = useState(''); const [b2, setB2] = useState(''); const [b3, setB3] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  async function submit() {
    const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!key || !unit) { toast('Label et unité requis', 'error'); return }
    setSaving(true)
    const bands = direction === 'higher_is_better' ? [
      { label: 'optimal', severity: 1, min: parseFloat(b1) },
      { label: 'deficience', severity: 2, min: parseFloat(b2), max: parseFloat(b1) },
      { label: 'carence', severity: 3, min: parseFloat(b3), max: parseFloat(b2) },
      { label: 'avitaminose', severity: 4, max: parseFloat(b3) },
    ] : [
      { label: 'optimal', severity: 1, max: parseFloat(b1) },
      { label: 'leger', severity: 2, min: parseFloat(b1), max: parseFloat(b2) },
      { label: 'modere', severity: 3, min: parseFloat(b2), max: parseFloat(b3) },
      { label: 'severe', severity: 4, min: parseFloat(b3) },
    ]
    const { error } = await supabase.from('coach_custom_markers').insert({
      coach_id: coachId, marker_key: key, label, unit_canonical: unit, category,
      zones: { direction, bands },
    })
    setSaving(false)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Marker custom créé', 'success')
    onCreated()
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Marker custom">
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input className="form-control" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="form-control" placeholder="Unité canonical" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="vitamin">Vitamine</option><option value="mineral">Minéral</option>
          <option value="iron">Fer</option><option value="hormone_sex">Hormone</option>
          <option value="thyroid">Thyroïde</option><option value="inflammation">Inflammation</option>
          <option value="metabolism">Métabolisme</option><option value="liver">Hépatique</option>
          <option value="lipid">Lipide</option><option value="hema">Hématologie</option>
        </select>
        <select className="form-control" value={direction} onChange={(e) => setDirection(e.target.value as any)}>
          <option value="higher_is_better">+ haut = mieux (vitamines)</option>
          <option value="lower_is_better">+ bas = mieux (CRP, ASAT)</option>
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="form-control" type="number" step="any" placeholder="Seuil 1" value={b1} onChange={(e) => setB1(e.target.value)} />
          <input className="form-control" type="number" step="any" placeholder="Seuil 2" value={b2} onChange={(e) => setB2(e.target.value)} />
          <input className="form-control" type="number" step="any" placeholder="Seuil 3" value={b3} onChange={(e) => setB3(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-red" onClick={submit} disabled={saving}>{saving ? '...' : 'Créer'}</button>
        </div>
      </div>
    </Modal>
  )
}
