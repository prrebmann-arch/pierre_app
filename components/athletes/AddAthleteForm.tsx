'use client'

import { useState, useEffect } from 'react'
import { createClient as createVanillaClient } from '@supabase/supabase-js'
import { useAuth } from '@/contexts/AuthContext'
import { useAthleteContext } from '@/contexts/AthleteContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import { generateSecurePassword } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import FormGroup from '@/components/ui/FormGroup'
import styles from '@/styles/athletes.module.css'

interface AddAthleteFormProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (message: string) => void
}

interface OnboardingWorkflow {
  id: string
  name: string
}

export default function AddAthleteForm({ isOpen, onClose, onCreated }: AddAthleteFormProps) {
  const { user } = useAuth()
  const { refreshAthletes } = useAthleteContext()
  const { toast } = useToast()
  const supabase = createClient()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // WhatsApp message modal
  const [whatsappMessage, setWhatsappMessage] = useState<string | null>(null)

  // Payment
  const [paymentType, setPaymentType] = useState<'paid' | 'free'>('paid')
  const [payAmount, setPayAmount] = useState('')
  const [payFrequency, setPayFrequency] = useState('month')
  const [payInterval, setPayInterval] = useState('1')
  const [payDuration, setPayDuration] = useState<'unlimited' | 'limited'>('unlimited')
  const [payTotal, setPayTotal] = useState('')
  const [engagementMonths, setEngagementMonths] = useState('0')
  const [billingAnchor, setBillingAnchor] = useState<'anniversary' | 'fixed'>('anniversary')
  const [billingDay, setBillingDay] = useState('1')

  // Onboarding workflow
  const [workflows, setWorkflows] = useState<OnboardingWorkflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState('')

  useEffect(() => {
    if (!isOpen || !user) return
    supabase
      .from('onboarding_workflows')
      .select('id, name')
      .eq('coach_id', user.id)
      .order('name')
      .then(({ data }) => {
        setWorkflows(data || [])
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user])

  const resetForm = () => {
    setPrenom('')
    setNom('')
    setEmail('')
    setPaymentType('paid')
    setPayAmount('')
    setPayFrequency('month')
    setPayInterval('1')
    setPayDuration('unlimited')
    setPayTotal('')
    setEngagementMonths('0')
    setBillingAnchor('anniversary')
    setBillingDay('1')
    setSelectedWorkflow('')
  }

  const copyWhatsappMessage = async () => {
    if (!whatsappMessage) return
    try {
      await navigator.clipboard.writeText(whatsappMessage)
      toast('Message copie !', 'success')
    } catch {
      toast('Impossible de copier', 'error')
    }
    setWhatsappMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!user) return

    // Validation
    const trimPrenom = prenom.trim()
    const trimNom = nom.trim()
    const trimEmail = email.trim()

    if (!trimPrenom || !trimNom) {
      toast('Prenom et nom requis', 'error')
      return
    }
    if (trimPrenom.length > 100 || trimNom.length > 100) {
      toast('Nom ou prenom trop long (max 100)', 'error')
      return
    }
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(trimEmail)) {
      toast('Email invalide', 'error')
      return
    }

    setSubmitting(true)

    try {
      // Check Stripe if paid
      if (paymentType === 'paid') {
        const { data: coachProfile } = await supabase
          .from('coach_profiles')
          .select('stripe_charges_enabled, stripe_account_id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!coachProfile?.stripe_charges_enabled && !coachProfile?.stripe_account_id) {
          toast("Connectez votre Stripe dans Profil avant d'ajouter un athlete payant", 'error')
          setSubmitting(false)
          return
        }
      }

      const tempPassword = generateSecurePassword(14)
      const coachId = user.id

      // Use a DISPOSABLE vanilla supabase client for signUp so the SSR client's
      // session/cookies are never switched to the athlete. This is the key fix:
      // the SSR browser client (createBrowserClient) syncs session to cookies,
      // so signUp would overwrite the coach's cookie-based auth. A vanilla client
      // is stateless and doesn't touch cookies.
      let authData: { user: { id: string } | null } | null = null
      try {
        const throwawayClient = createVanillaClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false } }
        )
        const { data: signUpData, error: authError } = await throwawayClient.auth.signUp({
          email: trimEmail,
          password: tempPassword,
          options: { data: { prenom: trimPrenom, nom: trimNom } },
        })

        if (authError && authError.message.includes('already registered')) {
          authData = null
        } else if (authError) {
          toast(authError.message, 'error')
          setSubmitting(false)
          return
        } else {
          authData = signUpData
        }
      } catch (err) {
        toast('Erreur lors de la creation du compte', 'error')
        setSubmitting(false)
        return
      }
      // No session restore needed — the main supabase client was never touched

      // If email already existed, look up existing user_id
      let existingUserId = authData?.user?.id || null

      if (!existingUserId) {
        const { data: existingAthlete } = await supabase
          .from('athletes')
          .select('user_id')
          .eq('email', trimEmail)
          .not('user_id', 'is', null)
          .maybeSingle()
        existingUserId = existingAthlete?.user_id || null
      }

      const workflowId = selectedWorkflow || null

      const { data: insertedAthletes, error } = await supabase
        .from('athletes')
        .insert({
          prenom: trimPrenom,
          nom: trimNom,
          email: trimEmail,
          poids_actuel: null,
          poids_objectif: null,
          objectif: 'maintenance',
          onboarding_workflow_id: workflowId,
          coach_id: coachId,
          user_id: existingUserId,
        })
        .select()

      if (error) {
        toast(error.message, 'error')
        setSubmitting(false)
        return
      }

      const insertedAthlete = insertedAthletes?.[0]

      // Create payment plan
      if (insertedAthlete) {
        const isFree = paymentType === 'free'
        const amount = parseInt(payAmount) || 0
        const freq = payFrequency
        const interval = parseInt(payInterval) || 1
        const total = payDuration === 'limited' ? parseInt(payTotal) || null : null
        const engagement = parseInt(engagementMonths) || 0

        const engagementStart = engagement > 0 ? new Date().toISOString() : null
        const engagementEnd =
          engagement > 0
            ? new Date(Date.now() + engagement * 30.44 * 24 * 60 * 60 * 1000).toISOString()
            : null

        const bDay = billingAnchor === 'fixed' ? parseInt(billingDay) || 1 : null

        await supabase.from('athlete_payment_plans').insert({
          coach_id: coachId,
          athlete_id: insertedAthlete.id,
          is_free: isFree,
          amount: isFree ? 0 : amount * 100,
          frequency: isFree ? 'month' : freq,
          frequency_interval: interval,
          is_unlimited: payDuration === 'unlimited',
          total_payments: total,
          engagement_months: engagement,
          engagement_start: engagementStart,
          engagement_end: engagementEnd,
          payment_status: isFree ? 'free' : 'pending',
          billing_anchor: billingAnchor,
          billing_day: bDay,
        })

        await supabase.from('athlete_activity_log').insert({
          coach_id: coachId,
          athlete_id: insertedAthlete.id,
          event: 'added',
        })
      }

      // Create onboarding entry if workflow selected
      if (workflowId && insertedAthlete) {
        let onboardingUserId = authData?.user?.id
        if (!onboardingUserId) {
          const { data: freshAthlete } = await supabase
            .from('athletes')
            .select('user_id')
            .eq('id', insertedAthlete.id)
            .single()
          onboardingUserId = freshAthlete?.user_id
        }

        if (onboardingUserId) {
          await supabase.from('athlete_onboarding').insert({
            athlete_id: onboardingUserId,
            workflow_id: workflowId,
            current_step: 0,
            steps_completed: [],
            completed: false,
            responses: {},
          })
        }
      }

      const msg = `Bienvenue dans l'app de coaching ! \n\nVoici vos identifiants:\n\nEmail: ${trimEmail}\nMot de passe: ${tempPassword}\n\nConnectez-vous pour voir vos seances!`
      toast('Athlete ajoute avec succes !', 'success')
      resetForm()
      onClose()
      refreshAthletes()
      // Show WhatsApp modal in PARENT (after form is closed)
      if (onCreated) onCreated(msg)
    } catch (err) {
      toast('Erreur inattendue', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un athlete" size="lg">
        <form onSubmit={handleSubmit} style={{ padding: '0 20px 20px' }}>
          <div className="form-row">
            <FormGroup label="Prenom" htmlFor="add-prenom">
              <input
                id="add-prenom"
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
              />
            </FormGroup>
            <FormGroup label="Nom" htmlFor="add-nom">
              <input
                id="add-nom"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </FormGroup>
          </div>

          <FormGroup label="Email" htmlFor="add-email">
            <input
              id="add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormGroup>

          {workflows.length > 0 && (
            <FormGroup label="Parcours d'onboarding" htmlFor="add-workflow">
              <select
                id="add-workflow"
                value={selectedWorkflow}
                onChange={(e) => setSelectedWorkflow(e.target.value)}
              >
                <option value="">&mdash; Aucun &mdash;</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </FormGroup>
          )}

          {/* Payment section */}
          <div className={styles.paymentSection}>
            <h3 className={styles.paymentTitle}>
              <i className="fa-solid fa-credit-card" style={{ marginRight: 6 }} />
              Paiement
            </h3>

            <FormGroup label="Type">
              <div className={styles.payTypeGroup}>
                <label
                  className={`${styles.payTypeLabel} ${paymentType === 'free' ? styles.payTypeLabelActive : ''}`}
                >
                  <input
                    type="radio"
                    name="pay-type"
                    checked={paymentType === 'free'}
                    onChange={() => setPaymentType('free')}
                    style={{ appearance: 'auto', width: 16, height: 16, accentColor: 'var(--primary)' }}
                  />
                  Gratuit
                </label>
                <label
                  className={`${styles.payTypeLabel} ${paymentType === 'paid' ? styles.payTypeLabelActive : ''}`}
                >
                  <input
                    type="radio"
                    name="pay-type"
                    checked={paymentType === 'paid'}
                    onChange={() => setPaymentType('paid')}
                    style={{ appearance: 'auto', width: 16, height: 16, accentColor: 'var(--primary)' }}
                  />
                  Payant
                </label>
              </div>
            </FormGroup>

            {paymentType === 'paid' && (
              <>
                <div className="form-row">
                  <FormGroup label="Montant (EUR)" htmlFor="add-amount">
                    <input
                      id="add-amount"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="160"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </FormGroup>
                  <FormGroup label="Frequence" htmlFor="add-freq">
                    <select
                      id="add-freq"
                      value={payFrequency}
                      onChange={(e) => setPayFrequency(e.target.value)}
                    >
                      <option value="month">Par mois</option>
                      <option value="week">Par semaine</option>
                      <option value="day">Par jour</option>
                      <option value="once">Paiement unique</option>
                    </select>
                  </FormGroup>
                </div>

                <div className="form-row">
                  <FormGroup label="Tous les" htmlFor="add-interval">
                    <input
                      id="add-interval"
                      type="number"
                      min="1"
                      max="12"
                      value={payInterval}
                      onChange={(e) => setPayInterval(e.target.value)}
                    />
                  </FormGroup>
                  <FormGroup label="Duree" htmlFor="add-duration">
                    <select
                      id="add-duration"
                      value={payDuration}
                      onChange={(e) => setPayDuration(e.target.value as 'unlimited' | 'limited')}
                    >
                      <option value="unlimited">Illimite</option>
                      <option value="limited">Nombre de paiements</option>
                    </select>
                  </FormGroup>
                </div>

                {payDuration === 'limited' && (
                  <FormGroup label="Nombre de paiements" htmlFor="add-total">
                    <input
                      id="add-total"
                      type="number"
                      min="1"
                      placeholder="9"
                      value={payTotal}
                      onChange={(e) => setPayTotal(e.target.value)}
                    />
                  </FormGroup>
                )}

                <div className="form-row">
                  <FormGroup label="Engagement (mois)" htmlFor="add-engagement">
                    <input
                      id="add-engagement"
                      type="number"
                      min="0"
                      placeholder="0 = sans"
                      value={engagementMonths}
                      onChange={(e) => setEngagementMonths(e.target.value)}
                    />
                  </FormGroup>
                  <FormGroup label="Date de prelevement" htmlFor="add-billing">
                    <select
                      id="add-billing"
                      value={billingAnchor}
                      onChange={(e) => setBillingAnchor(e.target.value as 'anniversary' | 'fixed')}
                    >
                      <option value="anniversary">Date anniversaire (inscription)</option>
                      <option value="fixed">Date fixe du mois</option>
                    </select>
                  </FormGroup>
                </div>

                {billingAnchor === 'fixed' && (
                  <FormGroup label="Jour du mois" htmlFor="add-billing-day">
                    <input
                      id="add-billing-day"
                      type="number"
                      min="1"
                      max="28"
                      placeholder="1"
                      value={billingDay}
                      onChange={(e) => setBillingDay(e.target.value)}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Entre 1 et 28</span>
                  </FormGroup>
                )}
              </>
            )}
          </div>

          <button type="submit" className="btn btn-red" disabled={submitting} style={{ marginTop: 16 }}>
            {submitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
                Ajout en cours...
              </>
            ) : (
              "Ajouter l'athlete"
            )}
          </button>
        </form>
      </Modal>

    </>
  )
}
