'use client'

import Link from 'next/link'
import styles from '@/styles/dashboard.module.css'
import type { Athlete } from '@/lib/types'

interface ActivityItem {
  athlete: Athlete
  date: string
  items: { icon: string; text: string; color: string }[]
  energy?: number | null
  sleep?: string | null
  adherence?: number | null
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return "a l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  maxHeight?: number
}

export default function ActivityFeed({ activities, maxHeight }: ActivityFeedProps) {
  return (
    <div
      className={`${styles.dashCard} ${styles.dashCardActivity}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <div className={styles.dashCardHeader}>
        <span className={styles.dashCardTitle}>
          <i className="fas fa-bolt" /> Activite recente
        </span>
      </div>
      <div className={`${styles.dashCardBody} ${styles.dashActivityScroll}`}>
        {activities.length > 0 ? (
          activities.map((a, i) => {
            const d = new Date(a.date + 'T00:00:00')
            const timeAgo = getTimeAgo(d)
            return (
              <Link
                key={`${a.athlete.id}-${a.date}-${i}`}
                href={`/athletes/${a.athlete.id}/bilans`}
                className={styles.dashActivityItem}
              >
                <div className={styles.dashAvatarSm}>
                  {a.athlete.prenom.charAt(0)}{a.athlete.nom.charAt(0)}
                </div>
                <div className={styles.dashActivityContent}>
                  <span className={styles.dashActivityName}>
                    {a.athlete.prenom} {a.athlete.nom}
                  </span>
                  {a.items.map((it, j) => (
                    <span
                      key={j}
                      className={styles.dashActivityTag}
                      style={{ color: it.color }}
                    >
                      <i className={`fas ${it.icon}`} /> {it.text}
                    </span>
                  ))}
                  <span className={styles.dashActivityTime}>{timeAgo}</span>
                </div>
              </Link>
            )
          })
        ) : (
          <div className={styles.dashEmpty}>Aucune activite recente</div>
        )}
      </div>
    </div>
  )
}

export type { ActivityItem }
