'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { notifyAthlete } from '@/lib/push'
import ExerciseLibrary from './ExerciseLibrary'
import SessionTab from './SessionTab'
import type { ExerciseData } from './ExerciseRow'
import type { SetData } from './SetRow'
import styles from '@/styles/training.module.css'

interface SessionData {
  nom: string
  jour: string
  exercises: ExerciseData[]
}

interface ProgramEditorProps {
  athleteId?: string
  athleteUserId?: string | null
  programId?: string | null
  initialName?: string
  initialPatternType?: string
  initialPatternData?: Record<string, unknown>
  initialSessions?: SessionData[]
  onClose: () => void
  onSaved: () => void
  /** Template mode: saves to training_templates instead of workout_programs */
  templateMode?: boolean
  /** Template ID when editing an existing template */
  templateId?: string | null
  /** Template category */
  templateCategory?: string
  /** Existing categories for the category dropdown */
  existingCategories?: string[]
}

const DEFAULT_SET: SetData = { reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' }

/** Normalize legacy { series, reps } format to sets[] */
function normalizeExSets(ex: Record<string, unknown>): SetData[] {
  const sets = ex.sets as SetData[] | undefined
  if (sets && Array.isArray(sets)) return sets
  const count = parseInt(String(ex.series)) || 3
  const reps = (ex.reps as string) || '10'
  const tempo = (ex.tempo as string) || '30X1'
  const result: SetData[] = []
  for (let i = 0; i < count; i++) {
    result.push({ reps, tempo, repos: '1m30', type: 'normal' })
  }
  return result
}

// Muscle color palette
const MUSCLE_COLOR_PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
]
const colorCache: Record<string, string> = {}
function getMuscleColor(m: string): string {
  if (!m) return '#888'
  const key = m.toLowerCase()
  if (colorCache[key]) return colorCache[key]
  const idx = Object.keys(colorCache).length % MUSCLE_COLOR_PALETTE.length
  colorCache[key] = MUSCLE_COLOR_PALETTE[idx]
  return colorCache[key]
}

