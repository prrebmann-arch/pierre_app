'use client'

import { useEffect, useRef } from 'react'
import styles from '@/styles/landing.module.css'

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    // Fade-in observer
    const fadeEls = section.querySelectorAll(`.${styles.fadeIn}`)
    const fadeObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.fadeInVisible)
            fadeObs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    fadeEls.forEach((el) => fadeObs.observe(el))

    // Scroll reveal for bento cards
    const revealEls = section.querySelectorAll(`.${styles.bentoCard}`)
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.scrollRevealed)
            revealObs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    )
    revealEls.forEach((el) => {
      el.classList.add(styles.scrollReveal)
      revealObs.observe(el)
    })

    return () => {
      fadeObs.disconnect()
      revealObs.disconnect()
    }
  }, [])

  return (
    <section className={styles.section} id="fonctionnalites" ref={sectionRef}>
      <div className={styles.sectionHeader}>
        <div className={`${styles.sectionLabel} ${styles.fadeIn}`}>
          <i className="fas fa-sparkles"></i> Fonctionnalites
        </div>
        <h2 className={`${styles.sectionTitle} ${styles.fadeIn} ${styles.fadeInDelay1}`}>
          Tout ce dont vous avez besoin
        </h2>
        <p className={`${styles.sectionDesc} ${styles.fadeIn} ${styles.fadeInDelay2}`}>
          Une plateforme complete pour gerer, suivre et developper votre activite de coaching.
        </p>
      </div>

      <div className={`${styles.bento} ${styles.fadeIn}`}>
        {/* ROW 1 : Dashboard (large) + Athletes (medium) */}
        <div className={`${styles.bentoCard} ${styles.bentoLg} ${styles.bentoGlowRed}`}>
          <div className={styles.bentoContent}>
            <div className={styles.bentoIcon}><i className="fas fa-chart-line"></i></div>
            <h3>Dashboard complet</h3>
            <p>Bilans a traiter, videos en attente, progression de vos athletes — tout en un coup d&apos;oeil.</p>
          </div>
          <div className={`${styles.bentoVisual} ${styles.bentoVisualDashboard}`}>
            <div className={styles.bvRow}>
              <div className={styles.bvStat}><span className={styles.bvNum}>24</span><span className={styles.bvLabel}>Athletes</span></div>
              <div className={styles.bvStat}><span className={styles.bvNum}>8</span><span className={styles.bvLabel}>Bilans</span></div>
              <div className={styles.bvStat}><span className={styles.bvNum}>3</span><span className={styles.bvLabel}>Videos</span></div>
            </div>
            <div className={styles.bvBars}>
              <div className={styles.bvBar} style={{ '--h': '40%' } as React.CSSProperties}></div>
              <div className={styles.bvBar} style={{ '--h': '65%' } as React.CSSProperties}></div>
              <div className={styles.bvBar} style={{ '--h': '35%' } as React.CSSProperties}></div>
              <div className={styles.bvBar} style={{ '--h': '85%' } as React.CSSProperties}></div>
              <div className={styles.bvBar} style={{ '--h': '55%' } as React.CSSProperties}></div>
              <div className={styles.bvBar} style={{ '--h': '90%' } as React.CSSProperties}></div>
              <div className={styles.bvBar} style={{ '--h': '70%' } as React.CSSProperties}></div>
            </div>
          </div>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoMd} ${styles.bentoGlowBlue}`}>
          <div className={styles.bentoContent}>
            <div className={styles.bentoIcon} style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
              <i className="fas fa-users"></i>
            </div>
            <h3>Gestion athletes</h3>
            <p>Profils, historique, programmes assignes — tout centralise.</p>
          </div>
          <div className={styles.bentoVisualAthletes}>
            <div className={styles.bvAthlete}>
              <div className={styles.bvAv} style={{ background: '#B30808' }}>T</div>
              <div className={styles.bvAthleteInfo}><strong>Thomas D.</strong><small>Musculation</small></div>
              <i className="fas fa-check-circle" style={{ color: '#22c55e' }}></i>
            </div>
            <div className={styles.bvAthlete}>
              <div className={styles.bvAv} style={{ background: '#3b82f6' }}>S</div>
              <div className={styles.bvAthleteInfo}><strong>Sarah M.</strong><small>CrossFit</small></div>
              <i className="fas fa-clock" style={{ color: '#f59e0b' }}></i>
            </div>
            <div className={styles.bvAthlete}>
              <div className={styles.bvAv} style={{ background: '#22c55e' }}>L</div>
              <div className={styles.bvAthleteInfo}><strong>Lucas P.</strong><small>Perte de poids</small></div>
              <i className="fas fa-check-circle" style={{ color: '#22c55e' }}></i>
            </div>
          </div>
        </div>

        {/* ROW 2 : Mobile (medium) + Programmes (small) + Nutrition (small) */}
        <div className={`${styles.bentoCard} ${styles.bentoMd} ${styles.bentoGlowGreen}`}>
          <div className={styles.bentoContent}>
            <div className={styles.bentoIcon} style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              <i className="fas fa-mobile-screen"></i>
            </div>
            <h3>App mobile athlete</h3>
            <p>Vos athletes ont tout dans leur poche.</p>
          </div>
          <div className={styles.bentoVisualPhone}>
            <div className={styles.bvPhone}>
              <div className={styles.bvPhoneHeader}>AthleteFlow</div>
              <div className={styles.bvPhoneItem}><span>Squat</span><span className={styles.bvSets}>4x8 · 80kg</span></div>
              <div className={styles.bvPhoneItem}><span>Dev. couche</span><span className={styles.bvSets}>4x10 · 60kg</span></div>
              <div className={styles.bvPhoneItem}><span>Rowing</span><span className={styles.bvSets}>3x12 · 50kg</span></div>
              <div className={styles.bvPhoneDivider}></div>
              <div className={styles.bvPhoneItem}><span>Sommeil</span><span>8h</span></div>
              <div className={styles.bvPhoneItem}><span>Energie</span><span>9/10</span></div>
            </div>
          </div>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoSm}`}>
          <div className={styles.bentoIcon}><i className="fas fa-dumbbell"></i></div>
          <h3>Programmes</h3>
          <p>Entrainements personnalises avec exercices, series et repetitions.</p>
          <div className={styles.bentoMiniVisual}>
            <div className={styles.bmvLine}></div>
            <div className={styles.bmvLine} style={{ width: '75%' }}></div>
            <div className={styles.bmvLine} style={{ width: '60%' }}></div>
          </div>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoSm}`}>
          <div className={styles.bentoIcon} style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
            <i className="fas fa-utensils"></i>
          </div>
          <h3>Nutrition</h3>
          <p>Plans alimentaires sur mesure adaptes a chaque objectif.</p>
          <div className={styles.bentoMiniVisual}>
            <div className={styles.bmvCircleRow}>
              <div className={styles.bmvCircle} style={{ '--c': '#ef4444', '--p': '35%' } as React.CSSProperties}>P</div>
              <div className={styles.bmvCircle} style={{ '--c': '#3b82f6', '--p': '45%' } as React.CSSProperties}>G</div>
              <div className={styles.bmvCircle} style={{ '--c': '#22c55e', '--p': '20%' } as React.CSSProperties}>L</div>
            </div>
          </div>
        </div>

        {/* ROW 3 : Business/IG (large) + Stacked */}
        <div className={`${styles.bentoCard} ${styles.bentoLg} ${styles.bentoGlowPurple}`}>
          <div className={styles.bentoContent}>
            <div className={styles.bentoIcon} style={{ background: 'linear-gradient(135deg,rgba(131,58,180,0.2),rgba(253,29,29,0.2))', color: '#c084fc' }}>
              <i className="fab fa-instagram"></i>
            </div>
            <h3>Business &amp; Instagram</h3>
            <p>DM automatises, pipeline de leads, planification de contenu, analytics — developpez votre activite.</p>
          </div>
          <div className={styles.bentoVisualIg}>
            <div className={styles.bvDm}>
              <div className={styles.bvDmAv}><i className="fab fa-instagram"></i></div>
              <div className={styles.bvDmInfo}><strong>@fit_lucas</strong><span>Tu proposes du coaching perso ?</span></div>
              <small>2min</small>
            </div>
            <div className={styles.bvDm}>
              <div className={styles.bvDmAv}><i className="fab fa-instagram"></i></div>
              <div className={styles.bvDmInfo}><strong>@marie.sport</strong><span>C&apos;est quoi tes tarifs ?</span></div>
              <small>15min</small>
            </div>
            <div className={styles.bvPipeline}>
              <div className={`${styles.bvPipe} ${styles.bvPipeActive}`}>Lead <b>12</b></div>
              <div className={styles.bvPipeArrow}><i className="fas fa-chevron-right"></i></div>
              <div className={styles.bvPipe}>Contact <b>8</b></div>
              <div className={styles.bvPipeArrow}><i className="fas fa-chevron-right"></i></div>
              <div className={`${styles.bvPipe} ${styles.bvPipeSuccess}`}>Client <b>5</b></div>
            </div>
          </div>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoSm} ${styles.bentoStack}`}>
          <div className={styles.bentoIcon} style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
            <i className="fas fa-clipboard-check"></i>
          </div>
          <h3>Bilans quotidiens</h3>
          <p>Suivi automatise chaque jour.</p>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoSm} ${styles.bentoStack}`}>
          <div className={styles.bentoIcon} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            <i className="fas fa-video"></i>
          </div>
          <h3>Retours video</h3>
          <p>Corrections personnalisees.</p>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoSm} ${styles.bentoStack}`}>
          <div className={styles.bentoIcon} style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
            <i className="fas fa-bell"></i>
          </div>
          <h3>Notifications</h3>
          <p>Push en temps reel.</p>
        </div>

        <div className={`${styles.bentoCard} ${styles.bentoSm} ${styles.bentoStack}`}>
          <div className={styles.bentoIcon} style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
            <i className="fas fa-graduation-cap"></i>
          </div>
          <h3>Formations</h3>
          <p>Contenu educatif en ligne.</p>
        </div>
      </div>
    </section>
  )
}
