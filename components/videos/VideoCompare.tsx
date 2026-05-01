'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import ExerciseRow, { type ExerciseData } from '@/components/training/ExerciseRow'
import type { SetData } from '@/components/training/SetRow'
import styles from '@/styles/videos.module.css'
import trStyles from '@/styles/training.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface VideoRow {
  id: string
  athlete_id: string
  exercise_name: string
  serie_number: number
  date: string
  session_name?: string | null
  session_id?: string | null
}

interface CompVideo {
  id: string
  video_url: string
  thumbnail_url: string | null
  date: string
  serie_number: number
}

interface VideoCompareProps {
  video: VideoRow
  compVideos: CompVideo[]
  compIdx: number
  showCompare?: boolean
  onNavigateLog?: (logIdx: number) => void
}

function parseLogExs(log: any): any[] {
  if (!log) return []
  try {
    const raw = typeof log.exercices_completes === 'string'
      ? JSON.parse(log.exercices_completes)
      : log.exercices_completes
    return raw || []
  } catch {
    return []
  }
}

function fmtDateShort(d: string | null): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function durationMinutes(log: any): number | null {
  if (!log?.started_at || !log?.finished_at) return null
  return Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 60000)
}

function fmtDuration(d: number): string {
  return d >= 60
    ? Math.floor(d / 60) + 'h' + String(d % 60).padStart(2, '0')
    : d + ' min'
}

function normalizeExSets(ex: any): SetData[] {
  if (ex.sets && Array.isArray(ex.sets)) return ex.sets as SetData[]
  const count = parseInt(ex.series) || 3
  const reps = ex.reps || '10'
  const tempo = ex.tempo || '30X1'
  const sets: SetData[] = []
  for (let i = 0; i < count; i++) sets.push({ reps, tempo, repos: '1m30', type: 'normal' })
  return sets
}

const DEFAULT_SET: SetData = { reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' }

const MUSCLE_COLOR_PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
]
const muscleColorCache: Record<string, string> = {}
function getMuscleColor(m: string): string {
  if (!m) return '#888'
  const key = m.toLowerCase()
  if (muscleColorCache[key]) return muscleColorCache[key]
  const idx = Object.keys(muscleColorCache).length % MUSCLE_COLOR_PALETTE.length
  muscleColorCache[key] = MUSCLE_COLOR_PALETTE[idx]
  return muscleColorCache[key]
}

