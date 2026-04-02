'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import FormGroup from '@/components/ui/FormGroup'

const Q_TYPES = [
  { value: 'text', label: 'Texte libre', icon: 'fa-align-left' },
  { value: 'choice', label: 'Choix multiples', icon: 'fa-list-ul' },
  { value: 'rating', label: 'Note (1-10)', icon: 'fa-star' },
  { value: 'yesno', label: 'Oui / Non', icon: 'fa-toggle-on' },
] as const

interface Question {
  id: string
  label: string
  type: string
  options?: string[]
  required?: boolean
}

interface QuestionnaireTemplate {
  id: string
  titre: string
  description?: string | null
  questions: Question[]
  created_at?: string
}

interface Props {
  templates: QuestionnaireTemplate[]
  onRefresh: () => void
}

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'q' + Date.now() + Math.random().toString(36).slice(2, 8)
}

export default function QuestionnaireTemplatesList({ templates, onRefresh }: Props) {
  const supabase = createClient()
  const { coach } = useAuth()
  const { toast } = useToast()

  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Editor state
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    setTitre('')
    setDescription('')
    setQuestions([])
  }

  const startEdit = (t: QuestionnaireTemplate) => {
    setEditing(t.id)
    setCreating(false)
    setTitre(t.titre)
    setDescription(t.description || '')
    setQuestions((t.questions || []).map((q) => ({ ...q })))
  }

  const cancelEdit = () => {
    setEditing(null)
    setCreating(false)
  }

  const addQuestion = useCallback(() => {
    setQuestions((prev) => [...prev, { id: genId(), label: '', type: 'text', options: [], required: false }])
  }, [])

  const updateQuestion = useCallback((idx: number, updates: Partial<Question>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...updates } : q)))
  }, [])

  const removeQuestion = useCallback((idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const moveQuestion = useCallback((idx: number, dir: number) => {
    setQuestions((prev) => {
      const j = idx + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }, [])

  const handleSave = async () => {
    if (!titre.trim()) {
      toast('Le titre est obligatoire', 'error')
      return
    }
    if (!coach) return

    setSaving(true)
    const qs = questions.map((q) => ({ ...q, id: q.id || genId() }))
    const payload = {
      coach_id: coach.id,
      titre: titre.trim(),
      description: description.trim() || null,
      questions: qs,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editing) {
      ;({ error } = await supabase.from('questionnaire_templates').update(payload).eq('id', editing))
    } else {
      ;({ error } = await supabase.from('questionnaire_templates').insert(payload))
    }
    setSaving(false)

    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast('Template sauvegarde')
    cancelEdit()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return
    const { error } = await supabase.from('questionnaire_templates').delete().eq('id', id)
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast('Template supprime')
    onRefresh()
  }

  const handleDuplicate = async (id: string) => {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl || !coach) return

    const { error } = await supabase.from('questionnaire_templates').insert({
      coach_id: coach.id,
      titre: tpl.titre + ' (copie)',
      description: tpl.description,
      questions: tpl.questions,
    })
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast('Template duplique')
    onRefresh()
  }

  // Editor view
  if (editing || creating) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{editing ? 'Modifier' : 'Nouveau'} questionnaire</h2>
          <Button variant="outline" onClick={cancelEdit}><i className="fas fa-arrow-left" /> Retour</Button>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <FormGroup label="Titre *">
            <input type="text" className="form-control" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Bilan de rentree" />
          </FormGroup>
          <FormGroup label="Description">
            <input type="text" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionnel" />
          </FormGroup>

          <h3 style={{ fontSize: 15, margin: '20px 0 12px' }}>Questions</h3>

          {questions.length === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
              Aucune question. Cliquez sur &quot;Ajouter une question&quot;.
            </p>
          )}

          {questions.map((q, idx) => (
            <QuestionEditor
              key={q.id || idx}
              question={q}
              index={idx}
              total={questions.length}
              onChange={(updates) => updateQuestion(idx, updates)}
              onRemove={() => removeQuestion(idx)}
              onMove={(dir) => moveQuestion(idx, dir)}
            />
          ))}

          <Button variant="outline" onClick={addQuestion} style={{ marginTop: 12 }}>
            <i className="fas fa-plus" /> Ajouter une question
          </Button>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Button variant="red" onClick={handleSave} loading={saving}>
              <i className="fas fa-save" /> Sauvegarder
            </Button>
            <Button variant="outline" onClick={cancelEdit}>Annuler</Button>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button variant="red" onClick={startCreate}>
          <i className="fas fa-plus" /> Nouveau questionnaire
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon="fas fa-clipboard-list" message="Aucun template de questionnaire" />
      ) : (
        templates.map((t) => {
          const qs = t.questions || []
          const d = t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
          return (
            <div
              key={t.id}
              className="card"
              style={{ marginBottom: 12, cursor: 'pointer' }}
              onClick={() => startEdit(t)}
            >
              <div className="card-header">
                <div style={{ flex: 1 }}>
                  <div className="card-title">{t.titre}</div>
                  {t.description && (
                    <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>{t.description}</div>
                  )}
                  <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
                    {qs.length} question(s){d ? ` · ${d}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => handleDuplicate(t.id)} title="Dupliquer">
                    <i className="fas fa-copy" />
                  </Button>
                  <Button variant="outline" size="sm" className="btn-danger" onClick={() => handleDelete(t.id)} title="Supprimer">
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

// ── Question editor sub-component ──

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  question: Question
  index: number
  total: number
  onChange: (updates: Partial<Question>) => void
  onRemove: () => void
  onMove: (dir: number) => void
}) {
  const typeOpts = Q_TYPES.map((t) => (
    <option key={t.value} value={t.value}>{t.label}</option>
  ))

  const updateOptions = (val: string) => {
    onChange({ options: val.split('\n').map((s) => s.trim()).filter(Boolean) })
  }

  return (
    <div
      style={{
        padding: 14, marginBottom: 10,
        background: 'var(--bg2)', borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--text3)', fontSize: 13, minWidth: 24 }}>#{index + 1}</span>
        <input
          type="text"
          className="form-control"
          style={{ flex: 1 }}
          value={question.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Texte de la question"
        />
        <select
          className="form-control"
          style={{ width: 160 }}
          value={question.type}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {typeOpts}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={question.required || false}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Obligatoire
        </label>
      </div>

      {question.type === 'choice' && (
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)' }}>Options (une par ligne)</label>
          <textarea
            className="form-control"
            rows={3}
            value={(question.options || []).join('\n')}
            onChange={(e) => updateOptions(e.target.value)}
            placeholder={'Option 1\nOption 2\nOption 3'}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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
        <Button variant="outline" size="sm" className="btn-danger" onClick={onRemove} title="Supprimer">
          <i className="fas fa-trash" />
        </Button>
      </div>
    </div>
  )
}
