'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatEur } from '@/lib/admin-helpers'
import styles from '@/styles/admin.module.css'

interface PaymentCoach {
  email: string
  display_name: string | null
  plan: string
  athlete_count: number
  total_paid: number
}

interface Invoice {
  coach_name: string | null
  coach_email: string | null
  month: number
  year: number
  total_amount: number
  status: string
}

interface PaymentsData {
  platform_mrr: number
  platform_total_revenue: number
  total_coaches: number
  coaches_with_payment: number
  pending_invoices: number
  coaches: PaymentCoach[]
  recent_invoices: Invoice[]
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: result, error: rpcError } = await supabase.rpc('admin_stripe_overview')
      if (rpcError) throw new Error(rpcError.message)
      setData(result as PaymentsData)
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
            <h1 className={styles.adminPageTitle}>Paiements &amp; Revenus</h1>
            <p className={styles.adminPageSubtitle}>Suivi financier de la plateforme</p>
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

  if (!data) return null

  const paidInvoices = (data.recent_invoices || []).filter(i => i.status === 'paid')

  return (
    <div className={styles.adminSection}>
      <div className={styles.adminPageHeader}>
        <div>
          <h1 className={styles.adminPageTitle}>Paiements &amp; Revenus</h1>
          <p className={styles.adminPageSubtitle}>Suivi financier de la plateforme</p>
        </div>
      </div>

      <div className={styles.adminStats}>
        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconRed}`}>
              <i className="fas fa-sync-alt" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{formatEur(data.platform_mrr || 0)}</div>
          <div className={styles.adminStatLabel}>MRR Plateforme</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconGreen}`}>
              <i className="fas fa-coins" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{formatEur(data.platform_total_revenue || 0)}</div>
          <div className={styles.adminStatLabel}>Revenus totaux</div>
          <div className={styles.adminStatSub}>
            {paidInvoices.length} facture{paidInvoices.length > 1 ? 's' : ''} pay&eacute;e{paidInvoices.length > 1 ? 's' : ''}
          </div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${styles.adminStatIconBlue}`}>
              <i className="fas fa-users" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{data.total_coaches || 0}</div>
          <div className={styles.adminStatLabel}>Coachs</div>
          <div className={styles.adminStatSub}>{data.coaches_with_payment || 0} avec CB</div>
        </div>

        <div className={styles.adminStatCard}>
          <div className={styles.adminStatHeader}>
            <div className={`${styles.adminStatIcon} ${(data.pending_invoices || 0) > 0 ? styles.adminStatIconOrange : styles.adminStatIconGreen}`}>
              <i className="fas fa-exclamation-triangle" />
            </div>
          </div>
          <div className={styles.adminStatValue}>{data.pending_invoices || 0}</div>
          <div className={styles.adminStatLabel}>Impay&eacute;s</div>
        </div>
      </div>

      <div className={styles.adminGrid2}>
        {/* Coaches Table */}
        <div className={styles.adminCard}>
          <div className={styles.adminCardHeader}>
            <div className={styles.adminCardTitle}>
              <i className="fas fa-user-tie" /> Coachs
            </div>
            <span className={styles.adminCardBadge}>{(data.coaches || []).length}</span>
          </div>
          <div className={styles.adminCardBodyNoPad} style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Coach</th>
                  <th>Plan</th>
                  <th>Athl&egrave;tes</th>
                  <th>Pay&eacute;</th>
                </tr>
              </thead>
              <tbody>
                {(data.coaches || []).map((c, i) => {
                  let planBadge: React.ReactNode
                  if (c.plan === 'business') {
                    planBadge = <span className={`${styles.adminBadge} ${styles.adminBadgeActive}`}>Business</span>
                  } else if (c.plan === 'free') {
                    planBadge = <span className={styles.adminBadge} style={{ color: '#22c55e' }}>Gratuit</span>
                  } else {
                    planBadge = <span className={styles.adminBadge}>Athl&egrave;te</span>
                  }
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.display_name || c.email}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.email}</div>
                      </td>
                      <td>{planBadge}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.athlete_count || 0}</td>
                      <td style={{ fontWeight: 600 }}>{formatEur(c.total_paid || 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoices Table */}
        <div className={styles.adminCard}>
          <div className={styles.adminCardHeader}>
            <div className={styles.adminCardTitle}>
              <i className="fas fa-file-invoice" /> Factures r&eacute;centes
            </div>
            <span className={styles.adminCardBadge}>{(data.recent_invoices || []).length}</span>
          </div>
          <div className={styles.adminCardBodyNoPad} style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Coach</th>
                  <th>P&eacute;riode</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {(data.recent_invoices || []).map((inv, i) => {
                  let invStatus: React.ReactNode
                  if (inv.status === 'paid') {
                    invStatus = <span className={`${styles.adminBadge} ${styles.adminBadgeActive}`}>Pay&eacute;</span>
                  } else if (inv.status === 'blocked') {
                    invStatus = <span className={`${styles.adminBadge} ${styles.adminBadgeCanceled}`}>Bloqu&eacute;</span>
                  } else {
                    invStatus = <span className={styles.adminBadge} style={{ color: '#f59e0b' }}>{inv.status}</span>
                  }
                  return (
                    <tr key={i}>
                      <td style={{ fontSize: 13 }}>{inv.coach_name || inv.coach_email || '\u2014'}</td>
                      <td>{inv.month}/{inv.year}</td>
                      <td style={{ fontWeight: 600 }}>{formatEur(inv.total_amount || 0)}</td>
                      <td>{invStatus}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
