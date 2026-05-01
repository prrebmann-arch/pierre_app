'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useAthleteContext } from '@/contexts/AthleteContext'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athletes.module.css'

const TABS = [
  { label: 'Apercu', route: 'apercu', icon: 'fa-eye' },
  { label: 'Infos', route: 'infos', icon: 'fa-id-card' },
  { label: 'Entr.', route: 'training', icon: 'fa-dumbbell' },
  { label: 'Nutrition', route: 'nutrition', icon: 'fa-utensils' },
  { label: 'Roadmap', route: 'roadmap', icon: 'fa-route' },
  { label: 'Bilans', route: 'bilans', icon: 'fa-clipboard-check' },
  { label: 'Videos', route: 'videos', icon: 'fa-video' },
  { label: 'Retours', route: 'retours', icon: 'fa-comments' },
  { label: 'Posing', route: 'posing', icon: 'fa-person' },
  { label: 'Quest.', route: 'questionnaires', icon: 'fa-clipboard-list' },
  { label: 'Suppl.', route: 'supplements', icon: 'fa-capsules' },
  { label: 'Routine', route: 'routine', icon: 'fa-sun' },
  { label: 'Menstr.', route: 'menstrual', icon: 'fa-calendar-days' },
  { label: 'Sang', route: 'bloodtest', icon: 'fa-droplet' },
]

export default function AthleteDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const { athletes, loading, setSelectedAthleteId, selectedAthlete } = useAthleteContext()

  const athleteId = params.id
  const athlete = athletes.find((a) => a.id === athleteId) ?? selectedAthlete

  useEffect(() => {
    if (athleteId) {
      setSelectedAthleteId(athleteId)
    }
    return () => setSelectedAthleteId(null)
  }, [athleteId, setSelectedAthleteId])

  const activeTab = TABS.find((t) => pathname.endsWith(`/${t.route}`))?.route || 'apercu'

  const initials = athlete
    ? (athlete.prenom?.charAt(0) || '') + (athlete.nom?.charAt(0) || '')
    : ''

  return (
    <div>
      {/* Header: back + avatar + name */}
      <div className={styles.detailHeader}>
        <Link
          href="/athletes"
          className={styles.backBtn}
          title="Retour aux athlètes"
        >
          <i className="fa-solid fa-arrow-left" />
        </Link>

        {loading ? (
          <Skeleton width={48} height={48} />
        ) : athlete?.avatar_url ? (
          <img src={athlete.avatar_url} alt="" className={styles.detailAvatar} />
        ) : (
          <div className={styles.detailAvatarFallback}>{initials}</div>
        )}

        <div className={styles.detailName}>
          {loading ? (
            <Skeleton width={180} height={22} />
          ) : athlete ? (
            `${athlete.prenom} ${athlete.nom}`
          ) : (
            'Athlete'
          )}
        </div>
      </div>

      {/* Tab bar */}
      <nav className={styles.athleteTabs}>
        {TABS.map((tab, i) => (
          <span key={tab.route} style={{ display: 'contents' }}>
            {i > 0 && <span className={styles.tabSep} />}
            <Link
              href={`/athletes/${athleteId}/${tab.route}`}
              className={`${styles.athleteTabBtn} ${activeTab === tab.route ? styles.athleteTabActive : ''}`}
            >
              <i className={`fa-solid ${tab.icon}`} style={{ fontSize: 12 }} />
              {tab.label}
            </Link>
          </span>
        ))}
      </nav>

      {children}
    </div>
  )
}
