'use client'

import Link from 'next/link'
import styles from '@/styles/landing.module.css'

export default function Pricing() {
  return (
    <section className={styles.section} id="tarifs">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLabel}>
          <i className="fas fa-tag"></i> Tarifs
        </div>
        <h2 className={styles.sectionTitle}>Des tarifs simples et transparents</h2>
        <p className={styles.sectionDesc}>
          Choisissez le plan qui correspond a vos besoins. Sans engagement, annulez a tout moment.
        </p>
      </div>
      <div className={styles.pricingGrid}>
        {/* Plan Athlete */}
        <div className={styles.pricingCard}>
          <div className={styles.pricingCardInner}>
            <div className={styles.pricingCardLeft}>
              <div className={styles.pricingName}>Athlete</div>
              <div className={styles.pricingDesc}>
                L&apos;essentiel pour suivre et accompagner vos athletes au quotidien.
              </div>
              <div className={styles.pricingPrice}>
                <span className={styles.pricingAmount}>5</span>
                <span className={styles.pricingCurrency}>&euro;</span>
              </div>
              <div className={styles.pricingPeriod}>/mois par athlete</div>
              <Link href="/login?tab=register" className={styles.btnSecondary}>
                Commencer l&apos;essai gratuit
              </Link>
            </div>
            <div className={styles.pricingCardRight}>
              <ul className={styles.pricingFeatures}>
                <li><i className="fas fa-check"></i> App mobile athlete</li>
                <li><i className="fas fa-check"></i> Programmes d&apos;entrainement</li>
                <li><i className="fas fa-check"></i> Plans nutrition</li>
                <li><i className="fas fa-check"></i> Bilans quotidiens</li>
                <li><i className="fas fa-check"></i> Retours video</li>
                <li><i className="fas fa-check"></i> Notifications temps reel</li>
              </ul>
            </div>
          </div>
        </div>

        {/* VS Separator */}
        <div className={styles.pricingVs}>
          <div className={styles.pricingVsLine}></div>
          <div className={styles.pricingVsBadge}>
            <i className="fas fa-rocket"></i> Passez au niveau superieur
          </div>
          <div className={styles.pricingVsLine}></div>
        </div>

        {/* Plan Business */}
        <div className={`${styles.pricingCard} ${styles.featured}`}>
          <div className={styles.businessTop}>
            <div className={styles.businessLeft}>
              <div className={styles.pricingPopular}>
                <i className="fas fa-star"></i> Recommande
              </div>
              <div className={styles.pricingName}>Business</div>
              <div className={styles.pricingDesc}>
                Tout ce qu&apos;il faut pour developper votre activite de coaching en ligne. Instagram, analytics, leads, automatisation — le package complet.
              </div>
              <div className={styles.pricingPrice}>
                <span className={styles.pricingAmount}>60</span>
                <span className={styles.pricingCurrency}>&euro;</span>
              </div>
              <div className={styles.pricingPeriod}>/mois + 5&euro;/mois par athlete</div>
              <Link href="/login?tab=register" className={styles.btnPrimary}>
                Demarrer maintenant
              </Link>
            </div>
            <div className={styles.businessRight}>
              <ul className={styles.pricingFeatures}>
                <li><i className="fas fa-check"></i> Tout du plan Athlete (illimite)</li>
                <li><i className="fas fa-check"></i> Integration Instagram complete</li>
                <li><i className="fas fa-check"></i> Analytics &amp; tableaux de bord avances</li>
                <li><i className="fas fa-check"></i> Gestion &amp; conversion des leads</li>
                <li><i className="fas fa-check"></i> Messagerie automatisee</li>
                <li><i className="fas fa-check"></i> Planification de contenu</li>
                <li><i className="fas fa-check"></i> Support prioritaire 7j/7</li>
              </ul>
            </div>
          </div>
          <div className={styles.businessBottom}>
            <div className={styles.businessHighlights}>
              <div className={styles.businessHighlight}>
                <div className={styles.businessHighlightIcon}><i className="fab fa-instagram"></i></div>
                <div>
                  <h4>Instagram integre</h4>
                  <p>DM automatiques, sync stories, reponses rapides — gerez tout depuis l&apos;app.</p>
                </div>
              </div>
              <div className={styles.businessHighlight}>
                <div className={styles.businessHighlightIcon}><i className="fas fa-funnel-dollar"></i></div>
                <div>
                  <h4>Pipeline de leads</h4>
                  <p>Suivez chaque prospect du premier contact jusqu&apos;a la conversion en client.</p>
                </div>
              </div>
              <div className={styles.businessHighlight}>
                <div className={styles.businessHighlightIcon}><i className="fas fa-chart-line"></i></div>
                <div>
                  <h4>Analytics avances</h4>
                  <p>Chiffre d&apos;affaires, retention, engagement — tout en temps reel sur votre dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
