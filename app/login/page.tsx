'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type { CoachProfile } from '@/lib/types'
import styles from '@/styles/auth.module.css'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [plan, setPlan] = useState<'athlete' | 'business'>('athlete')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Prefetch all possible post-login destinations for instant navigation
  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/admin')
    router.prefetch('/setup-payment')
  }, [router])

  // Safety timeout: if login takes more than 15s, reset the button
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError('La connexion a pris trop de temps. Veuillez reessayer.')
    }, 15000)
    return () => clearTimeout(timer)
  }, [loading])

  // Safari freezes JS when switching apps — reload on return so pending auth doesn't hang
  const hiddenAtRef = useRef<number | null>(null)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (document.visibilityState === 'visible' && hiddenAtRef.current) {
        const hiddenFor = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null
        if (hiddenFor > 1000) {
          window.location.reload()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const redirect = (email: string, coachProfile: CoachProfile | null) => {
    if (email === 'rebmannpierre1@gmail.com') {
      router.push('/admin')
    } else if (coachProfile && !coachProfile.has_payment_method && coachProfile.plan !== 'free') {
      router.push('/setup-payment')
    } else {
      router.push('/dashboard')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let coachProfile: CoachProfile | null = null
      if (mode === 'login') {
        coachProfile = await signIn(email, password)
      } else {
        coachProfile = await signUp(email, password, plan)
      }
      redirect(email, coachProfile)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.authScreen}>
      <div className={styles.authBox}>
        <div className={styles.authLogo}>
          <div className={styles.authLogoText}>MOMENTUM</div>
          <div className={styles.authSubtitle}>Plateforme Coach</div>
        </div>

        <div className={styles.authTabs}>
          <button
            className={`${styles.authTab} ${mode === 'login' ? styles.authTabActive : ''}`}
            onClick={() => setMode('login')}
            type="button"
          >
            Connexion
          </button>
          <button
            className={`${styles.authTab} ${mode === 'register' ? styles.authTabActive : ''}`}
            onClick={() => setMode('register')}
            type="button"
          >
            Inscription
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              placeholder="coach@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div className={styles.formGroup}>
              <label>Formule</label>
              <div className={styles.planSelector}>
                <button
                  type="button"
                  className={`${styles.planOption} ${plan === 'athlete' ? styles.planOptionActive : ''}`}
                  onClick={() => setPlan('athlete')}
                >
                  Athlete
                </button>
                <button
                  type="button"
                  className={`${styles.planOption} ${plan === 'business' ? styles.planOptionActive : ''}`}
                  onClick={() => setPlan('business')}
                >
                  Business
                </button>
              </div>
            </div>
          )}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading
              ? 'Chargement...'
              : mode === 'login'
                ? 'Se connecter'
                : 'Creer mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
}
