import styles from '@/styles/landing.module.css'

export default function SocialProof() {
  return (
    <div className={styles.socialProof}>
      <div className={styles.socialProofInner}>
        <div className={styles.socialProofLabel}>
          <i className="fas fa-chart-simple"></i> En chiffres
        </div>
        <h2>La confiance de centaines de coachs</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>500+</div>
            <div className={styles.statLabel}>Athletes accompagnes</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>50+</div>
            <div className={styles.statLabel}>Coachs actifs</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>98%</div>
            <div className={styles.statLabel}>Taux de satisfaction</div>
          </div>
        </div>
      </div>
    </div>
  )
}
