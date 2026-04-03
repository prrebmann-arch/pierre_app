'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AthleteProvider } from '@/contexts/AthleteContext'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import styles from '@/styles/sidebar.module.css'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const checkedRef = useRef(false)
  const [timedOut, setTimedOut] = useState(false)

  // Check if returning from external redirect (Stripe, etc.)
  const isReturning = typeof window !== 'undefined' && (
    window.location.search.includes('connect=') ||
    window.location.search.includes('setup=') ||
    window.location.search.includes('payment=')
  )

  // Safety timeout: if loading takes more than 8s, stop waiting
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    const shouldRedirect = !loading || timedOut
    if (!shouldRedirect) return
    if (!user && !isReturning && !checkedRef.current) {
      checkedRef.current = true
      router.push('/login')
    }
  }, [user, loading, timedOut, router, isReturning])

  if (loading && !timedOut) return (
    <div className={styles.appLayout}>
      {/* Sidebar skeleton */}
      <div className={styles.sidebarSkeleton}>
        <div className={styles.skelBrandRow}>
          <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 90, height: 14, borderRadius: 6 }} />
        </div>
        <div className={styles.skelNav}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: '100%', height: 36, borderRadius: 10 }} />
          ))}
        </div>
      </div>
      {/* Content skeleton */}
      <div className={styles.mainContentSkeleton}>
        <div className="skeleton" style={{ width: 220, height: 28, borderRadius: 10, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          ))}
        </div>
        <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 16, marginTop: 24 }} />
      </div>
    </div>
  )
  if (!user && !isReturning) return null

  return (
    <AthleteProvider>
      <div className={styles.appLayout}>
        <Sidebar />
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </AthleteProvider>
  )
}
