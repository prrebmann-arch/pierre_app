'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import HeroParticles from './HeroParticles'
import styles from '@/styles/landing.module.css'

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const orb1Ref = useRef<HTMLDivElement>(null)
  const orb2Ref = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Fade-in observer
    const fadeEls = heroRef.current?.querySelectorAll(`.${styles.fadeIn}`)
    if (fadeEls) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add(styles.fadeInVisible)
              obs.unobserve(e.target)
            }
          })
        },
        { threshold: 0.1 }
      )
      fadeEls.forEach((el) => obs.observe(el))
      return () => obs.disconnect()
    }
  }, [])

  useEffect(() => {
    // Parallax on scroll
    const handleScroll = () => {
      const scrollY = window.scrollY
      const hero = heroRef.current
      if (!hero) return
      const heroH = hero.offsetHeight

      if (scrollY < heroH) {
        const ratio = scrollY / heroH
        if (contentRef.current) {
          contentRef.current.style.transform = `translateY(${scrollY * 0.4}px)`
          contentRef.current.style.opacity = String(Math.max(0, 1 - ratio * 2))
        }
        if (orb1Ref.current) {
          orb1Ref.current.style.transform = `translate(${scrollY * 0.12}px, ${scrollY * -0.25}px)`
        }
        if (orb2Ref.current) {
          orb2Ref.current.style.transform = `translate(${scrollY * -0.18}px, ${scrollY * -0.15}px)`
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section className={styles.hero} ref={heroRef}>
      <HeroParticles />
      <div className={styles.heroGradient}></div>
      <div className={styles.heroGrid}></div>
      <div ref={orb1Ref} className={`${styles.heroOrb} ${styles.heroOrb1}`}></div>
      <div ref={orb2Ref} className={`${styles.heroOrb} ${styles.heroOrb2}`}></div>
      <div className={styles.heroContent} ref={contentRef}>
        <div className={`${styles.heroBadge} ${styles.fadeIn}`}>
          <i className="fas fa-bolt"></i>
          Plateforme tout-en-un pour coachs sportifs
        </div>
        <h1 className={`${styles.heroTitle} ${styles.fadeIn} ${styles.fadeInDelay1}`}>
          Revolutionnez votre<br /><span className={styles.highlight}>coaching sportif</span>
        </h1>
        <p className={`${styles.heroSubtitle} ${styles.fadeIn} ${styles.fadeInDelay2}`}>
          Gerez vos athletes, creez des programmes personnalises, suivez leur progression et communiquez en temps reel — le tout depuis une seule plateforme.
        </p>
        <div className={`${styles.heroButtons} ${styles.fadeIn} ${styles.fadeInDelay3}`}>
          <Link href="/login?tab=register" className={`${styles.btnPrimary} ${styles.btnLg}`}>
            Commencer gratuitement <i className="fas fa-arrow-right"></i>
          </Link>
          <a href="#fonctionnalites" className={`${styles.btnSecondary} ${styles.btnLg}`}>
            <i className="fas fa-play"></i> Decouvrir
          </a>
        </div>
        <div className={`${styles.heroStats} ${styles.fadeIn} ${styles.fadeInDelay4}`}>
          <div className={styles.heroStat}>
            <div className={styles.heroStatValue}>14 jours</div>
            <div className={styles.heroStatLabel}>Essai gratuit</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatValue}>2 min</div>
            <div className={styles.heroStatLabel}>Pour demarrer</div>
          </div>
          <div className={styles.heroStat}>
            <div className={styles.heroStatValue}>0 &euro;</div>
            <div className={styles.heroStatLabel}>Sans engagement</div>
          </div>
        </div>
      </div>
    </section>
  )
}
