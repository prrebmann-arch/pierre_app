'use client'

import { useState, FormEvent } from 'react'
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
