'use client'

import { useState, useRef, useEffect } from 'react'
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
  onSetChange: (exIdx: number, setIdx: number, field: string, value: string) => void
  onAddSet: (exIdx: number) => void
  onRemoveSet: (exIdx: number, setIdx: number) => void
  onAddDropSet: (exIdx: number) => void
  onAddRestPause: (exIdx: number) => void
  onToggleSuperset: (exIdx: number) => void
  onToggleMaxRep: (exIdx: number, setIdx: number, isMax: boolean) => void
}

export default function ExerciseRow({
  index,
  exercise,
  onMove,
  onRemove,
  onSetChange,
  onAddSet,
  onRemoveSet,
  onAddDropSet,
  onAddRestPause,
  onToggleSuperset,
  onToggleMaxRep,
}: ExerciseRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

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
        <span className={styles.trExerciseName}>{exercise.nom}</span>
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
