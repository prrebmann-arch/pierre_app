'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useToast } from '@/contexts/ToastContext'
import { getPageCache, setPageCache } from '@/lib/utils'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import { DEFAULT_STEPS_GOAL, DEFAULT_WATER_GOAL, DEFAULT_NOTIF_TIME, JOURS_SEMAINE } from '@/lib/constants'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/athlete-tabs.module.css'

/* eslint-disable @typescript-eslint/no-explicit-any */

const OBJECTIF_LABELS: Record<string, string> = {
  perte_de_poids: 'Perte de poids',
  prise_de_masse: 'Prise de masse',
  maintenance: 'Maintenance',
  recomposition: 'Recomposition',
  performance: 'Performance',
}

const ACCESS_LABELS: Record<string, string> = {
  training_only: 'Training uniquement',
  nutrition_only: 'Diete uniquement',
  full: 'Complet',
}

const COMPLETE_FREQ_OPTS = [
  { v: 'none', l: 'Aucun' },
  { v: 'weekly', l: 'Hebdomadaire' },
  { v: 'biweekly', l: 'Bi-hebdo' },
  { v: 'monthly', l: 'Mensuel' },
  { v: 'custom', l: 'Personnalise' },
]

function formatFrequency(freq: string, interval?: number) {
  if (freq === 'none') return 'Desactive'
  if (freq === 'daily') return 'Quotidien'
  if (freq === 'weekly') return 'Hebdomadaire'
  if (freq === 'biweekly') return 'Bi-hebdomadaire'
  if (freq === 'monthly') return 'Mensuel'
  if (freq === 'custom') return `Tous les ${interval || 14} jours`
  return freq
}

function formatBilanLabel(freq: string, interval?: number, day?: number | number[], monthDay?: number, notifTime?: string) {
  let s = formatFrequency(freq, interval)
  if (['weekly', 'biweekly'].includes(freq) && day != null) {
    if (Array.isArray(day)) s += ' — ' + day.map(d => JOURS_SEMAINE[d] || '?').join(' & ')
    else s += ' — ' + (JOURS_SEMAINE[day] || '')
  }
  if (freq === 'monthly' && monthDay) s += ' — le ' + monthDay + ' du mois'
  if (notifTime) s += ' · ' + notifTime
  return s
}

