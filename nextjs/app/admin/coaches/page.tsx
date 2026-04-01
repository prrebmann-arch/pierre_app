'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatEur, adminFormatDate, timeAgo } from '@/lib/admin-helpers'
import styles from '@/styles/admin.module.css'

interface Coach {
  id: string
  email: string
  created_at: string
  athletes_count: number
  mrr: number
  last_sign_in_at: string | null
  banned_until: string | null
  athletes: Array<{ prenom: string; nom: string }>
}

interface CoachProfile {
  user_id: string
  plan: string
  is_blocked: boolean
}

export default function AdminCoachesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, CoachProfile>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: coachData, error: rpcError } = await supabase.rpc('admin_coaches')
      if (rpcError) throw new Error(rpcError.message)

      const { data: profiles } = await supabase
        .from('coach_profiles')
        .select('user_id, plan, is_blocked')

      const map: Record<string, CoachProfile> = {}
      ;(profiles || []).forEach((p: CoachProfile) => { map[p.user_id] = p })

      setCoaches((coachData as Coach[]) || [])
      setProfileMap(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredCoaches = coaches.filter(c =>
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className={styles.adminSection}>
        <div className={styles.adminPageHeader}>
          <div>
            <h1 className={styles.adminPageTitle}>Gestion des Coachs</h1>
            <p className={styles.adminPageSubtitle}>Tous les comptes coach de la plateforme</p>
          </div>
        </div>
        <div className={styles.adminCoachGrid}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ height: 200 }} />
          ))}
        </div>
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
          <h1 className={styles.adminPageTitle}>Gestion des Coachs</h1>
          <p className={styles.adminPageSubtitle}>Tous les comptes coach de la plateforme</p>
        </div>
        <div className={styles.adminSearchWrap}>
          <i className="fas fa-search" />
          <input
            type="text"
            className={styles.adminSearch}
            placeholder="Rechercher un coach..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredCoaches.length === 0 ? (
        <div className={styles.adminEmpty}>
          <i className="fas fa-user-slash" />
          Aucun coach trouv&eacute;
        </div>
      ) : (
        <div className={styles.adminCoachGrid}>
          {filteredCoaches.map((c) => {
            const initials = (c.email || '').substring(0, 2).toUpperCase()
            const lastSeen = timeAgo(c.last_sign_in_at)
            const banned = c.banned_until && new Date(c.banned_until) > new Date()
            const profile = profileMap[c.id] || {} as CoachProfile
            const plan = profile.plan || 'athlete'
            const athletes = c.athletes || []

            let planBadgeClass = styles.adminBadge
            let planLabel = 'Athl\u00e8te'
            let planStyle: React.CSSProperties = { background: '#f59e0b22', color: '#f59e0b' }
            if (plan === 'free') {
              planLabel = 'Gratuit'
              planStyle = { background: '#22c55e22', color: '#22c55e' }
            } else if (plan === 'business') {
              planLabel = 'Business'
              planStyle = { background: '#6366f122', color: '#6366f1' }
            }

            return (
              <div key={c.id} className={styles.adminCoachCard}>
                <div className={styles.adminCoachCardHead}>
                  <div className={styles.adminCoachAvatar}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.adminCoachCardName}>{c.email}</div>
                    <div className={styles.adminCoachCardSub}>
                      Inscrit {adminFormatDate(c.created_at)} &middot; Vu {lastSeen}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <span className={planBadgeClass} style={planStyle}>{planLabel}</span>
                    {banned || profile.is_blocked ? (
                      <span className={`${styles.adminBadge} ${styles.adminBadgeCanceled}`}>Bloqu&eacute;</span>
                    ) : (
                      <span className={`${styles.adminBadge} ${styles.adminBadgeActive}`}>Actif</span>
                    )}
                  </div>
                </div>
                <div className={styles.adminCoachCardStats}>
                  <div className={styles.adminCoachCardStat}>
                    <div className={styles.adminCoachCardStatVal}>{c.athletes_count}</div>
                    <div className={styles.adminCoachCardStatLbl}>Athl&egrave;tes</div>
                  </div>
                  <div className={styles.adminCoachCardStat}>
                    <div className={styles.adminCoachCardStatVal} style={{ color: 'var(--success)' }}>
                      {c.mrr > 0 ? formatEur(c.mrr) : '\u2014'}
                    </div>
                    <div className={styles.adminCoachCardStatLbl}>MRR</div>
                  </div>
                  <div className={styles.adminCoachCardStat}>
                    <div className={styles.adminCoachCardStatVal}>{lastSeen}</div>
                    <div className={styles.adminCoachCardStatLbl}>Vu</div>
                  </div>
                </div>
                {athletes.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>
                      ATHL&Egrave;TES
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {athletes.map((a, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11,
                            background: 'var(--tint)',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            color: 'var(--text2)',
                          }}
                        >
                          {a.prenom} {a.nom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
