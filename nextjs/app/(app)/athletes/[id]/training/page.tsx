'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { notifyAthlete } from '@/lib/push'
import ProgramEditor from '@/components/training/ProgramEditor'
import CardioSection from '@/components/training/CardioSection'
import EmptyState from '@/components/ui/EmptyState'
import type { SetData } from '@/components/training/SetRow'
import styles from '@/styles/training.module.css'

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
  exercises: string | unknown[] | null
}

function parseLogExercises(log: WorkoutLog): Record<string, unknown>[] {
  const raw = log.exercises
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : []
  } catch { return [] }
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

  const [loading, setLoading] = useState(true)
  const [programs, setPrograms] = useState<WorkoutProgram[]>([])
  const [athleteCardio, setAthleteCardio] = useState<AthleteCardio>({ cardio_config: null, pas_journalier: null })
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

  // History state
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, WorkoutSession & { _exs: Record<string, unknown>[]; _progName: string }>>({})
  const [histWeekOffset, setHistWeekOffset] = useState(0)
  const [histSelectedDate, setHistSelectedDate] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [athleteRes, programsRes, logsRes] = await Promise.all([
      supabase.from('athletes').select('cardio_config, pas_journalier').eq('id', athleteId).single(),
      supabase.from('workout_programs').select('*, workout_sessions(*)').eq('athlete_id', athleteId).order('created_at', { ascending: false }),
      supabase.from('workout_logs').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(500),
    ])
    setAthleteCardio({
      cardio_config: athleteRes.data?.cardio_config || null,
      pas_journalier: athleteRes.data?.pas_journalier || null,
    })
    const progs = (programsRes.data as WorkoutProgram[]) || []
    setPrograms(progs)
    setWorkoutLogs((logsRes.data as WorkoutLog[]) || [])

    // Build session lookup
    const sMap: Record<string, WorkoutSession & { _exs: Record<string, unknown>[]; _progName: string }> = {}
    progs.forEach((p) => {
      (p.workout_sessions || []).forEach((s) => {
        const exs = parseExercises(s.exercices)
        ;(sMap as Record<string, unknown>)[s.id] = { ...s, _exs: exs, _progName: p.nom }
      })
    })
    setSessionMap(sMap)

    setLoading(false)
  }, [athleteId, supabase])

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // -- Actions --
  async function toggleProgram(id: string, activate: boolean) {
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
      console.error(err)
      toast('Erreur', 'error')
    }
  }

  async function deleteProgram(id: string) {
    if (!confirm('Supprimer ce programme et toutes ses seances ?')) return
    await supabase.from('workout_sessions').delete().eq('program_id', id)
    const { error } = await supabase.from('workout_programs').delete().eq('id', id)
    if (error) {
      toast('Erreur lors de la suppression', 'error')
      return
    }
    toast('Programme supprime !')
    loadData()
  }

  function openEditor(programId?: string) {
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
  }

  function openDetail(programId: string) {
    setViewProgramId(programId)
    setViewSessionIdx(0)
    setView('detail')
  }

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

    return (
      <div>
        <div className={styles.trHeader}>
          <div>
            <div className={styles.trHeaderTitle}>Historique d&apos;entrainement</div>
            <div className={styles.trHeaderSub}>{weekLabel}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>
            <i className="fa-solid fa-arrow-left" /> Retour
          </button>
        </div>

        {/* Week nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setHistWeekOffset(histWeekOffset + 1); setHistSelectedDate(null) }}>
            <i className="fa-solid fa-chevron-left" />
          </button>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {days.map((d) => {
              const hasLog = workoutLogs.some((l) => l.date === d.date)
              const isSelected = d.date === selectedDate
              const isToday = d.date === today
              return (
                <button
                  key={d.date}
                  onClick={() => setHistSelectedDate(d.date)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isSelected ? 'var(--primary)' : 'var(--bg3)',
                    color: isSelected ? '#fff' : 'var(--text2)',
                    fontWeight: isSelected ? 700 : 400,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    outline: isToday && !isSelected ? '2px solid var(--primary)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{d.dayLabel}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{d.dayNum}</span>
                  {hasLog && <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : 'var(--primary)' }} />}
                </button>
              )
            })}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setHistWeekOffset(Math.max(0, histWeekOffset - 1)); setHistSelectedDate(null) }}>
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>

        {/* Day logs */}
        {dayLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            <i className="fa-solid fa-dumbbell" style={{ fontSize: 28, marginBottom: 12, display: 'block' }} />
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
            const prevLog = sameLogs.length > 0 ? sameLogs[0] : null
            const prevExs = prevLog ? parseLogExercises(prevLog) : []

            return (
              <div key={log.id || logIdx} className="card mb-16" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <i className="fa-solid fa-dumbbell" style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{sessionName}</span>
                  {isLibre && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg4)', color: 'var(--text3)' }}>Libre</span>
                  )}
                  {duration !== null && (
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>
                      <i className="fa-solid fa-clock" style={{ marginRight: 3 }} />
                      {duration >= 60 ? Math.floor(duration / 60) + 'h' + String(duration % 60).padStart(2, '0') : duration + ' min'}
                    </span>
                  )}
                </div>

                {/* Exercise table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 600 }}>Exercice</th>
                        {prevLog && <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 600 }}>Precedent</th>}
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 600 }}>Realise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseExs.map((pEx, i) => {
                        const name = String(pEx.nom || '')
                        const le = logExs.find((e) => e.nom && String(e.nom).toLowerCase() === name.toLowerCase())
                        const pe = prevExs.find((e) => e.nom && String(e.nom).toLowerCase() === name.toLowerCase())
                        const missed = !le
                        const leSeries = (le?.series || le?.sets || []) as Record<string, unknown>[]
                        const peSeries = (pe?.series || pe?.sets || []) as Record<string, unknown>[]

                        const renderSets = (series: Record<string, unknown>[]) =>
                          series.map((s, si) => {
                            const reps = s.reps ?? '-'
                            const kg = s.kg ?? s.load ?? s.charge ?? null
                            return (
                              <span key={si} style={{
                                display: 'inline-block', padding: '2px 6px', borderRadius: 4,
                                background: 'var(--bg3)', marginRight: 4, marginBottom: 2, fontSize: 11,
                              }}>
                                {String(reps)} reps{kg != null && kg !== '-' ? ` · ${kg} kg` : ''}
                              </span>
                            )
                          })

                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: missed ? 0.5 : 1 }}>
                            <td style={{ padding: '8px', fontWeight: 500 }}>
                              <span style={{ color: 'var(--text3)', marginRight: 4 }}>{i + 1}</span>
                              {name}
                              {missed && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', marginLeft: 6 }}>Non fait</span>}
                            </td>
                            {prevLog && (
                              <td style={{ padding: '8px' }}>
                                {peSeries.length > 0 ? renderSets(peSeries) : <span style={{ color: 'var(--text3)' }}>&mdash;</span>}
                              </td>
                            )}
                            <td style={{ padding: '8px' }}>
                              {leSeries.length > 0 ? renderSets(leSeries) : <span style={{ color: 'var(--text3)' }}>&mdash;</span>}
                            </td>
                          </tr>
                        )
                      })}
                      {/* Extras */}
                      {programmedExs.length > 0 && logExs.filter((le) => !programmedExs.some((pe) => String(pe.nom || '').toLowerCase() === String(le.nom || '').toLowerCase())).map((ex, i) => {
                        const series = (ex.series || ex.sets || []) as Record<string, unknown>[]
                        return (
                          <tr key={`extra-${i}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px', fontWeight: 500 }}>
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', marginRight: 6 }}>+</span>
                              {String(ex.nom || '?')}
                            </td>
                            {prevLog && <td style={{ padding: '8px' }}><span style={{ color: 'var(--text3)' }}>&mdash;</span></td>}
                            <td style={{ padding: '8px' }}>
                              {series.map((s, si) => (
                                <span key={si} style={{
                                  display: 'inline-block', padding: '2px 6px', borderRadius: 4,
                                  background: 'var(--bg3)', marginRight: 4, fontSize: 11,
                                }}>
                                  {String(s.reps ?? '-')} reps{s.kg != null && s.kg !== '-' ? ` · ${s.kg} kg` : ''}
                                </span>
                              ))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  // -- List view --
  if (loading) {
    return (
      <div className="text-center" style={{ padding: 40 }}>
        <i className="fa-solid fa-spinner fa-spin fa-2x" />
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
            <button className="btn btn-red" onClick={() => openEditor()}>
              <i className="fa-solid fa-plus" /> Creer un programme
            </button>
          }
        />
      ) : (
        <>
          <div className="flex justify-end gap-8 mb-16">
            <button className="btn btn-outline" onClick={() => { setHistWeekOffset(0); setHistSelectedDate(null); setView('history') }}>
              <i className="fa-solid fa-clock-rotate-left" /> Historique
            </button>
            <button className="btn btn-red" onClick={() => openEditor()}>
              <i className="fa-solid fa-plus" /> Nouveau programme
            </button>
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
    </div>
  )
}
