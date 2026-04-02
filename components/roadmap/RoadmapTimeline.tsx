'use client'

import { PROG_PHASES, type ProgPhaseKey } from '@/lib/constants'
import { toDateStr } from '@/lib/utils'
import styles from '@/styles/roadmap.module.css'

export interface RoadmapPhase {
  id: string
  athlete_id: string
  coach_id: string
  name: string
  phase: ProgPhaseKey
  status: 'planifiee' | 'en_cours' | 'terminee'
  description?: string | null
  start_date: string
  end_date: string
  programme_id?: string | null
  nutrition_id?: string | null
  position: number
}

interface ProgramRef {
  id: string
  nom: string
}

interface NutritionRef {
  id: string
  nom: string
}

interface DailyReport {
  date: string
  weight: number | null
}

interface RoadmapTimelineProps {
  phases: RoadmapPhase[]
  programs: ProgramRef[]
  nutritions: NutritionRef[]
  reports: DailyReport[]
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onStart: (id: string) => void
  onComplete: (id: string) => void
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function RoadmapTimeline({
  phases,
  programs,
  nutritions,
  reports,
  onAdd,
  onEdit,
  onDelete,
  onStart,
  onComplete,
}: RoadmapTimelineProps) {
  const today = toDateStr(new Date())

  if (!phases.length) {
    return (
      <div className={styles.rmEmpty}>
        <i className="fa-solid fa-road" style={{ fontSize: 32, color: 'var(--text3)' }} />
        <p style={{ marginTop: 12, color: 'var(--text2)' }}>Aucune phase planifiee</p>
        <button className="btn btn-red" onClick={onAdd} style={{ marginTop: 12 }}>
          <i className="fa-solid fa-plus" /> Ajouter une phase
        </button>
      </div>
    )
  }

  return (
    <div className={styles.rmTimeline}>
      {phases.map((p) => {
        const pi = PROG_PHASES[p.phase]
        const color = pi ? pi.color : '#555'
        const label = pi ? pi.label : p.phase || ''
        const isActive = p.start_date <= today && p.end_date >= today
        const isPast = p.end_date < today
        const statusLabel =
          p.status === 'en_cours' ? 'En cours' : p.status === 'terminee' ? 'Terminee' : 'Planifiee'
        const statusCls =
          p.status === 'en_cours'
            ? styles.rmStatusActive
            : p.status === 'terminee'
              ? styles.rmStatusDone
              : styles.rmStatusPlanned

        const prog = programs.find((pr) => pr.id === p.programme_id)
        const nutri = nutritions.find((n) => n.id === p.nutrition_id)

        const start = new Date(p.start_date + 'T00:00:00')
        const end = new Date(p.end_date + 'T00:00:00')
        const weeks = Math.max(1, Math.round((end.getTime() - start.getTime()) / (7 * 86400000)))

        const weightVals = reports
          .filter((r) => r.weight && r.date >= p.start_date && r.date <= p.end_date)
          .map((r) => parseFloat(String(r.weight)))
        const avgWeight =
          weightVals.length
            ? (weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1)
            : null

        return (
          <div
            key={p.id}
            className={`${styles.rmPhase} ${isActive ? styles.rmPhaseActive : ''} ${isPast ? styles.rmPhasePast : ''}`}
          >
            <div className={styles.rmDot} style={{ background: color }} />
            <div className={styles.rmLine} />
            <div className={styles.rmPhaseCard}>
              <div className={styles.rmPhaseTop}>
                <div className={styles.rmPhaseInfo}>
                  <div className={styles.rmPhaseNameRow}>
                    <span className={styles.rmPhaseBadge} style={{ background: color }}>
                      {label}
                    </span>
                    <span className={styles.rmPhaseName}>{p.name}</span>
                    <span className={statusCls}>{statusLabel}</span>
                  </div>
                  {p.description && <div className={styles.rmPhaseDesc}>{p.description}</div>}
                  <div className={styles.rmPhaseMeta}>
                    <span>
                      <i className="fa-solid fa-calendar" /> {formatDateFr(p.start_date)} &rarr;{' '}
                      {formatDateFr(p.end_date)}
                    </span>
                    <span>
                      <i className="fa-solid fa-layer-group" /> {weeks} sem.
                    </span>
                    {avgWeight && (
                      <span>
                        <i className="fa-solid fa-weight" /> {avgWeight} kg moy.
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.rmPhaseActions}>
                  {p.status === 'planifiee' && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onStart(p.id)}
                      style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                    >
                      <i className="fa-solid fa-play" /> Demarrer
                    </button>
                  )}
                  {p.status === 'en_cours' && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onComplete(p.id)}
                      style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                    >
                      <i className="fa-solid fa-check" /> Terminer
                    </button>
                  )}
                  {prog && (
                    <span className={styles.rmLinkPill}>
                      <i className="fa-solid fa-dumbbell" /> {prog.nom}
                    </span>
                  )}
                  {nutri && (
                    <span className={styles.rmLinkPill}>
                      <i className="fa-solid fa-utensils" /> {nutri.nom}
                    </span>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => onEdit(p.id)}>
                    <i className="fa-solid fa-pen" />
                  </button>
                  <button
                    className="btn btn-outline btn-sm btn-danger"
                    onClick={() => onDelete(p.id)}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <div className={styles.rmPhase} onClick={onAdd} style={{ cursor: 'pointer' }}>
        <div className={styles.rmDot} style={{ background: 'var(--border)' }} />
        <div className={styles.rmAddCard}>
          <i className="fa-solid fa-plus" /> Ajouter une phase
        </div>
      </div>
    </div>
  )
}
