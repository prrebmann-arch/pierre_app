'use client'

import { useEffect, useRef } from 'react'
import styles from '@/styles/dashboard.module.css'

interface StatCardData {
  id: string
  value: number | string
  label: string
  icon: string
  iconColor: string
  iconBg: string
  stripeGradient: string
}

function animateCounter(el: HTMLElement, target: number, duration = 800) {
  if (!el || isNaN(target)) return
  const start = 0
  const startTime = performance.now()
  function tick(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    el.textContent = String(Math.round(start + (target - start) * eased))
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

interface StatsCardsProps {
  stats: StatCardData[]
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const refs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    stats.forEach(s => {
      const el = refs.current.get(s.id)
      if (!el) return
      if (typeof s.value === 'string') {
        el.textContent = s.value
      } else {
        animateCounter(el, s.value)
      }
    })
  }, [stats])

  return (
    <div className={styles.statsGrid}>
      {stats.map(s => (
        <div key={s.id} className={styles.statCard}>
          <div
            className={styles.statCardStripe}
            style={{ background: s.stripeGradient }}
          />
          <div className={styles.statCardInner}>
            <div
              className={styles.statIcon}
              style={{ background: s.iconBg, color: s.iconColor }}
            >
              <i className={`fas ${s.icon}`} />
            </div>
            <div>
              <div
                className={styles.statValue}
                ref={el => { if (el) refs.current.set(s.id, el) }}
              >
                0
              </div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export type { StatCardData }
