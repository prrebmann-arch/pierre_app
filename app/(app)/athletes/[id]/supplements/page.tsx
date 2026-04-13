'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { getPageCache, setPageCache } from '@/lib/utils'
import Toggle from '@/components/ui/Toggle'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

type SuppType = 'complement' | 'supplementation'

const FREQ_OPTIONS = [
  { value: '1x/jour', label: '1x/jour' },
  { value: '2x/jour', label: '2x/jour' },
  { value: '3x/jour', label: '3x/jour' },
  { value: 'tous les 2 jours', label: 'Tous les 2 jours (EOD)' },
  { value: 'tous les 3 jours', label: 'Tous les 3 jours' },
  { value: '2x/semaine', label: '2x/semaine' },
  { value: '3x/semaine', label: '3x/semaine' },
  { value: '1x/semaine', label: '1x/semaine' },
  { value: 'au besoin', label: 'Au besoin' },
]

const UNITE_OPTIONS = ['mg', 'g', 'ml', 'caps', 'gelules', 'cuillere', 'UI']

// Legacy moment options (kept for backward compatibility display)
const LEGACY_MOMENT_OPTIONS = [
  'Petit-dejeuner', 'Matin', 'Midi', 'Apres-midi',
  'Pre-training', 'Post-training', 'Soir', 'Coucher', 'Au repas', 'A jeun',
]

// New structured moment categories
const MOMENT_CATEGORIES = [
  { key: 'a_jeun', label: 'A jeun', icon: 'fas fa-sun' },
  { key: 'repas', label: 'Repas', icon: 'fas fa-utensils' },
  { key: 'training', label: 'Training', icon: 'fas fa-dumbbell' },
  { key: 'coucher', label: 'Coucher', icon: 'fas fa-moon' },
] as const

const TRAINING_TIMINGS = [
  { value: 'pre_training', label: 'Pre-training' },
  { value: 'intra_training', label: 'Intra-training' },
  { value: 'post_training', label: 'Post-training' },
] as const

const MEAL_TIMINGS = [
  { value: 'avant', label: 'Avant' },
  { value: 'pendant', label: 'Pendant' },
  { value: 'apres', label: 'Apres' },
] as const

/** Format a structured moment_prise value for display */
function formatMomentPrise(val: string): string {
  if (!val) return ''
  // New structured values
  if (val === 'a_jeun') return 'A jeun'
  if (val === 'coucher') return 'Coucher'
  if (val === 'pre_training') return 'Pre-training'
  if (val === 'intra_training') return 'Intra-training'
  if (val === 'post_training') return 'Post-training'
  // Meal patterns: R1_avant, R2_pendant, R3_apres
  const mealMatch = val.match(/^R(\d+)_(avant|pendant|apres)$/)
  if (mealMatch) {
    const timingLabels: Record<string, string> = { avant: 'Avant', pendant: 'Pendant', apres: 'Apres' }
    return `${timingLabels[mealMatch[2]]} Repas ${mealMatch[1]}`
  }
  // Legacy values: return as-is
  return val
}

/** Parse a moment_prise value into its group key for sectioning */
function getMomentGroup(val: string): string {
  if (!val) return 'autre'
  if (val === 'a_jeun') return 'a_jeun'
  if (val === 'coucher') return 'coucher'
  if (val === 'pre_training' || val === 'intra_training' || val === 'post_training') return 'training'
  const mealMatch = val.match(/^R(\d+)_/)
  if (mealMatch) return `repas_${mealMatch[1]}`
  // Legacy values
  return 'autre'
}

/** Get sort order for a moment group */
function getMomentSortOrder(group: string): number {
  if (group === 'a_jeun') return 0
  if (group.startsWith('repas_')) return 10 + parseInt(group.split('_')[1])
  if (group === 'training') return 100
  if (group === 'coucher') return 200
  return 300 // 'autre' / legacy
}

