'use client'

import { useState } from 'react'
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

  // loom state
  const [loomUrl, setLoomUrl] = useState('')
  const [titre, setTitre] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  function close() {
    setOpen(false)
    setLoomUrl('')
    setTitre('')
    setComment('')
    setMode('record')
  }

  async function handleStartRecord() {
    setStarting(true)
    try {
      await startRecording({ withWebcam, athleteId })
      close()
    } catch (err) {
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
                Inclure ma webcam (bulle visible pendant l&apos;enregistrement)
              </label>

              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                Durée maximum : 15 minutes. Tu peux naviguer librement dans COACH pendant l&apos;enregistrement.
              </p>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-outline" onClick={close} disabled={starting}>Annuler</button>
                <button className="btn btn-red" onClick={handleStartRecord} disabled={starting}>
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
