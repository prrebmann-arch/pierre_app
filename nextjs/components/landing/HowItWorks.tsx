import styles from '@/styles/landing.module.css'

export default function HowItWorks() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLabel}>
          <i className="fas fa-route"></i> Comment ca marche
        </div>
        <h2 className={styles.sectionTitle}>Demarrez en 3 etapes simples</h2>
        <p className={styles.sectionDesc}>
          Pas besoin de competences techniques. Tout est pret en quelques minutes.
        </p>
      </div>
      <div className={styles.stepsContainer}>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>1</div>
          <h3>Creez votre compte</h3>
          <p>Inscrivez-vous en quelques secondes et configurez votre profil de coach.</p>
        </div>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>2</div>
          <h3>Ajoutez vos athletes</h3>
          <p>Invitez vos athletes via un lien unique. Ils telechargeront l&apos;app mobile.</p>
        </div>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>3</div>
          <h3>Gerez tout depuis un seul endroit</h3>
          <p>Programmes, nutrition, bilans, videos — tout est centralise dans votre dashboard.</p>
        </div>
      </div>
    </section>
  )
}
