'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRecorder } from '@/contexts/RecorderContext'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { notifyAthlete } from '@/lib/push'
import Modal from '@/components/ui/Modal'

interface Props {
  athleteId: string
  onCreated?: () => void
  buttonClassName?: string
  label?: string
}

const QUICK_MESSAGES = [
  'Bon bilan, pas de changement, donne-toi à fond !',
  'Très beau résultat, continue comme ça !',
  'Bilan correct, on garde le cap !',
  'Super progression, rien à modifier !',
  'RAS, on continue sur cette lancée !',
]

type Tab = 'screen' | 'text'

export default function NouveauRetourButton({ athleteId, onCreated, buttonClassName, label }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { startRecording, isRecording, isProcessing, isUploading, enterPipWithStream } = useRecorder()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('screen')

  // ── Screen recording state ──
  const [withWebcam, setWithWebcam] = useState(false)
  const [starting, setStarting] = useState(false)
  const [previewCamStream, setPreviewCamStream] = useState<MediaStream | null>(null)
  const [previewMicStream, setPreviewMicStream] = useState<MediaStream | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)

  // Device pickers
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [selectedCamId, setSelectedCamId] = useState<string>('')

  // Bubble position (percent of canvas)
  const BUBBLE_DEFAULT = { xPct: 0.07, yPct: 0.93 }
  const [bubblePos, setBubblePos] = useState<{ xPct: number; yPct: number }>(() => {
    if (typeof window === 'undefined') return BUBBLE_DEFAULT
    try {
      const saved = window.localStorage.getItem('recorder.bubblePos')
      if (saved) {
        const p = JSON.parse(saved) as { xPct: number; yPct: number }
        if (typeof p.xPct === 'number' && typeof p.yPct === 'number') return p
      }
    } catch {}
    return BUBBLE_DEFAULT
  })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  // ── Text/Loom/Audio state ──
  const [loomUrl, setLoomUrl] = useState('')
  const [selectedChip, setSelectedChip] = useState<number>(-1)
  const [customMsg, setCustomMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const audio = useAudioRecorder({
    bucket: 'coach-audio',
    pathPrefix: `${user?.id || 'unknown'}/retour_${athleteId}_`,
  })

  function stopAllPreviews() {
    setPreviewCamStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
    setPreviewMicStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
    setPreviewError(null)
  }

  // Enumerate devices when modal opens
  useEffect(() => {
    if (!open) return
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
  }, [open, previewCamStream, previewMicStream])

  // Re-acquire cam if device changed mid-preview
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

  // Re-acquire mic if device changed mid-preview
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

  // Acquire cam preview based on webcam toggle (only on screen tab)
  useEffect(() => {
    let cancelled = false
    if (open && tab === 'screen' && withWebcam && !previewCamStream) {
      const constraint: MediaTrackConstraints = selectedCamId
        ? { deviceId: { exact: selectedCamId }, width: 320, height: 320 }
        : { width: 320, height: 320 }
      navigator.mediaDevices
        .getUserMedia({ video: constraint })
        .then((s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop())
            return
          }
          setPreviewCamStream(s)
        })
        .catch((err) => {
          if (cancelled) return
          setPreviewError(err instanceof Error ? err.message : 'Accès webcam refusé')
        })
    }
    if ((!withWebcam || tab !== 'screen' || !open) && previewCamStream) {
      previewCamStream.getTracks().forEach((t) => t.stop())
      setPreviewCamStream(null)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, withWebcam, selectedCamId, tab])

  // Pre-acquire mic when on the screen tab — saves a permission prompt at start
  useEffect(() => {
    let cancelled = false
    if (open && tab === 'screen' && !previewMicStream) {
      const constraint: MediaTrackConstraints | true = selectedMicId
        ? { deviceId: { exact: selectedMicId } }
        : true
      navigator.mediaDevices
        .getUserMedia({ audio: constraint })
        .then((s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop())
            return
          }
          setPreviewMicStream(s)
        })
        .catch(() => {})
    }
    if ((tab !== 'screen' || !open) && previewMicStream) {
      previewMicStream.getTracks().forEach((t) => t.stop())
      setPreviewMicStream(null)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, selectedMicId])

  // Bind cam stream to preview <video>
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

  function close() {
    stopAllPreviews()
    if (audio.isRecording) audio.stopRecording()
    audio.clearAudio()
    setOpen(false)
    setLoomUrl('')
    setSelectedChip(-1)
    setCustomMsg('')
    setWithWebcam(false)
    setTab('screen')
  }

  async function handleStartRecord() {
    setStarting(true)
    try {
      const camHandoff = previewCamStream
      const micHandoff = previewMicStream
      const pos = withWebcam ? bubblePos : null

      // Persist bubble position
      if (typeof window !== 'undefined' && withWebcam) {
        try { window.localStorage.setItem('recorder.bubblePos', JSON.stringify(bubblePos)) } catch {}
      }

      // CRITICAL: request PiP NOW while we still hold the user gesture
      // (getDisplayMedia inside startRecording will consume the activation
      // and prevent any subsequent PiP request).
      if (withWebcam && camHandoff) {
        await enterPipWithStream(camHandoff)
      }

      // Reset modal state — this also unmounts our local previews,
      // but we already handed off the streams to the recorder.
      setOpen(false)
      setWithWebcam(false)
      setLoomUrl('')
      setSelectedChip(-1)
      setCustomMsg('')
      // Don't stop preview streams — they're owned by the recorder now
      setPreviewCamStream(null)
      setPreviewMicStream(null)
      if (audio.isRecording) audio.stopRecording()
      audio.clearAudio()

      await startRecording({
        withWebcam,
        athleteId,
        preAcquiredCamStream: camHandoff,
        preAcquiredMicStream: micHandoff,
        micDeviceId: selectedMicId || undefined,
        camDeviceId: selectedCamId || undefined,
        bubblePosition: pos,
      })
    } catch (err) {
      previewCamStream?.getTracks().forEach((t) => t.stop())
      previewMicStream?.getTracks().forEach((t) => t.stop())
      const msg = err instanceof Error ? err.message : 'Erreur démarrage enregistrement'
      toast(msg, 'error')
    } finally {
      setStarting(false)
    }
  }

  async function handleSubmitOther() {
    const message = customMsg.trim() || (selectedChip >= 0 ? QUICK_MESSAGES[selectedChip] : '')
    const hasLoom = !!loomUrl.trim()
    const hasAudio = !!audio.audioUrl
    const hasMessage = !!message

    if (!hasLoom && !hasAudio && !hasMessage) {
      toast('Ajoute au moins un message, un Loom ou un vocal', 'error')
      return
    }

    setSaving(true)
    // Title is auto-derived (no input field anymore)
    const finalTitre = hasMessage ? message.slice(0, 40) : hasAudio ? 'Message vocal' : hasLoom ? 'Vidéo Loom' : 'Retour'
    const type = hasLoom ? (hasAudio ? 'mixed' : 'loom') : (hasAudio ? 'audio' : 'message')
    const { error } = await supabase.from('bilan_retours').insert({
      athlete_id: athleteId,
      coach_id: user?.id,
      titre: finalTitre,
      commentaire: message || null,
      loom_url: hasLoom ? loomUrl.trim() : null,
      audio_url: hasAudio ? audio.audioUrl : null,
      type,
    })
    setSaving(false)
    if (error) { toast("Erreur lors de l'envoi", 'error'); return }

    const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', athleteId).single()
    if (ath?.user_id) {
      const meta: Record<string, string> = {}
      if (hasLoom) meta.loom_url = loomUrl.trim()
      if (hasAudio && audio.audioUrl) meta.audio_url = audio.audioUrl
      if (hasMessage) meta.commentaire = message

      const notifTitle = hasAudio ? 'Message vocal de ton coach'
        : hasLoom ? 'Vidéo de ton coach'
        : 'Nouveau retour'
      const notifBody = hasMessage ? message
        : hasAudio ? "Ton coach t'a envoyé un message vocal"
        : hasLoom ? "Ton coach t'a envoyé une vidéo"
        : 'Nouveau retour'

      await notifyAthlete(ath.user_id, 'retour', notifTitle, notifBody, meta)
    }

    toast('Retour envoyé !', 'success')
    close()
    onCreated?.()
  }

  // Drag handlers
  function onBubbleDragStart(e: React.PointerEvent) {
    draggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onBubbleDragMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setBubblePos({
      xPct: Math.max(0.05, Math.min(0.95, x)),
      yPct: Math.max(0.05, Math.min(0.95, y)),
    })
  }
  function onBubbleDragEnd(e: React.PointerEvent) {
    draggingRef.current = false
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
  }

  const recordingBusy = isRecording || isProcessing || isUploading
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <>
      <button
        className={buttonClassName ?? 'btn btn-red'}
        onClick={() => setOpen(true)}
        disabled={recordingBusy}
        title={recordingBusy ? 'Un enregistrement est déjà en cours' : undefined}
      >
        <i className="fas fa-video" /> {label ?? 'Nouveau retour'}
      </button>

      <Modal isOpen={open} onClose={close} title="Nouveau retour">
        <div style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 480 }}>
          {/* ── Tab bar ── */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border, #2a2a2a)',
            background: 'var(--card-bg, #1a1a1a)',
          }}>
            <button
              onClick={() => setTab('screen')}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: 'transparent',
                color: tab === 'screen' ? 'var(--primary, #5b8dff)' : 'var(--text2)',
                border: 'none',
                borderBottom: tab === 'screen' ? '2px solid var(--primary, #5b8dff)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <i className="fas fa-desktop" style={{ marginRight: 6 }} />Enregistrer écran
            </button>
            <button
              onClick={() => setTab('text')}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: 'transparent',
                color: tab === 'text' ? 'var(--primary, #5b8dff)' : 'var(--text2)',
                border: 'none',
                borderBottom: tab === 'text' ? '2px solid var(--primary, #5b8dff)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <i className="fas fa-comment-alt" style={{ marginRight: 6 }} />Texte / Loom / Vocal
            </button>
          </div>

          {/* ── Tab content ── */}
          <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tab === 'screen' ? (
              <>
                {/* Devices row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <i className="fas fa-microphone" style={{ marginRight: 4 }} />Micro
                    </label>
                    <select
                      className="form-control"
                      style={{ fontSize: 13 }}
                      value={selectedMicId}
                      onChange={(e) => setSelectedMicId(e.target.value)}
                    >
                      {audioDevices.length === 0 && <option value="">Défaut</option>}
                      {audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Micro ${d.deviceId.slice(0, 6)}`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <i className="fas fa-video" style={{ marginRight: 4 }} />Caméra
                    </label>
                    <select
                      className="form-control"
                      style={{ fontSize: 13 }}
                      value={selectedCamId}
                      onChange={(e) => setSelectedCamId(e.target.value)}
                      disabled={!withWebcam}
                    >
                      {videoDevices.length === 0 && <option value="">Défaut</option>}
                      {videoDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Caméra ${d.deviceId.slice(0, 6)}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, padding: '8px 0' }}>
                  <input
                    type="checkbox"
                    checked={withWebcam}
                    onChange={(e) => setWithWebcam(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  Inclure ma webcam dans la vidéo
                </label>

                {withWebcam && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <i className="fas fa-arrows-alt" style={{ marginRight: 4 }} />Glisse la bulle où tu veux
                    </div>
                    <div
                      ref={stageRef}
                      style={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '16 / 9',
                        background: 'linear-gradient(135deg, #0a0a0a 0%, #1f1f1f 100%)',
                        border: '1px solid var(--border, #2a2a2a)',
                        borderRadius: 10,
                        overflow: 'hidden',
                        touchAction: 'none',
                      }}
                    >
                      <div
                        onPointerDown={onBubbleDragStart}
                        onPointerMove={onBubbleDragMove}
                        onPointerUp={onBubbleDragEnd}
                        onPointerCancel={onBubbleDragEnd}
                        style={{
                          position: 'absolute',
                          width: 70,
                          height: 70,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: '#000',
                          border: '3px solid var(--primary, #5b8dff)',
                          cursor: 'grab',
                          left: `calc(${bubblePos.xPct * 100}% - 35px)`,
                          top: `calc(${bubblePos.yPct * 100}% - 35px)`,
                          touchAction: 'none',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                        }}
                      >
                        {previewError ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--danger, #ff6464)', textAlign: 'center', padding: 4, pointerEvents: 'none' }}>
                            Cam KO
                          </div>
                        ) : previewCamStream ? (
                          <video
                            ref={previewVideoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', pointerEvents: 'none' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <i className="fas fa-spinner fa-spin" style={{ color: 'var(--text3)', fontSize: 16 }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                  <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
                  Tu te verras dans une fenêtre flottante (Picture-in-Picture) pendant l&apos;enregistrement. 15 min max.
                </p>

                <div style={{ flex: 1 }} />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={close} disabled={starting}>Annuler</button>
                  <button
                    className="btn btn-red"
                    onClick={handleStartRecord}
                    disabled={starting || (withWebcam && !previewCamStream && !previewError)}
                    style={{ minWidth: 130 }}
                  >
                    {starting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-circle" /> Démarrer</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Quick messages */}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <i className="fas fa-comment-dots" style={{ marginRight: 4 }} />Messages rapides
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {QUICK_MESSAGES.map((msg, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setSelectedChip(i); setCustomMsg('') }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 18,
                          fontSize: 12,
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
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <i className="fas fa-link" style={{ marginRight: 4 }} />Lien Loom (optionnel)
                  </label>
                  <input
                    type="url"
                    className="form-control"
                    value={loomUrl}
                    onChange={(e) => setLoomUrl(e.target.value)}
                    placeholder="https://www.loom.com/share/..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                      {audio.uploading ? (
                        <i className="fas fa-spinner fa-spin" />
                      ) : audio.isRecording ? (
                        <><i className="fas fa-stop" /> {formatTime(audio.seconds)}</>
                      ) : (
                        <><i className="fas fa-microphone" /> Enregistrer</>
                      )}
                    </button>
                    {audio.audioUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <audio controls src={audio.audioUrl} style={{ height: 32, flex: 1 }} />
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

                <div style={{ flex: 1 }} />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={close} disabled={saving || starting}>Annuler</button>
                  <button
                    className="btn btn-red"
                    onClick={handleSubmitOther}
                    disabled={saving || starting || audio.isRecording || audio.uploading}
                    style={{ minWidth: 130 }}
                  >
                    {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
