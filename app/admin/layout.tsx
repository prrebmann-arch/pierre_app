'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AdminSidebar from '@/components/layout/AdminSidebar'
import styles from '@/styles/admin.module.css'

const ADMIN_EMAIL = 'rebmannpierre1@gmail.com'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className={styles.adminLayout}>
        <div className={styles.adminMain} style={{ marginLeft: 0 }}>
          <div style={{ textAlign: 'center', padding: '80px' }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--primary)' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return null
  }

  return (
    <div className={styles.adminLayout}>
      <AdminSidebar />
      <main className={styles.adminMain}>
        {children}
      </main>
    </div>
  )
}
