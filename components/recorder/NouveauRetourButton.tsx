'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRecorder } from '@/contexts/RecorderContext'
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

type Mode = 'record' | 'loom'

export default function NouveauRetourButton({ athleteId, onCreated, buttonClassName, label }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { startRecording, isRecording, isProcessing, isUploading } = useRecorder()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('record')

  // record state
  const [withWebcam, setWithWebcam] = useState(false)
  const [starting, setStarting] = useState(false)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)

  // loom state
  const [loomUrl, setLoomUrl] = useState('')
  const [titre, setTitre] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Stop preview cam when toggle off / modal closes / unmount.
  // Note: we do NOT stop it when starting recording — the stream is handed off to the recorder.
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
    if (open && mode === 'record' && withWebcam && !previewStream) {
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
  }, [open, mode, withWebcam])

  // Bind stream to video element
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
    setOpen(false)
    setLoomUrl('')
    setTitre('')
    setComment('')
    setMode('record')
    setWithWebcam(false)
  }

  async function handleStartRecord() {
    setStarting(true)
    try {
      const handoff = previewStream
      // Reset flags FIRST so the acquisition useEffect (deps: open/mode/withWebcam)
      // sees withWebcam=false on next render and doesn't re-prompt while we hand off.
      setOpen(false)
      setWithWebcam(false)
      setLoomUrl('')
      setTitre('')
      setComment('')
      setMode('record')
      // Now drop the preview state (recorder takes ownership of the tracks)
      setPreviewStream(null)
      await startRecording({ withWebcam, athleteId, preAcquiredCamStream: handoff })
    } catch (err) {
      // If start failed, the handoff stream is now orphaned in the recorder's
      // failed setup path — best effort: stop tracks we still have a ref to.
      previewStream?.getTracks().forEach((t) => t.stop())
      const msg = err instanceof Error ? err.message : 'Erreur démarrage enregistrement'
      toast(msg, 'error')
    } finally {
      setStarting(false)
    }
  }

  async function handleSubmitLoom() {
    if (!loomUrl.trim()) { toast("L'URL Loom est obligatoire", 'error'); return }
    setSaving(true)
    const finalTitre = titre.trim() || 'Retour bilan'
    const { error } = await supabase.from('bilan_retours').insert({
      athlete_id: athleteId,
      coach_id: user?.id,
      loom_url: loomUrl.trim(),
      titre: finalTitre,
      commentaire: comment.trim() || null,
    })
    setSaving(false)
    if (error) { toast("Erreur lors de l'envoi", 'error'); return }

    const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', athleteId).single()
    if (ath?.user_id) {
      await notifyAthlete(
        ath.user_id, 'retour', 'Nouveau retour vidéo',
        `Votre coach vous a envoyé un retour : ${finalTitre}`,
        { loom_url: loomUrl.trim(), titre: finalTitre },
      )
    }

    toast('Retour vidéo envoyé !', 'success')
    close()
    onCreated?.()
  }

  const recordingBusy = isRecording || isProcessing || isUploading

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

      <Modal isOpen={open} onClose={close} title="Nouveau retour vidéo">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', background: 'var(--card-bg, #1f1f1f)' }}>
            <button
              onClick={() => setMode('record')}
              className="btn"
              style={{
                flex: 1,
                borderRadius: 0,
                background: mode === 'record' ? 'var(--primary, #5b8dff)' : 'transparent',
                color: mode === 'record' ? '#fff' : 'var(--text2)',
                border: 'none',
              }}
            >
              <i className="fas fa-circle" /> Enregistrer écran
            </button>
            <button
              onClick={() => setMode('loom')}
              className="btn"
              style={{
                flex: 1,
                borderRadius: 0,
                background: mode === 'loom' ? 'var(--primary, #5b8dff)' : 'transparent',
                color: mode === 'loom' ? '#fff' : 'var(--text2)',
                border: 'none',
              }}
            >
              <i className="fas fa-link" /> Lien Loom
            </button>
          </div>

          {mode === 'record' ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
                Tu vas choisir l&apos;écran à partager (écran entier, fenêtre ou onglet) au prochain dialogue du navigateur.
                Le micro sera activé automatiquement.
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={withWebcam}
                  onChange={(e) => setWithWebcam(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Inclure ma webcam (bulle en bas à gauche de la vidéo)
              </label>

              {withWebcam && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: '#000',
                      border: '3px solid var(--primary, #5b8dff)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {previewError ? (
                      <span style={{ fontSize: 11, color: 'var(--danger, #ff6464)', textAlign: 'center', padding: 8 }}>
                        {previewError}
                      </span>
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
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Aperçu — cadre-toi avant de démarrer</span>
                </div>
              )}

              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Durée maximum : 15 minutes. Tu peux naviguer librement dans COACH pendant l&apos;enregistrement.
              </p>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-outline" onClick={close} disabled={starting}>Annuler</button>
                <button
                  className="btn btn-red"
                  onClick={handleStartRecord}
                  disabled={starting || (withWebcam && !previewStream && !previewError)}
                  title={withWebcam && !previewStream && !previewError ? 'Initialisation webcam…' : undefined}
                >
                  {starting ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-circle" /> Démarrer</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre</label>
                <input type="text" className="form-control" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Retour bilan" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>URL Loom *</label>
                <input type="url" className="form-control" value={loomUrl} onChange={(e) => setLoomUrl(e.target.value)} placeholder="https://www.loom.com/share/..." />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Commentaire</label>
                <textarea className="form-control" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optionnel" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-outline" onClick={close} disabled={saving}>Annuler</button>
                <button className="btn btn-red" onClick={handleSubmitLoom} disabled={saving}>
                  {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
