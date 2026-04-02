'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from '@/styles/landing.module.css'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const closeMobileMenu = () => setMobileOpen(false)

  return (
    <>
      <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.navbarInner}>
          <a href="#" className={styles.navbarLogo}>
            <span className={styles.logoIcon}>M</span>
            Momentum
          </a>
          <ul className={styles.navbarLinks}>
            <li><a href="#fonctionnalites">Fonctionnalites</a></li>
            <li><a href="#tarifs">Tarifs</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <div className={styles.navbarActions}>
            <Link href="/login" className={styles.btnLogin}>Se connecter</Link>
            <Link href="/login?tab=register" className={styles.btnPrimary}>
              Commencer <i className="fas fa-arrow-right"></i>
            </Link>
          </div>
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
        </div>
      </nav>

      <div className={`${styles.mobileMenu} ${mobileOpen ? styles.mobileMenuOpen : ''}`}>
        <a href="#fonctionnalites" onClick={closeMobileMenu}>Fonctionnalites</a>
        <a href="#tarifs" onClick={closeMobileMenu}>Tarifs</a>
        <a href="#contact" onClick={closeMobileMenu}>Contact</a>
        <Link href="/login" onClick={closeMobileMenu}>Se connecter</Link>
        <Link href="/login?tab=register" className={styles.btnPrimary} onClick={closeMobileMenu}>
          Commencer <i className="fas fa-arrow-right"></i>
        </Link>
      </div>
    </>
  )
}
