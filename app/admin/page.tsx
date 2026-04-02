'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatEur, adminFormatDate, timeAgo, todayLabel } from '@/lib/admin-helpers'
import styles from '@/styles/admin.module.css'

interface OverviewData {
  coaches: Array<{
    id: string
    email: string
    created_at: string
    athletes_count: number
    mrr: number
    last_sign_in_at: string | null
  }>
  athletes_count: number
  total_mrr: number
  active_subs: number
  canceled_subs: number
  total_subs: number
  recent_payments: Array<{
    amount: number
    status: string
    created_at: string
  }>
  mrr_history: Array<{ month: string; revenue: number }>
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: result, error: rpcError } = await supabase.rpc('admin_overview')
      if (rpcError) throw new Error(rpcError.message)
      setData(result as OverviewData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className={styles.adminSection}>
        <div className={styles.adminPageHeader}>
          <div>
            <h1 className={styles.adminPageTitle}>Vue d&apos;ensemble</h1>
            <p className={styles.adminPageSubtitle}>Toutes les donn&eacute;es de la plateforme</p>
          </div>
        </div>
        <div className={styles.adminStats}>
          {[1, 2, 3, 4, 5].map(i => (
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

  if (!data) return null

  const coaches = data.coaches || []
  const coachesCount = coaches.length
  const churnRate = data.total_subs > 0 ? Math.round((data.canceled_subs / data.total_subs) * 100) : 0
  const avgAthletesPerCoach = coachesCount > 0 ? (data.athletes_count / coachesCount).toFixed(1) : '0'
  const churnColor = churnRate > 20 ? 'Orange' : churnRate > 10 ? 'Blue' : 'Green'

  const sortedCoaches = [...coaches].sort((a, b) => (b.mrr || 0) - (a.mrr || 0))

  return (
    <div className={styles.adminSection}>
      <div className={styles.adminPageHeader}>
        <div>
          <h1 className={styles.adminPageTitle}>Vue d&apos;ensemble</h1>
          <p className={styles.adminPageSubtitle}>Toutes les donn&eacute;es de la plateforme</p>
        </div>
        <button className="btn btn-outline" onClick={fetchData}>
          <i className="fas fa-sync-alt" /> Actualiser
        </button>
      </div>

      <div className={styles.adminWelcome}>
        <div className={styles.adminWelcomeTitle}>Bienvenue, Pierre</div>
        <div className={styles.adminWelcomeSub}>Voici un aper&ccedil;u de votre plateforme</div>
        <div className={styles.adminWelcomeDate}>
          <i className="fas fa-calendar-alt" /> {todayLabel()}
        </div>
      </div>

      <div className={styles.adminStats}>
        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconRed}`}>
              <i className="fas fa-euro-sign" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{formatEur(data.total_mrr)}</div>
          <div className={styles.adminStatLabel}>MRR Total</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconBlue}`}>
              <i className="fas fa-user-tie" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{coachesCount}</div>
          <div className={styles.adminStatLabel}>Coachs</div>
          <div className={styles.adminStatSub}>{avgAthletesPerCoach} athl&egrave;tes/coach en moy.</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconOrange}`}>
              <i className="fas fa-users" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{data.athletes_count}</div>
          <div className={styles.adminStatLabel}>Athl&egrave;tes</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconGreen}`}>
              <i className="fas fa-credit-card" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{data.active_subs}</div>
          <div className={styles.adminStatLabel}>Abo. actifs</div>
          <div className={styles.adminStatSub}>
            {data.canceled_subs} annul&eacute;{data.canceled_subs > 1 ? 's' : ''}
          </div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles[`adminStatIcon${churnColor}` as keyof typeof styles]}`}>
              <i className="fas fa-chart-line" />
            </div>
          </div>
          <div className={styles.adminStatValue}>
            {churnRate}<span style={{ fontSize: 16, fontWeight: 600 }}>%</span>
          </div>
          <div className={styles.adminStatLabel}>Churn</div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className={styles.adminCard}>
        <div className={styles.adminCardHeader}>
          <div className={styles.adminCardTitle}>
            <i className="fas fa-bolt" /> Derniers paiements
          </div>
          <span className={styles.adminCardBadge}>{(data.recent_payments || []).length}</span>
        </div>
        <div className={styles.adminCardBody} style={{ maxHeight: 250, overflowY: 'auto', padding: '8px 16px' }}>
          {data.recent_payments && data.recent_payments.length > 0 ? (
            data.recent_payments.slice(0, 10).map((p, i) => (
              <div key={i} className={styles.adminActivityItem}>
                <div className={`${styles.adminActivityDot} ${p.status === 'paid' ? styles.adminActivityDotPayment : styles.adminActivityDotCancel}`} />
                <div className={styles.adminActivityText}>
                  <strong>{formatEur(p.amount || 0)}</strong>
                </div>
                <div className={styles.adminActivityTime}>{timeAgo(p.created_at)}</div>
              </div>
            ))
          ) : (
            <div className={styles.adminEmpty} style={{ padding: 20 }}>
              <i className="fas fa-inbox" />Aucun paiement
            </div>
          )}
        </div>
      </div>

      {/* Coach Table */}
      <div className={styles.adminCard}>
        <div className={styles.adminCardHeader}>
          <div className={styles.adminCardTitle}>
            <i className="fas fa-user-tie" /> Coachs enregistr&eacute;s
          </div>
          <span className={styles.adminCardBadge}>{coachesCount}</span>
        </div>
        <div className={styles.adminCardBodyNoPad}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>Coach</th>
                <th>Inscrit le</th>
                <th>Athl&egrave;tes</th>
                <th>MRR</th>
                <th>Derni&egrave;re connexion</th>
              </tr>
            </thead>
            <tbody>
              {sortedCoaches.map((c) => {
                const initials = (c.email || '').substring(0, 2).toUpperCase()
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className={styles.adminCoachAvatar}>{initials}</div>
                        <div className={styles.adminCoachEmail}>{c.email}</div>
                      </div>
                    </td>
                    <td className={styles.adminCoachDate}>{adminFormatDate(c.created_at)}</td>
                    <td><strong>{c.athletes_count}</strong></td>
                    <td className={styles.adminCoachMrr}>
                      {c.mrr > 0 ? formatEur(c.mrr) : <span style={{ color: 'var(--text3)' }}>&mdash;</span>}
                    </td>
                    <td className={styles.adminCoachDate}>{timeAgo(c.last_sign_in_at)}</td>
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