export default function ProgramEditor({
  athleteId,
  athleteUserId,
  programId,
  initialName = '',
  initialPatternType = 'pattern',
  initialPatternData = {},
  initialSessions,
  onClose,
  onSaved,
  templateMode = false,
  templateId = null,
  templateCategory: initCategory = '',
  existingCategories: initExistingCategories = [],
}: ProgramEditorProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const { user } = useAuth()

  const [name, setName] = useState(initialName)
  const [patternType, setPatternType] = useState(initialPatternType)
  const [patternValue, setPatternValue] = useState(
    initialPatternType === 'pattern'
      ? (initialPatternData as { pattern?: string }).pattern || ''
      : ((initialPatternData as { days?: string[] }).days || []).join(', ')
  )
  const [sessions, setSessions] = useState<SessionData[]>(
    () => {
      if (initialSessions && initialSessions.length > 0) {
        // Normalize sets
        return initialSessions.map((s) => ({
          ...s,
          exercises: s.exercises.map((ex) => ({
            ...ex,
            sets: normalizeExSets(ex as unknown as Record<string, unknown>),
          })),
        }))
      }
      return [{ nom: '', jour: '', exercises: [] }]
    }
  )
  const [activeSession, setActiveSession] = useState(0)
  const [saving, setSaving] = useState(false)

  // Template-mode category state
  const [category, setCategory] = useState(initCategory)
  const [newCategory, setNewCategory] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [categories, setCategories] = useState(initExistingCategories)

  const isEdit = templateMode ? !!templateId : !!programId

  // -- Session management --
  const addSession = useCallback(() => {
    setSessions((prev) => [...prev, { nom: '', jour: '', exercises: [] }])
    setActiveSession((prev) => sessions.length) // will be new index
  }, [sessions.length])

  const removeSession = useCallback(() => {
    if (sessions.length <= 1) {
      toast('Il faut au moins une seance', 'error')
      return
    }
    if (!confirm('Supprimer cette seance ?')) return
    setSessions((prev) => prev.filter((_, i) => i !== activeSession))
    setActiveSession((prev) => Math.min(prev, sessions.length - 2))
  }, [sessions.length, activeSession, toast])

  const updateSessionField = useCallback((field: 'nom' | 'jour', value: string) => {
    setSessions((prev) => prev.map((s, i) => i === activeSession ? { ...s, [field]: value } : s))
  }, [activeSession])

  // -- Exercise management --
  const addExFromLibrary = useCallback((id: string, nom: string, muscle: string, defaultTempo?: string | null, defaultReps?: string | null) => {
    const setTemplate: SetData = {
      reps: defaultReps || DEFAULT_SET.reps,
      tempo: defaultTempo || DEFAULT_SET.tempo,
      repos: DEFAULT_SET.repos,
      type: 'normal',
    }
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      return {
        ...s,
        exercises: [
          ...s.exercises,
          {
            nom,
            exercice_id: id,
            muscle_principal: muscle,
            sets: [
              { ...setTemplate },
              { ...setTemplate },
              { ...setTemplate },
            ],
          },
        ],
      }
    }))
  }, [activeSession])

  const moveExercise = useCallback((idx: number, dir: number) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exs = [...s.exercises]
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= exs.length) return s
      ;[exs[idx], exs[newIdx]] = [exs[newIdx], exs[idx]]
      return { ...s, exercises: exs }
    }))
  }, [activeSession])

  const removeExercise = useCallback((idx: number) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      return { ...s, exercises: s.exercises.filter((_, j) => j !== idx) }
    }))
  }, [activeSession])

  const onSetChange = useCallback((exIdx: number, setIdx: number, field: string, value: string) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = s.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        const sets = ex.sets.map((set, si) => {
          if (si !== setIdx) return set
          return { ...set, [field]: value }
        })
        return { ...ex, sets }
      })
      return { ...s, exercises }
    }))
  }, [activeSession])

  const addSet = useCallback((exIdx: number) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = s.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        return { ...ex, sets: [...ex.sets, { ...DEFAULT_SET }] }
      })
      return { ...s, exercises }
    }))
  }, [activeSession])

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = s.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        if (ex.sets.length <= 1) {
          toast('Il faut au moins une serie', 'error')
          return ex
        }
        return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
      })
      return { ...s, exercises }
    }))
  }, [activeSession, toast])

  const addDropSet = useCallback((exIdx: number) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = s.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        return { ...ex, sets: [...ex.sets, { reps: '10', tempo: '30X1', repos: '', type: 'dropset' as const }] }
      })
      return { ...s, exercises }
    }))
  }, [activeSession])

  const addRestPause = useCallback((exIdx: number) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = s.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        return {
          ...ex,
          sets: [...ex.sets, { reps: '12', reps_rp: '20', rest_pause_time: '15', type: 'rest_pause' as const }],
        }
      })
      return { ...s, exercises }
    }))
  }, [activeSession])

  const toggleSuperset = useCallback((exIdx: number) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = [...s.exercises]
      const ex = exercises[exIdx]
      if (ex.superset_id) {
        const groupLetter = ex.superset_id.charAt(0)
        exercises.forEach((e) => {
          if (e.superset_id?.charAt(0) === groupLetter) {
            e.superset_id = null
          }
        })
      } else {
        const nextEx = exercises[exIdx + 1]
        if (!nextEx) {
          toast('Ajoutez un exercice apres celui-ci pour creer un super set', 'error')
          return s
        }
        const usedLetters = new Set(exercises.map((e) => e.superset_id?.charAt(0)).filter(Boolean))
        let letter = 'A'
        while (usedLetters.has(letter)) letter = String.fromCharCode(letter.charCodeAt(0) + 1)
        exercises[exIdx] = { ...ex, superset_id: letter + '1' }
        exercises[exIdx + 1] = { ...nextEx, superset_id: letter + '2' }
      }
      return { ...s, exercises }
    }))
  }, [activeSession, toast])

  const toggleMaxRep = useCallback((exIdx: number, setIdx: number, isMax: boolean) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = s.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        const sets = ex.sets.map((set, si) => {
          if (si !== setIdx) return set
          return { ...set, reps: isMax ? 'MAX' : '10' }
        })
        return { ...ex, sets }
      })
      return { ...s, exercises }
    }))
  }, [activeSession])

  const replaceExercise = useCallback((exIdx: number, id: string, nom: string, muscle: string) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== activeSession) return s
      const exercises = s.exercises.map((ex, ei) => {
        if (ei !== exIdx) return ex
        return { ...ex, nom, exercice_id: id, muscle_principal: muscle }
      })
      return { ...s, exercises }
    }))
  }, [activeSession])

  const moveSession = useCallback((idx: number, dir: number) => {
    setSessions((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
    setActiveSession((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= sessions.length) return prev
      if (prev === idx) return newIdx
      if (prev === newIdx) return idx
      return prev
    })
  }, [sessions.length])

  // -- Category helpers (template mode) --
  const confirmNewCategory = () => {
    if (newCategory.trim()) {
      if (!categories.includes(newCategory.trim())) {
        setCategories((prev) => [...prev, newCategory.trim()])
      }
      setCategory(newCategory.trim())
    }
    setNewCategory('')
    setShowNewCat(false)
  }

  // -- Save --
  async function handleSave() {
    if (!name.trim()) {
      toast('Le nom est obligatoire', 'error')
      return
    }
    setSaving(true)

    const patternData = patternType === 'pattern'
      ? { pattern: patternValue }
      : { days: patternValue.split(',').map((d) => d.trim()).filter(Boolean) }

    try {
      if (templateMode) {
        // ── TEMPLATE MODE: save to training_templates ──
        const sessionsData = sessions.map((s) => ({
          nom: s.nom,
          jour: s.jour,
          exercices: s.exercises.map((e) => {
            const base: Record<string, unknown> = {
              nom: e.nom,
              exercice_id: e.exercice_id || null,
              muscle_principal: e.muscle_principal || '',
            }
            if (e.sets && Array.isArray(e.sets)) {
              base.sets = e.sets
            }
            if (e.superset_id) base.superset_id = e.superset_id
            return base
          }),
        }))

        const tplData = {
          nom: name.trim(),
          category: category || null,
          pattern_type: patternType,
          pattern_data: patternData,
          sessions_data: sessionsData,
          coach_id: user?.id,
        }

        let error
        if (templateId) {
          ;({ error } = await supabase.from('training_templates').update(tplData).eq('id', templateId))
        } else {
          ;({ error } = await supabase.from('training_templates').insert(tplData))
        }
        if (error) throw error

        toast(templateId ? 'Template modifie' : 'Template cree')
        onSaved()
        return
      } else {
        // ── ATHLETE MODE: save to workout_programs + workout_sessions ──
        let pid = programId

        if (pid) {
          const { error } = await supabase
            .from('workout_programs')
            .update({ nom: name.trim(), pattern_type: patternType, pattern_data: patternData })
            .eq('id', pid)
          if (error) throw error

          const { error: delError } = await supabase
            .from('workout_sessions')
            .delete()
            .eq('program_id', pid)
          if (delError) throw delError
        } else {
          await supabase
            .from('workout_programs')
            .update({ actif: false })
            .eq('athlete_id', athleteId)

          const { data, error } = await supabase
            .from('workout_programs')
            .insert({
              nom: name.trim(),
              athlete_id: athleteId,
              coach_id: user?.id,
              pattern_type: patternType,
              pattern_data: patternData,
              actif: true,
            })
            .select()
          if (error) throw error
          pid = data[0].id
        }

        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i]
          const exs = s.exercises.map((e) => {
            const base: Record<string, unknown> = {
              nom: e.nom,
              exercice_id: e.exercice_id || null,
              muscle_principal: e.muscle_principal || '',
            }
            if (e.sets && Array.isArray(e.sets)) {
              base.sets = e.sets
            }
            if (e.superset_id) base.superset_id = e.superset_id
            return base
          })
          const { error } = await supabase
            .from('workout_sessions')
            .insert({
              nom: s.nom || `Seance ${i + 1}`,
              jour: s.jour || null,
              program_id: pid,
              exercices: JSON.stringify(exs),
              ordre: i,
            })
          if (error) throw error
        }

        toast('Programme sauvegarde !')

        if (!programId && athleteUserId) {
          await notifyAthlete(
            athleteUserId, 'training', 'Nouveau programme active',
            `Votre coach a active le programme "${name.trim()}"`,
          )
        }
      }

      onSaved()
    } catch (err) {
      toast('Erreur lors de la sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  // -- Compute total volume --
  let totalEx = 0
  let totalSeries = 0
  const totalMuscles: Record<string, number> = {}
  sessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      totalEx++
      const ser = ex.sets.length
      totalSeries += ser
      const m = ex.muscle_principal
      if (m && ser > 0) totalMuscles[m] = (totalMuscles[m] || 0) + ser
    })
  })
  const muscleEntries = Object.entries(totalMuscles).sort((a, b) => b[1] - a[1])

  const currentSession = sessions[activeSession]

  return (
    <div>
      {/* Header */}
      <div className={styles.trHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            <i className="fa-solid fa-arrow-left" />
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={templateMode ? 'Nom du template' : 'Nom du programme'}
            className={styles.trSessionNameInput}
            style={{ maxWidth: 350 }}
          />
          {templateMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-folder" style={{ color: 'var(--text3)', fontSize: 12 }} />
              {showNewCat ? (
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Nom..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmNewCategory()
                      if (e.key === 'Escape') setShowNewCat(false)
                    }}
                    style={{ padding: '4px 8px', background: 'var(--bg2)', border: '1px solid var(--primary)', borderRadius: 6, color: 'var(--text)', fontSize: 12, width: 130 }}
                  />
                  <button className="btn btn-outline btn-sm" onClick={confirmNewCategory} style={{ padding: '4px 8px' }}>
                    <i className="fa-solid fa-check" style={{ fontSize: 10, color: 'var(--success)' }} />
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowNewCat(false)} style={{ padding: '4px 8px' }}>
                    <i className="fa-solid fa-times" style={{ fontSize: 10 }} />
                  </button>
                </span>
              ) : (
                <>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ padding: '5px 8px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12 }}
                  >
                    <option value="">Sans categorie</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowNewCat(true)} title="Nouvelle categorie" style={{ padding: '4px 8px' }}>
                    <i className="fa-solid fa-plus" style={{ fontSize: 10 }} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <button className="btn btn-red" onClick={handleSave} disabled={saving}>
          <i className="fa-solid fa-save" /> {isEdit ? 'Enregistrer' : 'Creer'}
        </button>
      </div>

      {/* Config row */}
      <div className={styles.trConfigRow}>
        <select
          value={patternType}
          onChange={(e) => setPatternType(e.target.value)}
          className="inline-input"
          style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
        >
          <option value="pattern">Pattern</option>
          <option value="fixed">Jours fixes</option>
        </select>
        <div style={{ flex: 1, display: patternType === 'pattern' ? undefined : 'none' }}>
          <input
            type="text"
            value={patternType === 'pattern' ? patternValue : ''}
            onChange={(e) => setPatternValue(e.target.value)}
            placeholder="ex: Haut / Bas / Repos"
            className="inline-input"
            style={{ fontSize: 12, padding: '6px 10px' }}
          />
        </div>
        <div style={{ flex: 1, display: patternType === 'fixed' ? undefined : 'none' }}>
          <input
            type="text"
            value={patternType === 'fixed' ? patternValue : ''}
            onChange={(e) => setPatternValue(e.target.value)}
            placeholder="ex: Lundi, Mercredi, Vendredi"
            className="inline-input"
            style={{ fontSize: 12, padding: '6px 10px' }}
          />
        </div>
      </div>

      {/* Session tabs */}
      <div className={styles.trSessionTabs}>
        {sessions.map((s, i) => {
          const label = s.nom || `Seance ${i + 1}`
          return (
            <div
              key={i}
              className={`${styles.trSessionTab} ${i === activeSession ? styles.trSessionTabActive : ''}`}
              onClick={() => setActiveSession(i)}
            >
              {i > 0 && (
                <button
                  className={styles.trSessionTabArrow}
                  onClick={(e) => { e.stopPropagation(); moveSession(i, -1) }}
                  title="Deplacer a gauche"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
              )}
              <span>{label}</span>
              {i < sessions.length - 1 && (
                <button
                  className={styles.trSessionTabArrow}
                  onClick={(e) => { e.stopPropagation(); moveSession(i, 1) }}
                  title="Deplacer a droite"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              )}
            </div>
          )
        })}
        <button className={styles.trSessionTabAdd} onClick={addSession} title="Ajouter une seance">
          <i className="fa-solid fa-plus" />
        </button>
      </div>

      {/* Program total */}
      <div className={styles.programTotal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            <i className="fa-solid fa-chart-bar" style={{ color: 'var(--primary)', marginRight: 6 }} />
            Volume total
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {totalEx} exercice{totalEx > 1 ? 's' : ''} &middot; {totalSeries} series
          </span>
        </div>
        {muscleEntries.length > 0 ? (
          <div className={styles.trVolumePills}>
            {muscleEntries.map(([m, c]) => (
              <span key={m} className={styles.trVolumePill} style={{ borderColor: getMuscleColor(m) }}>
                <strong style={{ color: getMuscleColor(m) }}>{c}</strong> {m.toLowerCase()}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Ajoutez des exercices pour voir le volume
          </span>
        )}
      </div>

      {/* Body: library + session editor */}
      <div className={styles.trBody}>
        <ExerciseLibrary onAdd={addExFromLibrary} />
        {currentSession && (
          <SessionTab
            session={currentSession}
            onSessionNameChange={(v) => updateSessionField('nom', v)}
            onSessionJourChange={(v) => updateSessionField('jour', v)}
            onDeleteSession={removeSession}
            onMoveExercise={moveExercise}
            onRemoveExercise={removeExercise}
            onReplaceExercise={replaceExercise}
            onSetChange={onSetChange}
            onAddSet={addSet}
            onRemoveSet={removeSet}
            onAddDropSet={addDropSet}
            onAddRestPause={addRestPause}
            onToggleSuperset={toggleSuperset}
            onToggleMaxRep={toggleMaxRep}
          />
        )}
      </div>
    </div>
  )
}
