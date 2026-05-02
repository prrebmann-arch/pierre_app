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
import { PRESETS, type BloodtestPreset } from '@/lib/bloodtestCatalog'
import { type BloodtestUploadRow, type ExtractedData } from '@/lib/bloodtest'
import BloodtestAnalysisProgress, { ANALYSIS_TIMEOUT_MS } from '@/components/bloodtest/BloodtestAnalysisProgress'
import BloodtestDashboard from '@/components/bloodtest/BloodtestDashboard'
import PanelSuivi from '@/components/bloodtest/PanelSuivi'

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
  const [analyzing, setAnalyzing] = useState<{ uploadId: string; status: 'running' | 'stale' | 'error'; errorMessage?: string } | null>(null)
  const [pdfModal, setPdfModal] = useState<{ uploadId: string; urls: { url: string; mediaType: string }[] } | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [athleteInfo, setAthleteInfo] = useState<{ prenom?: string; sexe?: 'M' | 'F' } | null>(null)
  const [zoneOverrides, setZoneOverrides] = useState<Record<string, any>>({})

  const loadData = useCallback(async () => {
    try {
      const [{ data: ath, error: athErr }, { data: ups }, { data: cms }, { data: cp }] = await Promise.all([
        supabase.from('athletes').select('bloodtest_enabled, bloodtest_tracked_markers, prenom, genre').eq('id', params.id).single(),
        supabase.from('bloodtest_uploads')
          .select('id, athlete_id, uploaded_by, uploader_user_id, file_path, dated_at, uploaded_at, validated_at, validated_by, extracted_data, validated_data, ai_extraction_meta, archived_at, created_at')
          .eq('athlete_id', params.id).is('archived_at', null)
          .order('dated_at', { ascending: false, nullsFirst: false })
          .order('uploaded_at', { ascending: false }).limit(50),
        supabase.from('coach_custom_markers').select('id, marker_key, label, unit_canonical, category, zones').is('archived_at', null),
        user?.id ? supabase.from('coach_profiles').select('bloodtest_zone_overrides').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setZoneOverrides(((cp as any)?.bloodtest_zone_overrides as Record<string, any>) || {})
      if (athErr) { console.error('[bloodtest] athlete', athErr); toast(`Erreur: ${athErr.message}`, 'error'); return }
      setEnabled(ath?.bloodtest_enabled || false)
      setTracked(ath?.bloodtest_tracked_markers || [])
      setUploads((ups || []) as BloodtestUploadRow[])
      setCustomMarkers((cms || []) as CustomMarker[])
      const genre = (ath as any)?.genre
      const sexe: 'M' | 'F' | undefined = genre === 'homme' ? 'M' : genre === 'femme' ? 'F' : undefined
      setAthleteInfo({ prenom: (ath as any)?.prenom, sexe })
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
      toast(`${paths.length} screenshot${paths.length > 1 ? 's' : ''} envoyé${paths.length > 1 ? 's' : ''}, analyse IA en cours...`, 'success')
      loadData()
    } catch (e: any) {
      console.error('[bloodtest] upload', e)
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  const analysisEtaMs = useMemo(() => {
    const durations = uploads
      .map((u) => u.ai_extraction_meta?.duration_ms)
      .filter((d): d is number => typeof d === 'number' && d > 0)
      .slice(0, 10)
    if (durations.length === 0) return 12_000
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length
    return Math.max(5_000, Math.min(45_000, avg))
  }, [uploads])

  async function triggerExtract(uploadId: string, force = false) {
    setAnalyzing({ uploadId, status: 'running' })
    const staleTimer = setTimeout(() => {
      setAnalyzing((a) => (a && a.uploadId === uploadId && a.status === 'running' ? { ...a, status: 'stale' } : a))
    }, analysisEtaMs + 1000)
    const abort = new AbortController()
    const hardTimer = setTimeout(() => abort.abort(), ANALYSIS_TIMEOUT_MS)
    try {
      const res = await fetch('/api/bloodtest/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ upload_id: uploadId, force }),
        signal: abort.signal,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`)
      setAnalyzing(null)
      toast('Analyse terminée', 'success')
      loadData()
    } catch (e: any) {
      console.error('[bloodtest] extract', e)
      const msg = e.name === 'AbortError' ? 'délai dépassé' : (e.message || 'erreur inconnue')
      setAnalyzing({ uploadId, status: 'error', errorMessage: msg })
    } finally {
      clearTimeout(staleTimer)
      clearTimeout(hardTimer)
    }
  }

  async function deleteUpload(uploadId: string) {
    const { error } = await supabase.from('bloodtest_uploads').update({ archived_at: new Date().toISOString() }).eq('id', uploadId)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Bilan supprimé', 'success')
    loadData()
  }

  async function viewPdf(uploadId: string) {
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/bloodtest/signed-url?id=${uploadId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      const urls = Array.isArray(json.urls) && json.urls.length > 0
        ? json.urls
        : json.url ? [{ url: json.url, mediaType: 'application/pdf' }] : []
      if (urls.length === 0) { toast('Fichier introuvable', 'error'); return }
      setPdfModal({ uploadId, urls })
    } catch (e: any) {
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setPdfLoading(false)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Toggle checked={enabled} onChange={toggleEnabled} label="Prise de sang activée" />
        <input type="file" accept="image/jpeg,image/png" multiple id="bt-upload" hidden onChange={(e) => { const fs = e.target.files; if (fs && fs.length > 0) { uploadImages(Array.from(fs)); e.target.value = '' } }} />
        <Link href="/profile/marqueurs-sanguins" className="btn btn-outline btn-sm" title="Personnaliser les plages optimal/limite/hors zone de chaque marqueur">
          <i className="fas fa-sliders" /> Plages cliniques
        </Link>
        <button className="btn btn-red btn-sm" disabled={uploading} onClick={() => document.getElementById('bt-upload')?.click()}>
          <i className="fas fa-images" /> {uploading ? 'Upload...' : 'Upload screenshots'}
        </button>
      </div>

      {/* Panel suivi */}
      <PanelSuivi
        tracked={tracked}
        customMarkers={customMarkers}
        onApplyPreset={applyPreset}
        onToggleMarker={toggleMarker}
        onOpenCustomModal={() => setShowCustomModal(true)}
        athleteFirstName={athleteInfo?.prenom}
      />

      {/* Pending extraction */}
      {pendingExtraction.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-cog" style={{ color: 'var(--text3)' }} />
            En attente d'analyse ({pendingExtraction.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingExtraction.map((u) => {
              const fileCount = (u.file_path || '').split('|').filter((p: string) => p).length
              const live = analyzing && analyzing.uploadId === u.id ? analyzing : null
              return (
                <UploadCard
                  key={u.id}
                  upload={u}
                  fileCount={fileCount}
                  status="pending-extraction"
                  onAnalyse={() => triggerExtract(u.id)}
                  onView={() => viewPdf(u.id)}
                  onDelete={() => { if (confirm('Supprimer ce bilan ?')) deleteUpload(u.id) }}
                  liveProgress={live ? <BloodtestAnalysisProgress etaMs={analysisEtaMs} status={live.status} errorMessage={live.errorMessage} onRetry={() => triggerExtract(u.id)} /> : null}
                  pdfLoading={pdfLoading}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Pending validation */}
      {pendingValidation.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-hourglass-half" style={{ color: 'var(--warning)' }} />
            À valider ({pendingValidation.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingValidation.map((u) => {
              const fileCount = (u.file_path || '').split('|').filter((p: string) => p).length
              const markersCount = (u.extracted_data as ExtractedData | null)?.markers?.length || 0
              const live = analyzing && analyzing.uploadId === u.id ? analyzing : null
              return (
                <UploadCard
                  key={u.id}
                  upload={u}
                  fileCount={fileCount}
                  markersCount={markersCount}
                  status="pending-validation"
                  athleteId={params.id}
                  onReanalyse={() => { if (confirm('Relancer l\'analyse IA ? Les markers extraits seront remplacés.')) triggerExtract(u.id, true) }}
                  onView={() => viewPdf(u.id)}
                  onDelete={() => { if (confirm('Supprimer ce bilan ?')) deleteUpload(u.id) }}
                  liveProgress={live ? <BloodtestAnalysisProgress etaMs={analysisEtaMs} status={live.status} errorMessage={live.errorMessage} onRetry={() => triggerExtract(u.id, true)} /> : null}
                  pdfLoading={pdfLoading}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Dashboard / Historique */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-chart-line" style={{ color: 'var(--primary)' }} />
          Dashboard
        </h3>
        <BloodtestDashboard
          uploads={validated}
          tracked={tracked}
          customMarkers={customMarkers}
          onDelete={(uploadId) => { if (confirm('Supprimer ce bilan ? Les valeurs validées seront perdues.')) deleteUpload(uploadId) }}
          onViewPdf={(uploadId) => viewPdf(uploadId)}
          athleteSex={athleteInfo?.sexe}
          zoneOverrides={zoneOverrides}
        />
      </section>

      <CustomMarkerModal open={showCustomModal} onClose={() => setShowCustomModal(false)} onCreated={() => { setShowCustomModal(false); loadData() }} coachId={user?.id || ''} />

      {/* PDF preview modal */}
      <Modal isOpen={!!pdfModal} onClose={() => setPdfModal(null)} title="Aperçu du document">
        {pdfModal && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '80vh', overflow: 'auto' }}>
            {pdfModal.urls.map((f, i) => (
              f.mediaType === 'application/pdf' ? (
                <iframe key={i} src={f.url} style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 6 }} title={`PDF ${i + 1}`} />
              ) : (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer">
                  <img src={f.url} alt={`Screenshot ${i + 1}`} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                </a>
              )
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

function UploadCard({
  upload, fileCount, markersCount, status, athleteId, onAnalyse, onReanalyse, onView, onDelete, liveProgress, pdfLoading,
}: {
  upload: BloodtestUploadRow
  fileCount: number
  markersCount?: number
  status: 'pending-extraction' | 'pending-validation'
  athleteId?: string
  onAnalyse?: () => void
  onReanalyse?: () => void
  onView: () => void
  onDelete: () => void
  liveProgress: React.ReactNode
  pdfLoading: boolean
}) {
  const accent = status === 'pending-extraction' ? 'var(--text3)' : 'var(--warning)'
  const isPending = status === 'pending-extraction'

  return (
    <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fas ${isPending ? 'fa-cog' : 'fa-hourglass-half'}`} style={{ color: accent }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!isPending && athleteId ? (
            <Link href={`/athletes/${athleteId}/bloodtest/validate/${upload.id}`} style={{ textDecoration: 'none', color: 'var(--text)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Bilan du {new Date(upload.uploaded_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {markersCount} marker{(markersCount || 0) > 1 ? 's' : ''} extraits · {fileCount} fichier{fileCount > 1 ? 's' : ''} · clique pour valider
              </div>
            </Link>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Upload du {new Date(upload.uploaded_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {fileCount} fichier{fileCount > 1 ? 's' : ''} · pas encore analysé{fileCount > 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>
        {!liveProgress && (
          <>
            <button className="btn btn-outline btn-sm" onClick={onView} disabled={pdfLoading} title="Voir le PDF">
              <i className="fas fa-eye" /> PDF
            </button>
            {onAnalyse && (
              <button className="btn btn-red btn-sm" onClick={onAnalyse}>
                <i className="fas fa-wand-magic-sparkles" /> Analyse IA
              </button>
            )}
            {onReanalyse && (
              <button className="btn btn-outline btn-sm" onClick={onReanalyse} title="Relance l'analyse IA">
                <i className="fas fa-rotate" /> Réanalyser
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={onDelete} style={{ color: 'var(--red)' }} title="Supprimer">
              <i className="fas fa-trash" />
            </button>
          </>
        )}
      </div>
      {liveProgress && <div style={{ marginTop: 12 }}>{liveProgress}</div>}
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
