'use client'

import ExerciseRow, { type ExerciseData } from './ExerciseRow'
import styles from '@/styles/training.module.css'

const MUSCLE_COLOR_PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#6366f1', '#78716c', '#e11d48', '#0ea5e9', '#d946ef',
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

function getVolumePills(exercises: ExerciseData[]) {
  const muscles: Record<string, number> = {}
  exercises.forEach((ex) => {
    const m = ex.muscle_principal
    if (m && ex.sets.length > 0) {
      muscles[m] = (muscles[m] || 0) + ex.sets.length
    }
  })
  return Object.entries(muscles).sort((a, b) => b[1] - a[1])
}

interface SessionTabProps {
  session: { nom: string; jour: string; exercises: ExerciseData[] }
  onSessionNameChange: (nom: string) => void
  onSessionJourChange: (jour: string) => void
  onDeleteSession: () => void
  onMoveExercise: (idx: number, dir: number) => void
  onRemoveExercise: (idx: number) => void
  onReplaceExercise: (exIdx: number, id: string, nom: string, muscle: string) => void
  onSetChange: (exIdx: number, setIdx: number, field: string, value: string) => void
  onAddSet: (exIdx: number) => void
  onRemoveSet: (exIdx: number, setIdx: number) => void
  onAddDropSet: (exIdx: number) => void
  onAddRestPause: (exIdx: number) => void
  onToggleSuperset: (exIdx: number) => void
  onToggleMaxRep: (exIdx: number, setIdx: number, isMax: boolean) => void
}

export default function SessionTab({
  session,
  onSessionNameChange,
  onSessionJourChange,
  onDeleteSession,
  onMoveExercise,
  onRemoveExercise,
  onReplaceExercise,
  onSetChange,
  onAddSet,
  onRemoveSet,
  onAddDropSet,
  onAddRestPause,
  onToggleSuperset,
  onToggleMaxRep,
}: SessionTabProps) {
  const volumeEntries = getVolumePills(session.exercises)

  return (
    <div className={styles.trSessionContent}>
      <div className={styles.trSessionNameRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: 'var(--text3)' }}>
          Nom de la seance
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <input
          type="text"
          value={session.nom}
          onChange={(e) => onSessionNameChange(e.target.value)}
          placeholder="ex: Push, Haut du corps..."
          className={styles.trSessionNameInput}
          style={{ flex: 1 }}
        />
        <input
          type="text"
          value={session.jour}
          onChange={(e) => onSessionJourChange(e.target.value)}
          placeholder="Jour"
          className={styles.trSessionNameInput}
          style={{ width: 120, fontSize: 13, fontWeight: 400 }}
        />
        <button
          className="btn btn-outline btn-sm btn-danger"
          onClick={onDeleteSession}
          title="Supprimer cette seance"
        >
          <i className="fa-solid fa-trash" /> Supprimer
        </button>
      </div>

      {volumeEntries.length > 0 && (
        <div className={styles.trVolumePills}>
          {volumeEntries.map(([m, c]) => (
            <span key={m} className={styles.trVolumePill} style={{ borderColor: getMuscleColor(m) }}>
              <strong style={{ color: getMuscleColor(m) }}>{c}</strong> {m.toLowerCase()}
            </span>
          ))}
        </div>
      )}

      <div>
        {session.exercises.length > 0 ? (
          session.exercises.map((ex, i) => (
            <ExerciseRow
              key={i}
              index={i}
              exercise={ex}
              onMove={onMoveExercise}
              onRemove={onRemoveExercise}
              onReplace={onReplaceExercise}
              onSetChange={onSetChange}
              onAddSet={onAddSet}
              onRemoveSet={onRemoveSet}
              onAddDropSet={onAddDropSet}
              onAddRestPause={onAddRestPause}
              onToggleSuperset={onToggleSuperset}
              onToggleMaxRep={onToggleMaxRep}
            />
          ))
        ) : (
          <div className={styles.trEmptyZone}>
            <i className="fa-solid fa-dumbbell" />
            Cliquez sur un exercice de la bibliotheque pour l&apos;ajouter
          </div>
        )}
      </div>
    </div>
  )
}
