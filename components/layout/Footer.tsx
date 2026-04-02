import Link from 'next/link'
import styles from '@/styles/landing.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <a href="#" className={styles.footerBrand}>
          <span className={styles.logoIcon}>M</span>
          Momentum
        </a>
        <ul className={styles.footerLinks}>
          <li><a href="#fonctionnalites">Fonctionnalites</a></li>
          <li><a href="#tarifs">Tarifs</a></li>
          <li><a href="#contact">Contact</a></li>
          <li><Link href="/privacy">Confidentialite</Link></li>
          <li><Link href="/login">Se connecter</Link></li>
        </ul>
        <div className={styles.footerCopy}>
          &copy; 2026 Momentum. Tous droits reserves.
        </div>
      </div>
    </footer>
  )
}
