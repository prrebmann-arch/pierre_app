'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Button from '@/components/ui/Button'
import FormGroup from '@/components/ui/FormGroup'

interface Exercise {
  nom: string
  exercice_id?: string | null
  series: string
  reps: string
  muscle_principal?: string
}

interface Session {
  nom: string
  jour: string
  exercises: Exercise[]
}

interface Props {
  templateId?: string | null
  initialName?: string
  initialCategory?: string
  initialPatternType?: string
  initialPatternData?: { pattern?: string; days?: string[] }
  initialSessions?: Session[]
  existingCategories?: string[]
  onSave: () => void
  onCancel: () => void
}

export default function TrainingTemplateEditor({
  templateId,
  initialName = '',
  initialCategory = '',
  initialPatternType = 'pattern',
  initialPatternData = {},
  initialSessions,
  existingCategories = [],
  onSave,
  onCancel,
}: Props) {
  const supabase = createClient()
  const { coach } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState(initialName)
  const [category, setCategory] = useState(initialCategory)
  const [patternType, setPatternType] = useState(initialPatternType)
  const [pattern, setPattern] = useState(initialPatternData.pattern || '')
  const [fixedDays, setFixedDays] = useState((initialPatternData.days || []).join(', '))
  const [sessions, setSessions] = useState<Session[]>(
    initialSessions?.length ? initialSessions : [{ nom: '', jour: '', exercises: [] }]
  )
  const [activeSession, setActiveSession] = useState(0)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [categories, setCategories] = useState(existingCategories)

  const currentSession = sessions[activeSession] || sessions[0]

  const updateSession = useCallback((idx: number, updates: Partial<Session>) => {
    setSessions((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)))
  }, [])

  const addSession = () => {
    setSessions((prev) => [...prev, { nom: '', jour: '', exercises: [] }])
    setActiveSession(sessions.length)
  }

  const removeSession = (idx: number) => {
    if (sessions.length <= 1) return
    setSessions((prev) => prev.filter((_, i) => i !== idx))
    setActiveSession((prev) => Math.min(prev, sessions.length - 2))
  }

  const addExercise = () => {
    updateSession(activeSession, {
      exercises: [...currentSession.exercises, { nom: '', series: '4', reps: '10' }],
    })
  }

  const updateExercise = (exIdx: number, updates: Partial<Exercise>) => {
    const newExs = currentSession.exercises.map((ex, i) => (i === exIdx ? { ...ex, ...updates } : ex))
    updateSession(activeSession, { exercises: newExs })
  }

  const removeExercise = (exIdx: number) => {
    updateSession(activeSession, {
      exercises: currentSession.exercises.filter((_, i) => i !== exIdx),
    })
  }

  const moveExercise = (exIdx: number, dir: number) => {
    const newExs = [...currentSession.exercises]
    const target = exIdx + dir
    if (target < 0 || target >= newExs.length) return
    ;[newExs[exIdx], newExs[target]] = [newExs[target], newExs[exIdx]]
    updateSession(activeSession, { exercises: newExs })
  }

  const confirmNewCategory = () => {
    if (newCategory.trim()) {
      if (!categories.includes(newCategory.trim())) {
        setCategories((prev) => [...prev, newCategory.trim()])
      }
      setCategory(newCategory.trim())
    }
    setNewCategory('')
    setShowNewCat(false)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast('Le nom est obligatoire', 'error')
      return
    }
    if (!coach) return

    setSaving(true)
    const patternData = patternType === 'pattern' ? { pattern } : { days: fixedDays.split(',').map((d) => d.trim()).filter(Boolean) }
    const sessionsData = sessions.map((s) => ({
      nom: s.nom,
      jour: s.jour,
      exercices: s.exercises.map((e) => ({
        nom: e.nom,
        exercice_id: e.exercice_id || null,
        series: e.series || '-',
        reps: e.reps || '-',
      })),
    }))

    const tplData = {
      nom: name.trim(),
      category: category || null,
      pattern_type: patternType,
      pattern_data: patternData,
      sessions_data: sessionsData,
      coach_id: coach.id,
    }

    let error
    if (templateId) {
      ;({ error } = await supabase.from('training_templates').update(tplData).eq('id', templateId))
    } else {
      ;({ error } = await supabase.from('training_templates').insert(tplData))
    }

    setSaving(false)
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    toast(templateId ? 'Template modifie' : 'Template cree')
    onSave()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <i className="fas fa-arrow-left" />
        </Button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du template"
          style={{
            flex: 1, maxWidth: 350, padding: '8px 12px',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 14, fontWeight: 600,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-folder" style={{ color: 'var(--text3)', fontSize: 12 }} />
          {showNewCat ? (
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nom..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmNewCategory()
                  if (e.key === 'Escape') setShowNewCat(false)
                }}
                style={{ padding: '4px 8px', background: 'var(--bg2)', border: '1px solid var(--primary)', borderRadius: 6, color: 'var(--text)', fontSize: 12, width: 130 }}
              />
              <Button variant="outline" size="sm" onClick={confirmNewCategory} style={{ padding: '4px 8px' }}>
                <i className="fas fa-check" style={{ fontSize: 10, color: 'var(--success)' }} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNewCat(false)} style={{ padding: '4px 8px' }}>
                <i className="fas fa-times" style={{ fontSize: 10 }} />
              </Button>
            </span>
          ) : (
            <>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ padding: '5px 8px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12 }}
              >
                <option value="">Sans categorie</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => setShowNewCat(true)} title="Nouvelle categorie" style={{ padding: '4px 8px' }}>
                <i className="fas fa-plus" style={{ fontSize: 10 }} />
              </Button>
            </>
          )}
        </div>
        <Button variant="red" onClick={handleSave} loading={saving}>
          <i className="fas fa-save" /> {templateId ? 'Enregistrer' : 'Creer'}
        </Button>
      </div>

      {/* Pattern config */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <select
          value={patternType}
          onChange={(e) => setPatternType(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
        >
          <option value="pattern">Pattern</option>
          <option value="fixed">Jours fixes</option>
        </select>
        {patternType === 'pattern' ? (
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="ex: Haut / Bas / Repos"
            style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
          />
        ) : (
          <input
            type="text"
            value={fixedDays}
            onChange={(e) => setFixedDays(e.target.value)}
            placeholder="ex: Lundi, Mercredi, Vendredi"
            style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
          />
        )}
      </div>

      {/* Session tabs */}
      <div className="athlete-tabs" style={{ marginBottom: 0 }}>
        {sessions.map((s, i) => (
          <button
            key={i}
            className={`athlete-tab-btn${i === activeSession ? ' active' : ''}`}
            onClick={() => setActiveSession(i)}
          >
            {s.nom || `Seance ${i + 1}`}
          </button>
        ))}
        <button className="athlete-tab-btn" onClick={addSession} title="Ajouter une seance">
          <i className="fas fa-plus" />
        </button>
      </div>

      {/* Session editor */}
      <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormGroup label="Nom de la seance">
            <input
              type="text"
              value={currentSession.nom}
              onChange={(e) => updateSession(activeSession, { nom: e.target.value })}
              placeholder="ex: Haut du corps"
              className="form-control"
            />
          </FormGroup>
          <FormGroup label="Jour">
            <input
              type="text"
              value={currentSession.jour}
              onChange={(e) => updateSession(activeSession, { jour: e.target.value })}
              placeholder="ex: Lundi"
              className="form-control"
            />
          </FormGroup>
          {sessions.length > 1 && (
            <Button variant="outline" size="sm" className="btn-danger" onClick={() => removeSession(activeSession)} style={{ marginTop: 20 }}>
              <i className="fas fa-trash" /> Supprimer la seance
            </Button>
          )}
        </div>

        {/* Exercises */}
        <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text2)' }}>
          Exercices ({currentSession.exercises.length})
        </h4>
        {currentSession.exercises.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
            Aucun exercice. Cliquez sur &quot;Ajouter un exercice&quot;.
          </p>
        ) : (
          currentSession.exercises.map((ex, exIdx) => (
            <div
              key={exIdx}
              style={{
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8,
                padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text3)', fontSize: 12, minWidth: 24 }}>
                #{exIdx + 1}
              </span>
              <input
                type="text"
                value={ex.nom}
                onChange={(e) => updateExercise(exIdx, { nom: e.target.value })}
                placeholder="Nom de l'exercice"
                style={{ flex: 1, padding: '6px 10px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }}
              />
              <input
                type="text"
                value={ex.series}
                onChange={(e) => updateExercise(exIdx, { series: e.target.value })}
                placeholder="Series"
                style={{ width: 60, padding: '6px 8px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, textAlign: 'center' }}
              />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>x</span>
              <input
                type="text"
                value={ex.reps}
                onChange={(e) => updateExercise(exIdx, { reps: e.target.value })}
                placeholder="Reps"
                style={{ width: 60, padding: '6px 8px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, textAlign: 'center' }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {exIdx > 0 && (
                  <Button variant="outline" size="sm" onClick={() => moveExercise(exIdx, -1)} style={{ padding: '4px 6px' }}>
                    <i className="fas fa-arrow-up" style={{ fontSize: 10 }} />
                  </Button>
                )}
                {exIdx < currentSession.exercises.length - 1 && (
                  <Button variant="outline" size="sm" onClick={() => moveExercise(exIdx, 1)} style={{ padding: '4px 6px' }}>
                    <i className="fas fa-arrow-down" style={{ fontSize: 10 }} />
                  </Button>
                )}
                <Button variant="outline" size="sm" className="btn-danger" onClick={() => removeExercise(exIdx)} style={{ padding: '4px 6px' }}>
                  <i className="fas fa-trash" style={{ fontSize: 10 }} />
                </Button>
              </div>
            </div>
          ))
        )}
        <Button variant="outline" onClick={addExercise} style={{ marginTop: 8 }}>
          <i className="fas fa-plus" /> Ajouter un exercice
        </Button>
      </div>
    </div>
  )
}
