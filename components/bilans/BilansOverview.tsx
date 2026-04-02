'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useToast } from '@/contexts/ToastContext'
import { toDateStr, isBilanDate, getLastExpectedBilanDate, getNextBilanDate } from '@/lib/utils'
import { notifyAthlete } from '@/lib/push'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import styles from '@/styles/bilans.module.css'
import type { Athlete } from '@/lib/types'

// ── Types ──

interface DailyReport {
  id: string
  user_id: string
  date: string
  weight?: number | null
  photo_front?: string | null
  photo_side?: string | null
  photo_back?: string | null
  [key: string]: unknown
}

interface AthleteData {
  athlete: Athlete
  status: 'done' | 'late' | 'upcoming'
  bilanReport: DailyReport | null
  lastBilanReport: DailyReport | null
  expectedStr: string
}

type FilterKey = 'all' | 'done' | 'late' | 'upcoming'

const BILAN_TRAITE_MESSAGES = [
  "Bon bilan, pas de changement, donne-toi a fond !",
  "Tres beau resultat, continue comme ca !",
  "Bilan correct, on garde le cap !",
  "Super progression, rien a modifier !",
  "RAS, on continue sur cette lancee !",
]

const FILTER_BTNS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'Tous', icon: '' },
  { key: 'done', label: 'A traiter', icon: 'fa-clipboard-check' },
  { key: 'late', label: 'En retard', icon: 'fa-exclamation-circle' },
  { key: 'upcoming', label: 'A venir', icon: 'fa-clock' },
]

// ── Bilan Traite Popup ──