/** Get sub-sort for individual moments within a group */
function getMomentSubSort(val: string): number {
  if (val.endsWith('_avant')) return 0
  if (val.endsWith('_pendant')) return 1
  if (val.endsWith('_apres')) return 2
  if (val === 'pre_training') return 0
  if (val === 'intra_training') return 1
  if (val === 'post_training') return 2
  return 5
}

/** Get display label for a group */
function getGroupLabel(group: string): string {
  if (group === 'a_jeun') return 'A jeun'
  if (group.startsWith('repas_')) return `Repas ${group.split('_')[1]}`
  if (group === 'training') return 'Training'
  if (group === 'coucher') return 'Coucher'
  return 'Autre'
}

/** Get icon for a group */
function getGroupIcon(group: string): string {
  if (group === 'a_jeun') return 'fas fa-sun'
  if (group.startsWith('repas_')) return 'fas fa-utensils'
  if (group === 'training') return 'fas fa-dumbbell'
  if (group === 'coucher') return 'fas fa-moon'
  return 'fas fa-clock'
}

function getIntervalDays(freq: string): number {
  const map: Record<string, number> = {
    '1x/jour': 1, '2x/jour': 0.5, '3x/jour': 0.333,
    'tous les 2 jours': 2, 'tous les 3 jours': 3,
    '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7,
  }
  return map[freq] || 0
}

function isDueDate(startDate: string | null, intervalDays: number, checkDate: string): boolean {
  if (!startDate || intervalDays <= 0) return true
  if (intervalDays <= 1) return true
  const start = new Date(startDate + 'T00:00:00')
  const check = new Date(checkDate + 'T00:00:00')
  const diffDays = Math.round((check.getTime() - start.getTime()) / 86400000)
  if (diffDays < 0) return false
  return diffDays % Math.round(intervalDays) === 0
}

const HISTORY_DAYS = 14

