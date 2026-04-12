'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import { toDateStr, getLastExpectedBilanDate } from '@/lib/utils'
import { notifyAthlete } from '@/lib/push'
import StatsCards, { type StatCardData } from './StatsCards'
import ActivityFeed, { type ActivityItem } from './ActivityFeed'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/dashboard.module.css'
import type { Athlete } from '@/lib/types'

// ── Types for dashboard data ──

interface BilanToReview {
  athlete: Athlete
  report: Record<string, unknown>
  count: number
}

interface LateAthlete {
  athlete: Athlete
  expectedDay: string
  lastDate: string
}

interface PendingVideo {
  id: string
  athlete_id: string
  exercise_name: string | null
  created_at: string
  athlete: Athlete
}

interface Birthday {
  athlete: Athlete
  daysLeft: number
  nextBd: Date
  age: number
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return "a l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { athletes, loading: athletesLoading } = useAthleteContext()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [bilansToReview, setBilansToReview] = useState<BilanToReview[]>([])
  const [lateAthletes, setLateAthletes] = useState<LateAthlete[]>([])
  const [pendingVids, setPendingVids] = useState<PendingVideo[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [coachSettings, setCoachSettings] = useState<Record<string, unknown>>({})
  const [activePrograms, setActivePrograms] = useState(0)
  const [sendingRappel, setSendingRappel] = useState<Set<string>>(new Set())
  const [sentRappels, setSentRappels] = useState<Set<string>>(new Set())

  const mainRef = useRef<HTMLDivElement>(null)
  const activityRef = useRef<HTMLDivElement>(null)

  const loadDashboard = useCallback(async () => {
    if (!user || athletesLoading) return

    setLoading(true)

    const athleteUserIds = athletes.map(a => a.user_id).filter(Boolean) as string[]
    const athleteIds = athletes.map(a => a.id)

    const [
      { data: allReports },
      { data: allPrograms },
      { data: pendingVideos },
      { data: settingsRows },
    ] = await Promise.all([
      athleteUserIds.length
        ? supabase.from('daily_reports').select('*').in('user_id', athleteUserIds).order('date', { ascending: false }).limit(500)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase.from('workout_programs').select('id, nom, athlete_id, actif').eq('coach_id', user.id).limit(500),
      athleteIds.length
        ? supabase.from('execution_videos').select('id, athlete_id, exercise_name, created_at').in('athlete_id', athleteIds).eq('status', 'a_traiter').order('created_at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase.from('coach_settings').select('*').eq('coach_id', user.id).limit(1),
    ])

    // Coach settings
    let settings = settingsRows?.[0] || null
    if (!settings) {
      const { data: created } = await supabase
        .from('coach_settings')
        .insert({ coach_id: user.id, max_videos_per_day: 3 })
        .select()
        .single()
      settings = created || { max_videos_per_day: 3 }
    }
    setCoachSettings(settings as Record<string, unknown>)

    const reports = (allReports || []) as Record<string, unknown>[]
    const programs = (allPrograms || []) as Record<string, unknown>[]
    const videos = (pendingVideos || []) as Record<string, unknown>[]

    const today = toDateStr(new Date())
    const now = new Date()

    // Active programs count
    setActivePrograms(programs.filter(p => p.actif).length)

    // Build lookup
    const athleteMap: Record<string, Athlete> = {}
    athletes.forEach(a => {
      if (a.user_id) athleteMap[a.user_id] = a
      athleteMap[a.id] = a
    })

    // Monday of current week
    const mondayDate = new Date(now)
    const dayOff = mondayDate.getDay() === 0 ? 6 : mondayDate.getDay() - 1
    mondayDate.setDate(mondayDate.getDate() - dayOff)
    const mondayStr = toDateStr(mondayDate)

    const thisWeekReports = reports.filter(
      r => (r.date as string) >= mondayStr && (r.date as string) <= today
    )

    // Bilans to review
    const bilans: BilanToReview[] = []
    athletes.forEach(a => {
      if (!a.user_id) return
      const athleteReports = thisWeekReports.filter(r => r.user_id === a.user_id)
      if (athleteReports.length > 0) {
        const lastReport = athleteReports.sort(
          (x, y) => (y.date as string).localeCompare(x.date as string)
        )[0]
        bilans.push({ athlete: a, report: lastReport, count: athleteReports.length })
      }
    })
    setBilansToReview(bilans)

    // Late athletes
    const late: LateAthlete[] = []
    athletes.forEach(a => {
      if (!a.user_id) return
      const freq = a.complete_bilan_frequency || 'weekly'
      if (freq === 'none') return
      const intv = a.complete_bilan_interval || 7
      const day = a.complete_bilan_day ?? 0
      const anchor = a.complete_bilan_anchor_date
      const mDay = a.complete_bilan_month_day || 1

      const lastExpected = getLastExpectedBilanDate(freq, intv, day, anchor, mDay)
      if (!lastExpected) return

      const hasBilan = thisWeekReports.some(
        r => r.user_id === a.user_id && r.date === lastExpected
      )
      if (hasBilan) return

      const lastReport = reports.find(r => r.user_id === a.user_id)
      const expectedLabel = new Date(lastExpected + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'short',
      })
      late.push({
        athlete: a,
        expectedDay: expectedLabel,
        lastDate: lastReport
          ? new Date((lastReport.date as string) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          : 'jamais',
      })
    })
    setLateAthletes(late)

    // Pending videos
    const vids: PendingVideo[] = videos
      .map(v => {
        const athlete = athleteMap[v.athlete_id as string]
        return athlete
          ? { id: v.id as string, athlete_id: v.athlete_id as string, exercise_name: v.exercise_name as string | null, created_at: v.created_at as string, athlete }
          : null
      })
      .filter(Boolean) as PendingVideo[]
    setPendingVids(vids)

    // Birthdays
    const bdays: Birthday[] = []
    athletes.forEach(a => {
      if (!a.date_naissance) return
      const bd = new Date(a.date_naissance + 'T00:00:00')
      const nextBd = new Date(now.getFullYear(), bd.getMonth(), bd.getDate())
      if (nextBd < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        nextBd.setFullYear(nextBd.getFullYear() + 1)
      }
      const diffDays = Math.ceil(
        (nextBd.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000
      )
      if (diffDays <= 60) {
        const age = nextBd.getFullYear() - bd.getFullYear()
        bdays.push({ athlete: a, daysLeft: diffDays, nextBd, age })
      }
    })
    bdays.sort((a, b) => a.daysLeft - b.daysLeft)
    setBirthdays(bdays)

    // Recent activity
    const activity: ActivityItem[] = reports
      .slice(0, 30)
      .map(r => {
        const athlete = athleteMap[r.user_id as string]
        if (!athlete) return null
        const items: { icon: string; text: string; color: string }[] = []
        if (r.weight) items.push({ icon: 'fa-weight', text: `${r.weight} kg`, color: 'var(--text)' })
        if (r.sessions_executed) items.push({ icon: 'fa-dumbbell', text: r.sessions_executed as string, color: 'var(--primary)' })
        if (r.session_performance) {
          const perf = r.session_performance as string
          items.push({
            icon: 'fa-chart-line',
            text: perf,
            color: perf === 'Progres' ? 'var(--success)' : perf === 'Regression' ? 'var(--danger)' : 'var(--text2)',
          })
        }
        if (!items.length && !r.energy) return null
        return {
          athlete,
          date: r.date as string,
          items,
          energy: r.energy as number | null,
          sleep: r.sleep_quality as string | null,
          adherence: r.adherence as number | null,
        }
      })
      .filter(Boolean)
      .slice(0, 20) as ActivityItem[]
    setRecentActivity(activity)

    setLoading(false)
  }, [user, athletes, athletesLoading, supabase])

  useEffect(() => {
    if (user && !athletesLoading) {
      loadDashboard()
    }
  }, [user, athletesLoading, loadDashboard])

  // Sync activity column height with main column
  useEffect(() => {
    if (!loading && mainRef.current && activityRef.current) {
      activityRef.current.style.maxHeight = mainRef.current.offsetHeight + 'px'
    }
  }, [loading, bilansToReview, lateAthletes, pendingVids, birthdays])

  const sendBilanRappel = async (athlete: Athlete) => {
    if (!athlete.user_id || sendingRappel.has(athlete.id) || sentRappels.has(athlete.id)) return

    // Check if already sent today
    const todayStr = toDateStr(new Date())
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', athlete.user_id)
      .eq('type', 'rappel')
      .gte('created_at', todayStr + 'T00:00:00')
      .limit(1)

    if (existing && existing.length > 0) {
      toast('Rappel deja envoye aujourd\'hui', 'error')
      return
    }

    setSendingRappel(prev => new Set(prev).add(athlete.id))

    const title = 'Rappel bilan'
    const body = 'Ton bilan est en retard, pense a le remplir !'

    try {
      await notifyAthlete(athlete.user_id!, 'rappel', title, body)
    } catch {
      setSendingRappel(prev => { const next = new Set(prev); next.delete(athlete.id); return next })
      toast('Erreur lors de l\'envoi du rappel', 'error')
      return
    }

    setSendingRappel(prev => {
      const next = new Set(prev)
      next.delete(athlete.id)
      return next
    })

    setSentRappels(prev => new Set(prev).add(athlete.id))
    toast(`Rappel envoye a ${athlete.prenom}`, 'success')
  }

  const updateCoachSetting = async (key: string, value: number) => {
    if (!user) return
    const { error } = await supabase
      .from('coach_settings')
      .upsert({ coach_id: user.id, [key]: value }, { onConflict: 'coach_id' })
    if (error) {
      toast('Erreur lors de la sauvegarde', 'error')
      return
    }
    toast('Reglage sauvegarde', 'success')
  }

  // ── Loading state ──
  if (loading || athletesLoading) {
    return (
      <div>
        <Skeleton height={100} borderRadius={16} />
        <div className={styles.statsGrid} style={{ marginTop: 28 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={80} borderRadius={20} />
          ))}
        </div>
        <Skeleton height={400} borderRadius={16} />
      </div>
    )
  }

  const coachName = user?.email?.split('@')[0] || 'Coach'
  const todayFull = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const stats: StatCardData[] = [
    {
      id: 'athletes',
      value: athletes.length,
      label: 'Athletes',
      icon: 'fa-users',
      iconColor: '#3b82f6',
      iconBg: 'rgba(59,130,246,0.1)',
      stripeGradient: 'linear-gradient(90deg,#3b82f6,#60a5fa)',
    },
    {
      id: 'bilans',
      value: bilansToReview.length,
      label: 'Bilans a traiter',
      icon: 'fa-clipboard-check',
      iconColor: '#22c55e',
      iconBg: 'rgba(34,197,94,0.1)',
      stripeGradient: 'linear-gradient(90deg,#22c55e,#4ade80)',
    },
    {
      id: 'videos',
      value: pendingVids.length,
      label: 'Videos a corriger',
      icon: 'fa-video',
      iconColor: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.1)',
      stripeGradient: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
    },
    {
      id: 'late',
      value: lateAthletes.length,
      label: 'Bilans en retard',
      icon: 'fa-exclamation-triangle',
      iconColor: '#B30808',
      iconBg: 'rgba(179,8,8,0.1)',
      stripeGradient: 'linear-gradient(90deg,#B30808,#d41a1a)',
    },
  ]

  return (
    <div>
      {/* Welcome banner */}
      <div className={styles.prcWelcome}>
        <div>
          <div className={styles.prcWelcomeTitle}>Bonjour, {coachName}</div>
          <div className={styles.prcWelcomeSub}>Voici un apercu de vos athletes</div>
        </div>
        <div className={styles.prcWelcomeRight}>
          <div className={styles.prcWelcomeDate}>
            <i className="fas fa-calendar-alt" /> {todayFull}
          </div>
          <button
            className="btn btn-red"
            onClick={() => router.push('/athletes?new=1')}
          >
            <i className="fas fa-plus" /> Ajouter un athlete
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <StatsCards stats={stats} />

      {/* Main grid */}
      <div className={styles.dashLayout}>
        <div className={styles.dashMain} ref={mainRef}>
          {/* Row 1: Bilans a traiter + Bilans en retard */}
          <div className={styles.dashRow}>
            {/* Bilans a traiter */}
            <div className={styles.dashCard}>
              <div className={styles.dashCardHeader}>
                <span className={styles.dashCardTitle}>
                  <i className="fas fa-clipboard-check" /> Bilans a traiter
                </span>
                <span className={styles.dashBadge}>{bilansToReview.length}</span>
              </div>
              <div className={styles.dashCardBody}>
                {bilansToReview.length > 0 ? (
                  bilansToReview.map(b => {
                    const d = new Date((b.report.date as string) + 'T00:00:00')
                    const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                    return (
                      <div
                        key={b.athlete.id}
                        className={styles.dashItem}
                        onClick={() => router.push(`/athletes/${b.athlete.id}/bilans`)}
                      >
                        <div className={styles.dashAvatar}>
                          {b.athlete.prenom.charAt(0)}{b.athlete.nom.charAt(0)}
                        </div>
                        <div className={styles.dashItemInfo}>
                          <div className={styles.dashItemName}>
                            {b.athlete.prenom} {b.athlete.nom}
                          </div>
                          <div className={styles.dashItemSub}>
                            {b.count} bilan{b.count > 1 ? 's' : ''} · dernier le {dateStr}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className={styles.dashEmpty}>Aucun bilan cette semaine</div>
                )}
              </div>
            </div>

            {/* Bilans en retard */}
            <div className={styles.dashCard}>
              <div className={styles.dashCardHeader}>
                <span className={styles.dashCardTitle}>
                  <i className="fas fa-bell" /> Bilans en retard
                </span>
                <span className={`${styles.dashBadge} ${lateAthletes.length ? styles.dashBadgeWarn : ''}`}>
                  {lateAthletes.length}
                </span>
              </div>
              <div className={styles.dashCardBody}>
                {lateAthletes.length > 0 ? (
                  lateAthletes.map(l => (
                    <div key={l.athlete.id} className={styles.dashItem} style={{ cursor: 'default' }}>
                      <div className={`${styles.dashAvatar} ${styles.dashAvatarWarn}`}>
                        {l.athlete.prenom.charAt(0)}{l.athlete.nom.charAt(0)}
                      </div>
                      <div className={styles.dashItemInfo} style={{ flex: 1 }}>
                        <div className={styles.dashItemName}>
                          {l.athlete.prenom} {l.athlete.nom}
                        </div>
                        <div className={styles.dashItemSub}>
                          Attendu {l.expectedDay} · Dernier : {l.lastDate}
                        </div>
                      </div>
                      <button
                        className={styles.dashBellBtn}
                        disabled={sendingRappel.has(l.athlete.id) || sentRappels.has(l.athlete.id)}
                        onClick={e => {
                          e.stopPropagation()
                          sendBilanRappel(l.athlete)
                        }}
                        title="Envoyer un rappel"
                      >
                        <i className={`fas ${
                          sentRappels.has(l.athlete.id) ? 'fa-check' : sendingRappel.has(l.athlete.id) ? 'fa-spinner fa-spin' : 'fa-bell'
                        }`} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className={styles.dashEmpty}>
                    <i className="fas fa-check-circle" style={{ color: 'var(--success)', marginRight: 6 }} />
                    Tous les bilans sont a jour
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Videos + Anniversaires + Reglages */}
          <div className={styles.dashRow}>
            {/* Videos a corriger */}
            <div className={styles.dashCard}>
              <div className={styles.dashCardHeader}>
                <span className={styles.dashCardTitle}>
                  <i className="fas fa-video" /> Videos a corriger
                </span>
                <span className={`${styles.dashBadge} ${pendingVids.length ? styles.dashBadgeWarn : ''}`}>
                  {pendingVids.length}
                </span>
              </div>
              <div className={styles.dashCardBody}>
                {pendingVids.length > 0 ? (
                  pendingVids.map(v => {
                    const d = new Date(v.created_at)
                    const timeAgo = getTimeAgo(d)
                    return (
                      <div
                        key={v.id}
                        className={styles.dashItem}
                        onClick={() => router.push(`/athletes/${v.athlete.id}/videos`)}
                      >
                        <div className={styles.dashAvatar} style={{ background: 'var(--warning)' }}>
                          {v.athlete.prenom.charAt(0)}{v.athlete.nom.charAt(0)}
                        </div>
                        <div className={styles.dashItemInfo}>
                          <div className={styles.dashItemName}>
                            {v.athlete.prenom} {v.athlete.nom}
                          </div>
                          <div className={styles.dashItemSub}>
                            {v.exercise_name || 'Exercice'} · {timeAgo}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className={styles.dashEmpty}>
                    <i className="fas fa-check-circle" style={{ color: 'var(--success)', marginRight: 6 }} />
                    Aucune video en attente
                  </div>
                )}
              </div>
            </div>

            {/* Anniversaires */}
            <div className={styles.dashCard}>
              <div className={styles.dashCardHeader}>
                <span className={styles.dashCardTitle}>
                  <i className="fas fa-birthday-cake" /> Anniversaires
                </span>
                <span className={styles.dashBadge}>{birthdays.length}</span>
              </div>
              <div className={styles.dashCardBody}>
                {birthdays.length > 0 ? (
                  birthdays.map(b => {
                    const bdStr = b.nextBd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                    const isToday = b.daysLeft === 0
                    const countdownColor = isToday ? 'var(--warning)' : b.daysLeft <= 7 ? 'var(--primary)' : 'var(--text3)'
                    const countdownText = isToday ? 'Aujourd\'hui !' : `J-${b.daysLeft}`
                    return (
                      <div
                        key={b.athlete.id}
                        className={styles.dashItem}
                        onClick={() => router.push(`/athletes/${b.athlete.id}`)}
                      >
                        <div
                          className={styles.dashAvatar}
                          style={{
                            background: isToday ? 'var(--warning)' : 'var(--bg3)',
                            color: isToday ? '#000' : 'var(--text2)',
                          }}
                        >
                          {b.athlete.prenom.charAt(0)}{b.athlete.nom.charAt(0)}
                        </div>
                        <div className={styles.dashItemInfo}>
                          <div className={styles.dashItemName}>
                            {b.athlete.prenom} {b.athlete.nom}
                          </div>
                          <div className={styles.dashItemSub}>
                            {bdStr} · {b.age} ans
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: countdownColor, whiteSpace: 'nowrap' }}>
                          {countdownText}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className={styles.dashEmpty}>Aucun anniversaire a venir</div>
                )}
              </div>
            </div>
          </div>

          {/* Settings card */}
          <div className={styles.dashCard}>
            <div className={styles.dashCardHeader}>
              <span className={styles.dashCardTitle}>
                <i className="fas fa-cog" /> Reglages
              </span>
            </div>
            <div className={styles.dashCardBody}>
              <div className={styles.settingsRow}>
                <div>
                  <div className={styles.settingsLabel}>Videos max / jour</div>
                  <div className={styles.settingsHint}>Limite par athlete sur l&apos;app mobile</div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={(coachSettings.max_videos_per_day as number) ?? 3}
                  className={styles.settingsInput}
                  onChange={e => updateCoachSetting('max_videos_per_day', parseInt(e.target.value) || 3)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Activity feed */}
        <div ref={activityRef}>
          <ActivityFeed activities={recentActivity} />
        </div>
      </div>
    </div>
  )
}
