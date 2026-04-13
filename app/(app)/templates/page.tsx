'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Tabs from '@/components/ui/Tabs'
import Skeleton from '@/components/ui/Skeleton'
import TrainingTemplatesList from '@/components/templates/TrainingTemplatesList'
import ProgramEditor from '@/components/training/ProgramEditor'
import MealEditor, { type MealData } from '@/components/nutrition/MealEditor'
import NutritionTemplatesList from '@/components/templates/NutritionTemplatesList'
import WorkflowsList from '@/components/templates/WorkflowsList'
import QuestionnaireTemplatesList from '@/components/templates/QuestionnaireTemplatesList'

const TABS = [
  { id: 'training', label: 'Training' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'workflow', label: 'Workflows' },
  { id: 'questionnaires', label: 'Questionnaires' },
]

interface TrainingTemplate {
  id: string
  nom: string
  category?: string | null
  pattern_type?: string
  pattern_data?: Record<string, unknown>
  sessions_data?: Array<{
    nom?: string
    jour?: string
    exercices?: Array<{ nom?: string; series?: string | number; reps?: string; exercice_id?: string | null; muscle_principal?: string; sets?: Array<Record<string, unknown>>; superset_id?: string | null }> | string
    exercises?: Array<{ nom?: string; series?: string | number; reps?: string }>
  }>
  created_at?: string
}

interface NutritionTemplate {
  id: string
  nom: string
  category?: string | null
  template_type?: string
  calories_objectif?: number
  proteines?: number
  glucides?: number
  lipides?: number
  meals_data?: unknown
  created_at?: string
}

