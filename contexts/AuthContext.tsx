'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, CoachProfile } from '@/lib/types'

const CACHE_KEY_USER = 'coach_cached_user'
const CACHE_KEY_PROFILE = 'coach_profile'

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_USER)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function getCachedCoach(): CoachProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PROFILE)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function hasSupabaseSession(): boolean {
  try {
    // Supabase stores session in localStorage with key containing 'auth-token'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes('auth-token')) {
        const val = localStorage.getItem(key)
        if (val) {
          const parsed = JSON.parse(val)
          // Check token hasn't expired
          if (parsed?.expires_at && parsed.expires_at > Date.now() / 1000) return true
          // Some formats store in a nested structure
          if (parsed?.access_token) return true
        }
      }
    }
  } catch { /* ignore */ }
  return false
}

interface AuthContextType {
  user: User | null
  coach: CoachProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<CoachProfile | null>
  signUp: (email: string, password: string, plan: string) => Promise<CoachProfile | null>
  signOut: () => Promise<void>
  refreshCoach: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from cache synchronously — no network wait
  const cachedUser = useRef(getCachedUser())
  const cachedCoach = useRef(getCachedCoach())
  const hasCachedSession = useRef(cachedUser.current !== null && hasSupabaseSession())

  const [user, setUser] = useState<User | null>(cachedUser.current)
  const [coach, setCoach] = useState<CoachProfile | null>(cachedCoach.current)
  // If we have cached data, loading is already false — UI renders instantly
  const [loading, setLoading] = useState(!hasCachedSession.current)
  const initRef = useRef(false)
  // Prevents onAuthStateChange from interfering during explicit signIn/signUp
  const signingInRef = useRef(false)

  const supabase = createClient()

  const fetchCoach = useCallback(async (userId: string): Promise<CoachProfile | null> => {
    try {
      const { data } = await supabase
        .from('coach_profiles')
        .select('id, user_id, email, display_name, plan, trial_ends_at, has_payment_method, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, avatar_url, bio, specialites, certifications, instagram, site_web, created_at')
        .eq('user_id', userId)
        .single()
      const profile = data as CoachProfile | null
      setCoach(profile)
      // Cache for instant load on next visit
      if (profile) {
        try { localStorage.setItem(CACHE_KEY_PROFILE, JSON.stringify(profile)) } catch { /* quota */ }
      }
      return profile
    } catch (err) {
      // fetchCoach error
      return null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshCoach = useCallback(async () => {
    if (user) await fetchCoach(user.id)
  }, [user, fetchCoach])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const u = { id: session.user.id, email: session.user.email! }
          setUser(u)
          try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
          // Background refresh of coach profile (UI already showing cached data)
          await fetchCoach(session.user.id)
        } else {
          // No valid session — clear cache and state
          setUser(null)
          setCoach(null)
          localStorage.removeItem(CACHE_KEY_USER)
          localStorage.removeItem(CACHE_KEY_PROFILE)
        }
      } catch (err) {
        // init error
      } finally {
        setLoading(false)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Skip if signIn/signUp is handling state updates directly
        if (signingInRef.current) return
        if (session?.user) {
          const u = { id: session.user.id, email: session.user.email! }
          setUser(u)
          try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
          await fetchCoach(session.user.id)
        } else {
          setUser(null)
          setCoach(null)
          localStorage.removeItem(CACHE_KEY_USER)
          localStorage.removeItem(CACHE_KEY_PROFILE)
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<CoachProfile | null> => {
    signingInRef.current = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Check user is not an athlete
      const { data: athleteRow } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (athleteRow) {
        await supabase.auth.signOut()
        throw new Error('Cet espace est reserve aux coachs. Connectez-vous via l\'app athlete.')
      }

      const u = { id: data.user.id, email: data.user.email! }
      setUser(u)
      try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
      const profile = await fetchCoach(data.user.id)
      return profile
    } finally {
      signingInRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCoach])

  const signUp = useCallback(async (email: string, password: string, plan: string): Promise<CoachProfile | null> => {
    signingInRef.current = true
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (!data.user) throw new Error('Erreur lors de la creation du compte.')

      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 14)

      const { error: profileError } = await supabase
        .from('coach_profiles')
        .upsert({
          user_id: data.user.id,
          email,
          display_name: email.split('@')[0],
          plan,
          trial_ends_at: trialEnd.toISOString(),
          has_payment_method: false,
        }, { onConflict: 'user_id' })

      if (profileError) throw profileError

      const u = { id: data.user.id, email: data.user.email! }
      setUser(u)
      try { localStorage.setItem(CACHE_KEY_USER, JSON.stringify(u)) } catch { /* quota */ }
      const profile = await fetchCoach(data.user.id)
      return profile
    } finally {
      signingInRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCoach])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCoach(null)
    localStorage.removeItem(CACHE_KEY_USER)
    localStorage.removeItem(CACHE_KEY_PROFILE)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ user, coach, loading, signIn, signUp, signOut, refreshCoach }),
    [user, coach, loading, signIn, signUp, signOut, refreshCoach],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
