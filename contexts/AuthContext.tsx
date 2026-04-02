'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
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

  const supabase = createClient()

  const fetchCoach = useCallback(async (userId: string): Promise<CoachProfile | null> => {
    const { data } = await supabase
      .from('coach_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    const profile = data as CoachProfile | null
    setCoach(profile)
    return profile
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshCoach = useCallback(async () => {
    if (user) await fetchCoach(user.id)
  }, [user, fetchCoach])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
        await fetchCoach(session.user.id)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
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

  const signIn = async (email: string, password: string): Promise<CoachProfile | null> => {
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
    return await fetchCoach(data.user.id)
  }

  const signUp = async (email: string, password: string, plan: string): Promise<CoachProfile | null> => {
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
    return await fetchCoach(data.user.id)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCoach(null)
  }

  return (
    <AuthContext.Provider value={{ user, coach, loading, signIn, signUp, signOut, refreshCoach }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