export default function TemplatesPage() {
  const supabase = createClient()
  const { user, coach } = useAuth()

  const [activeTab, setActiveTab] = useState('training')
  const [loading, setLoading] = useState(true)

  // Training
  const [trainingTemplates, setTrainingTemplates] = useState<TrainingTemplate[]>([])
  const [editingTraining, setEditingTraining] = useState<string | null>(null)
  const [creatingTraining, setCreatingTraining] = useState(false)

  // Nutrition
  const [nutritionTemplates, setNutritionTemplates] = useState<NutritionTemplate[]>([])
  const [editingNutrition, setEditingNutrition] = useState<string | null>(null)
  const [creatingNutrition, setCreatingNutrition] = useState(false)
  const [nutritionTemplateType, setNutritionTemplateType] = useState<'diete' | 'jour' | 'repas'>('jour')

  // Workflows
  const [workflows, setWorkflows] = useState<Array<Record<string, unknown>>>([])

  // Questionnaires
  const [questionnaireTemplates, setQuestionnaireTemplates] = useState<Array<Record<string, unknown>>>([])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      if (activeTab === 'training') {
        const { data } = await supabase
          .from('training_templates')
          .select('id, nom, category, pattern_type, pattern_data, sessions_data, created_at')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        setTrainingTemplates((data || []) as TrainingTemplate[])
      } else if (activeTab === 'nutrition') {
        const { data } = await supabase
          .from('nutrition_templates')
          .select('id, nom, coach_id, template_type, category, calories_objectif, proteines, glucides, lipides, meals_data, created_at')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        setNutritionTemplates((data || []) as NutritionTemplate[])
      } else if (activeTab === 'workflow') {
        const { data } = await supabase
          .from('onboarding_workflows')
          .select('id, nom, coach_id, steps, created_at')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        setWorkflows(data || [])
      } else if (activeTab === 'questionnaires') {
        const { data } = await supabase
          .from('questionnaire_templates')
          .select('id, titre, coach_id, questions, created_at')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        setQuestionnaireTemplates(data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [user, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  // Re-fetch if Safari froze the JS while loading
  useRefetchOnResume(loadData, loading)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setEditingTraining(null)
    setCreatingTraining(false)
    setEditingNutrition(null)
    setCreatingNutrition(false)
  }

  // ── Training handlers ──
  const handleTrainingEdit = (id: string) => {
    setEditingTraining(id)
    setCreatingTraining(false)
  }

  const handleTrainingCreate = () => {
    setEditingTraining(null)
    setCreatingTraining(true)
  }

  const handleTrainingDelete = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return
    await supabase.from('training_templates').delete().eq('id', id)
    loadData()
  }

  const handleTrainingSaved = () => {
    setEditingTraining(null)
    setCreatingTraining(false)
    loadData()
  }

  const handleTrainingCancel = () => {
    setEditingTraining(null)
    setCreatingTraining(false)
  }

  // ── Nutrition handlers ──
  const handleNutritionEdit = (id: string) => {
    // Resolve the template type from the template being edited
    const tpl = nutritionTemplates.find((t) => t.id === id)
    if (tpl) setNutritionTemplateType((tpl.template_type as 'diete' | 'jour' | 'repas') || 'jour')
    setEditingNutrition(id)
    setCreatingNutrition(false)
  }

  const handleNutritionCreate = (type: 'diete' | 'jour' | 'repas') => {
    setNutritionTemplateType(type)
    setEditingNutrition(null)
    setCreatingNutrition(true)
  }

  const handleNutritionDelete = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return
    await supabase.from('nutrition_templates').delete().eq('id', id)
    loadData()
  }

  const handleNutritionSaved = () => {
    setEditingNutrition(null)
    setCreatingNutrition(false)
    loadData()
  }

  const handleNutritionCancel = () => {
    setEditingNutrition(null)
    setCreatingNutrition(false)
  }

  // ── Resolve templates for editing ──
  const editedTrainingTemplate = editingTraining
    ? trainingTemplates.find((t) => t.id === editingTraining)
    : null

  const editedNutritionTemplate = editingNutrition
    ? nutritionTemplates.find((t) => t.id === editingNutrition)
    : null

  const existingTrainingCategories = useMemo(
    () => [...new Set(trainingTemplates.map((t) => t.category).filter(Boolean))] as string[],
    [trainingTemplates]
  )
  const existingNutritionCategories = useMemo(
    () => [...new Set(nutritionTemplates.map((t) => t.category).filter(Boolean))] as string[],
    [nutritionTemplates]
  )

  /** Parse training template sessions_data into ProgramEditor's format */
  function parseEditorSessions(tpl: TrainingTemplate) {
    const sd = tpl.sessions_data || []
    return sd.map((s) => {
      let exs: Array<Record<string, unknown>> = []
      try {
        const raw = s.exercices ?? s.exercises ?? []
        exs = typeof raw === 'string' ? JSON.parse(raw) : (raw as Array<Record<string, unknown>>)
      } catch {
        exs = []
      }
      return {
        nom: s.nom || '',
        jour: s.jour || '',
        exercises: exs.map((ex) => ({
          nom: (ex.nom as string) || '',
          exercice_id: (ex.exercice_id as string) || null,
          muscle_principal: (ex.muscle_principal as string) || '',
          sets: (ex.sets as Array<Record<string, string>>) || undefined,
          // Legacy fields kept so normalizeExSets in ProgramEditor can convert them
          series: ex.series != null ? String(ex.series) : undefined,
          reps: ex.reps != null ? String(ex.reps) : undefined,
          superset_id: (ex.superset_id as string) || null,
        })),
      }
    })
  }

  /** Parse a flat array of meals into MealData[] */
  function parseMealsArray(raw: unknown): MealData[] {
    try {
      const arr = Array.isArray(raw) ? raw : []
      if (arr.length === 0) return [{ foods: [] }]
      return arr.map((meal: unknown) => {
        if (Array.isArray(meal)) {
          // Legacy format: array of food items directly
          return {
            foods: meal.map((f: Record<string, unknown>) => ({
              aliment: (f.aliment as string) || '',
              qte: (f.qte as number) || 100,
              kcal: (f.kcal as number) || 0,
              p: (f.p as number) || 0,
              g: (f.g as number) || 0,
              l: (f.l as number) || 0,
            })),
          }
        }
        const m = meal as Record<string, unknown>
        return {
          foods: ((m.foods as Array<Record<string, unknown>>) || []).map((f) => ({
            aliment: (f.aliment as string) || '',
            qte: (f.qte as number) || 100,
            kcal: (f.kcal as number) || 0,
            p: (f.p as number) || 0,
            g: (f.g as number) || 0,
            l: (f.l as number) || 0,
          })),
          pre_workout: m.pre_workout as boolean | undefined,
          time: m.time as string | undefined,
        }
      })
    } catch {
      return [{ foods: [] }]
    }
  }

  /** Parse nutrition template meals_data based on template_type */
  function parseNutritionTemplate(tpl: NutritionTemplate): {
    meals: MealData[]
    otherTab: { type: 'training' | 'rest'; id: string; meals: MealData[]; macros: { calories: number; proteines: number; glucides: number; lipides: number } } | null
    macroOnly: boolean
  } {
    try {
      const raw = typeof tpl.meals_data === 'string' ? JSON.parse(tpl.meals_data) : (tpl.meals_data || [])
      const tplType = (tpl.template_type || 'jour') as 'diete' | 'jour' | 'repas'

      if (tplType === 'diete' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
        // Full diet: { training: { meals: [...], macros: {...} }, rest: { meals: [...], macros: {...} } }
        const trainingData = raw.training || { meals: [], macros: { calories: 0, proteines: 0, glucides: 0, lipides: 0 } }
        const restData = raw.rest || { meals: [], macros: { calories: 0, proteines: 0, glucides: 0, lipides: 0 } }
        const trainingMeals = parseMealsArray(trainingData.meals)
        const restMeals = parseMealsArray(restData.meals)
        return {
          meals: trainingMeals,
          otherTab: {
            type: 'rest',
            id: tpl.id,
            meals: restMeals,
            macros: restData.macros || { calories: 0, proteines: 0, glucides: 0, lipides: 0 },
          },
          macroOnly: !!trainingData.macro_only,
        }
      }

      // jour or repas: flat array
      const meals = parseMealsArray(raw)
      const hasMeals = meals.some((m) => m.foods.length > 0)
      return {
        meals,
        otherTab: null,
        macroOnly: !hasMeals && !!(tpl.calories_objectif),
      }
    } catch {
      return { meals: [{ foods: [] }], otherTab: null, macroOnly: false }
    }
  }

  // ── Training editor view (ProgramEditor in template mode) ──
  if (activeTab === 'training' && (editingTraining || creatingTraining)) {
    const tpl = editedTrainingTemplate
    let patternData = {}
    try {
      patternData = tpl?.pattern_data
        ? (typeof tpl.pattern_data === 'string' ? JSON.parse(tpl.pattern_data as unknown as string) : tpl.pattern_data)
        : {}
    } catch { /* ignore */ }

    return (
      <div>
        <h1 className="page-title">Templates</h1>
        <ProgramEditor
          templateMode
          templateId={tpl?.id || null}
          templateCategory={tpl?.category || ''}
          existingCategories={existingTrainingCategories}
          initialName={tpl?.nom || ''}
          initialPatternType={tpl?.pattern_type || 'pattern'}
          initialPatternData={patternData}
          initialSessions={tpl ? (parseEditorSessions(tpl) as never) : undefined}
          onClose={handleTrainingCancel}
          onSaved={handleTrainingSaved}
        />
      </div>
    )
  }

  // ── Nutrition editor view (MealEditor in template mode) ──
  if (activeTab === 'nutrition' && (editingNutrition || creatingNutrition)) {
    const tpl = editedNutritionTemplate
    const parsed = tpl ? parseNutritionTemplate(tpl) : { meals: [{ foods: [] }], otherTab: null, macroOnly: false }

    return (
      <div>
        <h1 className="page-title">Templates</h1>
        <MealEditor
          templateMode
          templateType={nutritionTemplateType}
          templateId={tpl?.id || null}
          templateCategory={tpl?.category || ''}
          existingCategories={existingNutritionCategories}
          planId={null}
          planName={tpl?.nom || ''}
          mealType="training"
          initialMeals={parsed.meals}
          macroOnly={parsed.macroOnly}
          initialMacros={tpl ? { calories: tpl.calories_objectif || 0, proteines: tpl.proteines || 0, glucides: tpl.glucides || 0, lipides: tpl.lipides || 0 } : undefined}
          initialOtherTab={parsed.otherTab}
          onSaved={handleNutritionSaved}
          onBack={handleNutritionCancel}
        />
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Templates</h1>
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={60} borderRadius={8} />
            <Skeleton height={60} borderRadius={8} />
            <Skeleton height={60} borderRadius={8} />
          </div>
        ) : (
          <>
            {activeTab === 'training' && (
              <TrainingTemplatesList
                templates={trainingTemplates}
                onEdit={handleTrainingEdit}
                onCreate={handleTrainingCreate}
                onDelete={handleTrainingDelete}
              />
            )}

            {activeTab === 'nutrition' && (
              <NutritionTemplatesList
                templates={nutritionTemplates as never[]}
                onRefresh={loadData}
                onEdit={handleNutritionEdit}
                onCreate={handleNutritionCreate}
                onDelete={handleNutritionDelete}
              />
            )}

            {activeTab === 'workflow' && (
              <WorkflowsList
                workflows={workflows as never[]}
                onRefresh={loadData}
              />
            )}

            {activeTab === 'questionnaires' && (
              <QuestionnaireTemplatesList
                templates={questionnaireTemplates as never[]}
                onRefresh={loadData}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