function BilanTraitePopup({
  userId,
  prenom,
  athleteId,
  onClose,
  onSent,
}: {
  userId: string
  prenom: string
  athleteId: string | null
  onClose: () => void
  onSent: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [selectedChip, setSelectedChip] = useState(0)
  const [customMsg, setCustomMsg] = useState('')
  const [loomUrl, setLoomUrl] = useState('')
  const recorder = useAudioRecorder({
    bucket: 'coach-audio',
    pathPrefix: `${user?.id || 'unknown'}/bilan_${userId}_`,
  })

  const handleSend = async () => {
    const msg = customMsg.trim() || (selectedChip >= 0 ? BILAN_TRAITE_MESSAGES[selectedChip] : '')
    const hasAudio = !!recorder.audioUrl
    const hasLoom = !!loomUrl.trim()

    if (!msg && !hasAudio && !hasLoom) {
      toast('Ajoutez un message, vocal ou lien Loom', 'error')
      return
    }

    const finalMsg = msg || 'Bilan verifie'
    const body = 'Ton bilan a ete verifie : ' + finalMsg.charAt(0).toLowerCase() + finalMsg.slice(1)

    // Save in bilan_retours
    if (athleteId) {
      await supabase.from('bilan_retours').insert({
        athlete_id: athleteId,
        coach_id: user?.id,
        loom_url: hasLoom ? loomUrl.trim() : null,
        titre: 'Bilan traite',
        commentaire: finalMsg,
        audio_url: hasAudio ? recorder.audioUrl : null,
        type: hasLoom ? (hasAudio ? 'mixed' : 'loom') : (hasAudio ? 'audio' : 'message'),
      })
    }

    // Notify athlete (DB + push)
    const meta: Record<string, string> = {}
    if (hasAudio && recorder.audioUrl) meta.audio_url = recorder.audioUrl
    if (hasLoom) meta.loom_url = loomUrl.trim()

    await notifyAthlete(userId, 'bilan', 'Bilan traite', body, meta)

    onClose()
    onSent()
    toast('Notification envoyee !', 'success')
  }

  const formatTime = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  return (
    <div className={styles.btOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.btPopup}>
        <div className={styles.btPopupHeader}>
          <div className={styles.btPopupTitle}>
            <div className={styles.btPopupAvatar}>{prenom.charAt(0)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Retour bilan</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{prenom}</div>
            </div>
          </div>
          <button className={styles.btClose} onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div className={styles.btPopupBody}>
          <div className={styles.btSectionLabel}>
            <i className="fas fa-comment-dots" /> Message rapide
          </div>
          <div className={styles.btChips}>
            {BILAN_TRAITE_MESSAGES.map((msg, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.btChip} ${selectedChip === i && !customMsg.trim() ? styles.btChipActive : ''}`}
                onClick={() => { setSelectedChip(i); setCustomMsg('') }}
              >
                {msg}
              </button>
            ))}
          </div>

          <div className={styles.btSectionLabel} style={{ marginTop: 16 }}>
            <i className="fas fa-pen" /> Ou message libre
          </div>
          <input
            type="text"
            className={styles.btInput}
            placeholder="Ecrivez votre message..."
            value={customMsg}
            onChange={(e) => { setCustomMsg(e.target.value); setSelectedChip(-1) }}
          />

          <div className={styles.btDivider} />

          <div className={styles.btExtras}>
            <div className={styles.btExtraItem}>
              <div className={styles.btSectionLabel} style={{ margin: 0 }}>
                <i className="fas fa-video" /> Lien Loom
              </div>
              <input
                type="url"
                className={styles.btInput}
                placeholder="https://www.loom.com/share/..."
                value={loomUrl}
                onChange={(e) => setLoomUrl(e.target.value)}
              />
            </div>
            <div className={styles.btExtraItem}>
              <div className={styles.btSectionLabel} style={{ margin: 0 }}>
                <i className="fas fa-microphone" /> Message vocal
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={styles.btMicBtn}
                  onClick={() => recorder.isRecording ? recorder.stopRecording() : recorder.startRecording()}
                  disabled={recorder.uploading}
                  style={recorder.isRecording ? { borderColor: 'var(--danger)' } : undefined}
                >
                  {recorder.uploading ? (
                    <i className="fas fa-spinner fa-spin" />
                  ) : recorder.isRecording ? (
                    <>
                      <i className="fas fa-stop" style={{ color: 'var(--danger)' }} />
                      <span>{formatTime(recorder.seconds)}</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-microphone" />
                      <span>Enregistrer</span>
                    </>
                  )}
                </button>
                {recorder.audioUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <audio controls src={recorder.audioUrl} style={{ height: 32, flex: 1 }} />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={recorder.clearAudio}
                      style={{ padding: '3px 6px', color: 'var(--danger)' }}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.btPopupFooter}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-red" onClick={handleSend}>
            <i className="fas fa-paper-plane" style={{ marginRight: 6 }} />
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status Badge ──

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') return <span className={`${styles.boStatus} ${styles.boStatusDone}`}><i className="fas fa-check" /> Soumis</span>
  if (status === 'late') return <span className={`${styles.boStatus} ${styles.boStatusLate}`}><i className="fas fa-exclamation-circle" /> En retard</span>
  return <span className={`${styles.boStatus} ${styles.boStatusUpcoming}`}><i className="fas fa-clock" /> A venir</span>
}

// ── Main Component ──

export default function BilansOverview() {
  const { user } = useAuth()
  const { athletes, loading: athletesLoading } = useAthleteContext()
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState<{ userId: string; prenom: string; athleteId: string | null } | null>(null)

  const supabase = createClient()

  // Fetch reports — scoped to coach's athletes only
  const fetchReports = useCallback(async () => {
    if (!user) return
    const athleteUserIds = athletes.map(a => a.user_id).filter(Boolean) as string[]
    if (!athleteUserIds.length) { setReports([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('daily_reports')
        .select('id, user_id, date, weight, energy, sleep_quality, stress, adherence, sessions_executed, session_performance, steps')
        .in('user_id', athleteUserIds)
        .order('date', { ascending: false })
        .limit(1000)
      setReports((data as DailyReport[]) || [])
    } finally {
      setLoading(false)
    }
  }, [user, athletes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload reports when athletes list changes
  useEffect(() => {
    if (!athletesLoading && athletes.length) fetchReports()
  }, [athletesLoading, athletes, fetchReports])

  const today = toDateStr(new Date())

  const athleteData = useMemo((): AthleteData[] => {
    if (!athletes.length) return []
    return athletes
      .filter(a => a.user_id)
      .map(a => {
        const myReports = reports.filter(r => r.user_id === a.user_id)

        const freq = a.complete_bilan_frequency || 'weekly'
        const intv = a.complete_bilan_interval || 7
        const day = a.complete_bilan_day ?? 0
        const anchor = a.complete_bilan_anchor_date
        const mDay = a.complete_bilan_month_day || 1

        const lastExpected = getLastExpectedBilanDate(freq, intv, day, anchor, mDay)
        const nextExpected = getNextBilanDate(freq, intv, day, anchor, mDay)
        const expectedStr = lastExpected || nextExpected || today

        const isPast = expectedStr <= today
        const bilanReport = myReports.find(r => r.date === expectedStr) || null
        const lastBilanReport = myReports.find(r => r.weight || r.photo_front || r.photo_side || r.photo_back) || null

        let status: 'done' | 'late' | 'upcoming'
        if (freq === 'none') {
          status = 'upcoming'
        } else if (bilanReport) {
          status = 'done'
        } else if (isPast) {
          status = 'late'
        } else {
          status = 'upcoming'
        }

        return { athlete: a, status, bilanReport, lastBilanReport, expectedStr }
      })
  }, [athletes, reports, today])

  const counts = useMemo(() => {
    const c = { all: athleteData.length, done: 0, late: 0, upcoming: 0 }
    athleteData.forEach(d => { c[d.status]++ })
    return c
  }, [athleteData])

  const filtered = useMemo(() => {
    const data = filter === 'all' ? athleteData : athleteData.filter(d => d.status === filter)
    const order: Record<string, number> = { late: 0, done: 1, upcoming: 2 }
    return [...data].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))
  }, [athleteData, filter])

  if (athletesLoading || loading) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Skeleton width={200} height={28} />
          <Skeleton width={300} height={16} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} width={100} height={36} />)}
        </div>
        <Skeleton height={300} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Bilans</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Suivez la progression de vos athletes</p>
      </div>

      {/* Filters */}
      <div className={styles.boFilters}>
        {FILTER_BTNS.map(f => (
          <button
            key={f.key}
            className={`${styles.boFilter} ${filter === f.key ? styles.boFilterActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.icon && <i className={`fas ${f.icon}`} />}
            {f.label}
            <span className={styles.boCount}>{counts[f.key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={styles.boTableWrap}>
        <table className={styles.boTable}>
          <thead>
            <tr>
              <th>Client</th>
              <th>Statut</th>
              <th>Poids</th>
              <th>Echeance</th>
              <th>Dernier bilan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map(d => {
              const a = d.athlete
              const initials = (a.prenom?.charAt(0) || '') + (a.nom?.charAt(0) || '')
              const lastBilanDate = d.lastBilanReport?.date
              const lastDateStr = lastBilanDate
                ? new Date(lastBilanDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                : '\u2014'
              const echeanceStr = new Date(d.expectedStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
              const bilanInfo = d.bilanReport
                ? (d.bilanReport.weight ? d.bilanReport.weight + ' kg' : 'Soumis')
                : '\u2014'

              return (
                <tr
                  key={a.id}
                  className={styles.boRow}
                  onClick={() => router.push(`/athletes/${a.id}/bilans`)}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={styles.boAvatar}>{initials}</div>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{a.prenom} {a.nom}</span>
                    </div>
                  </td>
                  <td><StatusBadge status={d.status} /></td>
                  <td style={{ color: 'var(--text2)' }}>{bilanInfo}</td>
                  <td style={{ color: 'var(--text3)' }}>Echeance: {echeanceStr}</td>
                  <td style={{ color: 'var(--text3)' }}>{lastBilanDate ? lastDateStr : '\u2014'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {d.status === 'done' && (
                      <button
                        className={styles.boActionBtn}
                        style={{ color: 'var(--success)' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPopup({ userId: a.user_id!, prenom: a.prenom, athleteId: a.id })
                        }}
                        title="Bilan traite"
                      >
                        <i className="fas fa-check" />
                      </button>
                    )}
                    <button
                      className={styles.boActionBtn}
                      onClick={(e) => { e.stopPropagation(); router.push(`/athletes/${a.id}/bilans`) }}
                    >
                      <i className="fas fa-eye" />
                    </button>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
                  Aucun bilan dans cette categorie
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bilan Traite Popup */}
      {popup && (
        <BilanTraitePopup
          userId={popup.userId}
          prenom={popup.prenom}
          athleteId={popup.athleteId}
          onClose={() => setPopup(null)}
          onSent={() => fetchReports()}
        />
      )}
    </div>
  )
}
