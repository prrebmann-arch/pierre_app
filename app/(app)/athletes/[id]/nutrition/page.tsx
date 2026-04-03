'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Toggle from '@/components/ui/Toggle'
import Skeleton from '@/components/ui/Skeleton'
import MealEditor, { type MealData } from '@/components/nutrition/MealEditor'
import styles from '@/styles/nutrition.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface NutritionLog {
  id: string
  athlete_id: string
  date: string
  plan_id: string | null
  meals_log: string | any[]
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface NutritionPlan {
  id: string
  nom: string
  athlete_id: string
  coach_id: string
  meal_type: string
  calories_objectif: number
  proteines: number
  glucides: number
  lipides: number
  meals_data: string | any[]
  actif: boolean
  valid_from?: string
  created_at?: string
  macro_only?: boolean
  meal_times?: any
}

interface DietGroup {
  name: string
  tPlan: NutritionPlan | null
  rPlan: NutritionPlan | null
  isActive: boolean
  versionCount: number
  ids: string[]
}

interface PendingChange {
  planId: string
  mealIndex: number
  foodIndex: number
  type: 'replace' | 'extra'
  foodData: any
}

type View = 'list' | 'editor' | 'detail' | 'history'

export default function NutritionPage() {
  const params = useParams<{ id: string }>()
  const athleteId = params.id
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<NutritionPlan[]>([])
  const [diets, setDiets] = useState<DietGroup[]>([])
  const [view, setView] = useState<View>('list')

  // Editor state
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [editPlanName, setEditPlanName] = useState('')
  const [editMealType, setEditMealType] = useState<'training' | 'rest'>('training')
  const [editMeals, setEditMeals] = useState<MealData[]>([{ foods: [] }])
  const [editMacroOnly, setEditMacroOnly] = useState(false)
  const [editMacros, setEditMacros] = useState({ calories: 0, proteines: 0, glucides: 0, lipides: 0 })

  // Detail view
  const [detailPlan, setDetailPlan] = useState<NutritionPlan | null>(null)
  const [detailType, setDetailType] = useState<'training' | 'rest'>('training')
  const [detailDiet, setDetailDiet] = useState<{ tPlan: NutritionPlan | null; rPlan: NutritionPlan | null } | null>(null)

  // History state
  const [nutriLogs, setNutriLogs] = useState<NutritionLog[]>([])
  const [histWeekOffset, setHistWeekOffset] = useState(0)
  const [histSelectedDate, setHistSelectedDate] = useState<string | null>(null)

  // Versions expand state
  const [expandedVersions, setExpandedVersions] = useState<string | null>(null)

  // Accept changes state (group acceptations with a 10s timer)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [acceptCountdown, setAcceptCountdown] = useState(0)
  const acceptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('nutrition_plans')
        .select('id, nom, athlete_id, coach_id, meal_type, calories_objectif, proteines, glucides, lipides, meals_data, actif, valid_from, created_at, macro_only, meal_times')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })

      const allPlans = (data || []) as NutritionPlan[]
      setPlans(allPlans)

      // Group by diet name
      const byName: Record<string, NutritionPlan[]> = {}
      allPlans.forEach((p) => {
        const name = p.nom || 'Diete'
        if (!byName[name]) byName[name] = []
        byName[name].push(p)
      })

      const groups: DietGroup[] = []
      Object.entries(byName).forEach(([name, dietPlans]) => {
        const sorted = [...dietPlans].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        const tPlan = sorted.find((p) => p.actif && (p.meal_type === 'training' || p.meal_type === 'entrainement'))
          || sorted.find((p) => p.meal_type === 'training' || p.meal_type === 'entrainement') || null
        const rPlan = sorted.find((p) => p.actif && (p.meal_type === 'rest' || p.meal_type === 'repos'))
          || sorted.find((p) => p.meal_type === 'rest' || p.meal_type === 'repos') || null
        const isActive = dietPlans.some((p) => p.actif)
        groups.push({ name, tPlan, rPlan, isActive, versionCount: dietPlans.length, ids: dietPlans.map((p) => p.id) })
      })
      groups.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
      setDiets(groups)
    } finally {
      setLoading(false)
    }
  }, [athleteId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadPlans() }, [loadPlans])

  // Push browser history state when entering sub-views
  useEffect(() => {
    if (view !== 'list') {
      window.history.pushState({ nutritionView: view }, '')
    }
  }, [view])

  useEffect(() => {
    function handlePopState() {
      if (view !== 'list') {
        setView('list')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [view])

  // Load nutrition logs for history
  const loadNutriLogs = useCallback(async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90)
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0]

    // Fetch athlete user_id
    const { data: ath } = await supabase.from('athletes').select('id, user_id').eq('id', athleteId).single()
    if (!ath) return

    // Try both id and user_id as the athlete app may use either
    const [{ data: logsByUser }, { data: logsByAthlete }] = await Promise.all([
      supabase.from('nutrition_logs').select('id, athlete_id, date, plan_id, meals_log').eq('athlete_id', ath.user_id).gte('date', fromDate).order('date', { ascending: false }),
      supabase.from('nutrition_logs').select('id, athlete_id, date, plan_id, meals_log').eq('athlete_id', ath.id).gte('date', fromDate).order('date', { ascending: false }),
    ])
    const logs = ((logsByUser?.length ? logsByUser : logsByAthlete) || []) as NutritionLog[]
    setNutriLogs(logs)
  }, [athleteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ACCEPT CHANGES LOGIC ──

  // Flush pending changes: create a new version of the plan with accepted modifications
  const flushPendingChanges = useCallback(async (changes: PendingChange[]) => {
    if (changes.length === 0) return

    // Group changes by planId
    const byPlan: Record<string, PendingChange[]> = {}
    changes.forEach((c) => {
      if (!byPlan[c.planId]) byPlan[c.planId] = []
      byPlan[c.planId].push(c)
    })

    for (const [planId, planChanges] of Object.entries(byPlan)) {
      // Fetch current plan
      const { data: plan } = await supabase
        .from('nutrition_plans')
        .select('id, nom, athlete_id, coach_id, meal_type, calories_objectif, proteines, glucides, lipides, meals_data, actif, valid_from, macro_only, meal_times')
        .eq('id', planId)
        .single()
      if (!plan) continue

      // Parse meals_data
      let meals: any[] = []
      try {
        meals = typeof plan.meals_data === 'string' ? JSON.parse(plan.meals_data) : (plan.meals_data || [])
      } catch { meals = [] }

      // Normalize meals to { foods: [...] } format
      meals = meals.map((m: any) => {
        if (m && !Array.isArray(m) && m.foods) return m
        return { foods: Array.isArray(m) ? m : [] }
      })

      // Apply changes
      planChanges.forEach((change) => {
        if (change.type === 'replace') {
          // Replace the food at the given index with the replacement data
          if (meals[change.mealIndex]?.foods?.[change.foodIndex]) {
            const repl = change.foodData
            meals[change.mealIndex].foods[change.foodIndex] = {
              aliment: repl.aliment || repl.nom || '?',
              qte: repl.qte || 0,
              kcal: repl.kcal || 0,
              p: repl.p || 0,
              g: repl.g || 0,
              l: repl.l || 0,
            }
          }
        } else if (change.type === 'extra') {
          // Add extra food to the meal
          if (meals[change.mealIndex]) {
            if (!meals[change.mealIndex].foods) meals[change.mealIndex].foods = []
            const ex = change.foodData
            meals[change.mealIndex].foods.push({
              aliment: ex.aliment || ex.nom || '?',
              qte: ex.qte || 0,
              kcal: ex.kcal || 0,
              p: ex.p || 0,
              g: ex.g || 0,
              l: ex.l || 0,
            })
          }
        }
      })

      // Recalculate total macros from meals
      let totalK = 0, totalP = 0, totalG = 0, totalL = 0
      meals.forEach((m: any) => {
        (m.foods || []).forEach((f: any) => {
          totalK += parseFloat(f.kcal) || 0
          totalP += parseFloat(f.p) || 0
          totalG += parseFloat(f.g) || 0
          totalL += parseFloat(f.l) || 0
        })
      })

      // Create a new version of the plan (insert, not update)
      const { error } = await supabase.from('nutrition_plans').insert({
        nom: plan.nom,
        athlete_id: plan.athlete_id,
        coach_id: plan.coach_id || user?.id,
        meal_type: plan.meal_type,
        calories_objectif: Math.round(totalK),
        proteines: Math.round(totalP),
        glucides: Math.round(totalG),
        lipides: Math.round(totalL),
        meals_data: JSON.stringify(meals),
        actif: plan.actif,
        valid_from: new Date().toISOString().split('T')[0],
        macro_only: plan.macro_only || false,
        meal_times: plan.meal_times,
      })

      if (error) {
        toast('Erreur creation version: ' + error.message, 'error')
      } else {
        // Deactivate old plan if new one is active
        if (plan.actif) {
          await supabase.from('nutrition_plans').update({ actif: false }).eq('id', planId)
        }
        toast('Nouvelle version de diete creee avec les changements acceptes', 'success')
      }
    }

    // Reload plans
    loadPlans()
  }, [user?.id, loadPlans, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  function acceptChange(change: PendingChange) {
    setPendingChanges((prev) => {
      const next = [...prev, change]

      // Clear existing timer
      if (acceptTimerRef.current) clearTimeout(acceptTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

      // Start 10s countdown
      setAcceptCountdown(10)
      countdownIntervalRef.current = setInterval(() => {
        setAcceptCountdown((c) => {
          if (c <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
            return 0
          }
          return c - 1
        })
      }, 1000)

      // Flush after 10s
      acceptTimerRef.current = setTimeout(() => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
        setAcceptCountdown(0)
        setPendingChanges((current) => {
          flushPendingChanges(current)
          return []
        })
      }, 10000)

      return next
    })
  }

  function cancelPendingChanges() {
    if (acceptTimerRef.current) clearTimeout(acceptTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setPendingChanges([])
    setAcceptCountdown(0)
  }

  function flushNow() {
    if (acceptTimerRef.current) clearTimeout(acceptTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setAcceptCountdown(0)
    setPendingChanges((current) => {
      flushPendingChanges(current)
      return []
    })
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (acceptTimerRef.current) clearTimeout(acceptTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [])

  // Check if a specific change is already pending
  function isChangePending(planId: string, mealIndex: number, foodIndex: number, type: 'replace' | 'extra'): boolean {
    return pendingChanges.some((c) => c.planId === planId && c.mealIndex === mealIndex && c.foodIndex === foodIndex && c.type === type)
  }

  // Open editor for new diet
  function createNewDiet() {
    setEditPlanId(null)
    setEditPlanName('')
    setEditMealType('training')
    setEditMeals([{ foods: [] }])
    setEditMacroOnly(false)
    setEditMacros({ calories: 0, proteines: 0, glucides: 0, lipides: 0 })
    setView('editor')
  }

  // Open editor for existing diet
  async function editDiet(tId: string | null, rId: string | null) {
    const id = tId || rId
    if (!id) return
    const { data: plan } = await supabase.from('nutrition_plans').select('id, nom, athlete_id, coach_id, meal_type, calories_objectif, proteines, glucides, lipides, meals_data, actif, valid_from, created_at, macro_only, meal_times').eq('id', id).single()
    if (!plan) { toast('Plan introuvable', 'error'); return }

    let meals: MealData[] = []
    try {
      const parsed = typeof plan.meals_data === 'string' ? JSON.parse(plan.meals_data) : (plan.meals_data || [])
      meals = (parsed as any[]).map((m: any) => {
        if (m && !Array.isArray(m) && m.foods) return { foods: m.foods, pre_workout: m.pre_workout, time: m.time }
        return { foods: Array.isArray(m) ? m : [] }
      })
    } catch { /* empty */ }
    if (!meals.length) meals = [{ foods: [] }]

    setEditPlanId(plan.id)
    setEditPlanName(plan.nom || '')
    setEditMealType((plan.meal_type === 'rest' || plan.meal_type === 'repos') ? 'rest' : 'training')
    setEditMeals(meals)
    setEditMacroOnly(plan.macro_only || false)
    setEditMacros({
      calories: plan.calories_objectif || 0,
      proteines: plan.proteines || 0,
      glucides: plan.glucides || 0,
      lipides: plan.lipides || 0,
    })
    setView('editor')
  }

  // Open detail view
  function viewDiet(tPlan: NutritionPlan | null, rPlan: NutritionPlan | null) {
    setDetailDiet({ tPlan, rPlan })
    setDetailPlan(tPlan || rPlan)
    setDetailType(tPlan ? 'training' : 'rest')
    setView('detail')
  }

  // Toggle active
  async function toggleActive(isActive: boolean, tId: string | null, rId: string | null) {
    if (isActive) {
      await supabase.from('nutrition_plans').update({ actif: false }).eq('athlete_id', athleteId)
      const activations: Promise<any>[] = []
      if (tId) activations.push(Promise.resolve(supabase.from('nutrition_plans').update({ actif: true }).eq('id', tId)))
      if (rId) activations.push(Promise.resolve(supabase.from('nutrition_plans').update({ actif: true }).eq('id', rId)))
      await Promise.all(activations)
      toast('Diete activee !', 'success')
    } else {
      const deactivations: Promise<any>[] = []
      if (tId) deactivations.push(Promise.resolve(supabase.from('nutrition_plans').update({ actif: false }).eq('id', tId)))
      if (rId) deactivations.push(Promise.resolve(supabase.from('nutrition_plans').update({ actif: false }).eq('id', rId)))
      await Promise.all(deactivations)
      toast('Diete desactivee', 'success')
    }
    loadPlans()
  }

  // Delete diet
  async function deleteDiet(diet: DietGroup) {
    if (!confirm(`Supprimer "${diet.name}" et toutes ses versions ?`)) return
    const { error } = await supabase.from('nutrition_plans').delete().in('id', diet.ids)
    if (error) { toast('Erreur: ' + error.message, 'error'); return }
    toast('Diete supprimee', 'success')
    loadPlans()
  }

  // ── EDITOR VIEW ──
  if (view === 'editor') {
    return (
      <MealEditor
        athleteId={athleteId}
        planId={editPlanId}
        planName={editPlanName}
        mealType={editMealType}
        initialMeals={editMeals}
        macroOnly={editMacroOnly}
        initialMacros={editMacros}
        onSaved={() => { setView('list'); loadPlans() }}
        onBack={() => setView('list')}
      />
    )
  }

  // ── DETAIL VIEW ──
  if (view === 'detail' && detailDiet) {
    const plan = detailType === 'training' ? detailDiet.tPlan : detailDiet.rPlan

    function parseMeals(p: NutritionPlan | null): any[] {
      if (!p?.meals_data) return []
      try {
        const parsed = typeof p.meals_data === 'string' ? JSON.parse(p.meals_data) : p.meals_data
        return Array.isArray(parsed) ? parsed : []
      } catch { return [] }
    }

    const meals = parseMeals(plan)

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className={styles.editorHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>
              <i className="fa-solid fa-arrow-left" />
            </button>
            <div className="card-title" style={{ margin: 0 }}>{plan?.nom || 'Diete'}</div>
          </div>
          <button className="btn btn-red btn-sm" onClick={() => editDiet(detailDiet.tPlan?.id || null, detailDiet.rPlan?.id || null)}>
            <i className="fa-solid fa-pen" /> Modifier
          </button>
        </div>

        {/* ON/OFF tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            className={`athlete-tab-btn ${detailType === 'training' ? 'active' : ''}`}
            onClick={() => { setDetailType('training'); setDetailPlan(detailDiet.tPlan) }}
          >
            <i className="fa-solid fa-dumbbell" /> Jour ON
          </button>
          <button
            className={`athlete-tab-btn ${detailType === 'rest' ? 'active' : ''}`}
            onClick={() => { setDetailType('rest'); setDetailPlan(detailDiet.rPlan) }}
          >
            <i className="fa-solid fa-bed" /> Jour OFF
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {!plan ? (
            <div className="empty-state">
              <i className="fa-solid fa-utensils" />
              <p>Aucun plan pour les jours {detailType === 'training' ? "d'entrainement" : 'de repos'}</p>
            </div>
          ) : (
            <>
              {/* Macro summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
                <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{plan.calories_objectif || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>kcal</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{plan.proteines || 0}g</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Proteines</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{plan.glucides || 0}g</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Glucides</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{plan.lipides || 0}g</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Lipides</div>
                </div>
              </div>

              {plan.macro_only ? (
                <div style={{ textAlign: 'center', padding: 30, background: 'var(--bg3)', borderRadius: 10 }}>
                  <i className="fa-solid fa-utensils" style={{ fontSize: 24, color: 'var(--text3)', marginBottom: 10, display: 'block' }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Diete macros uniquement</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>L&apos;athlete compose ses repas librement</div>
                </div>
              ) : (
                meals.map((meal: any, idx: number) => {
                  const items = (meal && !Array.isArray(meal) && meal.foods) ? meal.foods : (Array.isArray(meal) ? meal : [])
                  return (
                    <div key={idx} className={styles.mealRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div className={styles.mealHeader} style={{ marginBottom: 0 }}>R{idx + 1}</div>
                        {meal?.pre_workout && <span className={styles.pwBadge}>Pre training</span>}
                      </div>
                      {items.length === 0 ? (
                        <div style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 13 }}>Aucun aliment</div>
                      ) : items.map((item: any, fi: number) => (
                        <div key={fi} className={styles.foodItem}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>{item.aliment || item.nom || '-'}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{item.qte}g</span>
                          </div>
                          <div style={{ fontSize: 12, textAlign: 'right' }}>
                            <span style={{ fontWeight: 600 }}>{item.kcal || 0} kcal</span>
                            <span style={{ color: 'var(--text3)', marginLeft: 8 }}>P:{item.p || 0}g G:{item.g || 0}g L:{item.l || 0}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── HISTORY VIEW ──
  if (view === 'history') {
    const planMap: Record<string, NutritionPlan> = {}
    plans.forEach((p) => { planMap[p.id] = p })

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - (histWeekOffset * 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekStartStr = toDateStr(weekStart)
    const weekEndStr = toDateStr(weekEnd)
    const today = toDateStr(now)

    const days: { date: string; dayLabel: string; dayNum: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      days.push({ date: toDateStr(d), dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'short' }), dayNum: d.getDate() })
    }

    const weekLabel = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      + ' — ' + weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

    let selectedDate = histSelectedDate
    if (!selectedDate || selectedDate < weekStartStr || selectedDate > weekEndStr) {
      selectedDate = days.find((d) => d.date === today)?.date || days[0].date
    }

    const dayLog = nutriLogs.find((l) => l.date === selectedDate)
    const plan = dayLog?.plan_id ? planMap[dayLog.plan_id] : null

    // Parse day log meals
    let mealsLog: any[] = []
    if (dayLog) {
      try { mealsLog = (typeof dayLog.meals_log === 'string' ? JSON.parse(dayLog.meals_log) : dayLog.meals_log) || [] } catch { /* empty */ }
    }

    // Compute adherence stats
    let actualK = 0, actualP = 0, actualG = 0, actualL = 0
    let plannedK = 0, plannedP = 0, plannedG = 0, plannedL = 0
    let followedCount = 0, replacedCount = 0, skippedCount = 0, totalFoods = 0

    mealsLog.forEach((meal: any) => {
      (meal?.foods || []).forEach((f: any) => {
        totalFoods++
        const orig = f.original || {}
        plannedK += parseFloat(orig.kcal) || 0
        plannedP += parseFloat(orig.p) || 0
        plannedG += parseFloat(orig.g) || 0
        plannedL += parseFloat(orig.l) || 0

        if (f.status === 'followed') {
          followedCount++
          actualK += parseFloat(orig.kcal) || 0
          actualP += parseFloat(orig.p) || 0
          actualG += parseFloat(orig.g) || 0
          actualL += parseFloat(orig.l) || 0
        } else if (f.status === 'replaced' && f.replacement) {
          replacedCount++
          actualK += parseFloat(f.replacement.kcal) || 0
          actualP += parseFloat(f.replacement.p) || 0
          actualG += parseFloat(f.replacement.g) || 0
          actualL += parseFloat(f.replacement.l) || 0
        } else {
          skippedCount++
        }
      })
      ;(meal?.extras || []).forEach((ex: any) => {
        actualK += parseFloat(ex.kcal) || 0
        actualP += parseFloat(ex.p) || 0
        actualG += parseFloat(ex.g) || 0
        actualL += parseFloat(ex.l) || 0
      })
    })

    const adherenceRate = totalFoods > 0 ? Math.round((followedCount / totalFoods) * 100) : 0

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Suivi nutritionnel</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{weekLabel}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>
            <i className="fa-solid fa-arrow-left" /> Retour
          </button>
        </div>

        {/* Week nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setHistWeekOffset(histWeekOffset + 1); setHistSelectedDate(null) }}>
            <i className="fa-solid fa-chevron-left" />
          </button>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {days.map((d) => {
              const hasLog = nutriLogs.some((l) => l.date === d.date)
              const isSelected = d.date === selectedDate
              const isToday = d.date === today
              return (
                <button
                  key={d.date}
                  onClick={() => setHistSelectedDate(d.date)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isSelected ? 'var(--primary)' : 'var(--bg3)',
                    color: isSelected ? '#fff' : 'var(--text2)',
                    fontWeight: isSelected ? 700 : 400,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    outline: isToday && !isSelected ? '2px solid var(--primary)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{d.dayLabel}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{d.dayNum}</span>
                  {hasLog && <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : 'var(--primary)' }} />}
                </button>
              )
            })}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setHistWeekOffset(Math.max(0, histWeekOffset - 1)); setHistSelectedDate(null) }}>
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>

        {/* Day content */}
        {!dayLog ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            <i className="fa-solid fa-utensils" style={{ fontSize: 28, marginBottom: 12, display: 'block' }} />
            <div style={{ fontSize: 14 }}>Aucun suivi nutritionnel ce jour</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>L&apos;athlete n&apos;a pas encore rempli son suivi</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 16 }}>
            {/* Plan name + adherence */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{plan?.nom || 'Plan supprime'}</span>
                {plan?.meal_type && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: 'var(--bg3)', color: 'var(--text3)', marginLeft: 8 }}>
                    {plan.meal_type === 'training' ? 'Entrainement' : 'Repos'}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800,
                color: adherenceRate >= 80 ? 'var(--success)' : adherenceRate >= 50 ? 'var(--warning)' : 'var(--danger)',
              }}>
                {adherenceRate}% adherence
              </div>
            </div>

            {/* Macros comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'kcal', actual: Math.round(actualK), planned: Math.round(plannedK) },
                { label: 'Prot', actual: Math.round(actualP), planned: Math.round(plannedP) },
                { label: 'Gluc', actual: Math.round(actualG), planned: Math.round(plannedG) },
                { label: 'Lip', actual: Math.round(actualL), planned: Math.round(plannedL) },
              ].map((m) => {
                const diff = m.actual - m.planned
                const diffColor = Math.abs(diff) < m.planned * 0.1 ? 'var(--success)' : 'var(--warning)'
                return (
                  <div key={m.label} style={{ textAlign: 'center', padding: 10, background: 'var(--bg3)', borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{m.actual}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>/ {m.planned} {m.label}</div>
                    {m.planned > 0 && <div style={{ fontSize: 10, fontWeight: 600, color: diffColor }}>{diff >= 0 ? '+' : ''}{diff}</div>}
                  </div>
                )
              })}
            </div>

            {/* Status breakdown */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 12 }}>
              <span style={{ color: 'var(--success)' }}><i className="fa-solid fa-check-circle" /> {followedCount} suivis</span>
              <span style={{ color: '#f59e0b' }}><i className="fa-solid fa-exchange" /> {replacedCount} remplaces</span>
              <span style={{ color: 'var(--danger)' }}><i className="fa-solid fa-times-circle" /> {skippedCount} sautes</span>
            </div>

            {/* Pending changes banner */}
            {pendingChanges.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', marginBottom: 12, borderRadius: 8,
                background: 'var(--primary-light, rgba(231,76,60,0.08))', border: '1px solid var(--primary)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  <i className="fa-solid fa-clock" style={{ marginRight: 6 }} />
                  {pendingChanges.length} changement{pendingChanges.length > 1 ? 's' : ''} en attente
                  {acceptCountdown > 0 && (
                    <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>
                      — application dans {acceptCountdown}s
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 10, padding: '2px 10px' }}
                    onClick={cancelPendingChanges}
                  >
                    Annuler
                  </button>
                  <button
                    className="btn btn-red btn-sm"
                    style={{ fontSize: 10, padding: '2px 10px' }}
                    onClick={flushNow}
                  >
                    <i className="fa-solid fa-check" /> Appliquer maintenant
                  </button>
                </div>
              </div>
            )}

            {/* Meal details */}
            {mealsLog.map((meal: any, mIdx: number) => {
              const mealLabel = meal?.meal_label || `Repas ${mIdx + 1}`
              const foods = meal?.foods || []
              const extras = meal?.extras || []
              return (
                <div key={mIdx} style={{ marginBottom: 12, padding: 12, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>{mealLabel}</div>
                  {foods.map((f: any, fIdx: number) => {
                    const orig = f.original || {}
                    const statusIcon = f.status === 'followed' ? { icon: 'fa-check-circle', color: 'var(--success)' }
                      : f.status === 'replaced' ? { icon: 'fa-exchange', color: '#f59e0b' }
                      : { icon: 'fa-times-circle', color: 'var(--danger)' }
                    return (
                      <div key={fIdx}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                          <i className={`fa-solid ${statusIcon.icon}`} style={{ color: statusIcon.color, width: 14 }} />
                          <span style={{ flex: 1, fontWeight: 500 }}>{orig.aliment || '?'}</span>
                          <span style={{ color: 'var(--text3)' }}>{orig.qte || 0}g</span>
                          <span style={{ fontWeight: 600 }}>{Math.round(parseFloat(orig.kcal) || 0)} kcal</span>
                        </div>
                        {f.status === 'replaced' && f.replacement && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 4px 22px', fontSize: 11, color: '#f59e0b' }}>
                            <i className="fa-solid fa-arrow-right" />
                            <span style={{ flex: 1 }}>{f.replacement.aliment || '?'} {f.replacement.qte || 0}g — {Math.round(parseFloat(f.replacement.kcal) || 0)} kcal</span>
                            {dayLog?.plan_id && !isChangePending(dayLog.plan_id, mIdx, fIdx, 'replace') && (
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: 10, padding: '2px 8px', lineHeight: 1.4 }}
                                onClick={() => acceptChange({
                                  planId: dayLog.plan_id!,
                                  mealIndex: mIdx,
                                  foodIndex: fIdx,
                                  type: 'replace',
                                  foodData: f.replacement,
                                })}
                              >
                                <i className="fa-solid fa-check" /> Accepter
                              </button>
                            )}
                            {dayLog?.plan_id && isChangePending(dayLog.plan_id, mIdx, fIdx, 'replace') && (
                              <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>
                                <i className="fa-solid fa-check-circle" /> Accepte
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {extras.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border-subtle)' }}>
                      <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>
                        <i className="fa-solid fa-plus-circle" style={{ marginRight: 4 }} />Ajoute par l&apos;athlete
                      </div>
                      {extras.map((ex: any, exIdx: number) => (
                        <div key={exIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 12 }}>
                          <i className="fa-solid fa-plus-circle" style={{ color: '#3b82f6', width: 14 }} />
                          <span style={{ flex: 1 }}>{ex.aliment || '?'}</span>
                          <span style={{ color: 'var(--text3)' }}>{ex.qte || 0}g</span>
                          <span style={{ fontWeight: 600 }}>{Math.round(parseFloat(ex.kcal) || 0)} kcal</span>
                          {dayLog?.plan_id && !isChangePending(dayLog.plan_id, mIdx, exIdx, 'extra') && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: 10, padding: '2px 8px', lineHeight: 1.4 }}
                              onClick={() => acceptChange({
                                planId: dayLog.plan_id!,
                                mealIndex: mIdx,
                                foodIndex: exIdx,
                                type: 'extra',
                                foodData: ex,
                              })}
                            >
                              <i className="fa-solid fa-check" /> Accepter
                            </button>
                          )}
                          {dayLog?.plan_id && isChangePending(dayLog.plan_id, mIdx, exIdx, 'extra') && (
                            <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>
                              <i className="fa-solid fa-check-circle" /> Accepte
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── LIST VIEW ──
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton height={48} borderRadius={10} />
        <Skeleton height={120} borderRadius={12} />
        <Skeleton height={120} borderRadius={12} />
      </div>
    )
  }

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-outline" onClick={() => { loadNutriLogs(); setHistWeekOffset(0); setHistSelectedDate(null); setView('history') }}>
          <i className="fa-solid fa-clock-rotate-left" /> Suivi
        </button>
        <button className="btn btn-red" onClick={createNewDiet}>
          <i className="fa-solid fa-plus" /> Nouvelle diete
        </button>
      </div>

      {/* Diet table */}
      {diets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="fa-solid fa-utensils" style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
            <p>Aucune diete</p>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-red" onClick={createNewDiet}>
                <i className="fa-solid fa-plus" /> Creer une diete
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.dietTable}>
            <thead>
              <tr>
                <th>Diete</th>
                <th style={{ textAlign: 'right' }}><span style={{ color: '#e74c3c' }}>ON</span> kcal</th>
                <th style={{ textAlign: 'right' }}><span style={{ color: '#3498db' }}>OFF</span> kcal</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {diets.map((d, idx) => {
                const tK = d.tPlan?.calories_objectif ?? null
                const rK = d.rPlan?.calories_objectif ?? null
                const tMacro = d.tPlan ? `P:${d.tPlan.proteines || 0} G:${d.tPlan.glucides || 0} L:${d.tPlan.lipides || 0}` : ''
                const rMacro = d.rPlan ? `P:${d.rPlan.proteines || 0} G:${d.rPlan.glucides || 0} L:${d.rPlan.lipides || 0}` : ''

                // Get all versions for this diet sorted by date (newest first)
                const allVersions = plans.filter((p) => (p.nom || 'Diete') === d.name).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
                const isExpanded = expandedVersions === d.name

                return (
                  <React.Fragment key={idx}>
                    <tr
                      className={`${styles.dietTr} ${d.isActive ? styles.dietTrActive : ''}`}
                      onClick={() => viewDiet(d.tPlan, d.rPlan)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{d.name}</span>
                          {d.isActive && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>ACTIF</span>
                          )}
                        </div>
                        {(() => {
                          const uniqueDates = new Set(plans.filter(p => (p.nom || 'Diete') === d.name).map(p => (p.created_at || '').slice(0, 10)).filter(Boolean))
                          return uniqueDates.size > 1 ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedVersions(isExpanded ? null : d.name) }}
                              style={{ fontSize: 10, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: 8 }} />
                              {uniqueDates.size} versions
                            </button>
                          ) : null
                        })()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {tK !== null ? (
                          <>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{tK.toLocaleString('fr-FR')}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{tMacro}</div>
                          </>
                        ) : <span style={{ color: 'var(--text3)' }}>--</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {rK !== null ? (
                          <>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{rK.toLocaleString('fr-FR')}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{rMacro}</div>
                          </>
                        ) : <span style={{ color: 'var(--text3)' }}>--</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <Toggle
                          checked={d.isActive}
                          onChange={(checked) => toggleActive(checked, d.tPlan?.id || null, d.rPlan?.id || null)}
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className={styles.dietBtn}
                          onClick={() => editDiet(d.tPlan?.id || null, d.rPlan?.id || null)}
                          title="Modifier"
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button
                          className={`${styles.dietBtn} ${styles.dietBtnDel}`}
                          onClick={() => deleteDiet(d)}
                          title="Supprimer"
                          style={{ marginLeft: 4 }}
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (() => {
                      // Group versions by date (day only, not full timestamp) to pair ON/OFF
                      const toDay = (s: string) => s.slice(0, 10) // '2026-04-04T...' → '2026-04-04'
                      const versionDays = [...new Set(allVersions.map(v => toDay(v.created_at || '')))].filter(Boolean).sort((a, b) => b.localeCompare(a))
                      return versionDays.map((dayStr, vi) => {
                        const vT = allVersions.find(p => toDay(p.created_at || '') === dayStr && (p.meal_type === 'training' || p.meal_type === 'entrainement')) || null
                        const vR = allVersions.find(p => toDay(p.created_at || '') === dayStr && (p.meal_type === 'rest' || p.meal_type === 'repos')) || null
                        const isCurrentActive = (vT?.actif || vR?.actif)
                        const vKcalT = vT?.calories_objectif || null
                        const vKcalR = vR?.calories_objectif || null
                        const vMacroT = vT ? `P:${vT.proteines || 0} G:${vT.glucides || 0} L:${vT.lipides || 0}` : ''
                        const vMacroR = vR ? `P:${vR.proteines || 0} G:${vR.glucides || 0} L:${vR.lipides || 0}` : ''
                        return (
                          <tr
                            key={`ver-${vi}`}
                            style={{ cursor: 'pointer', background: isCurrentActive ? 'rgba(179,8,8,0.03)' : 'transparent' }}
                            onClick={() => viewDiet(vT, vR)}
                          >
                            <td style={{ paddingLeft: 28 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i className="fa-solid fa-code-branch" style={{ fontSize: 10, color: 'var(--text3)' }} />
                                <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                                  {new Date(dayStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                {isCurrentActive && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>ACTIF</span>}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {vKcalT ? (
                                <>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{vKcalT.toLocaleString('fr-FR')}</div>
                                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{vMacroT}</div>
                                </>
                              ) : <span style={{ color: 'var(--text3)' }}>--</span>}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {vKcalR ? (
                                <>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{vKcalR.toLocaleString('fr-FR')}</div>
                                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{vMacroR}</div>
                                </>
                              ) : <span style={{ color: 'var(--text3)' }}>--</span>}
                            </td>
                            <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                              {!isCurrentActive && (
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ fontSize: 10, padding: '2px 8px' }}
                                  onClick={async () => {
                                    // Deactivate all versions of this diet
                                    const allIds = plans.filter(p => (p.nom || 'Diete') === d.name).map(p => p.id)
                                    await supabase.from('nutrition_plans').update({ actif: false }).in('id', allIds)
                                    // Reactivate this version
                                    if (vT) await supabase.from('nutrition_plans').update({ actif: true }).eq('id', vT.id)
                                    if (vR) await supabase.from('nutrition_plans').update({ actif: true }).eq('id', vR.id)
                                    toast('Version reactivee', 'success')
                                    loadPlans()
                                  }}
                                >
                                  Reactiver
                                </button>
                              )}
                            </td>
                            <td />
                          </tr>
                        )
                      })
                    })()}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
