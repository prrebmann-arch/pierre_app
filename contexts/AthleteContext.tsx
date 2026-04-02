'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
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

  const supabase = createClient()

  const fetchAthletes = useCallback(async () => {
    if (!user) {
      setAthletes([])
      setLoading(false)
      return
    }
    setLoading(true)

    const [{ data, error }, { data: phases }] = await Promise.all([
      supabase
        .from('athletes')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('roadmap_phases')
        .select('athlete_id, phase, name')
        .eq('coach_id', user.id)
        .eq('status', 'en_cours'),
    ])

    if (!error && data) {
      // Attach active phase to each athlete
      const phaseMap: Record<string, { athlete_id: string; phase: string; name: string }> = {}
      ;(phases || []).forEach((p: { athlete_id: string; phase: string; name: string }) => {
        if (!phaseMap[p.athlete_id]) phaseMap[p.athlete_id] = p
      })
      setAthletes(
        (data as Athlete[]).map(a => ({ ...a, _phase: phaseMap[a.id] || null }))
      )
    }
    setLoading(false)
  }, [user, supabase])

  const refreshAthletes = useCallback(async () => {
    await fetchAthletes()
  }, [fetchAthletes])

  useEffect(() => {
    fetchAthletes()
  }, [fetchAthletes])

  const selectedAthlete = selectedAthleteId
    ? athletes.find(a => a.id === selectedAthleteId) ?? null
    : null

  return (
    <AthleteContext.Provider
      value={{
        athletes,
        loading,
        refreshAthletes,
        selectedAthleteId,
        selectedAthlete,
        setSelectedAthleteId,
      }}
    >
      {children}
    </AthleteContext.Provider>
  )
}

export function useAthleteContext() {
  const ctx = useContext(AthleteContext)
  if (!ctx) throw new Error('useAthleteContext must be used within AthleteProvider')
  return ctx
}
