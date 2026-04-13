'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import FormGroup from '@/components/ui/FormGroup'

const STEP_TYPES = [
  { value: 'video', label: 'Video', icon: 'fa-play-circle' },
  { value: 'contract', label: 'Contrat', icon: 'fa-file-signature' },
  { value: 'questionnaire', label: 'Questionnaire', icon: 'fa-clipboard-list' },
  { value: 'formation', label: 'Formation', icon: 'fa-graduation-cap' },
  { value: 'payment', label: 'Paiement', icon: 'fa-credit-card' },
] as const

type StepType = (typeof STEP_TYPES)[number]['value']

interface WorkflowStep {
  type: StepType
  title: string
  position: number
  video_url?: string
  contract_text?: string
  questions?: Array<{ label: string; type: string; choices?: string[] }>
  formation_id?: string
}

interface Workflow {
  id: string
  name: string
  description?: string | null
  steps: WorkflowStep[] | string
  created_at?: string
}

interface Props {
  workflows: Workflow[]
  onRefresh: () => void
}

function parseSteps(raw: WorkflowStep[] | string | null | undefined): WorkflowStep[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return raw
}

export default function WorkflowsList({ workflows, onRefresh }: Props) {
  const supabase = createClient()
  const { coach } = useAuth()
  const { toast } = useToast()

  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Editor state
  const [wfName, setWfName] = useState('')
  const [wfDesc, setWfDesc] = useState('')
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [saving, setSaving] = useState(false)

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    setWfName('')
    setWfDesc('')
    setSteps([])
  }

  const startEdit = (wf: Workflow) => {
    setEditing(wf.id)
    setCreating(false)
    setWfName(wf.name)
    setWfDesc(wf.description || '')
    setSteps(parseSteps(wf.steps))
  }

  const cancelEdit = () => {
    setEditing(null)
    setCreating(false)
  }

  const addStep = () => {
    setSteps((prev) => [...prev, { type: 'video', title: '', position: prev.length + 1 }])
  }

  const updateStep = useCallback((idx: number, updates: Partial<WorkflowStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)))
  }, [])

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i + 1 })))
  }

  const moveStep = (idx: number, dir: number) => {
    const target = idx + dir
    if (target < 0 || target >= steps.length) return
    setSteps((prev) => {
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((s, i) => ({ ...s, position: i + 1 }))
    })
  }

  const handleSave = async () => {
    if (!wfName.trim()) {
      toast('Le nom est requis', 'error')
      return
    }
    if (!coach) return

    setSaving(true)
    const payload = {
      name: wfName.trim(),
      description: wfDesc.trim() || null,
      steps,
      coach_id: coach.id,
    }

    let error
    if (editing) {
      const { name, description, steps: s } = payload
      ;({ error } = await supabase.from('onboarding_workflows').update({ name, description, steps: s }).eq('id', editing))
    } else {
      ;({ error } = await supabase.from('onboarding_workflows').insert(payload))
    }
    setSaving(false)

    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast(editing ? 'Workflow mis a jour' : 'Workflow cree')
    cancelEdit()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce workflow ?')) return
    const { error } = await supabase.from('onboarding_workflows').delete().eq('id', id)
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast('Workflow supprime')
    onRefresh()
  }

  // Editor view
  if (editing || creating) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18 }}>
          {editing ? 'Modifier le workflow' : 'Nouveau workflow'}
        </h2>
        <FormGroup label="Nom du workflow">
          <input type="text" className="form-control" value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="Ex: Parcours Premium" />
        </FormGroup>
        <FormGroup label="Description (optionnel)">
          <input type="text" className="form-control" value={wfDesc} onChange={(e) => setWfDesc(e.target.value)} placeholder="Ex: Video + contrat + formation 7 jours" />
        </FormGroup>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px' }}>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text2)' }}>Etapes du parcours</h3>
          <Button variant="outline" size="sm" onClick={addStep}>
            <i className="fas fa-plus" /> Ajouter une etape
          </Button>
        </div>

        {steps.length === 0 && (
          <p style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
            Aucune etape. Cliquez sur &quot;Ajouter une etape&quot;.
          </p>
        )}

        {steps.map((step, idx) => (
          <StepEditor
            key={idx}
            step={step}
            index={idx}
            total={steps.length}
            onChange={(updates) => updateStep(idx, updates)}
            onRemove={() => removeStep(idx)}
            onMove={(dir) => moveStep(idx, dir)}
          />
        ))}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Button variant="outline" onClick={cancelEdit}>Annuler</Button>
          <Button variant="red" onClick={handleSave} loading={saving}>
            <i className="fas fa-check" /> {editing ? 'Sauvegarder' : 'Creer'}
          </Button>
        </div>
      </div>
    )
  }

  const parsedWorkflows = useMemo(
    () => workflows.map((wf) => ({ ...wf, parsedSteps: parseSteps(wf.steps) })),
    [workflows]
  )

  // List view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button variant="red" onClick={startCreate}>
          <i className="fas fa-plus" /> Nouveau workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <EmptyState icon="fas fa-route" message="Aucun workflow" />
      ) : (
        parsedWorkflows.map((wf) => {
          const steps = wf.parsedSteps
          return (
            <div key={wf.id} className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">{wf.name}</div>
                  <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>
                    {steps.length} etape(s){wf.description ? ` — ${wf.description}` : ''}
                    <span style={{ marginLeft: 8, color: 'var(--text3)' }}>
                      {steps.map((s, i) => {
                        const t = STEP_TYPES.find((st) => st.value === s.type)
                        return t ? <i key={i} className={`fas ${t.icon}`} style={{ margin: '0 2px' }} title={t.label} /> : null
                      })}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="outline" size="sm" onClick={() => startEdit(wf)}>
                    <i className="fas fa-pen" />
                  </Button>
                  <Button variant="outline" size="sm" className="btn-danger" onClick={() => handleDelete(wf.id)}>
                    <i className="fas fa-trash" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Step editor sub-component ──

function StepEditor({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  step: WorkflowStep
  index: number
  total: number
  onChange: (updates: Partial<WorkflowStep>) => void
  onRemove: () => void
  onMove: (dir: number) => void
}) {
  return (
    <div
      style={{
        padding: '12px 16px', marginBottom: 8,
        background: 'var(--bg2)', borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--text3)', fontSize: 13, minWidth: 24 }}>
          {index + 1}
        </span>
        <select
          value={step.type}
          onChange={(e) => onChange({ type: e.target.value as StepType })}
          className="form-control"
          style={{ width: 140 }}
        >
          {STEP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={step.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Titre de l'etape"
          className="form-control"
          style={{ flex: 1 }}
        />
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {index > 0 && (
            <Button variant="outline" size="sm" onClick={() => onMove(-1)} title="Monter">
              <i className="fas fa-arrow-up" />
            </Button>
          )}
          {index < total - 1 && (
            <Button variant="outline" size="sm" onClick={() => onMove(1)} title="Descendre">
              <i className="fas fa-arrow-down" />
            </Button>
          )}
          <Button variant="outline" size="sm" className="btn-danger" onClick={onRemove}>
            <i className="fas fa-trash" />
          </Button>
        </div>
      </div>

      {/* Step body based on type */}
      {step.type === 'video' && (
        <FormGroup label="URL de la video">
          <input
            type="url"
            className="form-control"
            value={step.video_url || ''}
            onChange={(e) => onChange({ video_url: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
          />
        </FormGroup>
      )}
      {step.type === 'contract' && (
        <FormGroup label="Texte du contrat">
          <textarea
            className="form-control"
            rows={4}
            value={step.contract_text || ''}
            onChange={(e) => onChange({ contract_text: e.target.value })}
            placeholder="Saisissez le texte du contrat ici..."
            style={{ resize: 'vertical' }}
          />
        </FormGroup>
      )}
      {step.type === 'questionnaire' && (
        <QuestionsEditor
          questions={step.questions || []}
          onChange={(questions) => onChange({ questions })}
        />
      )}
      {step.type === 'formation' && (
        <FormGroup label="ID de la formation (optionnel)">
          <input
            type="text"
            className="form-control"
            value={step.formation_id || ''}
            onChange={(e) => onChange({ formation_id: e.target.value })}
            placeholder="Laisser vide pour lien libre"
          />
        </FormGroup>
      )}
      {step.type === 'payment' && (
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0', padding: '0 4px' }}>
          <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
          L&apos;athlete sera invite a payer via Stripe selon le plan configure a l&apos;ajout.
        </p>
      )}
    </div>
  )
}

// ── Inline question builder for questionnaire steps ──

function QuestionsEditor({
  questions,
  onChange,
}: {
  questions: Array<{ label: string; type: string; choices?: string[] }>
  onChange: (q: Array<{ label: string; type: string; choices?: string[] }>) => void
}) {
  const addQuestion = () => {
    onChange([...questions, { label: '', type: 'text' }])
  }

  const updateQuestion = (idx: number, updates: Partial<{ label: string; type: string; choices: string[] }>) => {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...updates } : q)))
  }

  const removeQuestion = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx))
  }

  const addChoice = (qIdx: number) => {
    const q = questions[qIdx]
    updateQuestion(qIdx, { choices: [...(q.choices || []), ''] })
  }

  const updateChoice = (qIdx: number, cIdx: number, value: string) => {
    const q = questions[qIdx]
    const choices = [...(q.choices || [])]
    choices[cIdx] = value
    updateQuestion(qIdx, { choices })
  }

  const removeChoice = (qIdx: number, cIdx: number) => {
    const q = questions[qIdx]
    updateQuestion(qIdx, { choices: (q.choices || []).filter((_, i) => i !== cIdx) })
  }

  return (
    <div style={{ marginTop: 8 }}>
      {questions.map((q, idx) => (
        <div
          key={idx}
          style={{
            padding: '8px 12px', marginBottom: 6,
            background: 'var(--bg3)', borderRadius: 8,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text3)', fontSize: 11, fontWeight: 600 }}>{idx + 1}.</span>
            <input
              type="text"
              value={q.label}
              onChange={(e) => updateQuestion(idx, { label: e.target.value })}
              placeholder="Question..."
              className="form-control"
              style={{ flex: 1 }}
            />
            <select
              value={q.type}
              onChange={(e) => updateQuestion(idx, { type: e.target.value })}
              className="form-control"
              style={{ width: 110 }}
            >
              <option value="text">Texte libre</option>
              <option value="choice">Choix multiple</option>
              <option value="number">Nombre</option>
            </select>
            <Button variant="outline" size="sm" className="btn-danger" onClick={() => removeQuestion(idx)} style={{ padding: '4px 8px' }}>
              <i className="fas fa-times" />
            </Button>
          </div>
          {q.type === 'choice' && (
            <div style={{ marginTop: 6, paddingLeft: 24 }}>
              {(q.choices || []).map((c, cIdx) => (
                <div key={cIdx} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input
                    type="text"
                    value={c}
                    onChange={(e) => updateChoice(idx, cIdx, e.target.value)}
                    className="form-control"
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <Button variant="outline" size="sm" className="btn-danger" onClick={() => removeChoice(idx, cIdx)} style={{ padding: '2px 6px', fontSize: 10 }}>
                    <i className="fas fa-times" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addChoice(idx)} style={{ fontSize: 11, marginTop: 2 }}>
                <i className="fas fa-plus" /> Option
              </Button>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addQuestion} style={{ marginTop: 4 }}>
        <i className="fas fa-plus" /> Ajouter une question
      </Button>
    </div>
  )
}
