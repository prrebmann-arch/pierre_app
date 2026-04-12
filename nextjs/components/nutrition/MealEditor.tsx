'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifyAthlete } from '@/lib/push'
import FoodSearch, { type Aliment } from './FoodSearch'
import styles from '@/styles/nutrition.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FoodItem {
  aliment: string
  qte: number
  kcal: number
  p: number
  g: number
  l: number
  allow_conversion?: boolean
}

export interface MealData {
  foods: FoodItem[]
  pre_workout?: boolean
  time?: string
}

interface MealEditorProps {
  athleteId: string
  /** Plan ID when editing existing, null for new */
  planId: string | null
  /** Initial plan name */
  planName: string
  /** Initial meal type: 'training' | 'rest' */
  mealType: 'training' | 'rest'
  /** Initial meals data */
  initialMeals: MealData[]
  /** Macro-only mode */
  macroOnly?: boolean
  /** Initial macro targets (for macro-only mode) */
  initialMacros?: { calories: number; proteines: number; glucides: number; lipides: number }
  /** Called after save */
  onSaved: () => void
  /** Called on back */
  onBack: () => void
}

/** Local aliment DB cache */
let alimentsCache: Aliment[] | null = null

function findAliment(name: string): Aliment | null {
  if (!alimentsCache) return null
  return alimentsCache.find((a) => a.nom === name) || null
}

function calcFoodMacros(food: FoodItem): { kcal: number; p: number; g: number; l: number } {
  const a = findAliment(food.aliment)
  if (a) {
    const q = food.qte
    return {
      kcal: Math.round(a.calories * q),
      p: parseFloat((a.proteines * q).toFixed(1)),
      g: parseFloat((a.glucides * q).toFixed(1)),
      l: parseFloat((a.lipides * q).toFixed(1)),
    }
  }
  return { kcal: food.kcal || 0, p: food.p || 0, g: food.g || 0, l: food.l || 0 }
}

function calcMealTotals(foods: FoodItem[]): { kcal: number; p: number; g: number; l: number } {
  let kcal = 0, p = 0, g = 0, l = 0
  for (const f of foods) {
    const m = calcFoodMacros(f)
    kcal += m.kcal; p += m.p; g += m.g; l += m.l
  }
  return { kcal, p, g, l }
}

