'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { notifyAthlete } from '@/lib/push'
import { getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import CardioSection from '@/components/training/CardioSection'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import type { SetData } from '@/components/training/SetRow'
import styles from '@/styles/training.module.css'

const ProgramEditor = dynamic(() => import('@/components/training/ProgramEditor'), {
  loading: () => <div className="text-center" style={{ padding: 40 }}><i className="fa-solid fa-spinner fa-spin fa-2x" /></div>,
})

interface WorkoutSession {
  id: string
  nom: string
  jour: string | null
  exercices: string | unknown[]
  ordre: number
}

interface WorkoutProgram {
  id: string
  nom: string
  actif: boolean
  pattern_type: string | null
  pattern_data: Record<string, unknown> | string | null
  created_at: string
  workout_sessions: WorkoutSession[]
}

interface AthleteCardio {
  cardio_config: {
    titre: string
    minutes: number | null
    bpm_min: number | null
    bpm_max: number | null
    frequence: string | null
  } | null
  pas_journalier: number | null
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

function parseExercises(raw: string | unknown[]): Record<string, unknown>[] {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>[]) || []
  } catch {
    return []
  }
}

function getMuscleCount(exercises: Record<string, unknown>[]) {
  const muscles: Record<string, number> = {}
  exercises.forEach((ex) => {
    const m = ex.muscle_principal as string
    if (!m) return
    const sets = ex.sets as unknown[]
    const count = Array.isArray(sets) ? sets.length : (parseInt(String(ex.series)) || 0)
    if (count > 0) muscles[m] = (muscles[m] || 0) + count
  })
  return muscles
}

