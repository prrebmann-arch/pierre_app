'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRecorder } from '@/contexts/RecorderContext'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { notifyAthlete } from '@/lib/push'

interface Props {
  athleteId: string
  /** When set (non-empty), the panel switches to broadcast mode :
   *  - Submits go to /api/annonces/broadcast (N rows bilan_retours).
   *  - Audio path uses `${user.id}/annonce_${ts}_` (no athleteId).
   *  - Screen recording calls /api/annonces/broadcast after upload.
   *  - athleteId is ignored (pass empty string when broadcasting). */
  broadcastIds?: string[]
  onCreated?: () => void
  /** Called after a successful submit/start so the parent can close a modal */
  onAfter?: () => void
  /** Whether the panel is "active" (mounted and visible) — drives device acquisition */
  active?: boolean
  /** Optional execution_videos.id — when set, the push notif metadata
   *  carries video_id + coach_notes so the athlete app routes the tap to
   *  VideoRetour with the source exercise video instead of the dashboard. */
  videoId?: string
}

const QUICK_MESSAGES = [
  'Bon bilan, pas de changement, donne-toi à fond !',
  'Très beau résultat, continue comme ça !',
  'Bilan correct, on garde le cap !',
  'Super progression, rien à modifier !',
  'RAS, on continue sur cette lancée !',
]

type Tab = 'text' | 'screen'

