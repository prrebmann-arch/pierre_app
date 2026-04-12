'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/formations.module.css'

// ── Types ──
interface Formation {
  id: string
  coach_id: string
  title: string
  description: string
  video_count: number
  visibility: 'all' | 'selected'
  created_at: string
}

interface FormationVideo {
  id: string
  formation_id: string
  title: string
  video_url: string
  position: number
}

interface Athlete {
  id: string
  prenom: string
  nom: string
  email: string
  user_id?: string
}

interface VideoProgress {
  user_id: string
  video_id: string
  watched: boolean
}

// ── Helpers ──
function getEmbedUrl(url: string): string | null {
  if (!url) return null
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  m = url.match(/vimeo\.com\/(\d+)/)
  if (m) return `https://player.vimeo.com/video/${m[1]}`
  m = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (m) return `https://www.loom.com/embed/${m[1]}`
  return null
}

export default function FormationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [formations, setFormations] = useState<Formation[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})

  // Detail view
  const [currentFormation, setCurrentFormation] = useState<Formation | null>(null)
  const [videos, setVideos] = useState<FormationVideo[]>([])
  const [formationMembers, setFormationMembers] = useState<Athlete[]>([])
  const [progressData, setProgressData] = useState<VideoProgress[]>([])
  const [allAthletes, setAllAthletes] = useState<Athlete[]>([])

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createVisibility, setCreateVisibility] = useState<'all' | 'selected'>('all')
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set())

  // Members modal
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [editVisibility, setEditVisibility] = useState<'all' | 'selected'>('all')
  const [editSelectedAthletes, setEditSelectedAthletes] = useState<Set<string>>(new Set())

  // ── Load formations list ──
  const loadFormations = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [fRes, mRes] = await Promise.all([
      supabase.from('formations').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('formation_members').select('formation_id, athlete_id').limit(500),
    ])
    setFormations(fRes.data || [])
    const counts: Record<string, number> = {}
    ;(mRes.data || []).forEach((m: { formation_id: string }) => {
      counts[m.formation_id] = (counts[m.formation_id] || 0) + 1
    })
    setMemberCounts(counts)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { loadFormations() }, [loadFormations])

  // ── Load athletes (for modals) ──
  const loadAthletes = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('athletes')
      .select('id, prenom, nom, email, user_id')
      .eq('coach_id', user.id)
      .order('prenom')
    setAllAthletes(data || [])
  }, [user, supabase])

  // ── View formation detail ──
  const viewFormation = useCallback(async (formationId: string) => {
    if (!user) return
    const [fRes, vRes, mRes, progRes] = await Promise.all([
      supabase.from('formations').select('*').eq('id', formationId).single(),
      supabase.from('formation_videos').select('*').eq('formation_id', formationId).order('position'),
      supabase.from('formation_members').select('athlete_id, athletes(id, prenom, nom, email, user_id)').eq('formation_id', formationId),
      supabase.from('formation_video_progress').select('user_id, video_id, watched'),
    ])

    if (fRes.error) { toast('Erreur chargement', 'error'); return }
    const formation = fRes.data as Formation
    const vids = (vRes.data || []) as FormationVideo[]
    // Supabase join returns athletes as a nested object (single via FK), cast through unknown
    const members = ((mRes.data || []) as unknown as Array<{ athlete_id: string; athletes: Athlete | null }>).map(m => m.athletes).filter(Boolean) as Athlete[]

    setCurrentFormation(formation)
    setVideos(vids)
    setFormationMembers(members)

    // Filter progress to this formation's videos
    const videoIds = new Set(vids.map(v => v.id))
    setProgressData((progRes.data || []).filter((p: VideoProgress) => videoIds.has(p.video_id)))

    // Load all athletes if visibility is 'all'
    if (formation.visibility === 'all') {
      const { data: aths } = await supabase
        .from('athletes')
        .select('id, prenom, nom, email, user_id')
        .eq('coach_id', user.id)
        .order('prenom')
      setAllAthletes(aths || [])
    }
  }, [user, supabase, toast])

  // ── Create formation ──
  const openCreateModal = async () => {
    await loadAthletes()
    setCreateTitle('')
    setCreateDesc('')
    setCreateVisibility('all')
    setSelectedAthletes(new Set())
    setShowCreateModal(true)
  }

  const submitCreate = async () => {
    if (!user) return
    if (!createTitle.trim()) { toast('Le nom est obligatoire', 'error'); return }
    if (createVisibility === 'selected' && selectedAthletes.size === 0) {
      toast('Selectionnez au moins un athlete', 'error'); return
    }

    const { data: formation, error } = await supabase.from('formations').insert({
      coach_id: user.id,
      title: createTitle.trim(),
      description: createDesc.trim(),
      video_count: 0,
      visibility: createVisibility,
    }).select().single()

    if (error) { toast('Erreur creation', 'error'); console.error(error); return }

    if (createVisibility === 'selected' && selectedAthletes.size > 0) {
      const rows = [...selectedAthletes].map(aid => ({ formation_id: formation.id, athlete_id: aid }))
      await supabase.from('formation_members').insert(rows)
    }

    setShowCreateModal(false)
    await loadFormations()
  }

  // ── Delete formation ──
  const deleteFormation = async (id: string, title: string) => {
    if (!confirm(`Supprimer la formation "${title}" et toutes ses videos ?`)) return

    const { data: vids } = await supabase.from('formation_videos').select('id').eq('formation_id', id)
    const videoIds = (vids || []).map((v: { id: string }) => v.id)
    if (videoIds.length) await supabase.from('formation_video_progress').delete().in('video_id', videoIds)
    await supabase.from('formation_videos').delete().eq('formation_id', id)
    await supabase.from('formations').delete().eq('id', id)
    await loadFormations()
  }

  // ── Add video ──
  const addVideo = async () => {
    if (!currentFormation) return
    const title = prompt('Titre de la video :')
    if (!title?.trim()) return
    const url = prompt('Lien de la video (YouTube, Vimeo, Loom...) :')
    if (!url?.trim()) return

    const { data: existing } = await supabase
      .from('formation_videos')
      .select('position')
      .eq('formation_id', currentFormation.id)
      .order('position', { ascending: false })
      .limit(1)

    const nextPos = existing?.length ? existing[0].position + 1 : 0

    const { error } = await supabase.from('formation_videos').insert({
      formation_id: currentFormation.id,
      title: title.trim(),
      video_url: url.trim(),
      position: nextPos,
    })
    if (error) { toast('Erreur ajout video', 'error'); return }

    await supabase.from('formations').update({ video_count: nextPos + 1 }).eq('id', currentFormation.id)
    await viewFormation(currentFormation.id)
  }

  // ── Delete video ──
  const deleteVideo = async (videoId: string) => {
    if (!currentFormation || !confirm('Supprimer cette video ?')) return
    await supabase.from('formation_video_progress').delete().eq('video_id', videoId)
    await supabase.from('formation_videos').delete().eq('id', videoId)

    const { data: remaining } = await supabase.from('formation_videos').select('id').eq('formation_id', currentFormation.id)
    await supabase.from('formations').update({ video_count: (remaining || []).length }).eq('id', currentFormation.id)
    await viewFormation(currentFormation.id)
  }

  // ── Move video ──
  const moveVideo = async (videoId: string, currentPos: number, direction: 'up' | 'down') => {
    if (!currentFormation) return
    const newPos = direction === 'up' ? currentPos - 1 : currentPos + 1
    const { data: target } = await supabase
      .from('formation_videos')
      .select('id')
      .eq('formation_id', currentFormation.id)
      .eq('position', newPos)
      .single()
    if (!target) return

    await Promise.all([
      supabase.from('formation_videos').update({ position: newPos }).eq('id', videoId),
      supabase.from('formation_videos').update({ position: currentPos }).eq('id', target.id),
    ])
    await viewFormation(currentFormation.id)
  }

  // ── Members modal ──
  const openMembersModal = async () => {
    if (!currentFormation) return
    await loadAthletes()
    const { data: members } = await supabase
      .from('formation_members')
      .select('athlete_id')
      .eq('formation_id', currentFormation.id)

    setEditVisibility(currentFormation.visibility)
    setEditSelectedAthletes(new Set((members || []).map((m: { athlete_id: string }) => m.athlete_id)))
    setShowMembersModal(true)
  }

  const saveMembers = async () => {
    if (!currentFormation || !user) return
    if (editVisibility === 'selected' && editSelectedAthletes.size === 0) {
      toast('Selectionnez au moins un athlete', 'error'); return
    }

    await supabase.from('formations').update({ visibility: editVisibility }).eq('id', currentFormation.id)
    await supabase.from('formation_members').delete().eq('formation_id', currentFormation.id)

    if (editVisibility === 'selected' && editSelectedAthletes.size > 0) {
      const rows = [...editSelectedAthletes].map(aid => ({ formation_id: currentFormation.id, athlete_id: aid }))
      await supabase.from('formation_members').insert(rows)
    }

    setShowMembersModal(false)
    await viewFormation(currentFormation.id)
  }

  // ── Toggle helpers ──
  const toggleAthlete = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }

  const toggleAll = (set: Set<string>, athletes: Athlete[]): Set<string> => {
    if (set.size === athletes.length) return new Set()
    return new Set(athletes.map(a => a.id))
  }

  // ── Render ──
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}><Skeleton height={40} /></div>
        <Skeleton height={300} />
      </div>
    )
  }

  // ═══════════════════════════════════════
  // ── DETAIL VIEW ──
  // ═══════════════════════════════════════
  if (currentFormation) {
    const progressAthletes = currentFormation.visibility === 'selected' ? formationMembers : allAthletes
    const progressByUser: Record<string, Set<string>> = {}
    progressData.forEach(p => {
      if (p.watched) {
        if (!progressByUser[p.user_id]) progressByUser[p.user_id] = new Set()
        progressByUser[p.user_id].add(p.video_id)
      }
    })

    const audienceLabel = currentFormation.visibility === 'selected'
      ? `${formationMembers.length} athlete${formationMembers.length > 1 ? 's' : ''} selectionne${formationMembers.length > 1 ? 's' : ''}`
      : 'Tous les athletes'

    return (
      <div>
        {/* Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button variant="outline" onClick={() => { setCurrentFormation(null); loadFormations() }}>
              <i className="fas fa-arrow-left" /> Retour
            </Button>
            <h1 className="page-title">{currentFormation.title}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={openMembersModal}>
              <i className="fas fa-users" /> Membres
            </Button>
            <Button variant="primary" onClick={addVideo}>
              <i className="fas fa-plus" /> Ajouter une video
            </Button>
          </div>
        </div>

        {/* Info bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {currentFormation.description && (
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>{currentFormation.description}</p>
          )}
          <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', padding: '4px 10px', borderRadius: 20 }}>
            <i className={`fas ${currentFormation.visibility === 'selected' ? 'fa-user-check' : 'fa-users'}`} /> {audienceLabel}
          </span>
        </div>

        {/* Progression */}
        {videos.length > 0 && progressAthletes.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
              <i className="fas fa-chart-bar" style={{ marginRight: 6, color: 'var(--primary)' }} /> Progression des athletes
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {progressAthletes.map(a => {
                const userId = a.user_id || a.id
                const watchedCount = progressByUser[userId]?.size || 0
                const totalVideos = videos.length
                const pct = Math.round((watchedCount / totalVideos) * 100)
                const barColor = pct === 100 ? 'var(--success)' : 'var(--primary)'
                return (
                  <div key={a.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.prenom} {a.nom}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{watchedCount}/{totalVideos}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Videos */}
        {videos.length === 0 ? (
          <EmptyState icon="fas fa-video" message="Aucune video dans cette formation" />
        ) : (
          <div className={styles.fmVideos}>
            {videos.map((v, i) => {
              const embedUrl = getEmbedUrl(v.video_url)
              return (
                <div key={v.id} className={styles.fmVideoCard}>
                  <div className={styles.fmVideoNum}>{i + 1}</div>
                  <div className={styles.fmVideoPreview}>
                    {embedUrl ? (
                      <iframe src={embedUrl} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    ) : (
                      <a href={v.video_url} target="_blank" rel="noopener noreferrer" className={styles.fmVideoLink}>
                        <i className="fas fa-external-link-alt" /> Ouvrir la video
                      </a>
                    )}
                  </div>
                  <div className={styles.fmVideoInfo}>
                    <div className={styles.fmVideoTitle}>{v.title}</div>
                  </div>
                  <div className={styles.fmVideoActions}>
                    <button onClick={() => moveVideo(v.id, v.position, 'up')} title="Monter" disabled={i === 0}>
                      <i className="fas fa-chevron-up" />
                    </button>
                    <button onClick={() => moveVideo(v.id, v.position, 'down')} title="Descendre" disabled={i === videos.length - 1}>
                      <i className="fas fa-chevron-down" />
                    </button>
                    <button onClick={() => deleteVideo(v.id)} title="Supprimer" style={{ color: 'var(--danger)' }}>
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Members modal */}
        <Modal isOpen={showMembersModal} title={`Membres -- ${currentFormation.title}`} onClose={() => setShowMembersModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Acces</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Button
                  variant={editVisibility === 'all' ? 'primary' : 'outline'}
                  onClick={() => setEditVisibility('all')}
                >
                  <i className="fas fa-users" /> Tous les athletes
                </Button>
                <Button
                  variant={editVisibility === 'selected' ? 'primary' : 'outline'}
                  onClick={() => setEditVisibility('selected')}
                >
                  <i className="fas fa-user-check" /> Selection
                </Button>
              </div>
            </div>
            {editVisibility === 'selected' && (
              <div>
                <label className="field-label">Athletes</label>
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 8px)', marginTop: 4 }}>
                  {allAthletes.length ? allAthletes.map(a => (
                    <label key={a.id} className={styles.fmAthleteRow}>
                      <input
                        type="checkbox"
                        checked={editSelectedAthletes.has(a.id)}
                        onChange={() => setEditSelectedAthletes(s => toggleAthlete(s, a.id))}
                      />
                      <span style={{ fontSize: 14, color: 'var(--text)' }}>{a.prenom} {a.nom}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{a.email}</span>
                    </label>
                  )) : (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Aucun athlete</div>
                  )}
                </div>
                <Button variant="outline" size="sm" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setEditSelectedAthletes(s => toggleAll(s, allAthletes))}>
                  <i className="fas fa-check-double" /> Tout selectionner / deselectionner
                </Button>
              </div>
            )}
            <Button variant="primary" style={{ marginTop: 8 }} onClick={saveMembers}>
              <i className="fas fa-check" /> Enregistrer
            </Button>
          </div>
        </Modal>
      </div>
    )
  }

  // ═══════════════════════════════════════
  // ── LIST VIEW ──
  // ═══════════════════════════════════════
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Formations</h1>
        <Button variant="primary" onClick={openCreateModal}>
          <i className="fas fa-plus" /> Nouvelle formation
        </Button>
      </div>

      {formations.length === 0 ? (
        <EmptyState icon="fas fa-graduation-cap" message="Aucune formation creee" />
      ) : (
        <div className={styles.fmGrid}>
          {formations.map(f => {
            const audienceLabel = f.visibility === 'selected'
              ? `${memberCounts[f.id] || 0} athlete${(memberCounts[f.id] || 0) > 1 ? 's' : ''}`
              : 'Tous les athletes'
            return (
              <div key={f.id} className={styles.fmCard} onClick={() => viewFormation(f.id)}>
                <div className={styles.fmCardIcon}><i className="fas fa-play-circle" /></div>
                <div className={styles.fmCardBody}>
                  <div className={styles.fmCardTitle}>{f.title}</div>
                  {f.description && <div className={styles.fmCardDesc}>{f.description}</div>}
                  <div className={styles.fmCardMeta}>
                    <span>{f.video_count || 0} video{(f.video_count || 0) > 1 ? 's' : ''}</span>
                    <span>
                      <i className={`fas ${f.visibility === 'selected' ? 'fa-user-check' : 'fa-users'}`} /> {audienceLabel}
                    </span>
                  </div>
                </div>
                <button
                  className={styles.fmCardDel}
                  onClick={e => { e.stopPropagation(); deleteFormation(f.id, f.title) }}
                  title="Supprimer"
                >
                  <i className="fas fa-trash" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={showCreateModal} title="Nouvelle formation" onClose={() => setShowCreateModal(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">Nom de la formation *</label>
            <input type="text" className="field-input" placeholder="Ex: Programme debutant" value={createTitle} onChange={e => setCreateTitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field-input" rows={2} placeholder="Optionnel" value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Acces</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Button
                variant={createVisibility === 'all' ? 'primary' : 'outline'}
                onClick={() => setCreateVisibility('all')}
              >
                <i className="fas fa-users" /> Tous les athletes
              </Button>
              <Button
                variant={createVisibility === 'selected' ? 'primary' : 'outline'}
                onClick={() => setCreateVisibility('selected')}
              >
                <i className="fas fa-user-check" /> Selection
              </Button>
            </div>
          </div>
          {createVisibility === 'selected' && (
            <div>
              <label className="field-label">Athletes</label>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 8px)', marginTop: 4 }}>
                {allAthletes.length ? allAthletes.map(a => (
                  <label key={a.id} className={styles.fmAthleteRow}>
                    <input
                      type="checkbox"
                      checked={selectedAthletes.has(a.id)}
                      onChange={() => setSelectedAthletes(s => toggleAthlete(s, a.id))}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>{a.prenom} {a.nom}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{a.email}</span>
                  </label>
                )) : (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Aucun athlete</div>
                )}
              </div>
              <Button variant="outline" size="sm" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setSelectedAthletes(s => toggleAll(s, allAthletes))}>
                <i className="fas fa-check-double" /> Tout selectionner / deselectionner
              </Button>
            </div>
          )}
          <Button variant="primary" style={{ marginTop: 8 }} onClick={submitCreate}>
            <i className="fas fa-check" /> Creer la formation
          </Button>
        </div>
      </Modal>
    </div>
  )
}
