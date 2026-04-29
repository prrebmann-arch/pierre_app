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
  /** Optional className for the trigger button */
  buttonClassName?: string
  /** Optional label override */
  label?: string
}

const QUICK_MESSAGES = [
  'Bon bilan, pas de changement, donne-toi à fond !',
  'Très beau résultat, continue comme ça !',
  'Bilan correct, on garde le cap !',
  'Super progression, rien à modifier !',
  'RAS, on continue sur cette lancée !',
]

export default function NouveauRetourButton({ athleteId, onCreated, buttonClassName, label }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { startRecording, isRecording, isProcessing, isUploading } = useRecorder()
  const supabase = createClient()

  const [open, setOpen] = useState(false)

  // ── Screen recording state ──
  const [withWebcam, setWithWebcam] = useState(false)
  const [starting, setStarting] = useState(false)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)

  // ── Loom + message + audio state ──
  const [titre, setTitre] = useState('')
  const [loomUrl, setLoomUrl] = useState('')
  const [selectedChip, setSelectedChip] = useState<number>(-1)
  const [customMsg, setCustomMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const audio = useAudioRecorder({
    bucket: 'coach-audio',
    pathPrefix: `${user?.id || 'unknown'}/retour_${athleteId}_`,
  })

  function stopPreview() {
    setPreviewStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
    setPreviewError(null)
  }

  // Acquire / release cam preview based on toggle + modal state
  useEffect(() => {
    let cancelled = false
    if (open && withWebcam && !previewStream) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 320, height: 320 } })
        .then((s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop())
            return
          }
          setPreviewStream(s)
        })
        .catch((err) => {
          if (cancelled) return
          setPreviewError(err instanceof Error ? err.message : 'Accès webcam refusé')
        })
    }
    if (!withWebcam && previewStream) stopPreview()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, withWebcam])

  useEffect(() => {
    const v = previewVideoRef.current
    if (!v) return
    if (previewStream && v.srcObject !== previewStream) {
      v.srcObject = previewStream
      v.play().catch(() => {})
    } else if (!previewStream && v.srcObject) {
      v.srcObject = null
    }
  }, [previewStream])

  function close() {
    stopPreview()
    if (audio.isRecording) audio.stopRecording()
    audio.clearAudio()
    setOpen(false)
    setTitre('')
    setLoomUrl('')
    setSelectedChip(-1)
    setCustomMsg('')
    setWithWebcam(false)
  }

  async function handleStartRecord() {
    setStarting(true)
    try {
      const handoff = previewStream
      // Reset flags FIRST so the acquisition useEffect doesn't re-prompt during handoff
      setOpen(false)
      setWithWebcam(false)
      setTitre('')
      setLoomUrl('')
      setSelectedChip(-1)
      setCustomMsg('')
      if (audio.isRecording) audio.stopRecording()
      audio.clearAudio()
      setPreviewStream(null)
      await startRecording({ withWebcam, athleteId, preAcquiredCamStream: handoff })
    } catch (err) {
      previewStream?.getTracks().forEach((t) => t.stop())
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
    const finalTitre = titre.trim() || 'Retour'
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
      const meta: Record<string, string> = { titre: finalTitre }
      if (hasLoom) meta.loom_url = loomUrl.trim()
      if (hasAudio && audio.audioUrl) meta.audio_url = audio.audioUrl
      await notifyAthlete(
        ath.user_id, 'retour', 'Nouveau retour',
        `Votre coach vous a envoyé un retour : ${finalTitre}`,
        meta,
      )
    }

    toast('Retour envoyé !', 'success')
    close()
    onCreated?.()
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
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Section 1: Screen recording ── */}
          <div style={{ padding: 14, border: '1px solid var(--border, #2a2a2a)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-circle" style={{ color: 'var(--danger, #ff3b3b)' }} />
                <strong style={{ fontSize: 14 }}>Enregistrer mon écran</strong>
              </div>
              <button
                className="btn btn-red btn-sm"
                onClick={handleStartRecord}
                disabled={starting || (withWebcam && !previewStream && !previewError)}
                title={withWebcam && !previewStream && !previewError ? 'Initialisation webcam…' : undefined}
              >
                {starting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-circle" /> Démarrer</>}
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={withWebcam}
                onChange={(e) => setWithWebcam(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Inclure ma webcam (bulle en bas à gauche)
            </label>
            {withWebcam && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <div
                  style={{
                    width: 120, height: 120, borderRadius: '50%', overflow: 'hidden',
                    background: '#000', border: '3px solid var(--primary, #5b8dff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {previewError ? (
                    <span style={{ fontSize: 10, color: 'var(--danger, #ff6464)', textAlign: 'center', padding: 6 }}>{previewError}</span>
                  ) : previewStream ? (
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
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>Aperçu — cadre-toi avant de démarrer</span>
              </div>
            )}
          </div>

          {/* ── Section 2: Message + Loom + audio (combinable) ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border, #2a2a2a)' }} />
            ou envoyer
            <span style={{ flex: 1, height: 1, background: 'var(--border, #2a2a2a)' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre</label>
            <input
              type="text"
              className="form-control"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Retour bilan"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
              <i className="fas fa-comment-dots" style={{ marginRight: 6 }} />Message rapide
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_MESSAGES.map((msg, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setSelectedChip(i); setCustomMsg('') }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 16,
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
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
              <i className="fas fa-pen" style={{ marginRight: 6 }} />Ou message libre
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={customMsg}
              onChange={(e) => { setCustomMsg(e.target.value); setSelectedChip(-1) }}
              placeholder="Écris ton message…"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
              <i className="fas fa-link" style={{ marginRight: 6 }} />Lien Loom
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
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
              <i className="fas fa-microphone" style={{ marginRight: 6 }} />Message vocal
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

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={close} disabled={saving || starting}>Annuler</button>
            <button
              className="btn btn-red"
              onClick={handleSubmitOther}
              disabled={saving || starting || audio.isRecording || audio.uploading}
            >
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