export default function InfosPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { refreshAthletes } = useAthleteContext()
  const { toast } = useToast()
  const supabase = createClient()

  const cacheKey = `athlete_${params.id}_infos`
  const [cached] = useState(() => getPageCache<{ athlete: any; phase: any; plan: any; payments: any[]; cancels: any[] }>(cacheKey))

  const [loading, setLoading] = useState(!cached)
  const [athlete, setAthlete] = useState<any>(cached?.athlete ?? null)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [activePhase, setActivePhase] = useState<any>(cached?.phase ?? null)

  // Payment state
  const [paymentPlan, setPaymentPlan] = useState<any>(cached?.plan ?? null)
  const [paymentHistory, setPaymentHistory] = useState<any[]>(cached?.payments ?? [])
  const [cancelRequests, setCancelRequests] = useState<any[]>(cached?.cancels ?? [])

  // Onboarding state
  const [onboarding, setOnboarding] = useState<any>(null)
  const [workflow, setWorkflow] = useState<any>(null)

  const loadAthlete = useCallback(async () => {
    if (!athlete) setLoading(true)
    try {
      // Run athlete + payment + phase queries all in parallel
      const [athleteRes, planRes, paymentsRes, cancelsRes, phaseRes, obRes1] = await Promise.all([
        supabase.from('athletes').select('id, user_id, coach_id, prenom, nom, email, avatar_url, date_naissance, genre, telephone, objectif, poids_actuel, poids_objectif, access_mode, pas_journalier, water_goal_ml, blessures, allergies, medicaments, notes_sante, onboarding_workflow_id, bilan_frequency, bilan_interval, bilan_day, bilan_anchor_date, bilan_month_day, bilan_notif_time, complete_bilan_frequency, complete_bilan_interval, complete_bilan_day, complete_bilan_anchor_date, complete_bilan_month_day, complete_bilan_notif_time, created_at').eq('id', params.id).single(),
        supabase.from('athlete_payment_plans').select('id, athlete_id, coach_id, payment_status, amount, frequency, is_free, stripe_subscription_id, stripe_customer_id, created_at').eq('athlete_id', params.id).eq('coach_id', user?.id).maybeSingle(),
        supabase.from('payment_history').select('id, athlete_id, amount, status, stripe_invoice_id, created_at').eq('athlete_id', params.id).eq('is_platform_payment', false).order('created_at', { ascending: false }).limit(10),
        supabase.from('cancellation_requests').select('id, athlete_id, coach_id, reason, status, created_at').eq('athlete_id', params.id).eq('coach_id', user?.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('roadmap_phases').select('id, phase, name, status').eq('athlete_id', params.id).eq('status', 'en_cours').order('position').limit(1),
        supabase.from('athlete_onboarding').select('id, athlete_id, workflow_id, completed, steps_completed, started_at').eq('athlete_id', params.id).limit(1),
      ])

      const data = athleteRes.data
      setAthlete(data)
      const plan = planRes.data
      setPaymentPlan(plan)
      const payments = paymentsRes.data || []
      setPaymentHistory(payments)
      const cancels = cancelsRes.data || []
      setCancelRequests(cancels)
      const phase = phaseRes.data?.[0] || null
      setActivePhase(phase)

      // Cache main data
      setPageCache(cacheKey, { athlete: data, phase, plan, payments, cancels })

      // Onboarding: try athlete_id first, fallback to user_id
      let ob: any = obRes1.data?.[0] || null
      if (!ob && data?.user_id) {
        const r2 = await supabase.from('athlete_onboarding').select('id, athlete_id, workflow_id, completed, steps_completed, started_at').eq('athlete_id', data.user_id).limit(1)
        ob = r2.data?.[0] || null
      }
      setOnboarding(ob)
      if (ob?.workflow_id) {
        const { data: wf } = await supabase.from('onboarding_workflows').select('id, name, steps, created_at').eq('id', ob.workflow_id).single()
        setWorkflow(wf)
      } else {
        setWorkflow(null)
      }
    } finally {
      setLoading(false)
    }
  }, [params.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.id) loadAthlete()
  }, [params.id, loadAthlete])

  useRefetchOnResume(loadAthlete, loading)

  if (loading) return <Skeleton height={400} borderRadius={16} />
  if (!athlete) return <div className="empty-state"><p>Athlete introuvable</p></div>

  const a = athlete

  function startEdit(card: string) {
    const data: Record<string, any> = {}
    if (card === 'personal') {
      data.prenom = a.prenom || ''
      data.nom = a.nom || ''
      data.email = a.email || ''
      data.telephone = a.telephone || ''
      data.date_naissance = a.date_naissance || ''
      data.genre = a.genre || ''
      data.objectif = a.objectif || ''
      data.pas_journalier = a.pas_journalier || DEFAULT_STEPS_GOAL
      data.water_goal_ml = a.water_goal_ml || DEFAULT_WATER_GOAL
      data.access_mode = a.access_mode || 'full'
      // Bilan config
      data.bilan_frequency = a.bilan_frequency || 'daily'
      data.bilan_notif_time = a.bilan_notif_time || DEFAULT_NOTIF_TIME
      data.complete_bilan_frequency = a.complete_bilan_frequency || 'weekly'
      data.complete_bilan_day = a.complete_bilan_day ?? 1
      data.complete_bilan_month_day = a.complete_bilan_month_day || 1
      data.complete_bilan_interval = a.complete_bilan_interval || 14
      data.complete_bilan_notif_time = a.complete_bilan_notif_time || DEFAULT_NOTIF_TIME
    } else if (card === 'health') {
      data.blessures = a.blessures || ''
      data.allergies = a.allergies || ''
      data.medicaments = a.medicaments || ''
      data.notes_sante = a.notes_sante || ''
    }
    setFormData(data)
    setEditingCard(card)
  }

  async function saveEdit(card: string) {
    const updateData = { ...formData }
    if (card === 'personal') {
      const todayStr = new Date().toISOString().split('T')[0]
      // Set anchor dates if frequency changed
      if (updateData.bilan_frequency !== (a.bilan_frequency || 'daily')) {
        updateData.bilan_anchor_date = todayStr
      } else {
        updateData.bilan_anchor_date = a.bilan_anchor_date || todayStr
      }
      if (updateData.complete_bilan_frequency !== (a.complete_bilan_frequency || 'weekly')) {
        updateData.complete_bilan_anchor_date = todayStr
      } else {
        updateData.complete_bilan_anchor_date = a.complete_bilan_anchor_date || todayStr
      }
    }
    const { error } = await supabase.from('athletes').update(updateData).eq('id', a.id)
    if (error) {
      console.error('[saveEdit] supabase error:', error, 'payload:', updateData)
      toast(`Erreur: ${error.message}`, 'error')
      return
    }
    toast('Informations sauvegardees', 'success')
    setEditingCard(null)
    loadAthlete()
  }

  function updateField(key: string, val: any) {
    setFormData((prev) => ({ ...prev, [key]: val }))
  }

  function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}><i className={`fas ${icon}`} style={{ width: 16, color: 'var(--text3)' }} />{label}</span>
        <span className={styles.infoValue}>{value || '\u2014'}</span>
      </div>
    )
  }

  function EditField({ label, field, type = 'text', options }: { label: string; field: string; type?: string; options?: { value: string; label: string }[] }) {
    if (options) {
      return (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
          <select className="form-control" value={formData[field] || ''} onChange={(e) => updateField(field, e.target.value)}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
        {type === 'textarea' ? (
          <textarea className="form-control" rows={3} value={formData[field] || ''} onChange={(e) => updateField(field, e.target.value)} />
        ) : (
          <input type={type} className="form-control" value={formData[field] || ''} onChange={(e) => updateField(field, type === 'number' ? Number(e.target.value) : e.target.value)} />
        )}
      </div>
    )
  }

  // ── Bilan config editor ──
  function BilanConfigEditor() {
    const bilanFreq = formData.bilan_frequency || 'daily'
    const completeFreq = formData.complete_bilan_frequency || 'weekly'
    const completeDay = formData.complete_bilan_day ?? 1
    const isBiweekly = completeFreq === 'biweekly'

    function toggleDayCircle(dayIdx: number) {
      if (isBiweekly) {
        const current = Array.isArray(completeDay) ? [...completeDay] : [completeDay]
        const idx = current.indexOf(dayIdx)
        if (idx >= 0) {
          current.splice(idx, 1)
        } else if (current.length < 2) {
          current.push(dayIdx)
        } else {
          current[1] = dayIdx
        }
        updateField('complete_bilan_day', current.length === 1 ? current : current)
      } else {
        updateField('complete_bilan_day', dayIdx)
      }
    }

    function isDaySelected(dayIdx: number) {
      if (Array.isArray(completeDay)) return completeDay.includes(dayIdx)
      return completeDay === dayIdx
    }

    return (
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
        {/* Daily bilan toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
            <i className="fas fa-calendar-day" style={{ marginRight: 6, color: 'var(--text3)' }} />Bilan quotidien
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${bilanFreq !== 'none' ? 'btn-red' : 'btn-outline'}`}
              onClick={() => updateField('bilan_frequency', 'daily')}
            >Active</button>
            <button
              type="button"
              className={`btn btn-sm ${bilanFreq === 'none' ? 'btn-red' : 'btn-outline'}`}
              onClick={() => updateField('bilan_frequency', 'none')}
            >Desactive</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ color: 'var(--text2)', fontSize: 13 }}><i className="fas fa-bell" style={{ marginRight: 4 }} />Notification a</span>
            <input
              type="time"
              className="form-control"
              style={{ width: 'auto' }}
              value={formData.bilan_notif_time || DEFAULT_NOTIF_TIME}
              onChange={(e) => updateField('bilan_notif_time', e.target.value)}
            />
          </div>
        </div>

        {/* Complete bilan config */}
        <div>
          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
            <i className="fas fa-calendar-check" style={{ marginRight: 6, color: 'var(--primary)' }} />Bilan complet
            <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 12, marginLeft: 4 }}>(photos + mensurations)</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {COMPLETE_FREQ_OPTS.map(o => (
              <button
                key={o.v}
                type="button"
                className={`btn btn-sm ${completeFreq === o.v ? 'btn-red' : 'btn-outline'}`}
                onClick={() => updateField('complete_bilan_frequency', o.v)}
              >{o.l}</button>
            ))}
          </div>

          {/* Day circles for weekly/biweekly */}
          {['weekly', 'biweekly'].includes(completeFreq) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>{isBiweekly ? 'Jours (2) :' : 'Jour :'}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {JOURS_SEMAINE.map((jour, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDayCircle(i)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', border: '2px solid',
                      borderColor: isDaySelected(i) ? 'var(--primary)' : 'var(--border)',
                      background: isDaySelected(i) ? 'var(--primary)' : 'transparent',
                      color: isDaySelected(i) ? '#fff' : 'var(--text2)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {jour.charAt(0)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Month day for monthly */}
          {completeFreq === 'monthly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>Le</span>
              <select
                className="form-control"
                style={{ width: 'auto' }}
                value={formData.complete_bilan_month_day || 1}
                onChange={(e) => updateField('complete_bilan_month_day', Number(e.target.value))}
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>du mois</span>
            </div>
          )}

          {/* Custom interval */}
          {completeFreq === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>Tous les</span>
              <input
                type="number"
                className="form-control"
                style={{ width: 60 }}
                value={formData.complete_bilan_interval || 14}
                min={2}
                max={90}
                onChange={(e) => updateField('complete_bilan_interval', Number(e.target.value))}
              />
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>jours</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text2)', fontSize: 13 }}><i className="fas fa-bell" style={{ marginRight: 4 }} />Notification a</span>
            <input
              type="time"
              className="form-control"
              style={{ width: 'auto' }}
              value={formData.complete_bilan_notif_time || DEFAULT_NOTIF_TIME}
              onChange={(e) => updateField('complete_bilan_notif_time', e.target.value)}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Onboarding section ──
  function OnboardingSection() {
    if (!workflow || !onboarding) return null

    const steps = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : (workflow.steps || [])
    const completed = onboarding.steps_completed || []
    const responses = typeof onboarding.responses === 'string' ? JSON.parse(onboarding.responses) : (onboarding.responses || {})

    const isDone = (idx: number, step: any) =>
      completed.includes(idx) || completed.includes(String(idx)) ||
      completed.includes(step.position) || completed.includes(String(step.position))

    const stepTypeInfo: Record<string, { icon: string; color: string }> = {
      video: { icon: 'fa-play-circle', color: '#3b82f6' },
      contract: { icon: 'fa-file-signature', color: '#f59e0b' },
      questionnaire: { icon: 'fa-clipboard-list', color: '#8b5cf6' },
      formation: { icon: 'fa-graduation-cap', color: '#22c55e' },
    }

    const doneCount = steps.filter((s: any, i: number) => isDone(i, s)).length
    const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0

    const statusLabels: Record<string, { done: string; pending: string }> = {
      contract: { done: 'Signe', pending: 'En attente' },
      video: { done: 'Vu', pending: 'Non vu' },
      questionnaire: { done: 'Complete', pending: 'Non complete' },
      formation: { done: 'Terminee', pending: 'Non commencee' },
    }

    return (
      <div style={{ marginTop: 16, background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              <i className="fas fa-route" style={{ color: 'var(--primary)', marginRight: 8 }} />Onboarding — {workflow.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {doneCount}/{steps.length} etapes · {pct === 100 ? 'Termine' : 'En cours'}
            </div>
          </div>
        </div>
        <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map((step: any, idx: number) => {
            const done = isDone(idx, step)
            const info = stepTypeInfo[step.type] || { icon: 'fa-circle', color: 'var(--text3)' }
            const labels = statusLabels[step.type] || { done: 'Fait', pending: 'En attente' }

            return (
              <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: done ? info.color : 'var(--bg4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <i className={`fas ${info.icon}`} style={{ color: done ? '#fff' : 'var(--text3)', fontSize: 12 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{step.title || step.type}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                      background: done ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                      color: done ? '#22c55e' : '#f59e0b',
                    }}>
                      <i className={`fas ${done ? 'fa-check' : 'fa-clock'}`} style={{ marginRight: 4 }} />
                      {done ? labels.done : labels.pending}
                    </span>
                  </div>
                  {/* Show questionnaire answers if completed */}
                  {done && step.type === 'questionnaire' && step.questions?.length > 0 && (
                    <div style={{ marginTop: 8, padding: 10, background: 'var(--bg3)', borderRadius: 8 }}>
                      {step.questions.map((q: any, qi: number) => {
                        const stepResp = responses[idx] || responses[String(idx)] || responses[step.position] || responses[String(step.position)] || {}
                        const ans = stepResp[qi] || stepResp[String(qi)] || stepResp[q.label] || '\u2014'
                        return (
                          <div key={qi} style={{ marginBottom: qi < step.questions.length - 1 ? 8 : 0 }}>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}><i className="fas fa-question-circle" style={{ marginRight: 4, fontSize: 10 }} />{q.label}</div>
                            <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>{String(ans)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Payment card ──
  function PaymentCard() {
    if (!paymentPlan) {
      return (
        <div style={{ marginTop: 16, background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <i className="fas fa-credit-card" style={{ marginRight: 6 }} />PAIEMENT
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>Aucun plan configure</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: 6 }}>
              <i className="fas fa-gift" style={{ marginRight: 4 }} />Gratuit
            </span>
          </div>
        </div>
      )
    }

    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
      active: { label: 'Actif', color: '#22c55e', icon: 'fa-check-circle' },
      pending: { label: 'En attente', color: '#f59e0b', icon: 'fa-clock' },
      past_due: { label: 'Impaye', color: '#ef4444', icon: 'fa-exclamation-circle' },
      canceled: { label: 'Annule', color: '#ef4444', icon: 'fa-times-circle' },
      completed: { label: 'Termine', color: '#6366f1', icon: 'fa-flag-checkered' },
      free: { label: 'Gratuit', color: '#22c55e', icon: 'fa-gift' },
    }
    const status = statusMap[paymentPlan.payment_status] || statusMap.pending

    const freqLabel = paymentPlan.is_free ? 'Gratuit' :
      paymentPlan.frequency === 'once' ? `${(paymentPlan.amount / 100).toFixed(0)}\u20AC (unique)` :
      `${(paymentPlan.amount / 100).toFixed(0)}\u20AC/${paymentPlan.frequency === 'month' ? 'mois' : paymentPlan.frequency === 'week' ? 'sem' : 'jour'}`

    const engagementLabel = paymentPlan.engagement_months > 0
      ? `${paymentPlan.engagement_months} mois${paymentPlan.engagement_end ? ` (jusqu'au ${new Date(paymentPlan.engagement_end).toLocaleDateString('fr-FR')})` : ''}`
      : 'Sans engagement'

    const pendingCancel = cancelRequests.find((r: any) => r.status === 'pending')

    return (
      <div style={{ marginTop: 16, background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <i className="fas fa-credit-card" style={{ marginRight: 6 }} />PAIEMENT
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{freqLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: status.color, background: `${status.color}18`, padding: '3px 10px', borderRadius: 6 }}>
            <i className={`fas ${status.icon}`} style={{ marginRight: 4 }} />{status.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
          <i className="fas fa-lock" style={{ marginRight: 6, width: 14 }} />{engagementLabel}
        </div>

        {pendingCancel && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
              <i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />Demande de resiliation en attente
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              Raison : {pendingCancel.reason || '\u2014'}
            </div>
          </div>
        )}

        {paymentHistory.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>HISTORIQUE</div>
            {paymentHistory.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                <span style={{ fontWeight: 600 }}>{(p.amount / 100).toFixed(2)}\u20AC</span>
                <span style={{ color: p.status === 'succeeded' ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: 12 }}>
                  {p.status === 'succeeded' ? 'Paye' : 'Echoue'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Delete with Stripe cancellation ──
  async function handleDelete() {
    if (!confirm(`Supprimer ${a.prenom} ${a.nom} et TOUTES ses donnees ?`)) return

    // Cancel Stripe subscription if active
    const { data: stripeSub } = await supabase
      .from('stripe_customers')
      .select('stripe_subscription_id')
      .eq('athlete_id', a.id)
      .eq('coach_id', user?.id)
      .in('subscription_status', ['active', 'past_due'])
      .maybeSingle()

    if (stripeSub?.stripe_subscription_id) {
      try {
        await fetch(`/api/stripe?action=cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: stripeSub.stripe_subscription_id,
            coachId: user?.id,
            athleteId: a.id,
          }),
        })
      } catch (err) {
        // Continue with deletion even if Stripe cancel fails
      }
    }

    const { error } = await supabase.rpc('delete_athlete_complete', { athlete_row_id: a.id })
    if (error) {
      // Fallback to simple delete
      const { error: err2 } = await supabase.from('athletes').delete().eq('id', a.id)
      if (err2) { toast('Erreur lors de la suppression', 'error'); return }
    }
    toast('Athlete supprime', 'success')
    refreshAthletes()
    router.push('/athletes')
  }

  // -- Avatar --
  const initials = (a.prenom?.charAt(0) || '') + (a.nom?.charAt(0) || '')

  const bilanFreqLabel = formatBilanLabel(a.bilan_frequency || 'daily', a.bilan_interval, a.bilan_day, a.bilan_month_day, a.bilan_notif_time)
  const completeFreqLabel = formatBilanLabel(a.complete_bilan_frequency || 'weekly', a.complete_bilan_interval, a.complete_bilan_day, a.complete_bilan_month_day, a.complete_bilan_notif_time)

  return (
    <div>
      {/* Avatar + Name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, padding: 28, background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--primary),#d41a1a)' }} />
        {a.avatar_url ? (
          <img src={a.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', border: '3px solid var(--border)' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg,var(--bg3),var(--bg4))', border: '3px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--text2)' }}>{initials}</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{a.prenom} {a.nom}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{a.email || ''}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {activePhase ? (
              <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(179,8,8,0.1)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 6 }}>{activePhase.name || OBJECTIF_LABELS[activePhase.phase] || activePhase.phase}</span>
            ) : a.objectif ? (
              <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(179,8,8,0.1)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 6 }}>{OBJECTIF_LABELS[a.objectif] || a.objectif}</span>
            ) : null}
            {a.poids_actuel && <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--tint-medium, rgba(255,255,255,0.06))', color: 'var(--text2)', padding: '3px 10px', borderRadius: 6 }}>{a.poids_actuel} kg</span>}
          </div>
        </div>
      </div>

      <div className={styles.infoGrid}>
        {/* Personal info card */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardTitle}><i className="fas fa-user" style={{ marginRight: 6 }} />INFORMATIONS PERSONNELLES</span>
            <button className="btn btn-outline btn-sm" onClick={() => editingCard === 'personal' ? setEditingCard(null) : startEdit('personal')}>
              <i className={`fas ${editingCard === 'personal' ? 'fa-times' : 'fa-pen'}`} />
            </button>
          </div>
          {editingCard === 'personal' ? (
            <div>
              <EditField label="Prenom" field="prenom" />
              <EditField label="Nom" field="nom" />
              <EditField label="Email" field="email" type="email" />
              <EditField label="Telephone" field="telephone" />
              <EditField label="Date de naissance" field="date_naissance" type="date" />
              <EditField label="Genre" field="genre" options={[{ value: '', label: '\u2014' }, { value: 'homme', label: 'Homme' }, { value: 'femme', label: 'Femme' }]} />
              <EditField label="Objectif" field="objectif" options={[{ value: '', label: '\u2014' }, ...Object.entries(OBJECTIF_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
              <EditField label="Objectif pas/jour" field="pas_journalier" type="number" />
              <EditField label="Objectif eau (ml/jour)" field="water_goal_ml" type="number" />
              <EditField label="Mode d'acces" field="access_mode" options={[{ value: 'full', label: 'Complet' }, { value: 'training_only', label: 'Training uniquement' }, { value: 'nutrition_only', label: 'Diete uniquement' }]} />
              <BilanConfigEditor />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-red btn-sm" onClick={() => saveEdit('personal')}><i className="fas fa-save" /> Sauvegarder</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingCard(null)}>Annuler</button>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow icon="fa-id-card" label="Prenom" value={a.prenom} />
              <InfoRow icon="fa-id-card" label="Nom" value={a.nom} />
              <InfoRow icon="fa-envelope" label="Email" value={a.email} />
              <InfoRow icon="fa-phone" label="Telephone" value={a.telephone || ''} />
              <InfoRow icon="fa-calendar" label="Date de naissance" value={a.date_naissance ? new Date(a.date_naissance + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''} />
              <InfoRow icon="fa-venus-mars" label="Genre" value={a.genre || ''} />
              <InfoRow icon="fa-bullseye" label="Objectif" value={OBJECTIF_LABELS[a.objectif] || a.objectif || ''} />
              <InfoRow icon="fa-shoe-prints" label="Objectif pas" value={`${(a.pas_journalier || DEFAULT_STEPS_GOAL).toLocaleString('fr-FR')} pas/jour`} />
              <InfoRow icon="fa-tint" label="Objectif eau" value={`${(a.water_goal_ml || DEFAULT_WATER_GOAL).toLocaleString('fr-FR')} ml/jour`} />
              <InfoRow icon="fa-lock" label="Mode d'acces" value={ACCESS_LABELS[a.access_mode] || 'Complet'} />
              <InfoRow icon="fa-calendar-day" label="Bilan quotidien" value={bilanFreqLabel} />
              <InfoRow icon="fa-calendar-check" label="Bilan complet" value={completeFreqLabel} />
            </div>
          )}
        </div>

        {/* Health card */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardTitle}><i className="fas fa-heartbeat" style={{ marginRight: 6 }} />SANTE</span>
            <button className="btn btn-outline btn-sm" onClick={() => editingCard === 'health' ? setEditingCard(null) : startEdit('health')}>
              <i className={`fas ${editingCard === 'health' ? 'fa-times' : 'fa-pen'}`} />
            </button>
          </div>
          {editingCard === 'health' ? (
            <div>
              <EditField label="Blessures / Limitations" field="blessures" type="textarea" />
              <EditField label="Allergies alimentaires" field="allergies" type="textarea" />
              <EditField label="Medicaments" field="medicaments" type="textarea" />
              <EditField label="Notes sante" field="notes_sante" type="textarea" />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-red btn-sm" onClick={() => saveEdit('health')}><i className="fas fa-save" /> Sauvegarder</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingCard(null)}>Annuler</button>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow icon="fa-band-aid" label="Blessures / Limitations" value={a.blessures || ''} />
              <InfoRow icon="fa-allergies" label="Allergies alimentaires" value={a.allergies || ''} />
              <InfoRow icon="fa-pills" label="Medicaments" value={a.medicaments || ''} />
              <InfoRow icon="fa-notes-medical" label="Notes sante" value={a.notes_sante || ''} />
            </div>
          )}
        </div>
      </div>

      {/* Onboarding section */}
      <OnboardingSection />

      {/* Payment card */}
      <PaymentCard />

      {/* Delete athlete */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={handleDelete}>
          <i className="fas fa-trash" /> Supprimer l&apos;athlete
        </button>
      </div>
    </div>
  )
}
