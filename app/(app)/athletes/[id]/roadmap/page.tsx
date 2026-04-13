'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { toDateStr, getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { PROG_PHASES, type ProgPhaseKey } from '@/lib/constants'
import dynamic from 'next/dynamic'
import type { RoadmapPhase } from '@/components/roadmap/RoadmapTimeline'
const RoadmapTimeline = dynamic(() => import('@/components/roadmap/RoadmapTimeline'), { ssr: false })
const RoadmapCalendar = dynamic(() => import('@/components/roadmap/RoadmapCalendar'), { ssr: false })
import PhaseModal, { type PhaseFormData } from '@/components/roadmap/PhaseModal'
import styles from '@/styles/roadmap.module.css'

interface ProgramRef {
  id: string
  nom: string
}

interface NutritionRef {
  id: string
  nom: string
}

interface DailyReport {
  date: string
  weight: number | null
}

function getNextMonday(from: Date): Date {
  const d = new Date(from)
  const day = d.getDay()
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  d.setDate(d.getDate() + diff)
  return d
}

export default function RoadmapPage() {
  const params = useParams<{ id: string }>()
  const athleteId = params.id
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()
  const { selectedAthlete } = useAthleteContext()

  const cacheKey = `athlete_${athleteId}_roadmap`
  const [cached] = useState(() => getPageCache<{ phases: RoadmapPhase[]; programs: ProgramRef[]; nutritions: NutritionRef[]; reports: DailyReport[] }>(cacheKey))

  const [phases, setPhases] = useState<RoadmapPhase[]>(cached?.phases ?? [])
  const [programs, setPrograms] = useState<ProgramRef[]>(cached?.programs ?? [])
  const [nutritions, setNutritions] = useState<NutritionRef[]>(cached?.nutritions ?? [])
  const [reports, setReports] = useState<DailyReport[]>(cached?.reports ?? [])
  const [loading, setLoading] = useState(!cached)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<PhaseFormData | null>(null)

  const loadData = useCallback(async () => {
    if (!phases.length) setLoading(true)
    try {
      const userId = selectedAthlete?.user_id

      const [phasesRes, progsRes, nutritionsRes, reportsRes] = await Promise.all([
        supabase
          .from('roadmap_phases')
          .select('id, athlete_id, coach_id, phase, name, start_date, end_date, position, status, programme_id, nutrition_id, description')
          .eq('athlete_id', athleteId)
          .order('position')
          .order('start_date')
          .limit(50),
        supabase.from('workout_programs').select('id,nom').eq('athlete_id', athleteId).limit(50),
        supabase.from('nutrition_plans').select('id,nom').eq('athlete_id', athleteId).limit(50),
        userId
          ? supabase.from('daily_reports').select('date,weight').eq('user_id', userId).limit(120)
          : Promise.resolve({ data: [] }),
      ])

      const phasesData = (phasesRes.data || []) as RoadmapPhase[]
      const progsData = (progsRes.data || []) as ProgramRef[]
      const nutritionsData = (nutritionsRes.data || []) as NutritionRef[]
      const reportsData = (reportsRes.data || []) as DailyReport[]
      setPhases(phasesData)
      setPrograms(progsData)
      setNutritions(nutritionsData)
      setReports(reportsData)

      setPageCache(cacheKey, { phases: phasesData, programs: progsData, nutritions: nutritionsData, reports: reportsData })
    } finally {
      setLoading(false)
    }
  }, [athleteId, selectedAthlete?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  useRefetchOnResume(loadData, loading)

  const syncProgrammingWeeks = useCallback(async () => {
    if (!user) return
    const { data: currentPhases } = await supabase
      .from('roadmap_phases')
      .select('id, phase, start_date, end_date, position')
      .eq('athlete_id', athleteId)
      .order('position')
      .order('start_date')

    if (!currentPhases?.length) {
      await supabase.from('programming_weeks').delete().eq('athlete_id', athleteId)
      return
    }

    const expectedWeeks: { week_date: string; phase: string }[] = []
    currentPhases.forEach((p) => {
      const weekStart = new Date(p.start_date + 'T00:00:00')
      const dow = weekStart.getDay()
      const mondayDiff = dow === 0 ? -6 : 1 - dow
      weekStart.setDate(weekStart.getDate() + mondayDiff)

      const endDate = new Date(p.end_date + 'T00:00:00')
      while (weekStart <= endDate) {
        expectedWeeks.push({ week_date: toDateStr(weekStart), phase: p.phase })
        weekStart.setDate(weekStart.getDate() + 7)
      }
    })

    const weekMap: Record<string, string> = {}
    expectedWeeks.forEach((w) => {
      weekMap[w.week_date] = w.phase
    })

    await supabase.from('programming_weeks').delete().eq('athlete_id', athleteId)
    const rows = Object.entries(weekMap).map(([week_date, phase]) => ({
      athlete_id: athleteId,
      coach_id: user.id,
      week_date,
      phase,
    }))
    if (rows.length) {
      await supabase.from('programming_weeks').insert(rows)
    }
  }, [athleteId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = useCallback(() => {
    let defaultStart: Date
    if (phases.length) {
      const last = phases[phases.length - 1]
      defaultStart = new Date(last.end_date + 'T00:00:00')
      defaultStart.setDate(defaultStart.getDate() + 1)
    } else {
      defaultStart = getNextMonday(new Date())
    }
    const defaultEnd = new Date(defaultStart)
    defaultEnd.setDate(defaultEnd.getDate() + 8 * 7 - 1)

    setModalData({
      id: null,
      name: '',
      phase: 'seche',
      description: '',
      start_date: toDateStr(defaultStart),
      end_date: toDateStr(defaultEnd),
      status: 'planifiee',
      programme_id: null,
      nutrition_id: null,
    })
    setModalOpen(true)
  }, [phases])

  const handleEdit = useCallback((id: string) => {
    const phase = phases.find((p) => p.id === id)
    if (!phase) return
    setModalData({
      id: phase.id,
      name: phase.name,
      phase: phase.phase,
      description: phase.description || '',
      start_date: phase.start_date,
      end_date: phase.end_date,
      status: phase.status,
      programme_id: phase.programme_id || null,
      nutrition_id: phase.nutrition_id || null,
    })
    setModalOpen(true)
  }, [phases])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Supprimer cette phase ?')) return
    const { error } = await supabase.from('roadmap_phases').delete().eq('id', id)
    if (error) {
      toast('Erreur lors de la suppression', 'error')
      return
    }
    toast('Phase supprimee', 'success')
    await syncProgrammingWeeks()
    await loadData()
  }, [toast, syncProgrammingWeeks, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(async (id: string) => {
    const today = toDateStr(new Date())
    const targetPhase = phases.find((p) => p.id === id)
    if (!targetPhase) return

    // End current active phase
    const activePhase = phases.find((p) => p.status === 'en_cours' && p.id !== id)
    if (activePhase) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const { error } = await supabase
        .from('roadmap_phases')
        .update({ status: 'terminee', end_date: toDateStr(yesterday) })
        .eq('id', activePhase.id)
      if (error) {
        toast('Erreur', 'error')
        return
      }
    }

    const updates: Record<string, string> = { status: 'en_cours' }
    if (today !== targetPhase.start_date) {
      updates.start_date = today
    }

    const { error } = await supabase.from('roadmap_phases').update(updates).eq('id', id)
    if (error) {
      toast('Erreur', 'error')
      return
    }
    toast('Phase demarree !', 'success')
    await syncProgrammingWeeks()
    await loadData()
  }, [phases, toast, syncProgrammingWeeks, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(async (id: string) => {
    const today = toDateStr(new Date())
    const { error } = await supabase
      .from('roadmap_phases')
      .update({ status: 'terminee', end_date: today })
      .eq('id', id)
    if (error) {
      toast('Erreur', 'error')
      return
    }
    toast('Phase terminee !', 'success')
    await syncProgrammingWeeks()
    await loadData()
  }, [toast, syncProgrammingWeeks, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async (formData: PhaseFormData) => {
    if (!user) return
    const position = formData.id
      ? (phases.find((p) => p.id === formData.id)?.position || 0)
      : phases.length

    const row = {
      athlete_id: athleteId,
      coach_id: user.id,
      name: formData.name,
      phase: formData.phase,
      status: formData.status,
      description: formData.description,
      start_date: formData.start_date,
      end_date: formData.end_date,
      programme_id: formData.programme_id,
      nutrition_id: formData.nutrition_id,
      position,
    }

    let error
    if (formData.id) {
      ;({ error } = await supabase.from('roadmap_phases').update(row).eq('id', formData.id))
    } else {
      ;({ error } = await supabase.from('roadmap_phases').insert(row))
    }

    if (error) {
      toast('Erreur lors de la sauvegarde', 'error')
      return
    }

    setModalOpen(false)
    toast(formData.id ? 'Phase mise a jour !' : 'Phase creee !', 'success')
    await syncProgrammingWeeks()
    await loadData()
  }, [user, phases, athleteId, toast, syncProgrammingWeeks, loadData]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <i className="fa-solid fa-spinner fa-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className={styles.rmHeader}>
        <div>
          <h2 className={styles.rmTitle}>Roadmap</h2>
          <p className={styles.rmSubtitle}>Planifiez et suivez les phases de progression</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-red" onClick={handleAdd}>
            <i className="fa-solid fa-plus" /> Phase
          </button>
        </div>
      </div>

      <RoadmapTimeline
        phases={phases}
        programs={programs}
        nutritions={nutritions}
        reports={reports}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStart={handleStart}
        onComplete={handleComplete}
      />

      <RoadmapCalendar
        phases={phases}
        programs={programs}
        nutritions={nutritions}
        reports={reports}
      />

      {modalData && (
        <PhaseModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          data={modalData}
          programs={programs}
          nutritions={nutritions}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
