'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminFormatDate, timeAgo } from '@/lib/admin-helpers'
import styles from '@/styles/admin.module.css'

interface AdminAthlete {
  id: string
  prenom: string
  nom: string
  coach_id: string
  coach_email: string
  created_at: string
  last_activity: string | null
}

export default function AdminAthletesPage() {
  const [athletes, setAthletes] = useState<AdminAthlete[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('admin_athletes')
      if (rpcError) throw new Error(rpcError.message)
      setAthletes((data as AdminAthlete[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const total = athletes.length
  const active = athletes.filter(a => a.last_activity && a.last_activity >= thirtyDaysAgo).length
  const activeWeek = athletes.filter(a => a.last_activity && a.last_activity >= sevenDaysAgo).length
  const coachSet = new Set(athletes.map(a => a.coach_id))
  const avgPerCoach = coachSet.size > 0 ? (total / coachSet.size).toFixed(1) : '0'
  const neverActive = athletes.filter(a => !a.last_activity).length
  const engagementRate = total > 0 ? Math.round((active / total) * 100) : 0

  const filtered = athletes.filter(a =>
    `${a.prenom} ${a.nom}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className={styles.adminSection}>
        <div className={styles.adminPageHeader}>
          <div>
            <h1 className={styles.adminPageTitle}>Athl&egrave;tes</h1>
            <p className={styles.adminPageSubtitle}>Vue globale de tous les athl&egrave;tes</p>
          </div>
        </div>
        <div className={styles.adminStats}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
          ))}
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonTable}`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.adminEmpty}>
        <i className="fas fa-exclamation-triangle" />
        {error}
      </div>
    )
  }

  return (
    <div className={styles.adminSection}>
      <div className={styles.adminPageHeader}>
        <div>
          <h1 className={styles.adminPageTitle}>Athl&egrave;tes</h1>
          <p className={styles.adminPageSubtitle}>Vue globale de tous les athl&egrave;tes</p>
        </div>
        <div className={styles.adminSearchWrap}>
          <i className="fas fa-search" />
          <input
            type="text"
            className={styles.adminSearch}
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.adminStats}>
        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconBlue}`}>
              <i className="fas fa-users" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{total}</div>
          <div className={styles.adminStatLabel}>Total</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconGreen}`}>
              <i className="fas fa-heartbeat" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{active}</div>
          <div className={styles.adminStatLabel}>Actifs (30j)</div>
          <div className={styles.adminStatSub}>{activeWeek} cette semaine</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconOrange}`}>
              <i className="fas fa-percentage" />
            </div>
          </div>
          <div className={styles.adminStatValue}>
            {engagementRate}<span style={{ fontSize: 16, fontWeight: 600 }}>%</span>
          </div>
          <div className={styles.adminStatLabel}>Engagement</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconPurple}`}>
              <i className="fas fa-calculator" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{avgPerCoach}</div>
          <div className={styles.adminStatLabel}>Moy. / Coach</div>
          <div className={styles.adminStatSub}>
            {neverActive} jamais actif{neverActive > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className={styles.adminCard}>
        <div className={styles.adminCardHeader}>
          <div className={styles.adminCardTitle}>
            <i className="fas fa-list" /> Tous les athl&egrave;tes
          </div>
          <span className={styles.adminCardBadge}>{total}</span>
        </div>
        <div className={styles.adminCardBodyNoPad}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>Athl&egrave;te</th>
                <th>Coach</th>
                <th>Inscrit le</th>
                <th>Derni&egrave;re activit&eacute;</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isActive = a.last_activity && a.last_activity >= thirtyDaysAgo
                const initials = ((a.prenom || '')[0] + (a.nom || '')[0]).toUpperCase()
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          className={styles.adminCoachAvatar}
                          style={{ width: 32, height: 32, borderRadius: 8, fontSize: 11 }}
                        >
                          {initials}
                        </div>
                        <div style={{ fontWeight: 500 }}>{a.prenom} {a.nom}</div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{a.coach_email}</td>
                    <td className={styles.adminCoachDate}>{adminFormatDate(a.created_at)}</td>
                    <td className={styles.adminCoachDate}>
                      {a.last_activity
                        ? timeAgo(a.last_activity + 'T00:00:00')
                        : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Jamais</span>
                      }
                    </td>
                    <td>
                      {isActive ? (
                        <span className={`${styles.adminBadge} ${styles.adminBadgeActive}`}>Actif</span>
                      ) : (
                        <span className={`${styles.adminBadge} ${styles.adminBadgeInactive}`}>Inactif</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
