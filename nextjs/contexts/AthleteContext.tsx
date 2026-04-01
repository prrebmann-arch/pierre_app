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
    const { data, error } = await supabase
      .from('athletes')
      .select('*')
      .eq('coach_id', user.id)
      .order('prenom')
    if (!error && data) {
      setAthletes(data as Athlete[])
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