export default function NouveauRetourPanel({ athleteId, broadcastIds, onCreated, onAfter, active = true, videoId }: Props) {
  const isBroadcast = !!(broadcastIds && broadcastIds.length > 0)
  const { user, accessToken } = useAuth()
  const { toast } = useToast()
  const { startRecording, isRecording, isProcessing, isUploading } = useRecorder()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('text')

  // Screen recording state
  // Recording sub-mode within the "Écran ou Loom" tab:
  // - 'screen' (default) → captures the screen, optional cam bubble overlay (in-page)
  // - 'selfie' → portrait cam only (no screen share, no getDisplayMedia prompt)
  const [recordMode, setRecordMode] = useState<'screen' | 'selfie'>('screen')
  const [withWebcam, setWithWebcam] = useState(false)
  const [starting, setStarting] = useState(false)
  const [previewCamStream, setPreviewCamStream] = useState<MediaStream | null>(null)
  const [previewMicStream, setPreviewMicStream] = useState<MediaStream | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const handoffRef = useRef(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [selectedCamId, setSelectedCamId] = useState<string>('')

  // Text + audio + Loom state
  const [selectedChip, setSelectedChip] = useState<number>(-1)
  const [customMsg, setCustomMsg] = useState('')
  const [loomUrl, setLoomUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const audio = useAudioRecorder({
    bucket: 'coach-audio',
    pathPrefix: isBroadcast
      ? `${user?.id || 'unknown'}/annonce_`
      : `${user?.id || 'unknown'}/retour_${athleteId}_`,
  })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      if (cancelled) return
      const a = devices.filter((d) => d.kind === 'audioinput')
      const v = devices.filter((d) => d.kind === 'videoinput')
      setAudioDevices(a)
      setVideoDevices(v)
      if (!selectedMicId && a[0]) setSelectedMicId(a[0].deviceId)
      if (!selectedCamId && v[0]) setSelectedCamId(v[0].deviceId)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, previewCamStream, previewMicStream])

  useEffect(() => {
    if (previewCamStream && withWebcam && selectedCamId) {
      const tk = previewCamStream.getVideoTracks()[0]
      const s = tk?.getSettings()
      if (s?.deviceId && s.deviceId !== selectedCamId) {
        previewCamStream.getTracks().forEach((t) => t.stop())
        setPreviewCamStream(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamId])

  useEffect(() => {
    if (previewMicStream && selectedMicId) {
      const tk = previewMicStream.getAudioTracks()[0]
      const s = tk?.getSettings()
      if (s?.deviceId && s.deviceId !== selectedMicId) {
        previewMicStream.getTracks().forEach((t) => t.stop())
        setPreviewMicStream(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMicId])

  // Need cam preview when:
  // - on screen tab + withWebcam toggle ON (small preview for the bubble)
  // - on screen tab + selfie mode (cam IS the recording, want full preview)
  const needCamPreview = active && tab === 'screen' && (recordMode === 'selfie' || withWebcam)

  useEffect(() => {
    let cancelled = false
    if (needCamPreview && !previewCamStream) {
      // Selfie mode wants portrait constraints; screen mode keeps the small preview
      const constraint: MediaTrackConstraints = recordMode === 'selfie'
        ? (selectedCamId
            ? { deviceId: { exact: selectedCamId }, width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 }, facingMode: 'user' }
            : { width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 }, facingMode: 'user' })
        : (selectedCamId
            ? { deviceId: { exact: selectedCamId }, width: 320, height: 320 }
            : { width: 320, height: 320 })
      navigator.mediaDevices.getUserMedia({ video: constraint }).then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        setPreviewCamStream(s)
      }).catch((err) => {
        if (cancelled) return
        setPreviewError(err instanceof Error ? err.message : 'Accès webcam refusé')
      })
    }
    if (!needCamPreview && previewCamStream && !handoffRef.current) {
      previewCamStream.getTracks().forEach((t) => t.stop())
      setPreviewCamStream(null)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needCamPreview, selectedCamId, recordMode])

  useEffect(() => {
    let cancelled = false
    if (active && tab === 'screen' && !previewMicStream) {
      const constraint: MediaTrackConstraints | true = selectedMicId
        ? { deviceId: { exact: selectedMicId } }
        : true
      navigator.mediaDevices.getUserMedia({ audio: constraint }).then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        setPreviewMicStream(s)
      }).catch(() => {})
    }
    if ((tab !== 'screen' || !active) && previewMicStream && !handoffRef.current) {
      previewMicStream.getTracks().forEach((t) => t.stop())
      setPreviewMicStream(null)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tab, selectedMicId])

  useEffect(() => {
    const v = previewVideoRef.current
    if (!v) return
    if (previewCamStream && v.srcObject !== previewCamStream) {
      v.srcObject = previewCamStream
      v.play().catch(() => {})
    } else if (!previewCamStream && v.srcObject) {
      v.srcObject = null
    }
  }, [previewCamStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (handoffRef.current) return
      previewCamStream?.getTracks().forEach((t) => t.stop())
      previewMicStream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function reset() {
    setLoomUrl('')
    setSelectedChip(-1)
    setCustomMsg('')
    setWithWebcam(false)
    setRecordMode('screen')
    if (audio.isRecording) audio.stopRecording()
    audio.clearAudio()
  }

  async function handleStartRecord() {
    setStarting(true)
    handoffRef.current = true
    try {
      const camHandoff = previewCamStream
      const micHandoff = previewMicStream
      const modeAtStart = recordMode
      setWithWebcam(false)
      setPreviewCamStream(null)
      setPreviewMicStream(null)
      reset()
      // Selfie mode reuses the pre-acquired cam stream as the actual video source.
      // Screen mode hands the cam off to LiveCamBubble for the in-page preview.
      micHandoff?.getTracks().forEach((t) => t.stop())
      await startRecording({
        withWebcam: modeAtStart === 'selfie' ? true : !!camHandoff,
        athleteId: isBroadcast ? '' : athleteId,
        broadcastIds: isBroadcast ? broadcastIds : undefined,
        preAcquiredCamStream: camHandoff,
        mode: modeAtStart,
        executionVideoId: isBroadcast ? undefined : videoId,
      })
      onAfter?.()
    } catch (err) {
      previewCamStream?.getTracks().forEach((t) => t.stop())
      previewMicStream?.getTracks().forEach((t) => t.stop())
      const msg = err instanceof Error ? err.message : 'Erreur démarrage enregistrement'
      toast(msg, 'error')
    } finally {
      setStarting(false)
      handoffRef.current = false
    }
  }

  async function handleSubmit() {
    const message = customMsg.trim() || (selectedChip >= 0 ? QUICK_MESSAGES[selectedChip] : '')
    const hasLoom = !!loomUrl.trim()
    const hasAudio = !!audio.audioUrl
    const hasMessage = !!message
    if (!hasLoom && !hasAudio && !hasMessage) {
      toast('Ajoute un message, un Loom ou un vocal', 'error')
      return
    }
    // try/finally guarantees the button re-enables even if a sync throw
    // occurs before the manual setSaving(false) below (network drop on insert).
    try {
      setSaving(true)
      const finalTitre = hasMessage
        ? message.slice(0, 40)
        : hasAudio ? 'Message vocal'
        : hasLoom ? 'Vidéo Loom'
        : 'Retour'
      const type = hasLoom ? (hasAudio ? 'mixed' : 'loom') : (hasAudio ? 'audio' : 'message')

      // Broadcast mode : single API call to /api/annonces/broadcast (N inserts + 1 push batch)
      if (isBroadcast) {
        const res = await fetch('/api/annonces/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            athlete_ids: broadcastIds,
            type,
            titre: finalTitre,
            commentaire: message || null,
            audio_url: hasAudio ? audio.audioUrl : null,
            loom_url: hasLoom ? loomUrl.trim() : null,
          }),
        })
        const json = await res.json()
        if (!res.ok) { toast(`Erreur: ${json.error || res.status}`, 'error'); return }
        toast(`Envoyé à ${json.inserted} athlète${json.inserted > 1 ? 's' : ''} !`, 'success')
        reset()
        onCreated?.()
        onAfter?.()
        return
      }

      const { error } = await supabase.from('bilan_retours').insert({
        athlete_id: athleteId,
        coach_id: user?.id,
        titre: finalTitre,
        commentaire: message || null,
        loom_url: hasLoom ? loomUrl.trim() : null,
        audio_url: hasAudio ? audio.audioUrl : null,
        type,
        // Link to the originating exercise video so the athlete's Guide tab
        // (in ExerciseDetailScreen) can surface this retour while practicing
        // the same exercise.
        execution_video_id: videoId || null,
      })
      if (error) { toast("Erreur lors de l'envoi", 'error'); return }

      const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', athleteId).single()
      if (ath?.user_id) {
        const meta: Record<string, string> = {}
        if (hasLoom) meta.loom_url = loomUrl.trim()
        if (hasAudio && audio.audioUrl) meta.audio_url = audio.audioUrl
        if (hasMessage) {
          meta.commentaire = message
          // Athlete app reads `coach_notes` for the body shown on the retour
          // detail screen (matches the legacy field used by the old correction flow).
          meta.coach_notes = message
        }
        // When the retour was triggered from a specific exercise video page,
        // include video_id so the athlete app routes the notif tap to the
        // VideoRetour screen with the source video instead of the dashboard.
        if (videoId) meta.video_id = videoId

        const ctxLabel = videoId ? 'sur ton exercice' : ''
        const notifTitle = hasAudio
          ? `Message vocal de ton coach${ctxLabel ? ' ' + ctxLabel : ''}`
          : hasLoom
          ? `Vidéo de ton coach${ctxLabel ? ' ' + ctxLabel : ''}`
          : videoId
          ? 'Retour sur ton exercice'
          : 'Nouveau retour'
        const notifBody = hasMessage ? message
          : hasAudio ? "Ton coach t'a envoyé un message vocal"
          : hasLoom ? "Ton coach t'a envoyé une vidéo"
          : 'Nouveau retour'
        await notifyAthlete(ath.user_id, 'retour', notifTitle, notifBody, meta)
      }
      toast('Retour envoyé !', 'success')
      reset()
      onCreated?.()
      onAfter?.()
    } finally {
      setSaving(false)
    }
  }

  const recordingBusy = isRecording || isProcessing || isUploading
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '12px 14px',
    background: 'transparent',
    color: active ? 'var(--primary, #5b8dff)' : 'var(--text2)',
    border: 'none',
    borderBottom: active ? '2px solid var(--primary, #5b8dff)' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  })

  const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #2a2a2a)' }}>
        <button onClick={() => setTab('text')} style={tabBtn(tab === 'text')} disabled={recordingBusy}>
          <i className="fas fa-comment-alt" style={{ marginRight: 6 }} />Texte ou vocal
        </button>
        <button onClick={() => setTab('screen')} style={tabBtn(tab === 'screen')} disabled={recordingBusy}>
          <i className="fas fa-desktop" style={{ marginRight: 6 }} />Écran ou Loom
        </button>
      </div>

      <div style={{ padding: '16px 4px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'text' ? (
          <>
            <div>
              <div style={labelStyle}>
                <i className="fas fa-comment-dots" style={{ marginRight: 4 }} />Messages rapides
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUICK_MESSAGES.map((msg, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setSelectedChip(i); setCustomMsg('') }}
                    style={{
                      padding: '7px 11px',
                      borderRadius: 18,
                      fontSize: 11,
                      border: '1px solid var(--border, #2a2a2a)',
                      background: selectedChip === i && !customMsg.trim() ? 'var(--primary, #5b8dff)' : 'transparent',
                      color: selectedChip === i && !customMsg.trim() ? '#fff' : 'var(--text2)',
                      cursor: 'pointer',
                    }}
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fas fa-pen" style={{ marginRight: 4 }} />Message libre
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={customMsg}
                onChange={(e) => { setCustomMsg(e.target.value); setSelectedChip(-1) }}
                placeholder="Écris ton message…"
              />
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: 6 }}>
                <i className="fas fa-microphone" style={{ marginRight: 4 }} />Message vocal
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => audio.isRecording ? audio.stopRecording() : audio.startRecording()}
                  disabled={audio.uploading}
                  style={audio.isRecording ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : undefined}
                >
                  {audio.uploading ? <i className="fas fa-spinner fa-spin" />
                    : audio.isRecording ? <><i className="fas fa-stop" /> {formatTime(audio.seconds)}</>
                    : <><i className="fas fa-microphone" /> Enregistrer</>}
                </button>
                {audio.audioUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <audio controls src={audio.audioUrl} style={{ height: 30, flex: 1 }} />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={audio.clearAudio}
                      style={{ padding: '3px 6px', color: 'var(--danger)' }}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              className="btn btn-red"
              onClick={handleSubmit}
              disabled={saving || starting || audio.isRecording || audio.uploading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
          </>
        ) : (
          <>
            {/* Mode selector — Écran + cam vs Selfie portrait */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setRecordMode('screen')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: recordMode === 'screen' ? '2px solid var(--primary, #5b8dff)' : '1px solid var(--border, #2a2a2a)',
                  background: recordMode === 'screen' ? 'rgba(91,141,255,0.1)' : 'transparent',
                  color: recordMode === 'screen' ? 'var(--primary, #5b8dff)' : 'var(--text2)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                <i className="fas fa-desktop" style={{ marginRight: 6 }} />Écran + cam
              </button>
              <button
                type="button"
                onClick={() => setRecordMode('selfie')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: recordMode === 'selfie' ? '2px solid var(--primary, #5b8dff)' : '1px solid var(--border, #2a2a2a)',
                  background: recordMode === 'selfie' ? 'rgba(91,141,255,0.1)' : 'transparent',
                  color: recordMode === 'selfie' ? 'var(--primary, #5b8dff)' : 'var(--text2)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                <i className="fas fa-mobile-screen" style={{ marginRight: 6 }} />Selfie portrait
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>
                  <i className="fas fa-microphone" style={{ marginRight: 4 }} />Micro
                </label>
                <select
                  className="form-control"
                  style={{ fontSize: 12, width: '100%', maxWidth: '100%' }}
                  value={selectedMicId}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                >
                  {audioDevices.length === 0 && <option value="">Défaut</option>}
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Micro ${d.deviceId.slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>
                  <i className="fas fa-video" style={{ marginRight: 4 }} />Caméra
                </label>
                <select
                  className="form-control"
                  style={{ fontSize: 12, width: '100%', maxWidth: '100%' }}
                  value={selectedCamId}
                  onChange={(e) => setSelectedCamId(e.target.value)}
                  disabled={recordMode === 'screen' && !withWebcam}
                >
                  {videoDevices.length === 0 && <option value="">Défaut</option>}
                  {videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Caméra ${d.deviceId.slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Webcam toggle — only in screen mode (selfie always uses cam) */}
            {recordMode === 'screen' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, padding: '4px 0' }}>
                <input
                  type="checkbox"
                  checked={withWebcam}
                  onChange={(e) => setWithWebcam(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Inclure ma webcam
              </label>
            )}

            {/* Cam preview */}
            {recordMode === 'screen' && withWebcam && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%', overflow: 'hidden',
                  background: '#000', border: '2px solid var(--primary, #5b8dff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {previewError ? (
                    <span style={{ fontSize: 8, color: 'var(--danger, #ff6464)', textAlign: 'center', padding: 2 }}>{previewError}</span>
                  ) : previewCamStream ? (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <i className="fas fa-spinner fa-spin" style={{ color: 'var(--text3)', fontSize: 12 }} />
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Cercle déplaçable pendant l&apos;enregistrement
                </span>
              </div>
            )}

            {/* Selfie mode — large portrait preview */}
            {recordMode === 'selfie' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 144, height: 256, borderRadius: 12, overflow: 'hidden',
                  background: '#000', border: '2px solid var(--primary, #5b8dff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {previewError ? (
                    <span style={{ fontSize: 11, color: 'var(--danger, #ff6464)', textAlign: 'center', padding: 8 }}>{previewError}</span>
                  ) : previewCamStream ? (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <i className="fas fa-spinner fa-spin" style={{ color: 'var(--text3)' }} />
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                  Aperçu — la vidéo finale aura ce format vertical (9:16)
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, margin: '2px 0' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border, #2a2a2a)' }} />
              ou Loom
              <span style={{ flex: 1, height: 1, background: 'var(--border, #2a2a2a)' }} />
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fas fa-link" style={{ marginRight: 4 }} />Lien Loom
              </label>
              <input
                type="url"
                className="form-control"
                value={loomUrl}
                onChange={(e) => setLoomUrl(e.target.value)}
                placeholder="https://www.loom.com/share/..."
              />
            </div>

            {loomUrl.trim() ? (
              <button
                className="btn btn-red"
                onClick={handleSubmit}
                disabled={saving || starting}
                style={{ width: '100%', marginTop: 4 }}
              >
                {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer Loom</>}
              </button>
            ) : (
              <button
                className="btn btn-red"
                onClick={handleStartRecord}
                disabled={
                  starting ||
                  (recordMode === 'selfie' && !previewCamStream && !previewError) ||
                  (recordMode === 'screen' && withWebcam && !previewCamStream && !previewError)
                }
                style={{ width: '100%', marginTop: 4 }}
              >
                {starting
                  ? <i className="fas fa-spinner fa-spin" />
                  : recordMode === 'selfie'
                    ? <><i className="fas fa-mobile-screen" /> Démarrer selfie portrait</>
                    : <><i className="fas fa-circle" /> Démarrer enregistrement écran</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
