'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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

export default function VideoCompare({ video, compVideos, compIdx }: VideoCompareProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [currentLog, setCurrentLog] = useState<any>(null)
  const [prevLogIdx, setPrevLogIdx] = useState(-1)
  const [sessionName, setSessionName] = useState('')
  const [sessionExs, setSessionExs] = useState<any[]>([])

  const loadTraining = useCallback(async () => {
    setLoading(true)

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
      setLoading(false)
      return
    }

    setSessionName(matchSession.nom || '')
    let exs: any[] = []
    try {
      exs = typeof matchSession.exercices === 'string'
        ? JSON.parse(matchSession.exercices)
        : matchSession.exercices || []
    } catch { /* skip */ }
    setSessionExs(exs)

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
    setLoading(false)
  }, [video, supabase])

  useEffect(() => {
    loadTraining()
  }, [loadTraining])

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
      </div>
    </div>
  )
}
