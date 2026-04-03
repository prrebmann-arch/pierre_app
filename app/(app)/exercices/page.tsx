'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import FormGroup from '@/components/ui/FormGroup'
import EmptyState from '@/components/ui/EmptyState'
import styles from '@/styles/exercices.module.css'

interface Exercice {
  id: string
  nom: string
  muscle_principal: string | null
  muscle_secondaire: string | null
  categorie: string | null
  description: string | null
  youtube_url: string | null
  default_tempo: string | null
  default_reps: string | null
  coach_id: string | null
  created_at: string
}

type FormData = {
  nom: string
  muscle_principal: string
  muscle_secondaire: string
  categorie: string
  description: string
  youtube_url: string
  default_tempo: string
  default_reps: string
}

const EMPTY_FORM: FormData = {
  nom: '',
  muscle_principal: '',
  muscle_secondaire: '',
  categorie: '',
  description: '',
  youtube_url: '',
  default_tempo: '',
  default_reps: '',
}

const VIEW_STORAGE_KEY = 'exercices-view-mode'

export default function ExercicesPage() {
  const supabase = createClient()
  const { user } = useAuth()

  const [exercices, setExercices] = useState<Exercice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('')
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  // View mode: list or grid
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(VIEW_STORAGE_KEY) as 'list' | 'grid') || 'grid'
    }
    return 'grid'
  })

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExercice, setEditingExercice] = useState<Exercice | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Video preview
  const [videoPreview, setVideoPreview] = useState<string | null>(null)

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'list' ? 'grid' : 'list'
      localStorage.setItem(VIEW_STORAGE_KEY, next)
      return next
    })
  }, [])

  const loadExercices = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('exercices')
        .select('id, nom, muscle_principal, muscle_secondaire, categorie, description, youtube_url, default_tempo, default_reps, coach_id, created_at')
        .or(`coach_id.eq.${user.id},coach_id.is.null`)
        .order('nom')
      setExercices(data || [])
    } finally {
      setLoading(false)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadExercices()
  }, [loadExercices])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(value), 200)
  }, [])

  // Derive muscle groups from data
  const muscleGroups = useMemo(() => {
    return [...new Set(exercices.map((e) => e.muscle_principal).filter(Boolean) as string[])].sort()
  }, [exercices])

  // Filter exercises
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return exercices.filter((ex) => {
      if (muscleFilter && ex.muscle_principal !== muscleFilter) return false
      if (q && !ex.nom.toLowerCase().includes(q) && !(ex.muscle_principal || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [exercices, muscleFilter, debouncedSearch])

  // Open modal for new exercise
  const handleAdd = () => {
    setEditingExercice(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  // Open modal for editing
  const handleEdit = (ex: Exercice) => {
    setEditingExercice(ex)
    setForm({
      nom: ex.nom,
      muscle_principal: ex.muscle_principal || '',
      muscle_secondaire: ex.muscle_secondaire || '',
      categorie: ex.categorie || '',
      description: ex.description || '',
      youtube_url: ex.youtube_url || '',
      default_tempo: ex.default_tempo || '',
      default_reps: ex.default_reps || '',
    })
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingExercice(null)
    setForm(EMPTY_FORM)
  }

  const handleFormChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!user || !form.nom.trim()) return
    setSaving(true)
    try {
      const payload = {
        nom: form.nom.trim(),
        muscle_principal: form.muscle_principal || null,
        muscle_secondaire: form.muscle_secondaire || null,
        categorie: form.categorie || null,
        description: form.description || null,
        youtube_url: form.youtube_url || null,
        default_tempo: form.default_tempo || null,
        default_reps: form.default_reps || null,
        coach_id: user.id,
      }

      if (editingExercice) {
        await supabase.from('exercices').update(payload).eq('id', editingExercice.id)
      } else {
        await supabase.from('exercices').insert(payload)
      }

      handleCloseModal()
      await loadExercices()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await supabase.from('exercices').delete().eq('id', id)
      setDeleteConfirm(null)
      await loadExercices()
    } finally {
      setDeleting(false)
    }
  }

  // Extract YouTube embed URL
  const getYoutubeEmbedUrl = (url: string): string | null => {
    try {
      const u = new URL(url)
      let videoId = ''
      if (u.hostname.includes('youtube.com')) {
        videoId = u.searchParams.get('v') || ''
      } else if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1)
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    } catch {
      // not a valid URL
    }
    return null
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Exercices</h1>
          <p className={styles.pageSub}>{exercices.length} exercice{exercices.length > 1 ? 's' : ''} au total</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={styles.viewToggle}
            onClick={toggleViewMode}
            title={viewMode === 'list' ? 'Vue grille' : 'Vue liste'}
          >
            <i className={`fa-solid ${viewMode === 'list' ? 'fa-grid-2' : 'fa-list'}`} />
          </button>
          <Button onClick={handleAdd}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
            Nouvel exercice
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fa-solid fa-spinner fa-spin fa-2x" />
        </div>
      ) : exercices.length === 0 ? (
        <EmptyState
          icon="fa-solid fa-dumbbell"
          message="Aucun exercice pour le moment"
          action={
            <Button onClick={handleAdd}>
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
              Ajouter un exercice
            </Button>
          }
        />
      ) : (
        <>
          {/* Search */}
          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Rechercher un exercice..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Muscle filters */}
          <div className={styles.filtersRow}>
            <button
              className={`${styles.filterBtn} ${muscleFilter === '' ? styles.filterBtnActive : ''}`}
              onClick={() => setMuscleFilter('')}
            >
              Tous <span className={styles.filterCount}>({exercices.length})</span>
            </button>
            {muscleGroups.map((m) => {
              const count = exercices.filter((e) => e.muscle_principal === m).length
              return (
                <button
                  key={m}
                  className={`${styles.filterBtn} ${muscleFilter === m ? styles.filterBtnActive : ''}`}
                  onClick={() => setMuscleFilter(m)}
                >
                  {m} <span className={styles.filterCount}>({count})</span>
                </button>
              )
            })}
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <EmptyState icon="fa-solid fa-search" message="Aucun exercice ne correspond a votre recherche" />
          ) : viewMode === 'list' ? (
            /* LIST VIEW */
            filtered.map((ex) => (
              <div key={ex.id} className={styles.exRow} onClick={() => handleEdit(ex)}>
                <div className={styles.exRowLeft}>
                  <i
                    className={`fa-solid fa-circle-play ${ex.youtube_url ? styles.exVideoIcon : styles.exVideoIconEmpty}`}
                    style={{ fontSize: 18 }}
                  />
                  <div>
                    <div className={styles.exName}>
                      {ex.nom}
                      {ex.coach_id && <span className={styles.exTagPerso}>perso</span>}
                    </div>
                    <div className={styles.exMeta}>
                      {[ex.muscle_principal, ex.categorie].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {ex.youtube_url && (
                    <button
                      className="btn-icon"
                      title="Voir la video"
                      onClick={(e) => {
                        e.stopPropagation()
                        setVideoPreview(ex.youtube_url!)
                      }}
                    >
                      <i className="fa-solid fa-play" />
                    </button>
                  )}
                  {ex.coach_id && (
                    <button
                      className="btn-icon"
                      title="Supprimer"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm(ex.id)
                      }}
                    >
                      <i className="fa-solid fa-trash" style={{ color: 'var(--danger)' }} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            /* GRID VIEW */
            <div className={styles.exGrid}>
              {filtered.map((ex) => (
                <div key={ex.id} className={styles.exCard} onClick={() => handleEdit(ex)}>
                  <div className={styles.exCardHeader}>
                    <span className={styles.exCardName}>{ex.nom}</span>
                    {ex.youtube_url && (
                      <button
                        className={styles.exCardPlay}
                        title="Voir la video"
                        onClick={(e) => {
                          e.stopPropagation()
                          setVideoPreview(ex.youtube_url!)
                        }}
                      >
                        <i className="fa-solid fa-circle-play" />
                      </button>
                    )}
                  </div>
                  <div className={styles.exCardMeta}>
                    {ex.muscle_principal && <span className={styles.exCardBadge}>{ex.muscle_principal}</span>}
                    {ex.categorie && <span className={styles.exCardBadge}>{ex.categorie}</span>}
                  </div>
                  {(ex.default_reps || ex.default_tempo) && (
                    <div className={styles.exCardDefaults}>
                      {ex.default_reps && (
                        <span className={styles.exCardDefaultBadge}>
                          <i className="fa-solid fa-repeat" /> {ex.default_reps}
                        </span>
                      )}
                      {ex.default_tempo && (
                        <span className={styles.exCardDefaultBadge}>
                          <i className="fa-solid fa-stopwatch" /> {ex.default_tempo}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={styles.exCardFooter}>
                    {ex.coach_id && <span className={styles.exTagPerso}>perso</span>}
                    {ex.coach_id && (
                      <button
                        className="btn-icon"
                        title="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm(ex.id)
                        }}
                      >
                        <i className="fa-solid fa-trash" style={{ color: 'var(--danger)', fontSize: 12 }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={handleCloseModal} title={editingExercice ? 'Modifier l\'exercice' : 'Nouvel exercice'}>
        <div className={styles.editorWrap}>
          {editingExercice && !editingExercice.coach_id && (
            <p className={styles.editorHint}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />
              Exercice global — la modification creera votre version personnalisee
            </p>
          )}
          <FormGroup label="Nom" htmlFor="ex-nom">
            <input
              id="ex-nom"
              type="text"
              className="input"
              value={form.nom}
              onChange={(e) => handleFormChange('nom', e.target.value)}
              placeholder="Ex: Developpe couche"
              autoFocus
            />
          </FormGroup>
          <FormGroup label="Muscle principal" htmlFor="ex-muscle">
            <input
              id="ex-muscle"
              type="text"
              className="input"
              value={form.muscle_principal}
              onChange={(e) => handleFormChange('muscle_principal', e.target.value)}
              placeholder="Ex: Pectoraux"
            />
          </FormGroup>
          <FormGroup label="Muscle secondaire" htmlFor="ex-muscle2">
            <input
              id="ex-muscle2"
              type="text"
              className="input"
              value={form.muscle_secondaire}
              onChange={(e) => handleFormChange('muscle_secondaire', e.target.value)}
              placeholder="Ex: Triceps"
            />
          </FormGroup>
          <FormGroup label="Categorie" htmlFor="ex-cat">
            <input
              id="ex-cat"
              type="text"
              className="input"
              value={form.categorie}
              onChange={(e) => handleFormChange('categorie', e.target.value)}
              placeholder="Ex: Presse, Tirage, Rowing..."
            />
          </FormGroup>
          <div className={styles.editorRow}>
            <FormGroup label="Reps par defaut" htmlFor="ex-default-reps">
              <input
                id="ex-default-reps"
                type="text"
                className="input"
                value={form.default_reps}
                onChange={(e) => handleFormChange('default_reps', e.target.value)}
                placeholder="Ex: 10-15"
              />
            </FormGroup>
            <FormGroup label="Tempo par defaut" htmlFor="ex-default-tempo">
              <input
                id="ex-default-tempo"
                type="text"
                className="input"
                value={form.default_tempo}
                onChange={(e) => handleFormChange('default_tempo', e.target.value)}
                placeholder="Ex: 3-1-2-0"
              />
            </FormGroup>
          </div>
          <FormGroup label="Description" htmlFor="ex-desc">
            <textarea
              id="ex-desc"
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              placeholder="Notes sur l'execution..."
            />
          </FormGroup>
          <FormGroup label="URL Video (YouTube)" htmlFor="ex-video">
            <input
              id="ex-video"
              type="url"
              className="input"
              value={form.youtube_url}
              onChange={(e) => handleFormChange('youtube_url', e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
            />
          </FormGroup>
          <div className={styles.editorActions}>
            <Button variant="outline" onClick={handleCloseModal}>Annuler</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.nom.trim()}>
              {editingExercice ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer l'exercice">
        <p style={{ marginBottom: 16 }}>Etes-vous sur de vouloir supprimer cet exercice ? Cette action est irreversible.</p>
        <div className={styles.editorActions}>
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" loading={deleting} onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Supprimer
          </Button>
        </div>
      </Modal>

      {/* Video preview modal */}
      <Modal isOpen={!!videoPreview} onClose={() => setVideoPreview(null)} title="Video" size="lg">
        {videoPreview && (() => {
          const embedUrl = getYoutubeEmbedUrl(videoPreview)
          if (embedUrl) {
            return (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                <iframe
                  src={embedUrl}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video exercice"
                />
              </div>
            )
          }
          return (
            <p style={{ textAlign: 'center', color: 'var(--text3)' }}>
              <a href={videoPreview} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                Ouvrir la video <i className="fa-solid fa-external-link-alt" />
              </a>
            </p>
          )
        })()}
      </Modal>
    </div>
  )
}