// View mode: render exercise card
function ViewExCard({ ex, i }: { ex: Record<string, unknown>; i: number }) {
  const muscle = (ex.muscle_principal as string) || ''
  const rawSets = (ex.sets as SetData[]) || []
  const superBadge = ex.superset_id ? (
    <span className={styles.tpSupersetBadge}>SS {String(ex.superset_id)}</span>
  ) : null

  return (
    <div className={styles.tvExCard}>
      <div className={styles.tvExHeader}>
        <span className={styles.tvExNum}>{i + 1}</span>
        <span className={styles.tvExName}>{String(ex.nom)}</span>
        {superBadge}
        {muscle && <span className={styles.trExerciseMuscleChip}>{muscle}</span>}
      </div>
      <table className={styles.tvSetsTable}>
        <thead>
          <tr><th>#</th><th>Reps</th><th>Tempo</th><th>Repos</th></tr>
        </thead>
        <tbody>
          {rawSets.map((set, si) => {
            if (set.type === 'dropset') {
              const repsDisplay = set.reps === 'MAX' ? (
                <span className={styles.tpMaxrepTag}>MAX REP</span>
              ) : set.reps || '-'
              return (
                <tr key={si} className={`${styles.tvSetRow} ${styles.tvSetDrop}`}>
                  <td><span className={`${styles.tpSetTypeTag} ${styles.tpTagDrop}`}>DROP</span></td>
                  <td>{repsDisplay}</td>
                  <td>{set.tempo || '-'}</td>
                  <td>&mdash;</td>
                </tr>
              )
            }
            if (set.type === 'rest_pause') {
              return (
                <tr key={si} className={`${styles.tvSetRow} ${styles.tvSetRp}`}>
                  <td><span className={`${styles.tpSetTypeTag} ${styles.tpTagRp}`}>RP</span></td>
                  <td>{set.reps || '-'}</td>
                  <td>{set.reps_rp || '-'} tot</td>
                  <td>{set.rest_pause_time || '15'}s</td>
                </tr>
              )
            }
            return (
              <tr key={si} className={styles.tvSetRow}>
                <td>{si + 1}</td>
                <td>{set.reps || '-'}</td>
                <td>{set.tempo || '-'}</td>
                <td>{set.repos || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface WorkoutLog {
  id: string
  athlete_id: string
  session_id: string | null
  session_name: string | null
  titre: string | null
  date: string
  started_at: string | null
  finished_at: string | null
  exercices_completes?: string | unknown[] | null
}

function parseLogExercises(log: WorkoutLog): Record<string, unknown>[] {
  const raw = log.exercices_completes
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : []
  } catch { return [] }
}

function formatLogDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function TrainingPage() {
  const params = useParams<{ id: string }>()
  const athleteId = params.id
  const supabase = createClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const { athletes } = useAthleteContext()
  const athlete = athletes.find((a) => a.id === athleteId)

  const cacheKey = `athlete_${athleteId}_training`
  const [cached] = useState(() => getPageCache<{ programs: WorkoutProgram[]; cardio: AthleteCardio }>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [programs, setPrograms] = useState<WorkoutProgram[]>(cached?.programs ?? [])
  const [athleteCardio, setAthleteCardio] = useState<AthleteCardio>(cached?.cardio ?? { cardio_config: null, pas_journalier: null })
  const [view, setView] = useState<'list' | 'editor' | 'detail' | 'history'>('list')
  const [editProgramId, setEditProgramId] = useState<string | null>(null)
  const [editProgramData, setEditProgramData] = useState<{
    name: string
    patternType: string
    patternData: Record<string, unknown>
    sessions: { nom: string; jour: string; exercises: { nom: string; exercice_id: string | null; muscle_principal: string; sets: SetData[]; superset_id?: string | null }[] }[]
  } | null>(null)
  const [viewProgramId, setViewProgramId] = useState<string | null>(null)
  const [viewSessionIdx, setViewSessionIdx] = useState(0)

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [trainingTemplates, setTrainingTemplates] = useState<{ id: string; nom: string; category?: string | null; pattern_type?: string; pattern_data?: Record<string, unknown>; sessions_data?: Array<{ nom?: string; jour?: string; exercices?: unknown[] | string; exercises?: unknown[] | string }> }[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // History state
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, WorkoutSession & { _exs: Record<string, unknown>[]; _progName: string }>>({})
  const [histWeekOffset, setHistWeekOffset] = useState(0)
  const [histSelectedDate, setHistSelectedDate] = useState<string | null>(null)
  const [histPrevLogIdx, setHistPrevLogIdx] = useState(0)

  const loadData = useCallback(async () => {
    if (!programs.length) setLoading(true)
    try {
      const [athleteRes, programsRes, logsRes] = await Promise.all([
        supabase.from('athletes').select('cardio_config, pas_journalier').eq('id', athleteId).single(),
        supabase.from('workout_programs').select('id, nom, actif, pattern_type, pattern_data, created_at, workout_sessions(id, nom, jour, exercices, ordre)').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('workout_logs').select('id, athlete_id, session_id, session_name, titre, date, type, started_at, finished_at, exercices_completes').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(50),
      ])
      const cardio: AthleteCardio = {
        cardio_config: athleteRes.data?.cardio_config || null,
        pas_journalier: athleteRes.data?.pas_journalier || null,
      }
      setAthleteCardio(cardio)
      const progs = (programsRes.data as WorkoutProgram[]) || []
      setPrograms(progs)
      const logs = (logsRes.data as WorkoutLog[]) || []
      setWorkoutLogs(logs)

      // Build session lookup
      const sMap: Record<string, WorkoutSession & { _exs: Record<string, unknown>[]; _progName: string }> = {}
      progs.forEach((p) => {
        (p.workout_sessions || []).forEach((s) => {
          const exs = parseExercises(s.exercices)
          ;(sMap as Record<string, unknown>)[s.id] = { ...s, _exs: exs, _progName: p.nom }
        })
      })
      setSessionMap(sMap)

      // Persist to sessionStorage for instant load next time (exclude heavy logs)
      setPageCache(cacheKey, { programs: progs, cardio })
    } finally {
      setLoading(false)
    }
  }, [athleteId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  useRefetchOnResume(loadData, loading)

  // Push browser history state when entering sub-views, so back button returns to list
  useEffect(() => {
    if (view !== 'list') {
      window.history.pushState({ trainingView: view }, '')
    }
  }, [view])

  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      if (view !== 'list') {
        e.preventDefault()
        setView('list')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [view])

  // -- Actions --
  const toggleProgram = useCallback(async (id: string, activate: boolean) => {
    try {
      if (activate) {
        await supabase.from('workout_programs').update({ actif: false }).eq('athlete_id', athleteId)
        const { data: prog, error } = await supabase
          .from('workout_programs')
          .update({ actif: true })
          .eq('id', id)
          .select('nom')
          .single()
        if (error) throw error
        toast('Programme active !')
        if (athlete?.user_id) {
          await notifyAthlete(
            athlete.user_id, 'training', 'Nouveau programme active',
            `Votre coach a active le programme "${prog?.nom || ''}"`,
          )
        }
      } else {
        const { error } = await supabase.from('workout_programs').update({ actif: false }).eq('id', id)
        if (error) throw error
        toast('Programme desactive')
      }
      loadData()
    } catch (err) {
      toast('Erreur', 'error')
    }
  }, [athleteId, athlete?.user_id, toast, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteProgram = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce programme et toutes ses seances ?')) return
    await supabase.from('workout_sessions').delete().eq('program_id', id)
    const { error } = await supabase.from('workout_programs').delete().eq('id', id)
    if (error) {
      toast('Erreur lors de la suppression', 'error')
      return
    }
    toast('Programme supprime !')
    loadData()
  }, [toast, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = useCallback((programId?: string) => {
    if (!programId) {
      setEditProgramId(null)
      setEditProgramData(null)
      setView('editor')
      return
    }
    const prog = programs.find((p) => p.id === programId)
    if (!prog) return
    let pd: Record<string, unknown> = {}
    try {
      pd = typeof prog.pattern_data === 'string' ? JSON.parse(prog.pattern_data) : (prog.pattern_data || {})
    } catch { /* empty */ }
    const sessions = (prog.workout_sessions || [])
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      .map((s) => {
        const exercises = parseExercises(s.exercices)
        return {
          nom: s.nom || '',
          jour: s.jour || '',
          exercises: exercises.map((ex) => ({
            nom: String(ex.nom || ''),
            exercice_id: ex.exercice_id ? String(ex.exercice_id) : null,
            muscle_principal: String(ex.muscle_principal || ''),
            sets: (Array.isArray(ex.sets) ? ex.sets : []) as SetData[],
            superset_id: ex.superset_id ? String(ex.superset_id) : null,
          })),
        }
      })
    setEditProgramId(programId)
    setEditProgramData({
      name: prog.nom,
      patternType: prog.pattern_type || 'pattern',
      patternData: pd,
      sessions,
    })
    setView('editor')
  }, [programs])

  const openDetail = useCallback((programId: string) => {
    setViewProgramId(programId)
    setViewSessionIdx(0)
    setView('detail')
  }, [])

  // Open template picker: fetch coach's training templates
  const openTemplatePicker = useCallback(async () => {
    const coachId = user?.id
    if (!coachId) { console.warn('[Training] No user.id for template picker'); return }
    setShowTemplatePicker(true)
    setLoadingTemplates(true)
    try {
      const { data } = await supabase
        .from('training_templates')
        .select('id, nom, category, pattern_type, pattern_data, sessions_data')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      setTrainingTemplates((data || []) as typeof trainingTemplates)
    } finally {
      setLoadingTemplates(false)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Select a training template: pre-fill editor with its data
  const selectTrainingTemplate = useCallback((tpl: typeof trainingTemplates[0]) => {
    setShowTemplatePicker(false)
    const sd = tpl.sessions_data || []
    const sessions = sd.map((s) => {
      let exs: Array<{ nom?: string; series?: string | number; reps?: string; exercice_id?: string | null; muscle_principal?: string; sets?: SetData[]; superset_id?: string | null }> = []
      try {
        const raw = s.exercices ?? s.exercises ?? []
        exs = typeof raw === 'string' ? JSON.parse(raw) : (raw as typeof exs)
      } catch { exs = [] }
      return {
        nom: s.nom || '',
        jour: s.jour || '',
        exercises: exs.map((ex) => ({
          nom: String(ex.nom || ''),
          exercice_id: ex.exercice_id ? String(ex.exercice_id) : null,
          muscle_principal: String(ex.muscle_principal || ''),
          sets: Array.isArray(ex.sets) && ex.sets.length > 0
            ? ex.sets as SetData[]
            : Array.from({ length: parseInt(String(ex.series || '4')) || 4 }, () => ({ reps: String(ex.reps || '10'), tempo: '30X1', repos: '1m30', type: 'normal' as const })),
          superset_id: ex.superset_id ? String(ex.superset_id) : null,
        })),
      }
    })
    let pd: Record<string, unknown> = {}
    try {
      pd = typeof tpl.pattern_data === 'string' ? JSON.parse(tpl.pattern_data as string) : (tpl.pattern_data || {})
    } catch { /* empty */ }
    setEditProgramId(null)
    setEditProgramData({
      name: tpl.nom,
      patternType: tpl.pattern_type || 'pattern',
      patternData: pd,
      sessions,
    })
    setView('editor')
  }, [])

  // -- Editor view --
  if (view === 'editor') {
    return (
      <ProgramEditor
        athleteId={athleteId}
        athleteUserId={athlete?.user_id}
        programId={editProgramId}
        initialName={editProgramData?.name}
        initialPatternType={editProgramData?.patternType}
        initialPatternData={editProgramData?.patternData}
        initialSessions={editProgramData?.sessions}
        onClose={() => { setView('list'); loadData() }}
        onSaved={() => { setView('list'); loadData() }}
      />
    )
  }

  // -- Detail view --
  if (view === 'detail' && viewProgramId) {
    const prog = programs.find((p) => p.id === viewProgramId)
    if (!prog) {
      setView('list')
      return null
    }
    const sessions = (prog.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
    const currentSession = sessions[viewSessionIdx]
    const exercises = currentSession ? parseExercises(currentSession.exercices) : []
    const muscles = getMuscleCount(exercises)
    const muscleEntries = Object.entries(muscles).sort((a, b) => b[1] - a[1])
    let totalSeries = 0
    exercises.forEach((ex) => {
      const sets = ex.sets as unknown[]
      totalSeries += Array.isArray(sets) ? sets.length : (parseInt(String(ex.series)) || 0)
    })

    return (
      <div>
        <div className={styles.trHeader}>
          <div>
            <div className={styles.trHeaderTitle}>{prog.nom}</div>
            <div className={styles.trHeaderSub}>
              {sessions.length} seance(s){' '}
              {prog.actif && (
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>&middot; Actif</span>
              )}
            </div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm" onClick={() => openEditor(prog.id)}>
              <i className="fa-solid fa-pen" /> Modifier
            </button>
            <button className="btn btn-outline btn-sm btn-danger" onClick={() => deleteProgram(prog.id)}>
              <i className="fa-solid fa-trash" />
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>
              <i className="fa-solid fa-arrow-left" />
            </button>
          </div>
        </div>

        {/* Session tabs */}
        <div className={styles.trSessionTabs}>
          {sessions.map((s, i) => {
            const label = s.nom || `Seance ${i + 1}`
            return (
              <button
                key={i}
                className={`${styles.trSessionTab} ${i === viewSessionIdx ? styles.trSessionTabActive : ''}`}
                onClick={() => setViewSessionIdx(i)}
              >
                {label}
                {s.jour && (
                  <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}> &middot; {s.jour}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Session content */}
        <div className={styles.trBodyView}>
          <div className={styles.trSessionContent}>
            {currentSession && (
              <>
                <div className={styles.tvSessionHeader}>
                  <div>
                    <div className={styles.tvSessionTitle}>{currentSession.nom || 'Seance'}</div>
                    {currentSession.jour && (
                      <div className={styles.tvSessionDay}>
                        <i className="fa-solid fa-calendar" /> {currentSession.jour}
                      </div>
                    )}
                  </div>
                  <div className={styles.tvSessionStats}>
                    <span><strong>{exercises.length}</strong> exo</span>
                    <span><strong>{totalSeries}</strong> series</span>
                  </div>
                </div>

                {muscleEntries.length > 0 && (
                  <div className={styles.trVolumePills}>
                    {muscleEntries.map(([m, c]) => (
                      <span key={m} className={styles.trVolumePill} style={{ borderColor: getMuscleColor(m) }}>
                        <strong style={{ color: getMuscleColor(m) }}>{c}</strong> {m.toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}

                {exercises.length > 0 ? (
                  exercises.map((ex, i) => <ViewExCard key={i} ex={ex} i={i} />)
                ) : (
                  <div className={styles.trEmptyZone}>
                    <i className="fa-solid fa-dumbbell" />
                    Aucun exercice dans cette seance
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // -- History view --
  if (view === 'history') {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - (histWeekOffset * 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekStartStr = toDateStr(weekStart)
    const weekEndStr = toDateStr(weekEnd)
    const today = toDateStr(now)

    const days: { date: string; dayLabel: string; dayNum: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      days.push({
        date: toDateStr(d),
        dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNum: d.getDate(),
      })
    }

    const weekLabel = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      + ' — ' + weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

    // Auto-select date
    let selectedDate = histSelectedDate
    if (!selectedDate || selectedDate < weekStartStr || selectedDate > weekEndStr) {
      const dayWithLog = [...days].reverse().find((d) => workoutLogs.some((l) => l.date === d.date))
      selectedDate = dayWithLog?.date || days.find((d) => d.date === today)?.date || days[0].date
    }

    const dayLogs = workoutLogs.filter((l) => l.date === selectedDate)
    const dateLong = new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    const renderSetTags = (series: Record<string, unknown>[], cmpSeries?: Record<string, unknown>[]) =>
      (series || []).map((set, si) => {
        const reps = set.reps ?? '-'
        const kg = set.kg ?? set.load ?? set.charge ?? null
        let cmpIcon: React.ReactNode = null
        if (cmpSeries) {
          const cs = cmpSeries[si]
          if (cs) {
            const curVol = (parseFloat(String(kg)) || 0) > 0
              ? (parseFloat(String(set.reps)) || 0) * (parseFloat(String(kg)) || 0)
              : (parseFloat(String(set.reps)) || 0)
            const prevKg = cs.kg ?? cs.load ?? cs.charge
            const prevVol = (parseFloat(String(prevKg)) || 0) > 0
              ? (parseFloat(String(cs.reps)) || 0) * (parseFloat(String(prevKg)) || 0)
              : (parseFloat(String(cs.reps)) || 0)
            if (curVol > prevVol) cmpIcon = <i className={`fa-solid fa-arrow-up ${styles.htCmpUp}`} />
            else if (curVol < prevVol) cmpIcon = <i className={`fa-solid fa-arrow-down ${styles.htCmpDown}`} />
            else cmpIcon = <i className={`fa-solid fa-equals ${styles.htCmpEq}`} />
          }
        }
        if (set.duree) return <span key={si} className={styles.histSet}>{String(set.duree)}</span>
        return (
          <span key={si} className={styles.histSet}>
            {String(reps)} reps{kg != null && kg !== '-' ? ` \u00B7 ${kg} kg` : ''}{cmpIcon}
          </span>
        )
      })

    return (
      <div>
        <div className={styles.trHeader}>
          <div>
            <div className={styles.trHeaderTitle}>
              <i className="fa-solid fa-history" style={{ color: 'var(--primary)', marginRight: 8 }} />
              Historique Training
            </div>
            <div className={styles.trHeaderSub}>Seances realisees par l&apos;athlete</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>
            <i className="fa-solid fa-arrow-left" /> Programmes
          </button>
        </div>

        {/* Week nav */}
        <div className={styles.nhWeekNav}>
          <button
            className={styles.nhWeekBtn}
            onClick={() => { setHistWeekOffset(histWeekOffset + 1); setHistSelectedDate(null); setHistPrevLogIdx(0) }}
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
          <span className={styles.nhWeekLabel}>{weekLabel}</span>
          <button
            className={styles.nhWeekBtn}
            disabled={histWeekOffset <= 0}
            onClick={() => { setHistWeekOffset(Math.max(0, histWeekOffset - 1)); setHistSelectedDate(null); setHistPrevLogIdx(0) }}
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>

        {/* Day buttons */}
        <div className={styles.nhDaysRow}>
          {days.map((d) => {
            const hasLog = workoutLogs.some((l) => l.date === d.date)
            const isSelected = d.date === selectedDate
            const isToday = d.date === today
            const cls = [styles.nhDay]
            if (isSelected) cls.push(styles.nhDayActive)
            if (isToday) cls.push(styles.nhDayToday)
            return (
              <button
                key={d.date}
                className={cls.join(' ')}
                onClick={() => { setHistSelectedDate(d.date); setHistPrevLogIdx(0) }}
              >
                <span className={styles.nhDayLabel}>{d.dayLabel}</span>
                <span className={styles.nhDayNum}>{d.dayNum}</span>
                {hasLog && <span className={styles.nhDayDot} />}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className={styles.nhContent}>
          <div className={styles.nhDateLabel}>{dateLong}</div>

          {dayLogs.length === 0 ? (
            <div className={styles.histEmpty}>
              <i className="fa-solid fa-dumbbell" />
              <div style={{ fontSize: 14 }}>Aucune seance ce jour</div>
            </div>
          ) : (
            dayLogs.map((log, logIdx) => {
              const session = log.session_id ? sessionMap[log.session_id] : null
              const sessionName = session?.nom || log.session_name || log.titre || 'Seance libre'
              const isLibre = !log.session_id
              const duration = (log.started_at && log.finished_at)
                ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 60000)
                : null
              const logExs = parseLogExercises(log)
              const programmedExs = session?._exs || []
              const baseExs = programmedExs.length ? programmedExs : logExs

              // Find previous logs of same session for comparison
              const sameLogs = log.session_id
                ? workoutLogs.filter((l) => l.session_id === log.session_id && l.date < log.date)
                : workoutLogs.filter((l) => !l.session_id && l.date < log.date && (l.titre || l.session_name) === (log.titre || log.session_name))
              const hasPrev = sameLogs.length > 0
              const safeIdx = Math.min(histPrevLogIdx, sameLogs.length - 1)
              const prevLog = hasPrev ? sameLogs[safeIdx] : null
              const prevExs = prevLog ? parseLogExercises(prevLog) : []
              const prevDate = prevLog ? formatLogDate(prevLog.date) : ''
              const rightDate = formatLogDate(log.date)

              return (
                <div key={log.id || logIdx} style={{ marginBottom: 16 }}>
                  {/* Session title */}
                  <div className={styles.htSessionHeader}>
                    <i className="fa-solid fa-dumbbell" style={{ color: 'var(--primary)' }} />
                    {sessionName}
                    {isLibre && <span className={styles.htLibreTag}>Libre</span>}
                    {duration !== null && (
                      <span className={styles.htSessionDuration}>
                        <i className="fa-solid fa-clock" style={{ marginRight: 3 }} />
                        {duration >= 60 ? Math.floor(duration / 60) + 'h' + String(duration % 60).padStart(2, '0') : duration + ' min'}
                      </span>
                    )}
                  </div>

                  {/* Grid table */}
                  <div className={styles.htWrap}>
                    {/* Header */}
                    <div className={styles.htHdr}>
                      <div className={styles.htHdrTitle}>Exercice</div>
                      <div className={`${styles.htCellData} ${styles.htHdrCol}`}>
                        {hasPrev ? (
                          <div className={styles.htColNav}>
                            <button
                              className={styles.htNavBtn}
                              disabled={safeIdx >= sameLogs.length - 1}
                              onClick={() => setHistPrevLogIdx(safeIdx + 1)}
                            >
                              <i className="fa-solid fa-chevron-left" />
                            </button>
                            <span className={styles.htColLabel}>{prevDate}</span>
                            <button
                              className={styles.htNavBtn}
                              disabled={safeIdx <= 0}
                              onClick={() => setHistPrevLogIdx(safeIdx - 1)}
                            >
                              <i className="fa-solid fa-chevron-right" />
                            </button>
                            <span className={styles.htColCount}>{safeIdx + 1}/{sameLogs.length}</span>
                          </div>
                        ) : (
                          <span className={styles.htColLabel} style={{ color: 'var(--text3)' }}>Pas de precedent</span>
                        )}
                      </div>
                      <div className={`${styles.htCellData} ${styles.htHdrCol}`}>
                        <span className={styles.htColLabel}>{rightDate}</span>
                      </div>
                    </div>

                    {/* Exercise rows */}
                    {baseExs.map((pEx, i) => {
                      const name = String(pEx.nom || '')
                      const le = logExs.find((e) => e.nom && String(e.nom).toLowerCase() === name.toLowerCase())
                      const pe = prevExs.find((e) => e.nom && String(e.nom).toLowerCase() === name.toLowerCase())
                      const missed = !le
                      const leSeries = (le?.series || le?.sets || []) as Record<string, unknown>[]
                      const peSeries = (pe?.series || pe?.sets || []) as Record<string, unknown>[]
                      const plannedCount = pEx ? (parseInt(String(pEx.series)) || (pEx.sets as unknown[])?.length || 0) : 0
                      const doneCount = leSeries.length
                      const seriesMismatch = plannedCount > 0 && doneCount > 0 && doneCount < plannedCount

                      const rowCls = [styles.htRow]
                      if (!le && !pe) rowCls.push(styles.htRowDim)

                      return (
                        <div key={i} className={rowCls.join(' ')}>
                          <div className={`${styles.htCellName}${missed ? ` ${styles.htNameMissed}` : ''}`}>
                            <span className={styles.htNum}>{i + 1}</span>
                            {name}
                            {missed && <span className={styles.htMissedTag}>Non fait</span>}
                            {seriesMismatch && <span className={styles.htSeriesMismatch}>{doneCount}/{plannedCount} series</span>}
                          </div>
                          <div className={styles.htCellData}>
                            {peSeries.length > 0 ? renderSetTags(peSeries) : <span className={styles.htNil}>&mdash;</span>}
                          </div>
                          <div className={styles.htCellData}>
                            {leSeries.length > 0 ? renderSetTags(leSeries, peSeries) : <span className={styles.htNil}>&mdash;</span>}
                          </div>
                        </div>
                      )
                    })}

                    {/* Extra exercises (done but not programmed) */}
                    {programmedExs.length > 0 && logExs
                      .filter((le) => !programmedExs.some((pe) => String(pe.nom || '').toLowerCase() === String(le.nom || '').toLowerCase()))
                      .map((ex, i) => {
                        const pe = prevExs.find((e) => e.nom && String(e.nom).toLowerCase() === String(ex.nom || '').toLowerCase())
                        const leSeries = (ex.series || ex.sets || []) as Record<string, unknown>[]
                        const peSeries = (pe?.series || pe?.sets || []) as Record<string, unknown>[]
                        return (
                          <div key={`extra-${i}`} className={`${styles.htRow} ${styles.htRowExtra}`}>
                            <div className={styles.htCellName}>
                              <span className={styles.htExtraBadge}>+</span>
                              {String(ex.nom || '?')}
                              <span className={styles.htExtraTag}>Ajoute</span>
                            </div>
                            <div className={styles.htCellData}>
                              {peSeries.length > 0 ? renderSetTags(peSeries) : <span className={styles.htNil}>&mdash;</span>}
                            </div>
                            <div className={styles.htCellData}>
                              {renderSetTags(leSeries, peSeries)}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // -- List view --
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={60} borderRadius={12} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Skeleton height={180} borderRadius={16} />
          <Skeleton height={180} borderRadius={16} />
        </div>
        <Skeleton height={120} borderRadius={12} />
      </div>
    )
  }

  return (
    <div>
      <CardioSection
        athleteId={athleteId}
        cardio={athleteCardio.cardio_config}
        pasJournalier={athleteCardio.pas_journalier}
        onSaved={loadData}
      />

      {programs.length === 0 ? (
        <EmptyState
          icon="fa-solid fa-dumbbell"
          message="Aucun programme d'entrainement"
          action={
            <div className="flex gap-8">
              <button className="btn btn-outline" onClick={openTemplatePicker}>
                <i className="fa-solid fa-copy" /> Depuis un template
              </button>
              <button className="btn btn-red" onClick={() => openEditor()}>
                <i className="fa-solid fa-plus" /> Creer un programme
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className={styles.trHeader} style={{ marginBottom: 16 }}>
            <div>
              <div className={styles.trHeaderTitle}>Programmes</div>
              <div className={styles.trHeaderSub}>{programs.length} programme(s)</div>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-outline btn-sm" onClick={() => { setHistWeekOffset(0); setHistSelectedDate(null); setHistPrevLogIdx(0); setView('history') }}>
                <i className="fa-solid fa-clock-rotate-left" /> Historique
              </button>
              <button className="btn btn-outline btn-sm" onClick={openTemplatePicker}>
                <i className="fa-solid fa-copy" /> Depuis un template
              </button>
              <button className="btn btn-red btn-sm" onClick={() => openEditor()}>
                <i className="fa-solid fa-plus" /> Nouveau programme
              </button>
            </div>
          </div>

          {programs.map((p) => {
            const sessions = (p.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
            let pd: Record<string, unknown> = {}
            try {
              pd = typeof p.pattern_data === 'string' ? JSON.parse(p.pattern_data) : (p.pattern_data || {})
            } catch { /* empty */ }
            const patternDisplay = p.pattern_type === 'pattern'
              ? (pd.pattern as string || '')
              : ((pd.days as string[]) || []).join(' \u00B7 ')

            // Compute total muscles
            const totalMuscles: Record<string, number> = {}
            sessions.forEach((s) => {
              const exs = parseExercises(s.exercices)
              const m = getMuscleCount(exs)
              Object.entries(m).forEach(([k, v]) => { totalMuscles[k] = (totalMuscles[k] || 0) + v })
            })
            const muscleEntries = Object.entries(totalMuscles).sort((a, b) => b[1] - a[1])

            return (
              <div
                key={p.id}
                className={`card mb-16 ${styles.programCard}`}
                style={{ border: `2px solid ${p.actif ? 'var(--primary)' : 'var(--border)'}` }}
                onClick={() => openDetail(p.id)}
              >
                <div className="card-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="card-title">{p.nom}</div>
                      {p.actif && (
                        <span style={{
                          background: 'var(--success)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                        }}>
                          ACTIF
                        </span>
                      )}
                    </div>
                    {patternDisplay && (
                      <div className="text-small" style={{ color: 'var(--text3)', marginTop: 4 }}>
                        <i className="fa-solid fa-repeat" /> {patternDisplay}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {sessions.map((s) => (
                        <span
                          key={s.id}
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            background: 'var(--bg3)',
                            borderRadius: 6,
                            fontSize: 11,
                            color: 'var(--text2)',
                            fontWeight: 500,
                          }}
                        >
                          {s.nom || 'Seance'}
                        </span>
                      ))}
                    </div>
                    {muscleEntries.length > 0 && (
                      <div className={styles.trVolumePills} style={{ marginTop: 10 }}>
                        {muscleEntries.map(([m, c]) => (
                          <span key={m} className={styles.trVolumePill} style={{ borderColor: getMuscleColor(m) }}>
                            <strong style={{ color: getMuscleColor(m) }}>{c}</strong> {m.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-8 items-center" onClick={(e) => e.stopPropagation()}>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={p.actif}
                        onChange={(e) => toggleProgram(p.id, e.target.checked)}
                      />
                      <span className="switch" />
                    </label>
                    <button className="btn btn-outline btn-sm" onClick={() => openEditor(p.id)}>
                      <i className="fa-solid fa-pen" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <TemplatePicker
          templates={trainingTemplates}
          loading={loadingTemplates}
          onSelect={selectTrainingTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  )
}

function TemplatePicker({
  templates,
  loading,
  onSelect,
  onClose,
}: {
  templates: { id: string; nom: string; category?: string | null; pattern_type?: string; pattern_data?: Record<string, unknown>; sessions_data?: Array<{ nom?: string; jour?: string; exercices?: unknown[] | string; exercises?: unknown[] | string }> }[]
  loading: boolean
  onSelect: (tpl: typeof templates[0]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? templates.filter((t) => t.nom.toLowerCase().includes(search.toLowerCase()) || (t.category || '').toLowerCase().includes(search.toLowerCase()))
    : templates

  const groups: Record<string, typeof templates> = {}
  filtered.forEach((t) => {
    const cat = t.category || 'Sans catégorie'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(t)
  })
  const catNames = Object.keys(groups).sort((a, b) => {
    if (a === 'Sans catégorie') return 1
    if (b === 'Sans catégorie') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-elevated), 0 0 60px rgba(179,8,8,0.08)',
        borderRadius: 'var(--radius-lg)', width: '100%',
        maxWidth: 540, height: '60vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalSlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        {/* Fixed header + search */}
        <div style={{ flexShrink: 0, padding: '24px 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Choisir un template</h3>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                fontSize: 18, cursor: 'pointer', width: 32, height: 32,
                borderRadius: 'var(--radius-sm)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 12 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou catégorie..."
              autoFocus
              style={{
                width: '100%', padding: '10px 14px 10px 36px',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontSize: 13, outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>

        {/* Scrollable template list */}
        <div style={{ padding: '0 24px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton height={48} borderRadius={8} />
              <Skeleton height={48} borderRadius={8} />
              <Skeleton height={48} borderRadius={8} />
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>
              <i className="fa-solid fa-folder-open" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
              <p>Aucun template training</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Créez des templates dans la section Templates</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>
              <i className="fa-solid fa-search" style={{ fontSize: 20, marginBottom: 8, display: 'block' }} />
              <p style={{ fontSize: 13 }}>Aucun résultat pour &quot;{search}&quot;</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {catNames.map((cat) => (
                <div key={cat}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 8, padding: '0 2px',
                  }}>
                    <i className="fas fa-folder-open" style={{ color: 'var(--primary)', fontSize: 12 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{cat}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>{groups[cat].length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {groups[cat].map((tpl) => {
                      const sessionCount = tpl.sessions_data?.length || 0
                      const sessionNames = (tpl.sessions_data || []).map((s) => s.nom || 'Séance').slice(0, 4)
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => onSelect(tpl)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)',
                            background: 'var(--bg2)', cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'all 0.15s', gap: 12,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary-border)'
                            e.currentTarget.style.background = 'var(--bg-card-hover)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)'
                            e.currentTarget.style.background = 'var(--bg2)'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{tpl.nom}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="fas fa-calendar-day" style={{ fontSize: 9, color: 'var(--primary)', opacity: 0.7 }} />
                                {sessionCount} séance{sessionCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {sessionNames.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                                {sessionNames.map((name, i) => (
                                  <span key={i} style={{
                                    padding: '1px 7px', background: 'var(--primary-bg)',
                                    border: '1px solid var(--primary-border)', borderRadius: 4,
                                    fontSize: 10, color: 'var(--text2)', fontWeight: 500,
                                  }}>
                                    {name}
                                  </span>
                                ))}
                                {(tpl.sessions_data || []).length > 4 && (
                                  <span style={{ fontSize: 10, color: 'var(--text3)', padding: '1px 4px' }}>
                                    +{(tpl.sessions_data || []).length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0 }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
