'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRecorder } from '@/contexts/RecorderContext'
import Modal from '@/components/ui/Modal'

function defaultTitre(): string {
  const d = new Date()
  return `Retour technique du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
}

export default function RetourFinalizeModal() {
  const { pending, finalizeRecording, discardPending, isUploading } = useRecorder()

  const [titre, setTitre] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (pending) {
      setTitre(defaultTitre())
      setCommentaire('')
      const url = URL.createObjectURL(pending.videoBlob)
      setPreviewUrl(url)
      return () => { URL.revokeObjectURL(url) }
    }
  }, [pending])

  const sizeMb = useMemo(() => {
    if (!pending) return 0
    return Math.round((pending.videoBlob.size / (1024 * 1024)) * 10) / 10
  }, [pending])

  if (!pending) return null

  return (
    <Modal isOpen={!!pending} onClose={() => { if (!isUploading) discardPending() }} title="Finaliser le retour vidéo">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {previewUrl && (
          <video
            src={previewUrl}
            controls
            playsInline
            style={{ width: '100%', maxHeight: 320, borderRadius: 8, background: '#000' }}
          />
        )}
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          Durée: {Math.floor(pending.durationS / 60)}:{(pending.durationS % 60).toString().padStart(2, '0')} · Taille: {sizeMb} MB · Format: {pending.ext.toUpperCase()}
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre *</label>
          <input
            type="text"
            className="form-control"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={isUploading}
            maxLength={120}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Commentaire</label>
          <textarea
            className="form-control"
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Optionnel"
            disabled={isUploading}
            maxLength={500}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            className="btn btn-outline"
            onClick={() => { if (confirm('Jeter cet enregistrement ?')) discardPending() }}
            disabled={isUploading}
          >
            Jeter
          </button>
          <button
            className="btn btn-red"
            onClick={() => finalizeRecording({ titre: titre.trim() || defaultTitre(), commentaire: commentaire.trim() || undefined })}
            disabled={isUploading || !titre.trim()}
          >
            {isUploading ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}
