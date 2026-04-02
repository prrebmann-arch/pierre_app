'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import styles from '@/styles/videos.module.css'

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

interface ExSet {
  reps: string
  tempo?: string
  repos?: string
  type: 'normal' | 'dropset' | 'rest_pause'
  reps_rp?: string
  rest_pause_time?: string
}

interface EditExercise {
  nom: string
  muscle_principal?: string
  superset_id?: string
  sets: ExSet[]
  series?: number | string
}

interface VideoCompareProps {
  video: VideoRow
  compVideos: CompVideo[]
  compIdx: number
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

function normalizeExSets(ex: any): ExSet[] {
  if (ex.sets && Array.isArray(ex.sets)) return ex.sets
  const count = parseInt(ex.series) || 3
  const reps = ex.reps || '10'
  const tempo = ex.tempo || '30X1'
  const sets: ExSet[] = []
  for (let i = 0; i < count; i++) sets.push({ reps, tempo, repos: '1m30', type: 'normal' })
  return sets
}

export default function VideoCompare({ video, compVideos, compIdx }: VideoCompareProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [currentLog, setCurrentLog] = useState<any>(null)
  const [prevLogIdx, setPrevLogIdx] = useState(-1)
  const [sessionName, setSessionName] = useState('')
  const [sessionExs, setSessionExs] = useState<any[]>([])
  const [matchedSession, setMatchedSession] = useState<any>(null)

  // Edit column state
  const [editSessionName, setEditSessionName] = useState('')
  const [editExercises, setEditExercises] = useState<EditExercise[]>([])
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
    const editExs: EditExercise[] = exs.map((e: any) => ({
      nom: e.nom || '',
      muscle_principal: e.muscle_principal || '',
      superset_id: e.superset_id || '',
      sets: normalizeExSets(e),
    }))
    setEditExercises(editExs)

    // Load workout logs
    let { data: logs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('session_id', matchSession.id)
      .order('date', { ascending: false })
      .limit(30)

    if (!logs?.length && (video.session_name || matchSession.nom)) {
      ;({ data: logs } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('athlete_id', video.athlete_id)
        .eq('session_name', video.session_name || matchSession.nom)
        .order('date', { ascending: false })
        .limit(30))
    }

    const all = logs || []
    setAllLogs(all)

    const curLog = all.find((l: any) => l.date === video.date) || null
    setCurrentLog(curLog)

    // Find first log with different date for comparison
    let defaultPrevIdx = -1
    for (let i = 0; i < all.length; i++) {
      if (all[i].date !== video.date) {
        defaultPrevIdx = i
        break
      }
    }
    setPrevLogIdx(defaultPrevIdx)
    } finally {
      setLoading(false)
    }
  }, [video]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTraining()
  }, [loadTraining])

  // ── Edit column helpers ──
  const updateExercise = (idx: number, field: string, value: string) => {
    setEditExercises((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  const updateSet = (exIdx: number, setIdx: number, field: keyof ExSet, value: string) => {
    setEditExercises((prev) => {
      const copy = [...prev]
      const sets = [...copy[exIdx].sets]
      sets[setIdx] = { ...sets[setIdx], [field]: value }
      copy[exIdx] = { ...copy[exIdx], sets }
      return copy
    })
  }

  const addSet = (exIdx: number) => {
    setEditExercises((prev) => {
      const copy = [...prev]
      const sets = [...copy[exIdx].sets, { reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' as const }]
      copy[exIdx] = { ...copy[exIdx], sets }
      return copy
    })
  }

  const removeSet = (exIdx: number, setIdx: number) => {
    setEditExercises((prev) => {
      const copy = [...prev]
      if (copy[exIdx].sets.length <= 1) return prev
      const sets = copy[exIdx].sets.filter((_, i) => i !== setIdx)
      copy[exIdx] = { ...copy[exIdx], sets }
      return copy
    })
  }

  const addExercise = () => {
    setEditExercises((prev) => [
      ...prev,
      { nom: '', sets: [{ reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' as const }] },
    ])
  }

  const removeExercise = (idx: number) => {
    setEditExercises((prev) => prev.filter((_, i) => i !== idx))
  }

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
    const { error } = await supabase
      .from('workout_sessions')
      .update({ nom: editSessionName.trim(), exercices: JSON.stringify(exercises) })
      .eq('id', matchedSession.id)
    if (error) {
      toast('Erreur lors de la sauvegarde', 'error')
      setSavingEdit(false)
      return
    }
    setSessionName(editSessionName.trim())
    setSessionExs(exercises)
    toast('Seance modifiee !', 'success')
    setSavingEdit(false)
  }

  const navigatePrev = (dir: number) => {
    setPrevLogIdx((prev) => {
      let idx = prev + dir
      while (idx >= 0 && idx < allLogs.length && allLogs[idx].date === video.date) idx += dir
      if (idx < 0 || idx >= allLogs.length) return prev
      return idx
    })
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
          <div className={styles.vtCompHeaders}>
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
            <div>
              <div className={styles.vtColTitle}>Seance courante</div>
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
              >
                <div>
                  <div className={styles.vtExHeader}>
                    <span className={styles.vtExName}>{name}</span>
                    <span className={styles.vtExCount}>
                      {prevSets} serie{prevSets > 1 ? 's' : ''}
                    </span>
                  </div>
                  {renderSets(prevEx, null, false, highlightPrevEx, compVideo?.serie_number)}
                </div>
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
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              <i className="fa-solid fa-dumbbell" style={{ marginRight: 4 }} />
              {editExercises.length} exercice{editExercises.length > 1 ? 's' : ''} &mdash; {totalEditSeries} series
            </div>

            {editExercises.map((ex, exIdx) => {
              const isVideoEx = ex.nom.toLowerCase() === videoExName
              return (
                <div
                  key={exIdx}
                  className={`${styles.vtExEditable} ${isVideoEx ? styles.vtEditHighlight : ''}`}
                  style={{ marginBottom: 12 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span className={styles.vtExNum}>{exIdx + 1}.</span>
                    <input
                      type="text"
                      className={`${styles.vtInput} ${styles.vtInputName}`}
                      value={ex.nom}
                      onChange={(e) => updateExercise(exIdx, 'nom', e.target.value)}
                      placeholder="Nom de l'exercice"
                    />
                    {ex.superset_id && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        SS {ex.superset_id}
                      </span>
                    )}
                    {ex.muscle_principal && (
                      <span style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {ex.muscle_principal}
                      </span>
                    )}
                    <button
                      className={styles.vtBtnIcon}
                      onClick={() => removeExercise(exIdx)}
                      title="Supprimer"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: 'var(--text3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const }}>
                        <th style={{ padding: '4px 6px', textAlign: 'left', width: 30 }}>#</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Reps</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Tempo</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Repos</th>
                        <th style={{ width: 24 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {ex.sets.map((set, si) => (
                        <tr key={si} style={{ borderTop: si > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                          <td style={{ padding: '4px 6px', color: 'var(--text3)' }}>{si + 1}</td>
                          <td style={{ padding: '4px 6px' }}>
                            <input
                              type="text"
                              className={styles.vtInput}
                              value={set.reps}
                              onChange={(e) => updateSet(exIdx, si, 'reps', e.target.value)}
                              placeholder="10"
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input
                              type="text"
                              className={styles.vtInput}
                              value={set.tempo || ''}
                              onChange={(e) => updateSet(exIdx, si, 'tempo', e.target.value)}
                              placeholder="30X1"
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <input
                              type="text"
                              className={styles.vtInput}
                              value={set.repos || ''}
                              onChange={(e) => updateSet(exIdx, si, 'repos', e.target.value)}
                              placeholder="1m30"
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <button
                              className={styles.vtBtnIcon}
                              onClick={() => removeSet(exIdx, si)}
                              title="Supprimer"
                              style={{ fontSize: 10 }}
                            >
                              <i className="fa-solid fa-times" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <button
                    className={styles.vtBtnSm}
                    onClick={() => addSet(exIdx)}
                    style={{ marginTop: 6, width: '100%' }}
                  >
                    <i className="fa-solid fa-plus" /> Serie
                  </button>
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
