import Link from 'next/link'
import styles from '@/styles/landing.module.css'

export default function FinalCTA() {
  return (
    <section className={styles.finalCta} id="contact">
      <h2>Pret a transformer<br />votre coaching ?</h2>
      <p>
        Rejoignez les coachs qui ont deja modernise leur accompagnement. Essai gratuit de 14 jours, sans carte bancaire.
      </p>
      <div className={styles.finalCtaButtons}>
        <Link href="/login?tab=register" className={`${styles.btnPrimary} ${styles.btnLg}`}>
          Commencer maintenant <i className="fas fa-arrow-right"></i>
        </Link>
        <a href="mailto:contact@pierrecoaching.com" className={`${styles.btnSecondary} ${styles.btnLg}`}>
          <i className="fas fa-envelope"></i> Nous contacter
        </a>
      </div>
    </section>
  )
}
