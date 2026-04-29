'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'
import NouveauRetourButton from '@/components/recorder/NouveauRetourButton'
import RetourVideoPlayer from '@/components/videos/RetourVideoPlayer'

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function RetoursPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_retours`
  const [cached] = useState(() => getPageCache<any[]>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [retours, setRetours] = useState<any[]>(cached ?? [])

  const loadRetours = useCallback(async () => {
    if (!retours.length) setLoading(true)
    try {
      const { data } = await supabase
        .from('bilan_retours')
        .select('id, athlete_id, coach_id, loom_url, titre, commentaire, type, created_at, video_path, thumbnail_path, duration_s, archived_at, audio_url')
        .eq('athlete_id', params.id)
        .order('created_at', { ascending: false })
        .limit(100)
      const result = data || []
      setRetours(result)
      setPageCache(cacheKey, result)
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadRetours()
  }, [params.id, loadRetours])

  useRefetchOnResume(loadRetours, loading)

  async function deleteRetour(id: string) {
    if (!confirm('Supprimer ce retour video ?')) return
    // Delete DB row FIRST so failures don't leave orphan storage entries
    const target = retours.find(r => r.id === id)
    const { error } = await supabase.from('bilan_retours').delete().eq('id', id)
    if (error) { toast('Erreur lors de la suppression', 'error'); return }
    // Then best-effort cleanup of storage files (RLS allows coach to delete own files)
    if (target?.video_path) {
      const paths = [target.video_path, target.thumbnail_path].filter(Boolean) as string[]
      if (paths.length) {
        try { await supabase.storage.from('coach-video').remove(paths) }
        catch (e) { console.warn('storage cleanup failed (non-fatal):', e) }
      }
    }
    toast('Retour supprime', 'success')
    loadRetours()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Retours video envoyes</h2>
        <NouveauRetourButton athleteId={params.id} onCreated={loadRetours} />
      </div>

      {retours.length === 0 ? (
        <EmptyState icon="fas fa-video" message="Aucun retour video envoye" />
      ) : (
        retours.map((r) => {
          const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={r.id} className={styles.retourCard}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                <div className={styles.retourIcon}>
                  <i className={`fas ${r.video_path ? 'fa-video' : r.audio_url ? 'fa-microphone' : r.loom_url ? 'fa-link' : 'fa-comment'}`} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.titre || 'Retour bilan'}</div>
                  {r.commentaire && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{r.commentaire}</div>}

                  {r.video_path && (
                    <div style={{ marginTop: 10 }}>
                      <RetourVideoPlayer retourId={r.id} archived={!!r.archived_at} />
                    </div>
                  )}
                  {r.audio_url && !r.video_path && (
                    <div style={{ marginTop: 6 }}>
                      <audio controls src={r.audio_url} style={{ height: 28, maxWidth: 250 }} />
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {r.loom_url && !r.video_path && (
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

    </div>
  )
}
