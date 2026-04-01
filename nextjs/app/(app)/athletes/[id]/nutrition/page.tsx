'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Toggle from '@/components/ui/Toggle'
import Skeleton from '@/components/ui/Skeleton'
import MealEditor, { type MealData } from '@/components/nutrition/MealEditor'
import styles from '@/styles/nutrition.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

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

type View = 'list' | 'editor' | 'detail'

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

  const loadPlans = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('nutrition_plans')
      .select('*')
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
    setLoading(false)
  }, [athleteId, supabase])

  useEffect(() => { loadPlans() }, [loadPlans])

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
    const { data: plan } = await supabase.from('nutrition_plans').select('*').eq('id', id).single()
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

                return (
                  <tr
                    key={idx}
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
                      {d.versionCount > 1 && (
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{d.versionCount} versions</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {tK !== null ? (
                        <>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{tK.toLocaleString('fr-FR')}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{tMacro}</div>
                        </>
                      ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {rK !== null ? (
                        <>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{rK.toLocaleString('fr-FR')}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{rMacro}</div>
                        </>
                      ) : <span style={{ color: 'var(--text3)' }}>—</span>}
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