export default function MealEditor({
  athleteId, planId, planName: initName, mealType: initMealType,
  initialMeals, macroOnly: initMacroOnly, initialMacros, onSaved, onBack,
}: MealEditorProps) {
  const supabase = createClient()
  const { user } = useAuth()
  const { toast } = useToast()

  const [meals, setMeals] = useState<MealData[]>(initialMeals.length ? initialMeals : [{ foods: [] }])
  const [activeMealIdx, setActiveMealIdx] = useState(0)
  const [planName, setPlanName] = useState(initName)
  const [mealType, setMealType] = useState<'training' | 'rest'>(initMealType)
  const [isMacroOnly, setIsMacroOnly] = useState(initMacroOnly || false)
  const [manualMacros, setManualMacros] = useState(initialMacros || { calories: 0, proteines: 0, glucides: 0, lipides: 0 })
  const [saving, setSaving] = useState(false)
  const [foodRefreshKey, setFoodRefreshKey] = useState(0)

  // Paired plan: store meals for the other tab so we can save both on submit
  const [tempMeals, setTempMeals] = useState<Record<string, { meals: MealData[]; macros?: { calories: number; proteines: number; glucides: number; lipides: number } }>>({})

  // When switching meal type, store current meals and load other tab's meals
  function switchMealType(newType: 'training' | 'rest') {
    if (newType === mealType) return
    // Save current tab meals to temp
    const currentMacros = isMacroOnly ? manualMacros : undefined
    setTempMeals((prev) => ({ ...prev, [mealType]: { meals: [...meals], macros: currentMacros } }))
    // Load other tab from temp if available
    const other = tempMeals[newType]
    if (other) {
      setMeals(other.meals.length ? other.meals : [{ foods: [] }])
      if (other.macros) setManualMacros(other.macros)
    } else {
      setMeals([{ foods: [] }])
    }
    setActiveMealIdx(0)
    setMealType(newType)
  }

  // Load aliments cache
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('aliments_db').select('*').order('nom', { ascending: true }).limit(500)
      alimentsCache = (data || []) as Aliment[]
    }
    load()
  }, [supabase, foodRefreshKey])

  // Compute grand totals
  const totals = meals.reduce(
    (acc, meal) => {
      const mt = calcMealTotals(meal.foods)
      return { kcal: acc.kcal + mt.kcal, p: acc.p + mt.p, g: acc.g + mt.g, l: acc.l + mt.l }
    },
    { kcal: 0, p: 0, g: 0, l: 0 },
  )

  // Add food to active meal
  const addFood = useCallback((aliment: Aliment) => {
    setMeals((prev) => {
      const copy = prev.map((m) => ({ ...m, foods: [...m.foods] }))
      const idx = activeMealIdx < copy.length ? activeMealIdx : 0
      copy[idx].foods.push({ aliment: aliment.nom, qte: 100, kcal: 0, p: 0, g: 0, l: 0 })
      return copy
    })
  }, [activeMealIdx])

  // Update food quantity
  function updateFoodQty(mealIdx: number, foodIdx: number, qte: number) {
    setMeals((prev) => {
      const copy = prev.map((m) => ({ ...m, foods: [...m.foods] }))
      copy[mealIdx].foods[foodIdx] = { ...copy[mealIdx].foods[foodIdx], qte }
      return copy
    })
  }

  // Remove food
  function removeFood(mealIdx: number, foodIdx: number) {
    setMeals((prev) => {
      const copy = prev.map((m) => ({ ...m, foods: [...m.foods] }))
      copy[mealIdx].foods.splice(foodIdx, 1)
      return copy
    })
  }

  // Add meal
  function addMeal() {
    setMeals((prev) => [...prev, { foods: [] }])
    setActiveMealIdx(meals.length)
  }

  // Remove meal
  function removeMeal(idx: number) {
    if (meals.length <= 1) { toast('Minimum 1 repas', 'error'); return }
    setMeals((prev) => prev.filter((_, i) => i !== idx))
    if (activeMealIdx >= meals.length - 1) setActiveMealIdx(Math.max(0, meals.length - 2))
  }

  // Toggle pre-workout
  function togglePreWorkout(idx: number) {
    setMeals((prev) => prev.map((m, i) => i === idx ? { ...m, pre_workout: !m.pre_workout } : m))
  }

  // Save plan
  async function handleSave() {
    if (!planName.trim()) { toast('Le nom est obligatoire', 'error'); return }
    if (!user) return
    setSaving(true)

    const mealsData = isMacroOnly ? [] : meals.map((m) => {
      const foods = m.foods.map((f) => {
        const macros = calcFoodMacros(f)
        return { aliment: f.aliment, qte: f.qte, ...macros, allow_conversion: f.allow_conversion || false }
      })
      const obj: any = { foods }
      if (m.pre_workout) obj.pre_workout = true
      if (m.time) obj.time = m.time
      return obj
    })

    const finalTotals = isMacroOnly ? manualMacros : {
      calories: totals.kcal, proteines: Math.round(totals.p), glucides: Math.round(totals.g), lipides: Math.round(totals.l),
    }

    const today = new Date().toISOString().split('T')[0]

    // Deactivate all plans for this athlete
    await supabase.from('nutrition_plans').update({ actif: false }).eq('athlete_id', athleteId)

    const payload = {
      nom: planName.trim(),
      meal_type: mealType,
      meals_data: JSON.stringify(mealsData),
      calories_objectif: finalTotals.calories,
      proteines: finalTotals.proteines,
      glucides: finalTotals.glucides,
      lipides: finalTotals.lipides,
      valid_from: today,
      actif: true,
      athlete_id: athleteId,
      coach_id: user.id,
      macro_only: isMacroOnly || false,
    }

    const { error } = await supabase.from('nutrition_plans').insert(payload)
    if (error) { toast('Erreur: ' + error.message, 'error'); setSaving(false); return }

    // Save paired plan (other tab) if it has food data
    const otherType = mealType === 'training' ? 'rest' : 'training'
    const otherTemp = tempMeals[otherType]
    if (otherTemp?.meals?.length) {
      const hasFood = otherTemp.meals.some((m) => m.foods.length > 0)
      if (hasFood) {
        const otherMealsData = otherTemp.meals.map((m) => {
          const foods = m.foods.map((f) => {
            const macros = calcFoodMacros(f)
            return { aliment: f.aliment, qte: f.qte, ...macros, allow_conversion: f.allow_conversion || false }
          })
          const obj: any = { foods }
          if (m.pre_workout) obj.pre_workout = true
          if (m.time) obj.time = m.time
          return obj
        })
        const otherTotals = otherMealsData.reduce(
          (acc: { kcal: number; p: number; g: number; l: number }, m: any) => {
            (m.foods || []).forEach((f: any) => { acc.kcal += f.kcal || 0; acc.p += f.p || 0; acc.g += f.g || 0; acc.l += f.l || 0 })
            return acc
          },
          { kcal: 0, p: 0, g: 0, l: 0 },
        )
        await supabase.from('nutrition_plans').insert({
          nom: planName.trim(),
          meal_type: otherType,
          meals_data: JSON.stringify(otherMealsData),
          calories_objectif: Math.round(otherTotals.kcal),
          proteines: Math.round(otherTotals.p),
          glucides: Math.round(otherTotals.g),
          lipides: Math.round(otherTotals.l),
          valid_from: today,
          actif: true,
          athlete_id: athleteId,
          coach_id: user.id,
          macro_only: false,
        })
      }
    }

    // Notify athlete (DB + push)
    const { data: athlete } = await supabase.from('athletes').select('user_id').eq('id', athleteId).single()
    if (athlete?.user_id) {
      await notifyAthlete(
        athlete.user_id, 'nutrition', 'Plan nutrition mis a jour',
        `Votre coach a ${planId ? 'modifie' : 'cree'} votre plan nutritionnel "${planName.trim()}"`,
      )
    }

    toast('Diete sauvegardee !', 'success')
    setSaving(false)
    onSaved()
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div className={styles.editorHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>
            {planId ? `Modifier — ${planName}` : `Nouveau plan`}
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            <button
              className={`athlete-tab-btn ${mealType === 'training' ? 'active' : ''}`}
              onClick={() => switchMealType('training')}
            >
              <i className="fa-solid fa-dumbbell" /> Jour ON
            </button>
            <button
              className={`athlete-tab-btn ${mealType === 'rest' ? 'active' : ''}`}
              onClick={() => switchMealType('rest')}
            >
              <i className="fa-solid fa-bed" /> Jour OFF
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={onBack}>
            <i className="fa-solid fa-arrow-left" /> Retour
          </button>
          <button className="btn btn-red" onClick={handleSave} disabled={saving}>
            <i className="fa-solid fa-floppy-disk" /> {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Macro header */}
      <div className={styles.editorMacros}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Nom</label>
          <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="ex: Plan S1" />
        </div>
        {isMacroOnly ? (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>kcal total</label>
              <input type="number" value={manualMacros.calories || ''} onChange={(e) => setManualMacros((p) => ({ ...p, calories: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Proteines (g)</label>
              <input type="number" value={manualMacros.proteines || ''} onChange={(e) => setManualMacros((p) => ({ ...p, proteines: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Glucides (g)</label>
              <input type="number" value={manualMacros.glucides || ''} onChange={(e) => setManualMacros((p) => ({ ...p, glucides: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Lipides (g)</label>
              <input type="number" value={manualMacros.lipides || ''} onChange={(e) => setManualMacros((p) => ({ ...p, lipides: parseInt(e.target.value) || 0 }))} />
            </div>
          </>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>kcal total</label>
              <div className={styles.macroVal}>{totals.kcal}</div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Proteines (g)</label>
              <div className={styles.macroVal}>{totals.p.toFixed(1)}</div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Glucides (g)</label>
              <div className={styles.macroVal}>{totals.g.toFixed(1)}</div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Lipides (g)</label>
              <div className={styles.macroVal}>{totals.l.toFixed(1)}</div>
            </div>
          </>
        )}
      </div>

      {/* Options bar */}
      <div className={styles.optionsBar}>
        <label
          className={`${styles.optionPill} ${isMacroOnly ? styles.optionPillActive : ''}`}
          onClick={() => setIsMacroOnly(!isMacroOnly)}
        >
          <i className="fa-solid fa-sliders" /> Macros uniquement
        </label>
      </div>

      {/* Body: sidebar + meals */}
      <div className={styles.editorBody}>
        {/* Food library (hidden in macro-only mode) */}
        {!isMacroOnly && (
          <FoodSearch
            onSelect={addFood}
            refreshKey={foodRefreshKey}
          />
        )}

        {/* Meals area (hidden in macro-only mode) */}
        {!isMacroOnly && (
          <div className={styles.mealsArea}>
            {meals.map((meal, mealIdx) => {
              const mealTotals = calcMealTotals(meal.foods)
              const isActive = mealIdx === activeMealIdx
              return (
                <div
                  key={mealIdx}
                  className={`${styles.mealBlock} ${isActive ? styles.mealBlockActive : ''}`}
                  onClick={() => setActiveMealIdx(mealIdx)}
                >
                  <div className={styles.mealHead}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={styles.mealTitle}>R{mealIdx + 1}</span>
                      {meal.pre_workout && <span className={styles.pwBadge}>Pre training</span>}
                      {meal.foods.length > 0 && (
                        <span className={styles.mealHeadMacros}>
                          {mealTotals.kcal} kcal | P:{mealTotals.p.toFixed(1)}g G:{mealTotals.g.toFixed(1)}g L:{mealTotals.l.toFixed(1)}g
                        </span>
                      )}
                    </div>
                    <div className={styles.mealActions}>
                      <button
                        type="button"
                        className={`btn btn-outline btn-sm ${meal.pre_workout ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); togglePreWorkout(mealIdx) }}
                        title="Pre training"
                        style={meal.pre_workout ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(179,8,8,0.1)' } : {}}
                      >
                        <i className="fa-solid fa-person-running" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={(e) => { e.stopPropagation(); removeMeal(mealIdx) }}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>

                  {/* Food header */}
                  <div className={styles.foodHeader}>
                    <span className={styles.fhName}>Aliment</span>
                    <span className={styles.fhQty}>Qte</span>
                    <span className={styles.fhKcal}>kcal</span>
                    <span className={styles.fhMacro}>P</span>
                    <span className={styles.fhMacro}>G</span>
                    <span className={styles.fhMacro}>L</span>
                    <span className={styles.fhRm} />
                  </div>

                  {/* Food rows */}
                  <div>
                    {meal.foods.map((food, foodIdx) => {
                      const fm = calcFoodMacros(food)
                      return (
                        <div key={foodIdx} className={styles.foodRow}>
                          <span className={styles.foodName}>{food.aliment || '—'}</span>
                          <input
                            type="number"
                            className={styles.foodQty}
                            value={food.qte}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateFoodQty(mealIdx, foodIdx, parseFloat(e.target.value) || 0)}
                            placeholder="g"
                          />
                          <span className={styles.foodUnit}>g</span>
                          <span className={`${styles.foodMacro} ${styles.foodMacroKcal}`}>{fm.kcal}</span>
                          <span className={styles.foodMacro}>{fm.p.toFixed(1)}p</span>
                          <span className={styles.foodMacro}>{fm.g.toFixed(1)}g</span>
                          <span className={styles.foodMacro}>{fm.l.toFixed(1)}l</span>
                          <button
                            type="button"
                            className={styles.foodRm}
                            onClick={(e) => { e.stopPropagation(); removeFood(mealIdx, foodIdx) }}
                          >
                            &times;
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className={styles.mealsFooter}>
              <button className="btn btn-outline" onClick={addMeal}>
                <i className="fa-solid fa-plus" /> Repas
              </button>
            </div>
          </div>
        )}

        {/* Macro-only info */}
        {isMacroOnly && (
          <div style={{ flex: 1, padding: 40, textAlign: 'center' }}>
            <i className="fa-solid fa-utensils" style={{ fontSize: 24, color: 'var(--text3)', marginBottom: 10, display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Diete macros uniquement</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>L&apos;athlete compose ses repas librement dans les macros definies</div>
          </div>
        )}
      </div>
    </div>
  )
}