export default function VideoCompare({ video, compVideos, compIdx, showCompare = false, onNavigateLog }: VideoCompareProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [currentLog, setCurrentLog] = useState<any>(null)
  const [currentLogIdx, setCurrentLogIdx] = useState(-1) // For navigating logs in simple view
  const [prevLogIdx, setPrevLogIdx] = useState(-1)
  const [sessionName, setSessionName] = useState('')
  const [sessionExs, setSessionExs] = useState<any[]>([])
  const [matchedSession, setMatchedSession] = useState<any>(null)

  // Edit column state
  const [editSessionName, setEditSessionName] = useState('')
  const [editExercises, setEditExercises] = useState<ExerciseData[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  const loadTraining = useCallback(async () => {
    setLoading(true)
    try {
    // Find matching session
    const { data: allProgs } = await supabase
      .from('workout_programs')
      .select('id, nom, actif, workout_sessions(*)')
      .eq('athlete_id', video.athlete_id)
      .order('actif', { ascending: false })
      .limit(20)

    const allSessions: any[] = []
    ;(allProgs || []).forEach((p: any) => {
      ;(p.workout_sessions || []).forEach((s: any) => {
        allSessions.push({ ...s, _prog: { id: p.id, nom: p.nom, actif: p.actif } })
      })
    })

    let matchSession: any = null

    // Try exact session_id
    if (video.session_id) {
      matchSession = allSessions.find((s) => s.id === video.session_id)
    }
    // Try session_name
    if (!matchSession && video.session_name) {
      matchSession =
        allSessions.find((s) => s.nom === video.session_name && s._prog.actif) ||
        allSessions.find((s) => s.nom === video.session_name)
    }
    // Try exercise name match
    if (!matchSession && video.exercise_name) {
      const exNameLower = video.exercise_name.toLowerCase()
      for (const s of allSessions) {
        let exs: any[] = []
        try {
          exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : s.exercices || []
        } catch { /* skip */ }
        if (exs.some((e: any) => (e.nom || '').toLowerCase() === exNameLower)) {
          if (!matchSession || (s._prog.actif && !matchSession._prog.actif)) {
            matchSession = s
          }
        }
      }
    }
    // Fallback: first session of active program
    if (!matchSession) {
      matchSession = allSessions.find((s) => s._prog.actif)
    }

    if (!matchSession) {
      return
    }

    setMatchedSession(matchSession)
    setSessionName(matchSession.nom || '')
    let exs: any[] = []
    try {
      exs = typeof matchSession.exercices === 'string'
        ? JSON.parse(matchSession.exercices)
        : matchSession.exercices || []
    } catch { /* skip */ }
    setSessionExs(exs)

    // Initialize edit state
    setEditSessionName(matchSession.nom || '')
    const editExs: ExerciseData[] = exs.map((e: any) => ({
      nom: e.nom || '',
      exercice_id: e.exercice_id || null,
      muscle_principal: e.muscle_principal || '',
      sets: normalizeExSets(e),
      superset_id: e.superset_id || null,
    }))
    setEditExercises(editExs)

    // Load workout logs
    let { data: logs } = await supabase
      .from('workout_logs')
      .select('id, athlete_id, session_id, session_name, date, started_at, finished_at, exercices_completes')
      .eq('session_id', matchSession.id)
      .order('date', { ascending: false })
      .limit(30)

    if (!logs?.length && (video.session_name || matchSession.nom)) {
      ;({ data: logs } = await supabase
        .from('workout_logs')
        .select('id, athlete_id, session_id, session_name, date, started_at, finished_at, exercices_completes')
        .eq('athlete_id', video.athlete_id)
        .eq('session_name', video.session_name || matchSession.nom)
        .order('date', { ascending: false })
        .limit(30))
    }

    const all = logs || []
    setAllLogs(all)

    const curLog = all.find((l: any) => l.date === video.date) || null
    setCurrentLog(curLog)

    // Find the index of the current log in allLogs for simple-view navigation
    const curIdx = curLog ? all.findIndex((l: any) => l.id === curLog.id) : -1
    setCurrentLogIdx(curIdx)

    // Find first log with date strictly BEFORE the current video date
    let defaultPrevIdx = -1
    for (let i = 0; i < all.length; i++) {
      if (all[i].date < video.date) {
        defaultPrevIdx = i
        break
      }
    }
    setPrevLogIdx(defaultPrevIdx)
    } finally {
      setLoading(false)
    }
    // Use primitive deps to avoid re-running on every parent render that
    // re-creates the `video` object (e.g. notes textarea keystrokes).
  }, [video.id, video.athlete_id, video.session_id, video.session_name, video.exercise_name, video.date]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTraining()
  }, [loadTraining])

  // Bug 2 fix: When compIdx changes in compare mode, sync prevLogIdx to the comparison video's date
  useEffect(() => {
    if (!showCompare || compIdx < 0 || !compVideos[compIdx] || !allLogs.length) return
    const compDate = compVideos[compIdx].date
    // Find the log matching the comparison video's date
    let matchIdx = allLogs.findIndex((l: any) => l.date === compDate)
    if (matchIdx === -1) {
      // No exact match — find the first log with date <= compDate
      for (let i = 0; i < allLogs.length; i++) {
        if (allLogs[i].date <= compDate) {
          matchIdx = i
          break
        }
      }
    }
    setPrevLogIdx(matchIdx)
  }, [compIdx, showCompare, compVideos, allLogs])

  // ── Edit column helpers (parity with ProgramEditor) ──
  const onSetChange = useCallback((exIdx: number, setIdx: number, field: string, value: string) => {
    setEditExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      const sets = ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s)
      return { ...ex, sets }
    }))
  }, [])

  const onAddSet = useCallback((exIdx: number) => {
    setEditExercises((prev) => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, { ...DEFAULT_SET }] } : ex
    ))
  }, [])

  const onRemoveSet = useCallback((exIdx: number, setIdx: number) => {
    setEditExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      if (ex.sets.length <= 1) {
        toast('Il faut au moins une serie', 'error')
        return ex
      }
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
    }))
  }, [toast])

  const onAddDropSet = useCallback((exIdx: number) => {
    setEditExercises((prev) => prev.map((ex, i) =>
      i === exIdx
        ? { ...ex, sets: [...ex.sets, { reps: '10', tempo: '30X1', repos: '', type: 'dropset' as const }] }
        : ex
    ))
  }, [])

  const onAddRestPause = useCallback((exIdx: number) => {
    setEditExercises((prev) => prev.map((ex, i) =>
      i === exIdx
        ? { ...ex, sets: [...ex.sets, { reps: '12', reps_rp: '20', rest_pause_time: '15', type: 'rest_pause' as const }] }
        : ex
    ))
  }, [])

  const onToggleSuperset = useCallback((exIdx: number) => {
    setEditExercises((prev) => {
      const exercises = [...prev]
      const ex = exercises[exIdx]
      if (ex.superset_id) {
        const groupLetter = ex.superset_id.charAt(0)
        return exercises.map((e) =>
          e.superset_id?.charAt(0) === groupLetter ? { ...e, superset_id: null } : e
        )
      }
      const nextEx = exercises[exIdx + 1]
      if (!nextEx) {
        toast('Ajoutez un exercice apres celui-ci pour creer un super set', 'error')
        return prev
      }
      const usedLetters = new Set(exercises.map((e) => e.superset_id?.charAt(0)).filter(Boolean))
      let letter = 'A'
      while (usedLetters.has(letter)) letter = String.fromCharCode(letter.charCodeAt(0) + 1)
      exercises[exIdx] = { ...ex, superset_id: letter + '1' }
      exercises[exIdx + 1] = { ...nextEx, superset_id: letter + '2' }
      return exercises
    })
  }, [toast])

  const onToggleMaxRep = useCallback((exIdx: number, setIdx: number, isMax: boolean) => {
    setEditExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      const sets = ex.sets.map((s, si) => si === setIdx ? { ...s, reps: isMax ? 'MAX' : '10' } : s)
      return { ...ex, sets }
    }))
  }, [])

  const onMoveExercise = useCallback((idx: number, dir: number) => {
    setEditExercises((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
  }, [])

  const onRemoveExercise = useCallback((idx: number) => {
    setEditExercises((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const onReplaceExercise = useCallback((exIdx: number, id: string, nom: string, muscle: string) => {
    setEditExercises((prev) => prev.map((ex, i) =>
      i === exIdx ? { ...ex, nom, exercice_id: id, muscle_principal: muscle } : ex
    ))
  }, [])

  const addExercise = useCallback(() => {
    setEditExercises((prev) => [
      ...prev,
      {
        nom: '',
        exercice_id: null,
        muscle_principal: '',
        sets: [{ ...DEFAULT_SET }, { ...DEFAULT_SET }, { ...DEFAULT_SET }],
      },
    ])
  }, [])

  const handleSaveSession = async () => {
    if (!matchedSession?.id) return
    if (!editSessionName.trim()) {
      toast('Nom de seance requis', 'warning')
      return
    }
    const exercises = editExercises.filter((e) => e.nom.trim())
    if (!exercises.length) {
      toast('Ajoutez au moins un exercice', 'warning')
      return
    }
    setSavingEdit(true)
    try {
      const payload = exercises.map((e) => {
        const base: Record<string, unknown> = {
          nom: e.nom,
          exercice_id: e.exercice_id || null,
          muscle_principal: e.muscle_principal || '',
          sets: e.sets,
        }
        if (e.superset_id) base.superset_id = e.superset_id
        return base
      })
      const { error } = await supabase
        .from('workout_sessions')
        .update({ nom: editSessionName.trim(), exercices: JSON.stringify(payload) })
        .eq('id', matchedSession.id)
      if (error) {
        console.error('[VideoCompare.saveSession]', error)
        toast(`Erreur: ${error.message}`, 'error')
        return
      }
      setSessionName(editSessionName.trim())
      setSessionExs(payload)
      toast('Seance modifiee !', 'success')
    } finally {
      setSavingEdit(false)
    }
  }

  const navigatePrev = (dir: number) => {
    setPrevLogIdx((prev) => {
      let idx = prev + dir
      while (idx >= 0 && idx < allLogs.length && allLogs[idx].date === video.date) idx += dir
      if (idx < 0 || idx >= allLogs.length) return prev
      return idx
    })
  }

  // Navigate current log in simple (non-compare) view
  const navigateCurrentLog = (dir: number) => {
    const idx = currentLogIdx + dir
    if (idx < 0 || idx >= allLogs.length) return
    setCurrentLogIdx(idx)
    setCurrentLog(allLogs[idx])
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 30 }}>
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  if (!allLogs.length && !sessionExs.length) return null

  const prevLog = prevLogIdx >= 0 ? allLogs[prevLogIdx] : null
  const safePrevLog = prevLog && prevLog.date === video.date ? null : prevLog
  const prevExs = parseLogExs(safePrevLog)
  const currentExs = parseLogExs(currentLog)

  // Build master exercise list
  const masterExs: { nom: string }[] = sessionExs.map((e: any) => ({ nom: e.nom || '' }))
  const addExtras = (list: any[]) => {
    list.forEach((e: any) => {
      const name = (e.nom || '').toLowerCase()
      if (!masterExs.some((m) => m.nom.toLowerCase() === name)) {
        masterExs.push({ nom: e.nom })
      }
    })
  }
  addExtras(prevExs)
  addExtras(currentExs)

  const videoExName = (video.exercise_name || '').toLowerCase()
  const compVideo = compIdx >= 0 ? compVideos[compIdx] : null
  const prevHighlightExName = compVideo ? videoExName : ''
  const totalEditSeries = editExercises.reduce((a, e) => a + (e.sets?.length || 0), 0)
  const volumePills = (() => {
    const map: Record<string, number> = {}
    editExercises.forEach((ex) => {
      const m = ex.muscle_principal
      if (m && ex.sets.length > 0) map[m] = (map[m] || 0) + ex.sets.length
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  })()

  // Position-aware matching
  const matchByPos = (name: string, list: any[], usedSet: Set<number>) => {
    for (let i = 0; i < list.length; i++) {
      if (usedSet.has(i)) continue
      if ((list[i].nom || '').toLowerCase() === name.toLowerCase()) {
        usedSet.add(i)
        return list[i]
      }
    }
    return null
  }

  const usedPrev = new Set<number>()
  const usedCur = new Set<number>()
  let videoHighlightDone = false
  let prevHighlightDone = false

  const renderSets = (
    ex: any,
    cmpEx: any,
    isCurrentCol: boolean,
    highlightThisEx: boolean,
    hlSerie?: number,
  ) => {
    if (!ex)
      return (
        <div style={{ padding: '12px 0', color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
          &mdash;
        </div>
      )
    const series = ex.series || []
    const highlightSerie = hlSerie ?? video.serie_number

    return (
      <div className={styles.vtSets}>
        <div className={styles.vtSetHead}>
          <span>SERIE</span>
          <span>KG</span>
          <span>REPS</span>
        </div>
        {series.map((s: any, si: number) => {
          const kg = s.kg ?? s.load ?? '-'
          const reps = s.reps ?? '-'
          const cmpSeries = cmpEx?.series || []
          const cs = cmpSeries[si]
          let icon = null
          if (cs && isCurrentCol) {
            const curVol = (parseFloat(reps) || 0) * (parseFloat(kg) || 1)
            const prevVol = (parseFloat(cs.reps) || 0) * (parseFloat(cs.kg ?? cs.load) || 1)
            if (curVol > prevVol) icon = <i className={`fa-solid fa-arrow-up ${styles.vtUp}`} />
            else if (curVol < prevVol) icon = <i className={`fa-solid fa-arrow-down ${styles.vtDown}`} />
            else icon = <i className={`fa-solid fa-equals ${styles.vtEq}`} />
          }
          const isHighlight = highlightThisEx && si + 1 === highlightSerie
          return (
            <div
              key={si}
              className={`${styles.vtSetRow} ${isHighlight ? styles.vtSetActive : ''}`}
            >
              <span>
                <i
                  className="fa-solid fa-layer-group"
                  style={{ fontSize: 9, opacity: 0.4, marginRight: 4 }}
                />
                {si + 1}
              </span>
              <span>{kg}</span>
              <span>
                {reps} {icon}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const prevDur = durationMinutes(safePrevLog)
  const curDur = durationMinutes(currentLog)
  const canPrevOlder = prevLogIdx < allLogs.length - 1
  const canPrevNewer = prevLogIdx > 0

  return (
    <div className={styles.vtSection}>
      <div className={styles.vtGrid}>
        <div className={styles.vtComparison}>
          <div className={styles.vtCompHeaders} style={!showCompare ? { gridTemplateColumns: '1fr' } : undefined}>
            {showCompare && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={styles.vtColTitle}>Seance precedente</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => navigatePrev(-1)}
                    disabled={!canPrevNewer}
                    title="Plus recent"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => navigatePrev(1)}
                    disabled={!canPrevOlder}
                    title="Plus ancien"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </div>
              </div>
              {safePrevLog ? (
                <>
                  <div className={styles.vtColSession}>{sessionName}</div>
                  <div className={styles.vtColMeta}>
                    <i className="fa-solid fa-calendar" /> {fmtDateShort(safePrevLog.date)}
                    {prevDur != null && (
                      <>
                        &nbsp;&nbsp;<i className="fa-solid fa-clock" /> {fmtDuration(prevDur)}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: 13 }}>Aucune donnee</div>
              )}
            </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={styles.vtColTitle}>
                  {showCompare ? 'Seance courante' : 'Historique des seances'}
                </div>
                {!showCompare && allLogs.length > 1 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => navigateCurrentLog(-1)}
                      disabled={currentLogIdx <= 0}
                      title="Plus recent"
                    >
                      <i className="fa-solid fa-chevron-left" />
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => navigateCurrentLog(1)}
                      disabled={currentLogIdx >= allLogs.length - 1}
                      title="Plus ancien"
                    >
                      <i className="fa-solid fa-chevron-right" />
                    </button>
                  </div>
                )}
              </div>
              {currentLog ? (
                <>
                  <div className={styles.vtColSession}>{sessionName}</div>
                  <div className={styles.vtColMeta}>
                    <i className="fa-solid fa-calendar" /> {fmtDateShort(currentLog.date)}
                    {curDur != null && (
                      <>
                        &nbsp;&nbsp;<i className="fa-solid fa-clock" /> {fmtDuration(curDur)}
                      </>
                    )}
                    {!showCompare && allLogs.length > 1 && currentLogIdx >= 0 && (
                      <span style={{ marginLeft: 8, opacity: 0.6 }}>
                        ({currentLogIdx + 1} / {allLogs.length})
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: 13 }}>Aucune donnee</div>
              )}
            </div>
          </div>

          {masterExs.map((m, mIdx) => {
            const name = m.nom
            const prevEx = matchByPos(name, prevExs, usedPrev)
            const curEx = matchByPos(name, currentExs, usedCur)
            const prevSets = prevEx?.series?.length || 0
            const curSets = curEx?.series?.length || 0
            const missed = !curEx

            let highlightCurEx = false
            if (!videoHighlightDone && name.toLowerCase() === videoExName) {
              highlightCurEx = true
              videoHighlightDone = true
            }
            let highlightPrevEx = false
            if (!prevHighlightDone && prevEx && prevHighlightExName && name.toLowerCase() === prevHighlightExName) {
              highlightPrevEx = true
              prevHighlightDone = true
            }
            const rowHighlight = highlightCurEx || highlightPrevEx

            return (
              <div
                key={mIdx}
                className={`${styles.vtCompRow} ${rowHighlight ? styles.vtCompRowActive : ''}`}
                style={!showCompare ? { gridTemplateColumns: '1fr' } : undefined}
              >
                {showCompare && (
                <div>
                  <div className={styles.vtExHeader}>
                    <span className={styles.vtExName}>{name}</span>
                    <span className={styles.vtExCount}>
                      {prevSets} serie{prevSets > 1 ? 's' : ''}
                    </span>
                  </div>
                  {renderSets(prevEx, null, false, highlightPrevEx, compVideo?.serie_number)}
                </div>
                )}
                <div>
                  <div className={styles.vtExHeader}>
                    <span className={`${styles.vtExName} ${missed ? styles.vtExMissed : ''}`}>
                      {name}
                    </span>
                    <span className={styles.vtExCount}>
                      {curSets} serie{curSets > 1 ? 's' : ''}
                    </span>
                    {highlightCurEx && (
                      <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>
                        <i className="fa-solid fa-video" style={{ marginRight: 3 }} />
                        Serie {video.serie_number}
                      </span>
                    )}
                  </div>
                  {renderSets(curEx, prevEx, true, highlightCurEx)}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Edit column (3rd column) ── */}
        {matchedSession && (
          <div className={`${styles.vtCol} ${styles.vtColEdit}`}>
            <div className={styles.vtColHeader}>
              <div className={styles.vtColTitle}>Modifier la seance</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                className="inline-input"
                value={editSessionName}
                onChange={(e) => setEditSessionName(e.target.value)}
                placeholder="Nom de la seance"
                style={{ flex: 1 }}
              />
            </div>

            {volumePills.length > 0 && (
              <div className={trStyles.trVolumePills}>
                {volumePills.map(([m, c]) => (
                  <span key={m} className={trStyles.trVolumePill} style={{ borderColor: getMuscleColor(m) }}>
                    <strong style={{ color: getMuscleColor(m) }}>{c}</strong> {m.toLowerCase()}
                  </span>
                ))}
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              <i className="fa-solid fa-dumbbell" style={{ marginRight: 4 }} />
              {editExercises.length} exercice{editExercises.length > 1 ? 's' : ''} &mdash; {totalEditSeries} series
            </div>

            {editExercises.map((ex, exIdx) => {
              const isVideoEx = ex.nom.toLowerCase() === videoExName
              return (
                <div
                  key={exIdx}
                  className={isVideoEx ? styles.vtEditHighlight : undefined}
                  style={{ borderRadius: 8, marginBottom: 4 }}
                >
                  <ExerciseRow
                    index={exIdx}
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
                </div>
              )
            })}

            <button
              className="btn btn-outline btn-sm"
              onClick={addExercise}
              style={{ marginTop: 10, width: '100%' }}
            >
              <i className="fa-solid fa-plus" /> Exercice
            </button>
            <button
              className="btn btn-red"
              onClick={handleSaveSession}
              disabled={savingEdit}
              style={{ width: '100%', marginTop: 12 }}
            >
              <i className="fa-solid fa-save" /> {savingEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
