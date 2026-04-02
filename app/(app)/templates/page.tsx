'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import Tabs from '@/components/ui/Tabs'
import Skeleton from '@/components/ui/Skeleton'
import TrainingTemplatesList from '@/components/templates/TrainingTemplatesList'
import TrainingTemplateEditor from '@/components/templates/TrainingTemplateEditor'
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
    exercices?: Array<{ nom?: string; series?: string | number; reps?: string; exercice_id?: string | null; muscle_principal?: string }> | string
    exercises?: Array<{ nom?: string; series?: string | number; reps?: string }>
  }>
  created_at?: string
}

export default function TemplatesPage() {
  const supabase = createClient()
  const { coach } = useAuth()

  const [activeTab, setActiveTab] = useState('training')
  const [loading, setLoading] = useState(true)

  // Training
  const [trainingTemplates, setTrainingTemplates] = useState<TrainingTemplate[]>([])
  const [editingTraining, setEditingTraining] = useState<string | null>(null)
  const [creatingTraining, setCreatingTraining] = useState(false)

  // Nutrition
  const [nutritionTemplates, setNutritionTemplates] = useState<Array<Record<string, unknown>>>([])

  // Workflows
  const [workflows, setWorkflows] = useState<Array<Record<string, unknown>>>([])

  // Questionnaires
  const [questionnaireTemplates, setQuestionnaireTemplates] = useState<Array<Record<string, unknown>>>([])

  const loadData = useCallback(async () => {
    if (!coach) return
    setLoading(true)
    try {
      if (activeTab === 'training') {
        const { data } = await supabase
          .from('training_templates')
          .select('*')
          .eq('coach_id', coach.id)
          .order('created_at', { ascending: false })
        setTrainingTemplates((data || []) as TrainingTemplate[])
      } else if (activeTab === 'nutrition') {
        const { data } = await supabase
          .from('nutrition_templates')
          .select('*')
          .eq('coach_id', coach.id)
          .order('created_at', { ascending: false })
        setNutritionTemplates(data || [])
      } else if (activeTab === 'workflow') {
        const { data } = await supabase
          .from('onboarding_workflows')
          .select('*')
          .eq('coach_id', coach.id)
          .order('created_at', { ascending: false })
        setWorkflows(data || [])
      } else if (activeTab === 'questionnaires') {
        const { data } = await supabase
          .from('questionnaire_templates')
          .select('*')
          .eq('coach_id', coach.id)
          .order('created_at', { ascending: false })
        setQuestionnaireTemplates(data || [])
      }
    } finally {
      setLoading(false)
    }
  }, [coach, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setEditingTraining(null)
    setCreatingTraining(false)
  }

  const handleTrainingEdit = async (id: string) => {
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

  // Resolve template for editing
  const editedTemplate = editingTraining
    ? trainingTemplates.find((t) => t.id === editingTraining)
    : null

  const existingTrainingCategories = [...new Set(trainingTemplates.map((t) => t.category).filter(Boolean))] as string[]

  function parseEditorSessions(tpl: TrainingTemplate) {
    const sd = tpl.sessions_data || []
    return sd.map((s) => {
      let exs: Array<{ nom?: string; series?: string | number; reps?: string; exercice_id?: string | null; muscle_principal?: string }> = []
      try {
        const raw = s.exercices ?? s.exercises ?? []
        exs = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {
        exs = []
      }
      return {
        nom: s.nom || '',
        jour: s.jour || '',
        exercises: exs.map((ex) => ({
          nom: ex.nom || '',
          exercice_id: ex.exercice_id || null,
          series: String(ex.series || '4'),
          reps: String(ex.reps || '10'),
          muscle_principal: ex.muscle_principal || '',
        })),
      }
    })
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
              <>
                {editingTraining && editedTemplate ? (
                  <TrainingTemplateEditor
                    templateId={editedTemplate.id}
                    initialName={editedTemplate.nom}
                    initialCategory={editedTemplate.category || ''}
                    initialPatternType={editedTemplate.pattern_type}
                    initialPatternData={editedTemplate.pattern_data as { pattern?: string; days?: string[] }}
                    initialSessions={parseEditorSessions(editedTemplate)}
                    existingCategories={existingTrainingCategories}
                    onSave={handleTrainingSaved}
                    onCancel={handleTrainingCancel}
                  />
                ) : creatingTraining ? (
                  <TrainingTemplateEditor
                    existingCategories={existingTrainingCategories}
                    onSave={handleTrainingSaved}
                    onCancel={handleTrainingCancel}
                  />
                ) : (
                  <TrainingTemplatesList
                    templates={trainingTemplates}
                    onEdit={handleTrainingEdit}
                    onCreate={handleTrainingCreate}
                    onDelete={handleTrainingDelete}
                  />
                )}
              </>
            )}

            {activeTab === 'nutrition' && (
              <NutritionTemplatesList
                templates={nutritionTemplates as never[]}
                onRefresh={loadData}
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
