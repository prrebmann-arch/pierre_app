'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifyAthlete } from '@/lib/push'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function RetoursPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [retours, setRetours] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [formLoom, setFormLoom] = useState('')
  const [formTitre, setFormTitre] = useState('')
  const [formComment, setFormComment] = useState('')
  const [saving, setSaving] = useState(false)

  const loadRetours = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('bilan_retours')
        .select('*')
        .eq('athlete_id', params.id)
        .order('created_at', { ascending: false })
      setRetours(data || [])
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadRetours()
  }, [params.id, loadRetours])

  async function submitRetour() {
    if (!formLoom.trim()) { toast("L'URL Loom est obligatoire", 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('bilan_retours').insert({
      athlete_id: params.id,
      coach_id: user?.id,
      loom_url: formLoom.trim(),
      titre: formTitre.trim() || 'Retour bilan',
      commentaire: formComment.trim() || null,
    })
    setSaving(false)
    if (error) { toast('Erreur lors de l\'envoi', 'error'); return }

    // Notify athlete (DB + push)
    const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', params.id).single()
    if (ath?.user_id) {
      await notifyAthlete(
        ath.user_id, 'retour', 'Nouveau retour video',
        `Votre coach vous a envoye un retour : ${formTitre.trim() || 'Retour bilan'}`,
        { loom_url: formLoom.trim(), titre: formTitre.trim() || 'Retour bilan' },
      )
    }

    toast('Retour video envoye !', 'success')
    setShowModal(false)
    setFormLoom('')
    setFormTitre('')
    setFormComment('')
    loadRetours()
  }

  async function deleteRetour(id: string) {
    if (!confirm('Supprimer ce retour video ?')) return
    const { error } = await supabase.from('bilan_retours').delete().eq('id', id)
    if (error) { toast('Erreur lors de la suppression', 'error'); return }
    toast('Retour supprime', 'success')
    loadRetours()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Retours video envoyes</h2>
        <button className="btn btn-red" onClick={() => setShowModal(true)}>
          <i className="fas fa-video" /> Envoyer un retour video
        </button>
      </div>

      {retours.length === 0 ? (
        <EmptyState icon="fas fa-video" message="Aucun retour video envoye" />
      ) : (
        retours.map((r) => {
          const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          const icon = r.audio_url && !r.loom_url ? 'fa-microphone' : r.loom_url ? 'fa-video' : 'fa-comment'
          return (
            <div key={r.id} className={styles.retourCard}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div className={styles.retourIcon}>
                  <i className={`fas ${icon}`} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.titre || 'Retour bilan'}</div>
                  {r.commentaire && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{r.commentaire}</div>}
                  {r.audio_url && (
                    <div style={{ marginTop: 6 }}>
                      <audio controls src={r.audio_url} style={{ height: 28, maxWidth: 250 }} />
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {r.loom_url && (
                  <a href={r.loom_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <i className="fas fa-external-link-alt" /> Voir
                  </a>
                )}
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteRetour(r.id)}>
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          )
        })
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Envoyer un retour video">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre</label>
            <input type="text" className="form-control" value={formTitre} onChange={(e) => setFormTitre(e.target.value)} placeholder="Retour bilan" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>URL Loom *</label>
            <input type="url" className="form-control" value={formLoom} onChange={(e) => setFormLoom(e.target.value)} placeholder="https://www.loom.com/share/..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Commentaire</label>
            <textarea className="form-control" rows={3} value={formComment} onChange={(e) => setFormComment(e.target.value)} placeholder="Optionnel" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-red" onClick={submitRetour} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
