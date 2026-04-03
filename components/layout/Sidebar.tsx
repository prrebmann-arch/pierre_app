'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useAuth } from '@/contexts/AuthContext'
import styles from '@/styles/sidebar.module.css'

interface NavItem {
  label: string
  icon: string
  route: string
}

const navGroups: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Dashboard', icon: 'fa-chart-line', route: '/dashboard' },
      { label: 'Athlètes', icon: 'fa-users', route: '/athletes' },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { label: 'Bilans', icon: 'fa-clipboard-check', route: '/bilans' },
      { label: 'Vidéos', icon: 'fa-video', route: '/videos' },
    ],
  },
  {
    label: 'Outils',
    items: [
      { label: 'Templates', icon: 'fa-copy', route: '/templates' },
      { label: 'Aliments', icon: 'fa-utensils', route: '/aliments' },
      { label: 'Exercices', icon: 'fa-dumbbell', route: '/exercices' },
      { label: 'Formations', icon: 'fa-graduation-cap', route: '/formations' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Business', icon: 'fa-briefcase', route: '/business' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  const isActive = (route: string) => {
    if (route === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(route)
  }

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/')
  }, [signOut, router])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? 'C'
  const userName = user?.email?.split('@')[0] ?? 'Coach'

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarBrand}>
          <div className={styles.brandIcon}>M</div>
          <span className={styles.brandText}>Momentum</span>
        </div>
      </div>

      <nav className={styles.sidebarNav}>
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className={styles.navLabel}>{group.label}</div>
            )}
            {group.items.map((item) => (
              <Link
                key={item.route}
                href={item.route}
                className={isActive(item.route) ? styles.navItemActive : styles.navItem}
              >
                <i className={`fas ${item.icon}`} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarUser}>
          <div
            className={styles.userAvatar}
            onClick={() => router.push('/profile')}
            title="Mon profil"
          >
            {userInitial}
          </div>
          <div
            className={styles.userInfo}
            onClick={() => router.push('/profile')}
            title="Mon profil"
          >
            <div className={styles.userName}>{userName}</div>
          </div>
          <button
            className={styles.footerBtn}
            onClick={toggleTheme}
            title="Mode jour / nuit"
          >
            <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} />
          </button>
          <button
            className={styles.footerBtn}
            onClick={handleLogout}
            title="Se déconnecter"
          >
            <i className="fas fa-sign-out-alt" />
          </button>
        </div>
      </div>
    </div>
  )
}
