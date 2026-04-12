'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import SetRow, { type SetData } from './SetRow'
import styles from '@/styles/training.module.css'

export interface ExerciseData {
  nom: string
  exercice_id: string | null
  muscle_principal: string
  sets: SetData[]
  superset_id?: string | null
}

interface ExerciseRowProps {
  index: number
  exercise: ExerciseData
  onMove: (idx: number, dir: number) => void
  onRemove: (idx: number) => void
  onReplace: (exIdx: number, id: string, nom: string, muscle: string) => void
  onSetChange: (exIdx: number, setIdx: number, field: string, value: string) => void
  onAddSet: (exIdx: number) => void
  onRemoveSet: (exIdx: number, setIdx: number) => void
  onAddDropSet: (exIdx: number) => void
  onAddRestPause: (exIdx: number) => void
  onToggleSuperset: (exIdx: number) => void
  onToggleMaxRep: (exIdx: number, setIdx: number, isMax: boolean) => void
}

interface ExerciseDB {
  id: string
  nom: string
  muscle_principal: string | null
}

// Module-level cache shared across all ExerciseRow instances
let exercisesCache: ExerciseDB[] | null = null
let exercisesCachePromise: Promise<ExerciseDB[]> | null = null

async function fetchExercises(): Promise<ExerciseDB[]> {
  if (exercisesCache) return exercisesCache
  if (exercisesCachePromise) return exercisesCachePromise
  const supabase = createClient()
  exercisesCachePromise = (async () => {
    const { data } = await supabase
      .from('exercices')
      .select('id, nom, muscle_principal')
      .order('nom')
      .limit(500)
    exercisesCache = data || []
    return exercisesCache
  })()
  return exercisesCachePromise
}

export default function ExerciseRow({
  index,
  exercise,
  onMove,
  onRemove,
  onReplace,
  onSetChange,
  onAddSet,
  onRemoveSet,
  onAddDropSet,
  onAddRestPause,
  onToggleSuperset,
  onToggleMaxRep,
}: ExerciseRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapSearch, setSwapSearch] = useState('')
  const [allExercises, setAllExercises] = useState<ExerciseDB[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const swapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (swapRef.current && !swapRef.current.contains(e.target as Node)) {
        setSwapOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const openSwap = useCallback(() => {
    setSwapOpen(true)
    setSwapSearch('')
    fetchExercises().then(setAllExercises)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  const handleSelect = useCallback((ex: ExerciseDB) => {
    onReplace(index, ex.id, ex.nom, ex.muscle_principal || '')
    setSwapOpen(false)
  }, [index, onReplace])

  const query = swapSearch.toLowerCase()
  const swapResults = allExercises
    .filter((ex) => {
      if (!query) return true
      return ex.nom.toLowerCase().includes(query) || (ex.muscle_principal || '').toLowerCase().includes(query)
    })
    .slice(0, 20)

  const superBadge = exercise.superset_id ? (
    <span className={styles.tpSupersetBadge}>SS {exercise.superset_id}</span>
  ) : null

  return (
    <div
      className={`${styles.trExerciseCard} ${index === 0 ? styles.trExerciseCardFirst : ''}`}
      data-ex-id={exercise.exercice_id || ''}
      data-muscle={exercise.muscle_principal}
    >
      <div className={styles.trExerciseHeader}>
        <span className={styles.trExerciseNum}>{index + 1}.</span>
        <div className={styles.trExNameWrap} ref={swapRef}>
          <span
            className={`${styles.trExerciseName} ${styles.trExerciseNameClickable}`}
            onClick={(e) => { e.stopPropagation(); openSwap() }}
            title="Cliquer pour changer d'exercice"
          >
            {exercise.nom}
            <i className={`fa-solid fa-pen ${styles.trExSwapIcon}`} />
          </span>
          {swapOpen && (
            <div className={styles.trExSwapDropdown}>
              <div className={styles.trExSwapSearchWrap}>
                <i className={`fa-solid fa-search ${styles.trExSwapSearchIcon}`} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  placeholder="Rechercher un exercice..."
                  className={styles.trExSwapSearchInput}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className={styles.trExSwapResults}>
                {swapResults.length > 0 ? swapResults.map((ex) => (
                  <div
                    key={ex.id}
                    className={styles.trExSwapItem}
                    onClick={(e) => { e.stopPropagation(); handleSelect(ex) }}
                  >
                    <span className={styles.trExSwapItemName}>{ex.nom}</span>
                    {ex.muscle_principal && (
                      <span className={styles.trExSwapItemMuscle}>{ex.muscle_principal}</span>
                    )}
                  </div>
                )) : (
                  <div className={styles.trExSwapEmpty}>Aucun resultat</div>
                )}
              </div>
            </div>
          )}
        </div>
        {superBadge}
        {exercise.muscle_principal && (
          <span className={styles.trExerciseMuscleChip}>{exercise.muscle_principal}</span>
        )}
        <div className={styles.trExerciseActions}>
          <button onClick={() => onMove(index, -1)} title="Monter">
            <i className="fa-solid fa-arrow-up" />
          </button>
          <button onClick={() => onMove(index, 1)} title="Descendre">
            <i className="fa-solid fa-arrow-down" />
          </button>
          <div className={styles.tpExMenuWrap} ref={menuRef}>
            <button
              className={styles.tpExMenuBtn}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              title="Options"
            >
              <i className="fa-solid fa-ellipsis-vertical" />
            </button>
            <div className={`${styles.tpExMenu} ${menuOpen ? styles.tpExMenuOpen : ''}`}>
              <button onClick={() => { onToggleSuperset(index); setMenuOpen(false) }}>
                <i className="fa-solid fa-link" /> Super set
              </button>
              <button onClick={() => { onAddDropSet(index); setMenuOpen(false) }}>
                <i className="fa-solid fa-angle-double-down" /> Drop set
              </button>
              <button onClick={() => { onAddRestPause(index); setMenuOpen(false) }}>
                <i className="fa-solid fa-pause" /> Rest-pause
              </button>
              <hr className={styles.tpExMenuDivider} />
              <button onClick={() => { onRemove(index); setMenuOpen(false) }} style={{ color: 'var(--danger)' }}>
                <i className="fa-solid fa-trash" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
      <table className={styles.tpSetsTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>Reps</th>
            <th>Tempo</th>
            <th>Repos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {exercise.sets.map((set, si) => (
            <SetRow
              key={si}
              exIdx={index}
              setIdx={si}
              set={set}
              onChange={onSetChange}
              onRemove={onRemoveSet}
              onToggleMaxRep={onToggleMaxRep}
            />
          ))}
        </tbody>
      </table>
      <button className={styles.tpAddSetBtn} onClick={() => onAddSet(index)}>
        <i className="fa-solid fa-plus" /> Serie
      </button>
    </div>
  )
}
