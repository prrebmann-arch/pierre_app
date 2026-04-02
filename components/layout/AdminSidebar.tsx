'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import styles from '@/styles/admin.module.css'

const NAV_ITEMS = [
  { href: '/admin', label: 'Vue d\'ensemble', icon: 'fa-chart-pie' },
  { href: '/admin/coaches', label: 'Coachs', icon: 'fa-user-tie' },
  { href: '/admin/athletes', label: 'Athl\u00e8tes', icon: 'fa-running' },
  { href: '/admin/payments', label: 'Paiements', icon: 'fa-credit-card' },
  { href: '/admin/metrics', label: 'M\u00e9triques', icon: 'fa-chart-bar' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <aside className={styles.adminSidebar}>
      <div className={styles.adminSidebarHeader}>
        <div className={styles.adminSidebarBrand}>
          <div className={styles.adminBrandIcon}>M</div>
          <div>
            <div className={styles.adminBrandText}>Momentum</div>
            <div className={styles.adminBrandSub}>Admin</div>
          </div>
        </div>
      </div>

      <nav className={styles.adminSidebarNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.adminNavItem} ${isActive ? styles.adminNavItemActive : ''}`}
            >
              <i className={`fas ${item.icon}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className={styles.adminSidebarFooter}>
        <button className={styles.btnLogout} onClick={handleLogout}>
          <i className="fas fa-sign-out-alt" /> D&eacute;connexion
        </button>
      </div>
    </aside>
  )
}
