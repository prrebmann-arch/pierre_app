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
  /** Controlled open state — when provided, the trigger button is hidden and
   *  the modal opens/closes based on this prop. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const QUICK_MESSAGES = [
  'Bon bilan, pas de changement, donne-toi à fond !',
  'Très beau résultat, continue comme ça !',
  'Bilan correct, on garde le cap !',
  'Super progression, rien à modifier !',
  'RAS, on continue sur cette lancée !',
]

type Tab = 'text' | 'screen'

export default function NouveauRetourButton({ athleteId, onCreated, buttonClassName, label, open: controlledOpen, onOpenChange }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { startRecording, isRecording, isProcessing, isUploading } = useRecorder()
  const supabase = createClient()

  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }
  const [tab, setTab] = useState<Tab>('text')

  // Screen recording state
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
  const bubblePos = { xPct: 0.07, yPct: 0.93 }

  // Text + audio + Loom state
  const [selectedChip, setSelectedChip] = useState<number>(-1)
  const [customMsg, setCustomMsg] = useState('')
  const [loomUrl, setLoomUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const audio = useAudioRecorder({
    bucket: 'coach-audio',
    pathPrefix: `${user?.id || 'unknown'}/retour_${athleteId}_`,
  })

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

  useEffect(() => {
    let cancelled = false
    if (open && tab === 'screen' && withWebcam && !previewCamStream) {
      const constraint: MediaTrackConstraints = selectedCamId
        ? { deviceId: { exact: selectedCamId }, width: 320, height: 320 }
        : { width: 320, height: 320 }
      navigator.mediaDevices.getUserMedia({ video: constraint }).then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        setPreviewCamStream(s)
      }).catch((err) => {
        if (cancelled) return
        setPreviewError(err instanceof Error ? err.message : 'Accès webcam refusé')
      })
    }
    if ((!withWebcam || tab !== 'screen' || !open) && previewCamStream && !handoffRef.current) {
      previewCamStream.getTracks().forEach((t) => t.stop())
      setPreviewCamStream(null)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, withWebcam, selectedCamId, tab])

  useEffect(() => {
    let cancelled = false
    if (open && tab === 'screen' && !previewMicStream) {
      const constraint: MediaTrackConstraints | true = selectedMicId
        ? { deviceId: { exact: selectedMicId } }
        : true
      navigator.mediaDevices.getUserMedia({ audio: constraint }).then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        setPreviewMicStream(s)
      }).catch(() => {})
    }
    if ((tab !== 'screen' || !open) && previewMicStream && !handoffRef.current) {
      previewMicStream.getTracks().forEach((t) => t.stop())
      setPreviewMicStream(null)
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, selectedMicId])

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
    if (!handoffRef.current) {
      previewCamStream?.getTracks().forEach((t) => t.stop())
      previewMicStream?.getTracks().forEach((t) => t.stop())
      setPreviewCamStream(null)
      setPreviewMicStream(null)
      setPreviewError(null)
    }
    if (audio.isRecording) audio.stopRecording()
    audio.clearAudio()
    setOpen(false)
    setLoomUrl('')
    setSelectedChip(-1)
    setCustomMsg('')
    setWithWebcam(false)
    setTab('text')
  }

  async function handleStartRecord() {
    setStarting(true)
    handoffRef.current = true
    try {
      const camHandoff = previewCamStream
      const micHandoff = previewMicStream
      const pos = withWebcam ? bubblePos : null
      setOpen(false)
      setWithWebcam(false)
      setLoomUrl('')
      setSelectedChip(-1)
      setCustomMsg('')
      setPreviewCamStream(null)
      setPreviewMicStream(null)
      if (audio.isRecording) audio.stopRecording()
      audio.clearAudio()
      // Mic stream is pre-acquired in the modal but the hook on this branch
      // only accepts a pre-acquired cam stream — release the mic so the
      // recorder can re-acquire (no extra prompt because perm already granted).
      micHandoff?.getTracks().forEach((t) => t.stop())
      // pos is reserved for a future bubble-position option
      void pos
      await startRecording({
        withWebcam,
        athleteId,
        preAcquiredCamStream: camHandoff,
      })
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
    setSaving(true)
    const finalTitre = hasMessage
      ? message.slice(0, 40)
      : hasAudio ? 'Message vocal'
      : hasLoom ? 'Vidéo Loom'
      : 'Retour'
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

  const recordingBusy = isRecording || isProcessing || isUploading
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '14px 16px',
    background: 'transparent',
    color: active ? 'var(--primary, #5b8dff)' : 'var(--text2)',
    border: 'none',
    borderBottom: active ? '2px solid var(--primary, #5b8dff)' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  })

  const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }

  return (
    <>
      {!isControlled && <button
        className={buttonClassName ?? 'btn btn-red'}
        onClick={() => setOpen(true)}
        disabled={recordingBusy}
        title={recordingBusy ? 'Un enregistrement est déjà en cours' : undefined}
      >
        <i className="fas fa-video" /> {label ?? 'Nouveau retour'}
      </button>}

      <Modal isOpen={open} onClose={close} title="Nouveau retour">
        <div style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 480 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #2a2a2a)', background: 'var(--card-bg, #1a1a1a)' }}>
            <button onClick={() => setTab('text')} style={tabBtn(tab === 'text')}>
              <i className="fas fa-comment-alt" style={{ marginRight: 6 }} />Texte ou vocal
            </button>
            <button onClick={() => setTab('screen')} style={tabBtn(tab === 'screen')}>
              <i className="fas fa-desktop" style={{ marginRight: 6 }} />Écran ou Loom
            </button>
          </div>

          <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                    onClick={handleSubmit}
                    disabled={saving || starting || audio.isRecording || audio.uploading}
                    style={{ minWidth: 130 }}
                  >
                    {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>
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
                    <label style={labelStyle}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
                      background: '#000', border: '3px solid var(--primary, #5b8dff)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {previewError ? (
                        <span style={{ fontSize: 9, color: 'var(--danger, #ff6464)', textAlign: 'center', padding: 4 }}>{previewError}</span>
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
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      Cercle webcam déplaçable visible pendant l&apos;enregistrement
                    </span>
                  </div>
                )}

                <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                  <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
                  Durée max : 15 minutes.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 0' }}>
                  <span style={{ flex: 1, height: 1, background: 'var(--border, #2a2a2a)' }} />
                  ou coller un Loom
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

                <div style={{ flex: 1 }} />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={close} disabled={starting || saving}>Annuler</button>
                  {loomUrl.trim() ? (
                    <button
                      className="btn btn-red"
                      onClick={handleSubmit}
                      disabled={saving || starting}
                      style={{ minWidth: 140 }}
                    >
                      {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer Loom</>}
                    </button>
                  ) : (
                    <button
                      className="btn btn-red"
                      onClick={handleStartRecord}
                      disabled={starting || (withWebcam && !previewCamStream && !previewError)}
                      style={{ minWidth: 140 }}
                    >
                      {starting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-circle" /> Démarrer</>}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
