'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Toggle from '@/components/ui/Toggle'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterKey = 'a_traiter' | 'traite' | 'all'

export default function PosingPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [posingEnabled, setPosingEnabled] = useState(false)
  const [videos, setVideos] = useState<any[]>([])
  const [retours, setRetours] = useState<any[]>([])
  const [filter, setFilter] = useState<FilterKey>('a_traiter')
  const [viewingVideo, setViewingVideo] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalVideoId, setModalVideoId] = useState<string | null>(null)
  const [formLoom, setFormLoom] = useState('')
  const [formTitre, setFormTitre] = useState('')
  const [formComment, setFormComment] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: ath } = await supabase.from('athletes').select('posing_enabled').eq('id', params.id).single()
      const enabled = ath?.posing_enabled || false
      setPosingEnabled(enabled)

      if (!enabled) { return }

      const [{ data: vids }, { data: rets }] = await Promise.all([
        supabase.from('posing_videos').select('*').eq('athlete_id', params.id).order('created_at', { ascending: false }),
        supabase.from('posing_retours').select('*').eq('athlete_id', params.id).order('created_at', { ascending: false }),
      ])
      setVideos(vids || [])
      setRetours(rets || [])
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadData()
  }, [params.id, loadData])

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

  async function submitCorrection() {
    if (!formLoom.trim()) { toast("L'URL Loom est obligatoire", 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('posing_retours').insert({
      athlete_id: params.id,
      coach_id: user?.id,
      posing_video_id: modalVideoId || null,
      loom_url: formLoom.trim(),
      titre: formTitre.trim() || 'Correction posing',
      commentaire: formComment.trim() || null,
    })
    setSaving(false)
    if (error) { toast('Erreur', 'error'); return }
    toast('Correction posing envoyee !', 'success')
    setShowModal(false)
    setFormLoom(''); setFormTitre(''); setFormComment('')
    loadData()
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

  // Video detail view
  if (viewingVideo) {
    const v = viewingVideo
    const date = new Date(v.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const isPending = v.status === 'a_traiter'
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setViewingVideo(null)}><i className="fas fa-arrow-left" /> Retour</button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{v.titre || 'Posing'}</span>
          <Badge variant={isPending ? 'warning' : 'success'}>{isPending ? 'A traiter' : 'Traite'}</Badge>
        </div>
        <video controls muted playsInline src={v.video_url} style={{ width: '100%', maxHeight: 500, borderRadius: 10, background: '#000' }} />
        {v.commentaire && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg2)', borderRadius: 8, fontSize: 13, color: 'var(--text2)' }}>
            <i className="fas fa-quote-left" style={{ color: 'var(--text3)', marginRight: 6 }} />{v.commentaire}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{date}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {isPending && (
            <button className="btn btn-outline btn-sm" style={{ color: 'var(--success)' }} onClick={() => markTraite(v.id)}>
              <i className="fas fa-check" /> Marquer traite
            </button>
          )}
          <button className="btn btn-red btn-sm" onClick={() => { setModalVideoId(v.id); setShowModal(true) }}>
            <i className="fas fa-video" /> Envoyer une correction
          </button>
        </div>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
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
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.titre || 'Correction posing'}</div>
                  {r.commentaire && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{r.commentaire}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <a href={r.loom_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><i className="fas fa-external-link-alt" /></a>
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteRetour(r.id)}><i className="fas fa-trash" /></button>
              </div>
            </div>
          )
        })
      )}

      {/* Correction modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Envoyer une correction posing">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre</label>
            <input type="text" className="form-control" value={formTitre} onChange={(e) => setFormTitre(e.target.value)} placeholder="Correction posing" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>URL Loom *</label>
            <input type="url" className="form-control" value={formLoom} onChange={(e) => setFormLoom(e.target.value)} placeholder="https://www.loom.com/share/..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Commentaire</label>
            <textarea className="form-control" rows={3} value={formComment} onChange={(e) => setFormComment(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-red" onClick={submitCorrection} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
