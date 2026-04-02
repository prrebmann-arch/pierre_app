'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { Athlete } from '@/lib/types'

interface AthleteContextType {
  athletes: Athlete[]
  loading: boolean
  refreshAthletes: () => Promise<void>
  selectedAthleteId: string | null
  selectedAthlete: Athlete | null
  setSelectedAthleteId: (id: string | null) => void
}

const AthleteContext = createContext<AthleteContextType | undefined>(undefined)

export function AthleteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)
  const fetchedRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)

  const userId = user?.id || null

  const fetchAthletes = useCallback(async () => {
    if (!userId) {
      setAthletes([])
      setLoading(false)
      return
    }
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    try {
      const supabase = createClient()
      const [{ data, error }, { data: phases }] = await Promise.all([
        supabase
          .from('athletes')
          .select('*')
          .eq('coach_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('roadmap_phases')
          .select('athlete_id, phase, name')
          .eq('coach_id', userId)
          .eq('status', 'en_cours'),
      ])

      if (!error && data) {
        const phaseMap: Record<string, { athlete_id: string; phase: string; name: string }> = {}
        ;(phases || []).forEach((p: { athlete_id: string; phase: string; name: string }) => {
          if (!phaseMap[p.athlete_id]) phaseMap[p.athlete_id] = p
        })
        setAthletes(
          (data as Athlete[]).map(a => ({ ...a, _phase: phaseMap[a.id] || null }))
        )
      }
    } catch (err) {
      console.error('[AthleteContext] fetch error:', err)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [userId])

  useEffect(() => {
    if (userId && fetchedRef.current !== userId) {
      fetchedRef.current = userId
      fetchAthletes()
    } else if (!userId) {
      setAthletes([])
      setLoading(false)
      fetchedRef.current = null
    }
  }, [userId, fetchAthletes])

  const refreshAthletes = useCallback(async () => {
    fetchingRef.current = false // allow re-fetch
    await fetchAthletes()
  }, [fetchAthletes])

  const selectedAthlete = useMemo(
    () => (selectedAthleteId ? athletes.find(a => a.id === selectedAthleteId) ?? null : null),
    [selectedAthleteId, athletes],
  )

  const value = useMemo(
    () => ({ athletes, loading, refreshAthletes, selectedAthleteId, selectedAthlete, setSelectedAthleteId }),
    [athletes, loading, refreshAthletes, selectedAthleteId, selectedAthlete],
  )

  return (
    <AthleteContext.Provider value={value}>
      {children}
    </AthleteContext.Provider>
  )
}

export function useAthleteContext() {
  const ctx = useContext(AthleteContext)
  if (!ctx) throw new Error('useAthleteContext must be used within AthleteProvider')
  return ctx
}
