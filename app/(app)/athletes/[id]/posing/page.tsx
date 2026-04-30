'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Toggle from '@/components/ui/Toggle'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { notifyAthlete } from '@/lib/push'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterKey = 'a_traiter' | 'traite' | 'all'

export default function PosingPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_posing`
  const [cached] = useState(() => getPageCache<{ enabled: boolean; videos: any[]; retours: any[] }>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [posingEnabled, setPosingEnabled] = useState(cached?.enabled ?? false)
  const [videos, setVideos] = useState<any[]>(cached?.videos ?? [])
  const [retours, setRetours] = useState<any[]>(cached?.retours ?? [])
  const [filter, setFilter] = useState<FilterKey>('a_traiter')
  const [viewingVideo, setViewingVideo] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalVideoId, setModalVideoId] = useState<string | null>(null)
  const [formLoom, setFormLoom] = useState('')
  const [formTitre, setFormTitre] = useState('')
  const [formComment, setFormComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Vocal recording
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const recordStartRef = useRef<number>(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPreviewUrl = useMemo(() => audioBlob ? URL.createObjectURL(audioBlob) : null, [audioBlob])

  const loadData = useCallback(async () => {
    if (!videos.length && !cached) setLoading(true)
    try {
      const { data: ath } = await supabase.from('athletes').select('posing_enabled').eq('id', params.id).single()
      const enabled = ath?.posing_enabled || false
      setPosingEnabled(enabled)

      if (!enabled) {
        setPageCache(cacheKey, { enabled: false, videos: [], retours: [] })
        return
      }

      const [{ data: vids }, { data: rets }] = await Promise.all([
        supabase.from('posing_videos').select('id, athlete_id, video_url, thumbnail_url, status, commentaire, created_at').eq('athlete_id', params.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('posing_retours').select('id, athlete_id, coach_id, loom_url, audio_url, titre, commentaire, posing_video_id, created_at').eq('athlete_id', params.id).order('created_at', { ascending: false }).limit(100),
      ])
      const vidsData = vids || []
      const retsData = rets || []
      setVideos(vidsData)
      setRetours(retsData)
      setPageCache(cacheKey, { enabled, videos: vidsData, retours: retsData })
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadData()
  }, [params.id, loadData])

  useRefetchOnResume(loadData, loading)

  async function togglePosing(on: boolean) {
    const { error } = await supabase.from('athletes').update({ posing_enabled: on }).eq('id', params.id)
    if (error) { toast('Erreur', 'error'); return }
    toast(on ? 'Posing active' : 'Posing desactive', 'success')
    setPosingEnabled(on)
    if (on) loadData()
  }

  async function markTraite(videoId: string) {
    const { error } = await supabase.from('posing_videos').update({ status: 'traite' }).eq('id', videoId)
    if (error) { toast('Erreur', 'error'); return }
    toast('Video marquee comme traitee', 'success')
    setViewingVideo(null)
    loadData()
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Prefer audio/mp4 (iOS Safari native, Chrome plays it).
      // webm;opus is a fallback for Chrome/Firefox desktop — but iOS Safari on
      // the athlete side can't play webm, so this is strictly a fallback.
      const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2') ? 'audio/mp4;codecs=mp4a.40.2'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : ''
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        setAudioDuration(Math.round((Date.now() - recordStartRef.current) / 1000))
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      recordStartRef.current = Date.now()
      setRecording(true)
    } catch (e: any) {
      console.error('[posing] mic error', e)
      toast(`Micro indisponible: ${e.message || e}`, 'error')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function resetAudio() {
    setAudioBlob(null)
    setAudioDuration(0)
  }

  function resetForm() {
    setFormLoom(''); setFormTitre(''); setFormComment('')
    resetAudio()
  }

  async function uploadAudioBlob(blob: Blob): Promise<string | null> {
    // `coach-audio` bucket accepts audio/webm, audio/mp4, audio/mpeg, audio/ogg.
    // The `execution-videos` bucket is locked to video/* mime types.
    const ext = blob.type.includes('mp4') ? 'm4a'
      : blob.type.includes('ogg') ? 'ogg'
      : blob.type.includes('mpeg') ? 'mp3'
      : 'webm'
    const path = `posing-retours/${params.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('coach-audio')
      .upload(path, blob, { contentType: blob.type, upsert: false })
    if (error) { console.error('[posing] audio upload error:', error); throw new Error(error.message) }
    const { data: signed } = await supabase.storage
      .from('coach-audio')
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5) // 5 years
    return signed?.signedUrl || null
  }

  async function submitCorrection() {
    const loom = formLoom.trim()
    const comment = formComment.trim()
    if (!loom && !comment && !audioBlob) {
      toast('Ajoute un message, un vocal ou une URL Loom', 'error')
      return
    }
    setSaving(true)
    try {
      let audioUrl: string | null = null
      if (audioBlob) audioUrl = await uploadAudioBlob(audioBlob)

      const { error } = await supabase.from('posing_retours').insert({
        athlete_id: params.id,
        coach_id: user?.id,
        posing_video_id: modalVideoId || null,
        loom_url: loom || null,
        titre: formTitre.trim() || 'Correction posing',
        commentaire: comment || null,
        audio_url: audioUrl,
      })
      if (error) throw error

      // Notify athlete (in-app DB row + push if they have a token)
      const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', params.id).single()
      if (ath?.user_id) {
        const bodyPreview = comment ? comment.slice(0, 80) : audioUrl ? 'Message vocal du coach' : loom ? 'Correction posing' : 'Nouveau retour'
        await notifyAthlete(
          ath.user_id,
          'posing_retour',
          'Correction posing',
          bodyPreview,
          { loom_url: loom || null, audio_url: audioUrl, titre: formTitre.trim() || 'Correction posing' },
        )
      }

      toast('Correction posing envoyee !', 'success')
      setShowModal(false)
      resetForm()
      loadData()
    } catch (e: any) {
      console.error('[posing] submitCorrection error:', e)
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRetour(id: string) {
    if (!confirm('Supprimer cette correction ?')) return
    const { error } = await supabase.from('posing_retours').delete().eq('id', id)
    if (error) { toast('Erreur', 'error'); return }
    toast('Correction supprimee', 'success')
    loadData()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  if (!posingEnabled) {
    return (
      <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
        <i className="fas fa-person" style={{ fontSize: 36, color: 'var(--text3)', marginBottom: 16, display: 'block' }} />
        <p style={{ color: 'var(--text3)', marginBottom: 16 }}>Posing desactive pour cet athlete</p>
        <Toggle checked={false} onChange={togglePosing} />
      </div>
    )
  }

  // Video detail view — 2 column layout: video left, correction form right
  if (viewingVideo) {
    const v = viewingVideo
    const date = new Date(v.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const isPending = v.status === 'a_traiter'
    // Ensure modalVideoId tracks the current video so submitCorrection links it
    if (modalVideoId !== v.id) setModalVideoId(v.id)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setViewingVideo(null); resetForm() }}><i className="fas fa-arrow-left" /> Retour</button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{v.titre || 'Posing'}</span>
          <Badge variant={isPending ? 'warning' : 'success'}>{isPending ? 'A traiter' : 'Traite'}</Badge>
          {isPending && (
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--success)', marginLeft: 'auto' }} onClick={() => markTraite(v.id)}>
              <i className="fas fa-check" /> Marquer traite
            </button>
          )}
        </div>

        <div className="posingDetailGrid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 420px)', gap: 16, alignItems: 'start' }}>
          {/* LEFT: Video */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: 10 }}>
              <video
                controls
                playsInline
                src={v.video_url}
                style={{ width: 'auto', maxWidth: '100%', maxHeight: '75vh', borderRadius: 10, background: '#000' }}
              />
            </div>
            {v.commentaire && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--bg2)', borderRadius: 8, fontSize: 13, color: 'var(--text2)' }}>
                <i className="fas fa-quote-left" style={{ color: 'var(--text3)', marginRight: 6 }} />{v.commentaire}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{date}</div>
          </div>

          {/* RIGHT: Correction form */}
          <div style={{ padding: 16, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <i className="fas fa-paper-plane" style={{ marginRight: 6, color: 'var(--primary)' }} />
              Envoyer un retour
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                <i className="fas fa-comment" style={{ marginRight: 6 }} />Message texte
              </label>
              <textarea className="form-control" rows={3} value={formComment} onChange={(e) => setFormComment(e.target.value)} placeholder="Ton message à l'athlète..." />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                <i className="fas fa-microphone" style={{ marginRight: 6 }} />Message vocal
              </label>
              {audioBlob ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'var(--bg3)', borderRadius: 8 }}>
                  <audio controls src={audioPreviewUrl || undefined} style={{ flex: 1, height: 36 }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{audioDuration}s</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={resetAudio} title="Réenregistrer">
                    <i className="fas fa-trash" />
                  </button>
                </div>
              ) : recording ? (
                <button type="button" className="btn btn-red" onClick={stopRecording} style={{ width: '100%' }}>
                  <i className="fas fa-stop-circle" style={{ marginRight: 6 }} />Arrêter l'enregistrement
                </button>
              ) : (
                <button type="button" className="btn btn-outline" onClick={startRecording} style={{ width: '100%' }}>
                  <i className="fas fa-microphone" style={{ marginRight: 6 }} />Enregistrer un message vocal
                </button>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                <i className="fas fa-link" style={{ marginRight: 6 }} />URL Loom (optionnel)
              </label>
              <input type="url" className="form-control" value={formLoom} onChange={(e) => setFormLoom(e.target.value)} placeholder="https://www.loom.com/share/..." />
            </div>

            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Au moins un des trois est requis.</div>

            <button
              className="btn btn-red"
              onClick={submitCorrection}
              disabled={saving || recording}
              style={{ marginTop: 4 }}
            >
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" />  Envoyer le retour</>}
            </button>
          </div>
        </div>

        <style jsx>{`
          @media (max-width: 900px) {
            :global(.posingDetailGrid) {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    )
  }

  const filtered = filter === 'all' ? videos : videos.filter((v) => v.status === filter)
  const countPending = videos.filter((v) => v.status === 'a_traiter').length
  const countDone = videos.filter((v) => v.status === 'traite').length

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'a_traiter', label: 'A traiter', count: countPending },
    { key: 'traite', label: 'Traite', count: countDone },
    { key: 'all', label: 'Tout', count: videos.length },
  ]

  return (
    <div>
      {/* Toggle + send correction */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 8, flexWrap: 'wrap' }}>
        <Toggle checked={posingEnabled} onChange={togglePosing} label="Posing active" />
        <button className="btn btn-red btn-sm" onClick={() => { setModalVideoId(null); setShowModal(true) }}>
          <i className="fas fa-video" style={{ marginRight: 4 }} /> Envoyer une correction
        </button>
      </div>

      {/* Videos received */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
        <i className="fas fa-film" style={{ color: 'var(--primary)', marginRight: 6 }} />Videos recues
      </h3>

      <div className={styles.filterBar}>
        {filters.map((f) => (
          <button key={f.key} className={filter === f.key ? styles.filterBtnActive : styles.filterBtn} onClick={() => setFilter(f.key)}>
            {f.label} <span className={styles.filterCount}>{f.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="fas fa-inbox" message={`Aucune video posing ${filter === 'a_traiter' ? 'a traiter' : filter === 'traite' ? 'traitee' : ''}`} />
      ) : (
        <div className={styles.posingGrid}>
          {filtered.map((v) => {
            const date = new Date(v.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
            return (
              <div key={v.id} className={styles.posingCard} onClick={() => setViewingVideo(v)}>
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" className={styles.posingThumb} />
                ) : (
                  <div className={styles.posingThumbPlaceholder}><i className="fas fa-play-circle" style={{ fontSize: 32, color: 'var(--text3)' }} /></div>
                )}
                <div style={{ padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{v.titre || 'Posing'}</span>
                    <Badge variant={v.status === 'traite' ? 'success' : 'warning'}>{v.status === 'traite' ? 'Traite' : 'A traiter'}</Badge>
                  </div>
                  {v.commentaire && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{v.commentaire.substring(0, 60)}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{date}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Corrections sent */}
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '24px 0 10px' }}>
        <i className="fas fa-comment-dots" style={{ color: 'var(--primary)', marginRight: 6 }} />Corrections envoyees
      </h3>

      {retours.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 13 }}>Aucune correction envoyee</div>
      ) : (
        retours.map((r) => {
          const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
          return (
            <div key={r.id} className={styles.retourCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(179,8,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-video" style={{ color: 'var(--primary)', fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.titre || 'Correction posing'}</div>
                  {r.commentaire && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{r.commentaire}</div>}
                  {r.audio_url && (
                    <audio controls src={r.audio_url} style={{ marginTop: 6, width: '100%', maxWidth: 300, height: 32 }} />
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {r.loom_url && (
                  <a href={r.loom_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><i className="fas fa-external-link-alt" /></a>
                )}
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteRetour(r.id)}><i className="fas fa-trash" /></button>
              </div>
            </div>
          )
        })
      )}

      {/* Correction modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }} title="Envoyer une correction posing">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
              <i className="fas fa-comment" style={{ marginRight: 6 }} />Message texte
            </label>
            <textarea className="form-control" rows={3} value={formComment} onChange={(e) => setFormComment(e.target.value)} placeholder="Ton message à l'athlète..." />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
              <i className="fas fa-microphone" style={{ marginRight: 6 }} />Message vocal
            </label>
            {audioBlob ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'var(--bg3)', borderRadius: 8 }}>
                <audio controls src={audioPreviewUrl || undefined} style={{ flex: 1, height: 36 }} />
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{audioDuration}s</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={resetAudio} title="Réenregistrer">
                  <i className="fas fa-trash" />
                </button>
              </div>
            ) : recording ? (
              <button type="button" className="btn btn-red" onClick={stopRecording} style={{ width: '100%' }}>
                <i className="fas fa-stop-circle" style={{ marginRight: 6 }} />
                Arrêter l'enregistrement
              </button>
            ) : (
              <button type="button" className="btn btn-outline" onClick={startRecording} style={{ width: '100%' }}>
                <i className="fas fa-microphone" style={{ marginRight: 6 }} />
                Enregistrer un message vocal
              </button>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
              <i className="fas fa-link" style={{ marginRight: 6 }} />URL Loom (optionnel)
            </label>
            <input type="url" className="form-control" value={formLoom} onChange={(e) => setFormLoom(e.target.value)} placeholder="https://www.loom.com/share/..." />
          </div>

          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Au moins un des trois est requis : message, vocal ou Loom.
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => { setShowModal(false); resetForm() }}>Annuler</button>
            <button className="btn btn-red" onClick={submitCorrection} disabled={saving || recording}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
