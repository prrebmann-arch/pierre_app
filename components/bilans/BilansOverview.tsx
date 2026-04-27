'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useToast } from '@/contexts/ToastContext'
import { toDateStr, getLastExpectedBilanDate, getNextBilanDate } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Skeleton from '@/components/ui/Skeleton'
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
  coach_reviewed_at?: string | null
  [key: string]: unknown
}

interface AthleteData {
  athlete: Athlete
  status: 'done' | 'late' | 'upcoming' | 'treated'
  bilanReport: DailyReport | null
  lastBilanReport: DailyReport | null
  expectedStr: string
}

type FilterKey = 'all' | 'done' | 'late' | 'upcoming'

const FILTER_BTNS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'Tous', icon: '' },
  { key: 'done', label: 'A traiter', icon: 'fa-clipboard-check' },
  { key: 'late', label: 'En retard', icon: 'fa-exclamation-circle' },
  { key: 'upcoming', label: 'A venir', icon: 'fa-clock' },
]

// ── Status Badge ──

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') return <span className={`${styles.boStatus} ${styles.boStatusDone}`}><i className="fas fa-check" /> Soumis</span>
  if (status === 'treated') return <span className={`${styles.boStatus} ${styles.boStatusDone}`}><i className="fas fa-check-double" /> Traite</span>
  if (status === 'late') return <span className={`${styles.boStatus} ${styles.boStatusLate}`}><i className="fas fa-exclamation-circle" /> En retard</span>
  return <span className={`${styles.boStatus} ${styles.boStatusUpcoming}`}><i className="fas fa-clock" /> A venir</span>
}

// ── Main Component ──

export default function BilansOverview() {
  const { user } = useAuth()
  const { athletes, loading: athletesLoading } = useAthleteContext()
  const { toast } = useToast()
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | null>(null)

  const supabase = createClient()

  // Fetch reports — scoped to coach's athletes only
  const fetchReports = useCallback(async () => {
    if (!user) return
    const athleteUserIds = athletes.map(a => a.user_id).filter(Boolean) as string[]
    if (!athleteUserIds.length) { setReports([]); setLoading(false); return }
    if (!reports.length) setLoading(true)
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const fromDate = thirtyDaysAgo.toISOString().slice(0, 10)

      const { data } = await supabase
        .from('daily_reports')
        .select('id, user_id, date, weight, energy, sleep_quality, stress, adherence, sessions_executed, session_performance, steps, photo_front, photo_side, photo_back, coach_reviewed_at')
        .in('user_id', athleteUserIds)
        .gte('date', fromDate)
        .order('date', { ascending: false })
        .limit(200)
      setReports((data as DailyReport[]) || [])
    } finally {
      setLoading(false)
    }
  }, [user?.id, athletes.length]) // eslint-disable-line react-hooks-exhaustive-deps

  // Reload reports when athletes list changes
  useEffect(() => {
    if (!athletesLoading && athletes.length) fetchReports()
  }, [athletesLoading, athletes, fetchReports])

  useRefetchOnResume(fetchReports, loading)

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

        let status: 'done' | 'late' | 'upcoming' | 'treated'
        if (freq === 'none') {
          status = 'upcoming'
        } else if (bilanReport) {
          status = bilanReport.coach_reviewed_at ? 'treated' : 'done'
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
    athleteData.forEach(d => {
      if (d.status === 'done' || d.status === 'late' || d.status === 'upcoming') c[d.status]++
    })
    return c
  }, [athleteData])

  const filtered = useMemo(() => {
    const data = filter === 'all' ? athleteData : athleteData.filter(d => d.status === filter)
    const order: Record<string, number> = { late: 0, done: 1, treated: 2, upcoming: 3 }
    return [...data].sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4))
  }, [athleteData, filter])

  const markAsTreated = useCallback(async (reportId: string) => {
    setMarking(reportId)
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('daily_reports')
      .update({ coach_reviewed_at: now })
      .eq('id', reportId)
      .select('id')
    setMarking(null)
    if (error || !data || data.length === 0) {
      toast('Impossible de marquer comme traite', 'error')
      return
    }
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, coach_reviewed_at: now } : r))
    toast('Bilan marque comme traite', 'success')
  }, [supabase, toast])

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
                  onMouseEnter={() => router.prefetch(`/athletes/${a.id}/bilans`)}
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
                    {d.status === 'done' && d.bilanReport && (
                      <button
                        className={styles.boActionBtn}
                        style={{ color: 'var(--success)' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsTreated(d.bilanReport!.id)
                        }}
                        disabled={marking === d.bilanReport.id}
                        title="Marquer comme traite"
                      >
                        <i className={marking === d.bilanReport.id ? 'fas fa-spinner fa-spin' : 'fas fa-check'} />
                      </button>
                    )}
                    <Link
                      href={`/athletes/${a.id}/bilans`}
                      className={styles.boActionBtn}
                      onClick={(e) => { e.stopPropagation() }}
                    >
                      <i className="fas fa-eye" />
                    </Link>
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

    </div>
  )
}
