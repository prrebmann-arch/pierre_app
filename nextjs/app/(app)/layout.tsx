'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AthleteProvider } from '@/contexts/AthleteContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import styles from '@/styles/sidebar.module.css'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) return <div>Chargement...</div>
  if (!user) return null

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
