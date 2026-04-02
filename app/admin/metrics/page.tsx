'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '@/styles/admin.module.css'

interface MetricsData {
  programs: number
  reports: number
  videos: number
  nutrition_plans: number
  formations: number
  questionnaires: number
}

const METRIC_ITEMS = [
  { key: 'programs' as const, icon: 'fa-dumbbell', label: 'Programmes', color: '#B30808' },
  { key: 'reports' as const, icon: 'fa-clipboard-check', label: 'Bilans remplis', color: '#22c55e' },
  { key: 'videos' as const, icon: 'fa-video', label: 'Vid\u00e9os', color: '#3b82f6' },
  { key: 'nutrition_plans' as const, icon: 'fa-utensils', label: 'Plans nutrition', color: '#f59e0b' },
  { key: 'formations' as const, icon: 'fa-graduation-cap', label: 'Formations', color: '#8b5cf6' },
  { key: 'questionnaires' as const, icon: 'fa-question-circle', label: 'Questionnaires', color: '#ec4899' },
]

export default function AdminMetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: result, error: rpcError } = await supabase.rpc('admin_metrics')
      if (rpcError) throw new Error(rpcError.message)
      setData(result as MetricsData)
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
            <h1 className={styles.adminPageTitle}>M&eacute;triques Produit</h1>
            <p className={styles.adminPageSubtitle}>Usage des fonctionnalit&eacute;s</p>
          </div>
        </div>
        <div className={styles.adminMetricsGrid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ height: 160 }} />
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

  if (!data) return null

  const maxVal = Math.max(
    data.programs, data.reports, data.videos,
    data.nutrition_plans, data.formations, data.questionnaires, 1
  )

  const totalItems = METRIC_ITEMS.reduce((s, item) => s + (data[item.key] || 0), 0)

  return (
    <div className={styles.adminSection}>
      <div className={styles.adminPageHeader}>
        <div>
          <h1 className={styles.adminPageTitle}>M&eacute;triques Produit</h1>
          <p className={styles.adminPageSubtitle}>Usage des fonctionnalit&eacute;s</p>
        </div>
      </div>

      <div className={styles.adminCard}>
        <div className={styles.adminCardHeader}>
          <div className={styles.adminCardTitle}>
            <i className="fas fa-chart-bar" /> Usage des fonctionnalit&eacute;s
          </div>
          <span className={styles.adminCardBadge}>{totalItems.toLocaleString('fr-FR')} total</span>
        </div>
        <div className={styles.adminCardBody}>
          <div className={styles.adminMetricsGrid}>
            {METRIC_ITEMS.map((item) => {
              const value = data[item.key] || 0
              const pct = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0
              return (
                <div key={item.key} className={styles.adminMetricItem}>
                  <div className={styles.adminMetricIcon}>
                    <i className={`fas ${item.icon}`} style={{ color: item.color }} />
                  </div>
                  <div className={styles.adminMetricValue}>
                    {value.toLocaleString('fr-FR')}
                  </div>
                  <div className={styles.adminMetricLabel}>{item.label}</div>
                  <div className={styles.adminMetricBar}>
                    <div
                      className={styles.adminMetricBarFill}
                      style={{ width: `${pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
