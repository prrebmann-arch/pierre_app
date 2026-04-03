'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { notifyAthlete } from '@/lib/push'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

const Q_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'text', label: 'Texte libre', icon: 'fa-align-left' },
  { value: 'choice', label: 'Choix multiples', icon: 'fa-list-ul' },
  { value: 'rating', label: 'Note (1-10)', icon: 'fa-star' },
  { value: 'yesno', label: 'Oui / Non', icon: 'fa-toggle-on' },
]

function formatAnswer(question: any, answer: any): string {
  if (answer == null) return '\u2014'
  if (question.type === 'yesno') return answer ? 'Oui' : 'Non'
  if (question.type === 'rating') return `${answer}/10`
  if (question.type === 'choice' && Array.isArray(answer)) return answer.join(', ')
  return String(answer)
}

export default function QuestionnairesPage() {
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<any[]>([])
  const [responsesMap, setResponsesMap] = useState<Record<string, any>>({})
  const [templates, setTemplates] = useState<any[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [obligatoire, setObligatoire] = useState(false)
  const [sending, setSending] = useState(false)

  // Quick questionnaire state
  const [showQuick, setShowQuick] = useState(false)
  const [quickTitre, setQuickTitre] = useState('')
  const [quickQuestions, setQuickQuestions] = useState<any[]>([])
  const [quickObligatoire, setQuickObligatoire] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: assigns } = await supabase
        .from('questionnaire_assignments')
        .select('*, questionnaire_templates(titre)')
        .eq('athlete_id', params.id)
        .order('sent_at', { ascending: false })

      const completedIds = (assigns || []).filter((a: any) => a.status === 'completed').map((a: any) => a.id)
      const rmap: Record<string, any> = {}
      if (completedIds.length > 0) {
        const { data: responses } = await supabase
          .from('questionnaire_responses')
          .select('id, assignment_id, answers, submitted_at')
          .in('assignment_id', completedIds)
        ;(responses || []).forEach((r: any) => { rmap[r.assignment_id] = r })
      }

      const { data: tpls } = await supabase
        .from('questionnaire_templates')
        .select('id, titre, questions')
        .eq('coach_id', user?.id)
        .order('titre')

      setAssignments(assigns || [])
      setResponsesMap(rmap)
      setTemplates(tpls || [])
    } finally {
      setLoading(false)
    }
  }, [params.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadData()
  }, [params.id, loadData])

  function toggleDetail(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function sendFromTemplate() {
    if (!selectedTemplate) { toast('Selectionnez un template', 'error'); return }
    setSending(true)

    const { data: tpl } = await supabase
      .from('questionnaire_templates')
      .select('titre, questions')
      .eq('id', selectedTemplate)
      .single()

    if (!tpl) { toast('Template introuvable', 'error'); setSending(false); return }

    const { error } = await supabase.from('questionnaire_assignments').insert({
      template_id: selectedTemplate,
      athlete_id: params.id,
      coach_id: user?.id,
      obligatoire,
      questions_snapshot: tpl.questions,
    })

    setSending(false)
    if (error) { toast('Erreur lors de l\'envoi', 'error'); return }

    // Notify (DB + push)
    const { data: ath } = await supabase.from('athletes').select('user_id').eq('id', params.id).single()
    if (ath?.user_id) {
      await notifyAthlete(
        ath.user_id, 'questionnaire', 'Nouveau questionnaire',
        `Votre coach vous a envoye un questionnaire : ${tpl.titre}`,
        { template_id: selectedTemplate },
      )
    }

    toast('Questionnaire envoye', 'success')
    setSelectedTemplate('')
    setObligatoire(false)
    loadData()
  }

  async function sendQuickQuestionnaire() {
    if (!quickTitre.trim()) { toast('Le titre est obligatoire', 'error'); return }
    if (!quickQuestions.length || !quickQuestions.some((q: any) => q.label.trim())) {
      toast('Ajoutez au moins une question', 'error'); return
    }
    setSending(true)

    const questions = quickQuestions.map((q: any) => ({
      ...q,
      id: q.id || crypto.randomUUID(),
    }))

    const { error } = await supabase.from('questionnaire_assignments').insert({
      template_id: null,
      athlete_id: params.id,
      coach_id: user?.id,
      obligatoire: quickObligatoire,
      questions_snapshot: questions,
    })

    setSending(false)
    if (error) { toast('Erreur', 'error'); return }

    const { data: ath2 } = await supabase.from('athletes').select('user_id').eq('id', params.id).single()
    if (ath2?.user_id) {
      await notifyAthlete(
        ath2.user_id, 'questionnaire', 'Nouveau questionnaire',
        `Votre coach vous a envoye un questionnaire : ${quickTitre.trim()}`,
      )
    }

    toast('Questionnaire envoye', 'success')
    setShowQuick(false)
    setQuickTitre(''); setQuickQuestions([]); setQuickObligatoire(false)
    loadData()
  }

  async function relance(id: string) {
    const { data: a } = await supabase
      .from('questionnaire_assignments')
      .select('*, questionnaire_templates(titre), athletes(user_id)')
      .eq('id', id).single()
    if (!a) return
    const userId = a.athletes?.user_id
    if (!userId) { toast('Pas de user_id', 'error'); return }
    await notifyAthlete(
      userId, 'rappel', 'Rappel questionnaire',
      `N'oubliez pas de remplir : ${a.questionnaire_templates?.titre || 'Questionnaire'}`,
    )
    toast('Rappel envoye', 'success')
  }

  async function deleteAssignment(id: string) {
    if (!confirm('Supprimer ce questionnaire envoye ?')) return
    const { error } = await supabase.from('questionnaire_assignments').delete().eq('id', id)
    if (error) { toast('Erreur', 'error'); return }
    toast('Questionnaire supprime', 'success')
    loadData()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  // Quick questionnaire editor view
  if (showQuick) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Questionnaire rapide</h2>
          <button className="btn btn-outline" onClick={() => setShowQuick(false)}><i className="fas fa-arrow-left" /> Retour</button>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Titre *</label>
            <input type="text" className="form-control" value={quickTitre} onChange={(e) => setQuickTitre(e.target.value)} placeholder="Ex: Retour de vacances" />
          </div>

          <h3 style={{ fontSize: 15, margin: '20px 0 12px' }}>Questions</h3>
          {quickQuestions.map((q: any, i: number) => (
            <div key={i} style={{ background: 'var(--bg3, var(--bg2))', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: 'var(--text3)', fontSize: 13, minWidth: 24 }}>#{i + 1}</span>
                <input type="text" className="form-control" style={{ flex: 1 }} value={q.label} onChange={(e) => {
                  const nq = [...quickQuestions]; nq[i] = { ...nq[i], label: e.target.value }; setQuickQuestions(nq)
                }} placeholder="Texte de la question" />
                <select className="form-control" style={{ width: 160 }} value={q.type} onChange={(e) => {
                  const nq = [...quickQuestions]; nq[i] = { ...nq[i], type: e.target.value }; setQuickQuestions(nq)
                }}>
                  {Q_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => {
                  setQuickQuestions((prev) => prev.filter((_, j) => j !== i))
                }}><i className="fas fa-trash" /></button>
              </div>
              {q.type === 'choice' && (
                <textarea className="form-control" rows={3} placeholder="Option 1&#10;Option 2&#10;Option 3" value={(q.options || []).join('\n')} onChange={(e) => {
                  const nq = [...quickQuestions]; nq[i] = { ...nq[i], options: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) }; setQuickQuestions(nq)
                }} />
              )}
            </div>
          ))}
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => {
            setQuickQuestions((prev) => [...prev, { id: crypto.randomUUID(), label: '', type: 'text', options: [], required: false }])
          }}><i className="fas fa-plus" /> Ajouter une question</button>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={quickObligatoire} onChange={(e) => setQuickObligatoire(e.target.checked)} /> Rendre obligatoire
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button className="btn btn-red" onClick={sendQuickQuestionnaire} disabled={sending}>
              {sending ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Envoyer</>}
            </button>
            <button className="btn btn-outline" onClick={() => setShowQuick(false)}>Annuler</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Send from template */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Envoyer un questionnaire</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {templates.length ? (
            <>
              <select className="form-control" style={{ width: 'auto', minWidth: 200 }} value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                <option value="">&mdash; Choisir un template &mdash;</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.titre} ({(t.questions || []).length}q)</option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={obligatoire} onChange={(e) => setObligatoire(e.target.checked)} /> Obligatoire
              </label>
              <button className="btn btn-red btn-sm" onClick={sendFromTemplate} disabled={sending}>
                <i className="fas fa-paper-plane" /> Envoyer
              </button>
            </>
          ) : (
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>Aucun template. Creez-en un dans Templates.</span>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => { setShowQuick(true); setQuickQuestions([{ id: crypto.randomUUID(), label: '', type: 'text', options: [], required: false }]) }}>
            <i className="fas fa-bolt" /> Questionnaire rapide
          </button>
        </div>
      </div>

      {/* History */}
      <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Historique</h3>

      {!assignments.length ? (
        <EmptyState icon="fas fa-clipboard-list" message="Aucun questionnaire envoye" />
      ) : (
        assignments.map((a: any) => {
          const title = a.questionnaire_templates?.titre || '(Sans titre)'
          const sentDate = new Date(a.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
          const isPending = a.status === 'pending'
          const isExpanded = expandedIds.has(a.id)
          const resp = responsesMap[a.id]
          const questions = a.questions_snapshot || []
          const answers = resp ? (resp.responses || []) : []

          return (
            <div key={a.id} className={styles.qtCard}>
              <div className={styles.qtCardHeader}>
                <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => toggleDetail(a.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-chevron-right" style={{ fontSize: 11, color: 'var(--text3)', transition: 'transform .2s', transform: isExpanded ? 'rotate(90deg)' : '' }} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
                    <Badge variant={isPending ? 'warning' : 'success'}>{isPending ? 'En attente' : `Complete${a.completed_at ? ' \u00b7 ' + new Date(a.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}`}</Badge>
                    {a.obligatoire && <Badge variant="error">Obligatoire</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, paddingLeft: 22 }}>
                    Envoye le {sentDate} &middot; {questions.length} question(s)
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {isPending && (
                    <button className="btn btn-outline btn-sm" onClick={() => relance(a.id)}>
                      <i className="fas fa-bell" /> Relancer
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteAssignment(a.id)}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.qtDetail}>
                  {resp && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', marginBottom: 10 }}>
                      <i className="fas fa-check-circle" /> Reponses recues
                    </div>
                  )}
                  {questions.map((q: any, qi: number) => {
                    const typeInfo = Q_TYPES.find((t) => t.value === q.type)
                    const ans = answers.find((r: any) => r.question_id === q.id)
                    return (
                      <div key={qi} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <i className={`fas ${typeInfo?.icon || 'fa-question'}`} style={{ fontSize: 11, color: 'var(--text3)', width: 16, textAlign: 'center' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                            {q.label || '(sans label)'}{q.required && <span style={{ color: 'var(--danger)', fontSize: 10, marginLeft: 4 }}>*</span>}
                          </span>
                        </div>
                        {resp && (
                          <div style={{ marginTop: 4, fontSize: 14, paddingLeft: 22 }}>
                            {ans ? (
                              <span style={{ color: q.type === 'yesno' ? (ans.answer ? 'var(--success)' : 'var(--danger)') : 'var(--text)' }}>
                                {formatAnswer(q, ans.answer)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Pas de reponse</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
