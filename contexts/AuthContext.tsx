'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, CoachProfile } from '@/lib/types'

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
  const [user, setUser] = useState<User | null>(null)
  const [coach, setCoach] = useState<CoachProfile | null>(null)
  const [loading, setLoading] = useState(true)
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
          setUser({ id: session.user.id, email: session.user.email! })
          await fetchCoach(session.user.id)
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
          setUser({ id: session.user.id, email: session.user.email! })
          await fetchCoach(session.user.id)
        } else {
          setUser(null)
          setCoach(null)
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

      setUser({ id: data.user.id, email: data.user.email! })
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

      setUser({ id: data.user.id, email: data.user.email! })
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