export default function SupplementsPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_supplements`
  const [cached] = useState(() => getPageCache<{ assignments: any[]; unlocked: boolean }>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [tab, setTab] = useState<SuppType>('complement')
  const [assignments, setAssignments] = useState<any[]>(cached?.assignments ?? [])
  const [unlocked, setUnlocked] = useState(cached?.unlocked ?? false)
  const [logs, setLogs] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formNom, setFormNom] = useState('')
  const [formMarque, setFormMarque] = useState('')
  const [formDosage, setFormDosage] = useState('')
  const [formUnite, setFormUnite] = useState('mg')
  const [formFreq, setFormFreq] = useState('1x/jour')
  const [formMoment, setFormMoment] = useState('')
  const [formLien, setFormLien] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formConcentration, setFormConcentration] = useState('')
  const [formMomentCustom, setFormMomentCustom] = useState(false)
  const [formMomentCategory, setFormMomentCategory] = useState('')
  const [formMomentMealNum, setFormMomentMealNum] = useState('')
  const [formMomentTiming, setFormMomentTiming] = useState('')
  const [mealCount, setMealCount] = useState(5) // default 5 meals if no diet found

  const loadData = useCallback(async () => {
    if (!assignments.length) setLoading(true)
    try {
      const rangeStart = new Date()
      rangeStart.setDate(rangeStart.getDate() - (HISTORY_DAYS - 1))
      const startDate = rangeStart.toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)

      const [{ data: assigns }, { data: ath }, { data: logData }, { data: nutritionPlans }] = await Promise.all([
        supabase.from('athlete_supplements').select('id, athlete_id, supplement_id, dosage, moment, actif, custom_days, supplements(id, nom, marque, type, forme)').eq('athlete_id', params.id).limit(100),
        supabase.from('athletes').select('supplementation_unlocked').eq('id', params.id).single(),
        supabase.from('supplement_logs').select('id, athlete_id, athlete_supplement_id, taken_date, taken').eq('athlete_id', params.id).gte('taken_date', startDate).lte('taken_date', today).order('taken_date', { ascending: false }).limit(200),
        supabase.from('nutrition_plans').select('id, meals_data, meal_type, actif').eq('athlete_id', params.id).eq('actif', true).limit(10),
      ])

      // Determine meal count from active training diet
      let detectedMealCount = 5
      if (nutritionPlans && nutritionPlans.length > 0) {
        const trainingPlan = nutritionPlans.find((p: any) => p.meal_type === 'training' || p.meal_type === 'entrainement') || nutritionPlans[0]
        try {
          const meals = typeof trainingPlan.meals_data === 'string' ? JSON.parse(trainingPlan.meals_data) : (trainingPlan.meals_data || [])
          if (Array.isArray(meals) && meals.length > 0) detectedMealCount = meals.length
        } catch { /* keep default */ }
      }
      setMealCount(detectedMealCount)
      const filteredAssigns = (assigns || []).filter((a: any) => a.actif !== false)
      const unlockedVal = ath?.supplementation_unlocked || false
      setAssignments(filteredAssigns)
      setUnlocked(unlockedVal)
      setLogs(logData || [])

      setPageCache(cacheKey, { assignments: filteredAssigns, unlocked: unlockedVal })
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadData()
  }, [params.id, loadData])

  async function toggleUnlock(on: boolean) {
    const { error } = await supabase.from('athletes').update({ supplementation_unlocked: on }).eq('id', params.id)
    if (error) { toast('Erreur', 'error'); return }
    setUnlocked(on)
    toast(on ? 'Supplementation visible par l\'athlete' : 'Supplementation masquee', 'success')
  }

  async function saveNewSupplement() {
    if (!formNom.trim()) { toast('Nom obligatoire', 'error'); return }
    if (!formDosage.trim()) { toast('Dosage obligatoire', 'error'); return }
    setSaving(true)

    try {
      // Create supplement
      const { data: supp, error: e1 } = await supabase.from('supplements').insert({
        coach_id: user?.id,
        type: tab,
        nom: formNom.trim(),
        marque: formMarque.trim() || null,
        lien_achat: formLien.trim() || null,
      }).select().single()
      if (e1 || !supp) { toast('Erreur creation supplement', 'error'); return }

      const intervalMap: Record<string, number> = {
        '1x/jour': 1, '2x/jour': 1, '3x/jour': 1,
        'tous les 2 jours': 2, 'tous les 3 jours': 3,
        '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7, 'au besoin': 0,
      }

      const { error: e2 } = await supabase.from('athlete_supplements').insert({
        athlete_id: params.id,
        supplement_id: supp.id,
        dosage: formDosage.trim(),
        unite: formUnite,
        frequence: formFreq,
        intervalle_jours: intervalMap[formFreq] || 1,
        moment_prise: formMoment.trim() || null,
        concentration_mg_ml: parseFloat(formConcentration) || null,
        notes: formNotes.trim() || null,
        actif: true,
      })
      if (e2) { toast('Erreur assignation', 'error'); return }

      toast('Supplement ajoute', 'success')
      setShowAddModal(false)
      resetForm()
      loadData()
    } catch (err) {
      console.error('saveNewSupplement error:', err)
      toast('Erreur inattendue', 'error')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setFormNom(''); setFormMarque(''); setFormDosage(''); setFormUnite('mg')
    setFormFreq('1x/jour'); setFormMoment(''); setFormLien(''); setFormNotes(''); setFormConcentration('')
    setFormMomentCustom(false); setFormMomentCategory(''); setFormMomentMealNum(''); setFormMomentTiming('')
  }

  function openEditModal(a: any) {
    const s = a.supplements || {}
    setEditingId(a.id)
    setFormNom(s.nom || '')
    setFormMarque(s.marque || '')
    setFormDosage(a.dosage || '')
    setFormUnite(a.unite || 'mg')
    setFormFreq(a.frequence || '1x/jour')
    const moment = a.moment_prise || ''
    setFormMoment(moment)
    // Parse existing moment into category/timing for the new picker
    if (moment === 'a_jeun') {
      setFormMomentCategory('a_jeun'); setFormMomentMealNum(''); setFormMomentTiming('')
    } else if (moment === 'coucher') {
      setFormMomentCategory('coucher'); setFormMomentMealNum(''); setFormMomentTiming('')
    } else if (moment === 'pre_training' || moment === 'intra_training' || moment === 'post_training') {
      setFormMomentCategory('training'); setFormMomentMealNum(''); setFormMomentTiming(moment)
    } else {
      const mealMatch = moment.match(/^R(\d+)_(avant|pendant|apres)$/)
      if (mealMatch) {
        setFormMomentCategory('repas'); setFormMomentMealNum(mealMatch[1]); setFormMomentTiming(mealMatch[2])
      } else if (moment && LEGACY_MOMENT_OPTIONS.includes(moment)) {
        // Legacy value: show as custom
        setFormMomentCategory(''); setFormMomentMealNum(''); setFormMomentTiming('')
        setFormMomentCustom(true)
      } else if (moment) {
        setFormMomentCategory(''); setFormMomentMealNum(''); setFormMomentTiming('')
        setFormMomentCustom(true)
      } else {
        setFormMomentCategory(''); setFormMomentMealNum(''); setFormMomentTiming('')
        setFormMomentCustom(false)
      }
    }
    setFormLien(s.lien_achat || '')
    setFormNotes(a.notes || '')
    setFormConcentration(a.concentration_mg_ml ? String(a.concentration_mg_ml) : '')
    setShowAddModal(true)
  }

  async function saveEditSupplement() {
    if (!editingId) return
    if (!formDosage.trim()) { toast('Dosage obligatoire', 'error'); return }
    setSaving(true)

    try {
      const intervalMap: Record<string, number> = {
        '1x/jour': 1, '2x/jour': 1, '3x/jour': 1,
        'tous les 2 jours': 2, 'tous les 3 jours': 3,
        '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7, 'au besoin': 0,
      }

      // Get old values for history
      const oldAssignment = assignments.find((a: any) => a.id === editingId)

      // Update assignment
      const { error } = await supabase.from('athlete_supplements').update({
        dosage: formDosage.trim(),
        unite: formUnite,
        frequence: formFreq,
        intervalle_jours: intervalMap[formFreq] || 1,
        moment_prise: formMoment.trim() || null,
        concentration_mg_ml: parseFloat(formConcentration) || null,
        notes: formNotes.trim() || null,
      }).eq('id', editingId)

      if (error) { toast('Erreur modification', 'error'); return }

      // Log dosage change in history
      if (oldAssignment && (oldAssignment.dosage !== formDosage.trim() || oldAssignment.unite !== formUnite || oldAssignment.frequence !== formFreq)) {
        const { error: histErr } = await supabase.from('supplement_dosage_history').insert({
          athlete_supplement_id: editingId,
          ancien_dosage: oldAssignment.dosage,
          nouveau_dosage: formDosage.trim(),
          ancienne_unite: oldAssignment.unite,
          nouvelle_unite: formUnite,
          ancienne_frequence: oldAssignment.frequence,
          nouvelle_frequence: formFreq,
          changed_by: user?.id,
        })
        if (histErr) console.warn('supplement_dosage_history insert failed:', histErr.message)
      }

      toast('Supplement modifie', 'success')
      setShowAddModal(false)
      setEditingId(null)
      resetForm()
      loadData()
    } catch (err) {
      console.error('saveEditSupplement error:', err)
      toast('Erreur inattendue', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(id: string) {
    if (!confirm('Retirer ce supplement ?')) return
    const { error } = await supabase.from('athlete_supplements').update({ actif: false }).eq('id', id)
    if (error) { toast('Erreur', 'error'); return }
    toast('Supplement retire', 'success')
    loadData()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  const assigned = assignments.filter((a: any) => a.supplements?.type === tab)
  const today = new Date().toISOString().slice(0, 10)

  // Build per-assignment history for 14 days + delay detection
  function getAssignmentHistory(a: any) {
    const intervalDays = a.intervalle_jours || getIntervalDays(a.frequence) || 1
    const isOnDemand = a.frequence === 'au besoin'
    const days: { date: string; label: string; status: 'taken' | 'missed' | 'not_due' | 'today_pending' | 'today_taken' }[] = []
    let missedCount = 0
    let lastDueMissed: string | null = null

    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const log = logs.find((l: any) => l.athlete_supplement_id === a.id && l.taken_date === ds)
      const due = isOnDemand ? false : isDueDate(a.start_date, intervalDays, ds)
      const isToday = ds === today

      let status: typeof days[0]['status']
      if (isToday) {
        status = log?.taken ? 'today_taken' : 'today_pending'
      } else if (!due) {
        status = 'not_due'
      } else if (log?.taken) {
        status = 'taken'
      } else {
        status = 'missed'
        missedCount++
        if (!lastDueMissed || ds > lastDueMissed) lastDueMissed = ds
      }

      days.push({
        date: ds,
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2) + ' ' + d.getDate(),
        status,
      })
    }

    // Calculate delay in days from last missed due date
    let delayDays = 0
    if (lastDueMissed) {
      delayDays = Math.round((new Date(today + 'T00:00:00').getTime() - new Date(lastDueMissed + 'T00:00:00').getTime()) / 86400000)
    }

    return { days, missedCount, delayDays, isOnDemand }
  }

  // Compliance grid for supplementation (summary)
  let complianceHtml = null
  if (tab === 'supplementation' && assigned.length) {
    const suppIds = assigned.map((a: any) => a.id)
    const todayLogs = logs.filter((l: any) => l.taken_date === today && suppIds.includes(l.athlete_supplement_id))
    const takenTodayCount = todayLogs.filter((l: any) => l.taken).length

    const days: { label: string; taken: number; due: number; pct: number }[] = []
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const dayLogs = logs.filter((l: any) => l.taken_date === ds && suppIds.includes(l.athlete_supplement_id))
      const taken = dayLogs.filter((l: any) => l.taken).length
      // Count how many supplements were due that day
      let dueCount = 0
      for (const a of assigned) {
        const intervalDays = a.intervalle_jours || getIntervalDays(a.frequence) || 1
        if (a.frequence !== 'au besoin' && isDueDate(a.start_date, intervalDays, ds)) dueCount++
      }
      days.push({
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2) + '\n' + d.getDate(),
        taken, due: dueCount,
        pct: dueCount > 0 ? taken / dueCount : 0,
      })
    }

    complianceHtml = (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <i className="fas fa-chart-bar" style={{ marginRight: 6, color: 'var(--text3)' }} />Suivi des prises (14 jours)
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: takenTodayCount === assigned.length ? 'var(--success)' : 'var(--warning)' }}>
            Aujourd&apos;hui : {takenTodayCount}/{assigned.length}
          </div>
        </div>
        <div className={styles.complianceGrid}>
          {days.map((d, i) => {
            const color = d.due === 0 ? 'var(--bg4)' : d.pct >= 1 ? 'var(--success)' : d.pct > 0 ? 'var(--warning)' : 'var(--danger)'
            return (
              <div key={i} className={styles.complianceDay}>
                <div className={styles.complianceDayLabel} style={{ whiteSpace: 'pre-line' }}>{d.label}</div>
                <div className={styles.complianceDayBar} style={{ background: color }}>
                  {d.due > 0 && <span className={styles.complianceDayCount}>{d.taken}/{d.due}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Weekly dose calculation helper
  function calcWeekly(a: any) {
    const interval = getIntervalDays(a.frequence)
    if (!interval || a.frequence === 'au besoin') return null
    const inj = 7 / interval
    const dose = parseFloat((a.dosage || '').replace(',', '.')) || 0
    if (a.concentration_mg_ml && a.unite === 'ml') {
      return `${(dose * a.concentration_mg_ml * inj).toFixed(0)} mg/semaine`
    }
    if (dose) return `${(dose * inj).toFixed(0)} ${a.unite}/semaine`
    return null
  }

  return (
    <div>
      {/* Tab buttons */}
      <div className={styles.filterBar}>
        <button className={tab === 'complement' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setTab('complement')}>
          <i className="fas fa-capsules" /> Complements
        </button>
        <button className={tab === 'supplementation' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setTab('supplementation')}>
          <i className="fas fa-pills" /> Supplementation
        </button>
      </div>

      {/* Unlock toggle for supplementation */}
      {tab === 'supplementation' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: unlocked ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          borderRadius: 8, marginBottom: 16,
          border: `1px solid ${unlocked ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {unlocked ? <><i className="fas fa-unlock" style={{ color: 'var(--success)', marginRight: 6 }} />Visible par l&apos;athlete</> : <><i className="fas fa-lock" style={{ color: 'var(--danger)', marginRight: 6 }} />Masque pour l&apos;athlete</>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              La supplementation {unlocked ? 'est accessible' : 'n\'est pas accessible'} dans l&apos;app mobile
            </div>
          </div>
          <Toggle checked={unlocked} onChange={toggleUnlock} />
        </div>
      )}

      {complianceHtml}

      {/* Actions bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-red btn-sm" onClick={() => { resetForm(); setShowAddModal(true) }}>
          <i className="fas fa-plus" /> Ajouter
        </button>
      </div>

      {/* Cards grouped by moment */}
      {assigned.length === 0 ? (
        <EmptyState icon="fas fa-pills" message={`Aucun ${tab === 'complement' ? 'complement' : 'supplement'} assigne`} />
      ) : (() => {
        // Group assignments by moment
        const groups: Record<string, any[]> = {}
        for (const a of assigned) {
          const group = getMomentGroup(a.moment_prise || '')
          if (!groups[group]) groups[group] = []
          groups[group].push(a)
        }
        // Sort groups
        const sortedGroupKeys = Object.keys(groups).sort((a, b) => getMomentSortOrder(a) - getMomentSortOrder(b))
        // Sort items within each group by sub-sort
        for (const key of sortedGroupKeys) {
          groups[key].sort((a: any, b: any) => getMomentSubSort(a.moment_prise || '') - getMomentSubSort(b.moment_prise || ''))
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sortedGroupKeys.map((groupKey) => (
              <div key={groupKey}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                  padding: '6px 12px', background: 'var(--bg2)', borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <i className={getGroupIcon(groupKey)} style={{ color: 'var(--primary)', fontSize: 13 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{getGroupLabel(groupKey)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{groups[groupKey].length} supplement{groups[groupKey].length > 1 ? 's' : ''}</span>
                </div>
                {/* Cards */}
                <div className={styles.suppGrid}>
                  {groups[groupKey].map((a: any) => {
                    const s = a.supplements || {}
                    const weekly = calcWeekly(a)
                    const history = getAssignmentHistory(a)
                    const todayStatus = history.days[history.days.length - 1]?.status
                    return (
                      <div key={a.id} className={styles.suppCard}>
                        <div className={styles.suppCardHeader}>
                          <div>
                            <div className={styles.suppCardName}>{s.nom}</div>
                            {s.marque && <div className={styles.suppCardBrand}>{s.marque}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            {s.lien_achat && (
                              <a href={s.lien_achat} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ fontSize: 10 }}>
                                <i className="fas fa-shopping-cart" /> Acheter
                              </a>
                            )}
                            {tab === 'supplementation' && !history.isOnDemand && (
                              history.delayDays > 0 ? (
                                <span className={styles.suppBadgeLate}>
                                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 3 }} />
                                  En retard de {history.delayDays}j
                                </span>
                              ) : (
                                <span className={styles.suppBadgeOk}>
                                  <i className="fas fa-check" style={{ marginRight: 3 }} />A jour
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        {/* Moment badge (sub-timing within group) */}
                        {a.moment_prise && (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: 'var(--primary)',
                              background: 'rgba(var(--primary-rgb, 220,38,38), 0.08)',
                              padding: '2px 8px', borderRadius: 4,
                            }}>
                              {formatMomentPrise(a.moment_prise)}
                            </span>
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{a.dosage}</span>
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{a.unite}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                            <span><i className="fas fa-redo" style={{ marginRight: 3 }} />{a.frequence}</span>
                          </div>
                          {weekly && (
                            <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 6 }}>
                              <i className="fas fa-calculator" style={{ marginRight: 4 }} />{weekly}
                            </div>
                          )}
                          {a.notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{a.notes}</div>}
                        </div>

                        {/* 14-day history grid (supplementation only) */}
                        {tab === 'supplementation' && <div className={styles.suppHistorySection}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>Historique 14 jours</span>
                            {!history.isOnDemand && history.missedCount > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--danger)' }}>
                                {history.missedCount} manquee{history.missedCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className={styles.suppHistoryGrid}>
                            {history.days.map((d, i) => {
                              let bg: string
                              let title: string
                              switch (d.status) {
                                case 'taken': bg = 'var(--success)'; title = 'Pris'; break
                                case 'missed': bg = 'var(--danger)'; title = 'Manque'; break
                                case 'not_due': bg = 'var(--bg4)'; title = 'Pas prevu'; break
                                case 'today_taken': bg = 'var(--success)'; title = 'Pris aujourd\'hui'; break
                                case 'today_pending': bg = 'var(--info, #3b82f6)'; title = 'En attente'; break
                              }
                              return (
                                <div key={i} className={styles.suppHistoryCell} title={`${d.date} — ${title}`} style={{ background: bg }} />
                              )
                            })}
                          </div>
                          <div className={styles.suppHistoryLegend}>
                            <span><span className={styles.suppDot} style={{ background: 'var(--success)' }} /> Pris</span>
                            <span><span className={styles.suppDot} style={{ background: 'var(--danger)' }} /> Manque</span>
                            <span><span className={styles.suppDot} style={{ background: 'var(--bg4)' }} /> Pas prevu</span>
                            <span><span className={styles.suppDot} style={{ background: 'var(--info, #3b82f6)' }} /> Aujourd&apos;hui</span>
                          </div>
                        </div>}

                        {/* Today status */}
                        {tab === 'supplementation' && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: todayStatus === 'today_taken' ? 'var(--success)' : 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            <i className={todayStatus === 'today_taken' ? 'fas fa-check-circle' : 'far fa-circle'} />
                            {todayStatus === 'today_taken' ? 'Pris aujourd\'hui' : 'Pas encore pris'}
                          </div>
                        )}

                        <div className={styles.suppCardFooter}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEditModal(a)}>
                            <i className="fas fa-pen" /> Modifier
                          </button>
                          <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeAssignment(a.id)}>
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Add supplement modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingId(null); resetForm() }} title={editingId ? 'Modifier le supplement' : `Ajouter un ${tab === 'complement' ? 'complement' : 'supplement'}`}>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="text" className="form-control" placeholder="Nom du produit *" value={formNom} onChange={(e) => setFormNom(e.target.value)} />
          <input type="text" className="form-control" placeholder="Marque" value={formMarque} onChange={(e) => setFormMarque(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" className="form-control" placeholder="Dosage *" value={formDosage} onChange={(e) => setFormDosage(e.target.value)} style={{ flex: 1 }} />
            <select className="form-control" value={formUnite} onChange={(e) => setFormUnite(e.target.value)} style={{ width: 100 }}>
              {UNITE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <select className="form-control" value={formFreq} onChange={(e) => setFormFreq(e.target.value)}>
            {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {/* Weekly dose preview */}
          {(() => {
            const interval = getIntervalDays(formFreq)
            if (!interval || formFreq === 'au besoin') return null
            const inj = 7 / interval
            const dose = parseFloat((formDosage || '').replace(',', '.')) || 0
            if (!dose) return null
            const concMgMl = parseFloat(formConcentration) || 0
            let weeklyText: string
            if (concMgMl && formUnite === 'ml') {
              weeklyText = `${(dose * concMgMl * inj).toFixed(0)} mg/semaine`
            } else {
              weeklyText = `${(dose * inj).toFixed(1)} ${formUnite}/semaine`
            }
            return (
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, padding: '4px 0' }}>
                <i className="fas fa-calculator" style={{ marginRight: 4 }} />
                {formDosage}{formUnite} x {inj.toFixed(1)}/sem = {weeklyText}
              </div>
            )
          })()}
          {tab === 'supplementation' && (
            <input type="number" className="form-control" placeholder="Concentration (mg/ml)" value={formConcentration} onChange={(e) => setFormConcentration(e.target.value)} step="any" />
          )}
          {/* Moment de prise - structured picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>Moment de prise</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {MOMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={formMomentCategory === cat.key ? 'btn btn-red btn-sm' : 'btn btn-outline btn-sm'}
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setFormMomentCustom(false)
                    if (cat.key === 'a_jeun') {
                      setFormMomentCategory('a_jeun'); setFormMomentMealNum(''); setFormMomentTiming('')
                      setFormMoment('a_jeun')
                    } else if (cat.key === 'coucher') {
                      setFormMomentCategory('coucher'); setFormMomentMealNum(''); setFormMomentTiming('')
                      setFormMoment('coucher')
                    } else if (cat.key === 'training') {
                      setFormMomentCategory('training'); setFormMomentMealNum(''); setFormMomentTiming('')
                      setFormMoment('')
                    } else if (cat.key === 'repas') {
                      setFormMomentCategory('repas'); setFormMomentMealNum(''); setFormMomentTiming('')
                      setFormMoment('')
                    }
                  }}
                >
                  <i className={cat.icon} style={{ marginRight: 4 }} />{cat.label}
                </button>
              ))}
              <button
                type="button"
                className={formMomentCustom ? 'btn btn-red btn-sm' : 'btn btn-outline btn-sm'}
                style={{ fontSize: 11 }}
                onClick={() => {
                  setFormMomentCustom(true); setFormMomentCategory(''); setFormMomentMealNum(''); setFormMomentTiming('')
                  setFormMoment('')
                }}
              >
                <i className="fas fa-pen" style={{ marginRight: 4 }} />Autre
              </button>
            </div>

            {/* Step 2: Training timing */}
            {formMomentCategory === 'training' && (
              <div style={{ display: 'flex', gap: 6 }}>
                {TRAINING_TIMINGS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={formMoment === t.value ? 'btn btn-red btn-sm' : 'btn btn-outline btn-sm'}
                    style={{ fontSize: 11, flex: 1 }}
                    onClick={() => { setFormMomentTiming(t.value); setFormMoment(t.value) }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Meal selection + timing */}
            {formMomentCategory === 'repas' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className="form-control"
                  value={formMomentMealNum}
                  onChange={(e) => {
                    setFormMomentMealNum(e.target.value)
                    if (e.target.value && formMomentTiming) {
                      setFormMoment(`R${e.target.value}_${formMomentTiming}`)
                    } else {
                      setFormMoment('')
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Repas --</option>
                  {Array.from({ length: mealCount }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>Repas {i + 1}</option>
                  ))}
                </select>
                <select
                  className="form-control"
                  value={formMomentTiming}
                  onChange={(e) => {
                    setFormMomentTiming(e.target.value)
                    if (formMomentMealNum && e.target.value) {
                      setFormMoment(`R${formMomentMealNum}_${e.target.value}`)
                    } else {
                      setFormMoment('')
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Timing --</option>
                  {MEAL_TIMINGS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom / legacy input */}
            {formMomentCustom && (
              <input type="text" className="form-control" placeholder="Ex: Apres-midi, Matin..." value={formMoment} onChange={(e) => setFormMoment(e.target.value)} />
            )}
          </div>
          <input type="url" className="form-control" placeholder="Lien d'achat (optionnel)" value={formLien} onChange={(e) => setFormLien(e.target.value)} />
          <textarea className="form-control" placeholder="Notes" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Annuler</button>
            <button className="btn btn-red" onClick={editingId ? saveEditSupplement : saveNewSupplement} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : editingId ? <><i className="fas fa-check" style={{ marginRight: 4 }} />Modifier</> : <><i className="fas fa-plus" style={{ marginRight: 4 }} />Ajouter</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
