'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadStripe, type Stripe as StripeJS } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Toggle from '@/components/ui/Toggle'
import Modal from '@/components/ui/Modal'
import type { PlatformInvoice } from '@/lib/types'
import styles from '@/styles/profile.module.css'

const MONTH_NAMES = [
  '', 'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
]

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paye', color: 'var(--success)' },
  pending: { label: 'En attente', color: 'var(--warning)' },
  failed: { label: 'Echoue', color: 'var(--danger)' },
  retry_1: { label: 'Relance 1', color: 'var(--warning)' },
  retry_2: { label: 'Relance 2', color: '#f97316' },
  retry_3: { label: 'Relance 3', color: 'var(--danger)' },
  blocked: { label: 'Bloque', color: 'var(--danger)' },
}

interface ImportSub {
  subscription_id: string
  customer_id: string
  customer_email: string | null
  customer_name: string | null
  amount: number
  currency: string
  interval: string
  interval_count: number
  status: string
  current_period_start: string
  current_period_end: string
}

export default function ProfilePage() {
  const { user, coach, refreshCoach } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<PlatformInvoice[]>([])
  const [loading, setLoading] = useState(true)

  // Stripe card update state
  const [showCardForm, setShowCardForm] = useState(false)
  const [stripePromise, setStripePromise] = useState<Promise<StripeJS | null> | null>(null)
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null)

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importSubs, setImportSubs] = useState<ImportSub[]>([])
  const [importedIndexes, setImportedIndexes] = useState<Set<number>>(new Set())

  // Load invoices
  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('platform_invoices')
          .select('id, coach_id, amount, status, month, year, stripe_invoice_id, created_at')
          .eq('coach_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12)
        setInvoices((data as PlatformInvoice[]) || [])
      } catch (err) {
        // load error
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const authFetch = useCallback(
    async (url: string, opts: RequestInit = {}) => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      return fetch(url, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
          ...(opts.headers || {}),
        },
      })
    },
    [supabase],
  )

  // Check connect return
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('connect') === 'complete') {
      authFetch(`/api/stripe?action=connect-complete&coachId=${user.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.connected) {
            toast('Stripe connecte avec succes !', 'success')
            refreshCoach()
          } else if (data.details_submitted === false) {
            toast('Onboarding Stripe incomplet. Cliquez sur "Connecter" pour finaliser.', 'error')
          }
          window.history.replaceState({}, '', '/profile')
        })
        .catch(() => {})
    }
    if (params.get('setup') === 'success') {
      supabase
        .from('coach_profiles')
        .update({ has_payment_method: true })
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) {
            toast('Erreur enregistrement carte', 'error')
            return
          }
          refreshCoach()
          toast('Carte enregistree avec succes', 'success')
          window.history.replaceState({}, '', '/profile')
        })
    }
  }, [user, authFetch, refreshCoach, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  // -- Actions --

  const handleEditName = async () => {
    const name = prompt('Nom affiche :', coach?.display_name || '')
    if (name === null) return
    const { error } = await supabase
      .from('coach_profiles')
      .update({ display_name: name })
      .eq('user_id', user!.id)
    if (error) {
      toast('Erreur mise a jour', 'error')
      return
    }
    refreshCoach()
    toast('Nom mis a jour', 'success')
  }

  const handleConnectStripe = async () => {
    toast('Redirection vers Stripe...', 'success')
    try {
      const resp = await authFetch('/api/stripe?action=connect-start', {
        method: 'POST',
        body: JSON.stringify({ coachId: user!.id, email: user!.email }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      if (data.url) window.location.href = data.url
    } catch (err) {
      toast((err as Error).message || 'Erreur Stripe Connect', 'error')
    }
  }

  const handleOpenDashboard = async () => {
    try {
      const resp = await authFetch('/api/stripe?action=connect-dashboard', {
        method: 'POST',
        body: JSON.stringify({ coachId: user!.id }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      if (data.url) window.open(data.url, '_blank')
    } catch (err) {
      toast((err as Error).message || 'Erreur', 'error')
    }
  }

  const handleDisconnectStripe = async () => {
    const ok = window.confirm('Deconnecter votre Stripe ? Vos athletes ne pourront plus etre preleves.')
    if (!ok) return
    const { error } = await supabase
      .from('coach_profiles')
      .update({
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_account_id: null,
      })
      .eq('user_id', user!.id)
    if (error) {
      toast('Erreur: ' + error.message, 'error')
      return
    }
    refreshCoach()
    toast('Stripe deconnecte', 'success')
  }

  const handleChangePlan = async () => {
    const newPlan = coach?.plan === 'business' ? 'athlete' : 'business'
    const msg =
      newPlan === 'business'
        ? 'Passer au plan Business (60EUR/mois + 5EUR/athlete) ?'
        : 'Passer au plan Athlete (5EUR/athlete uniquement) ?'
    if (!confirm(msg)) return
    const { error } = await supabase
      .from('coach_profiles')
      .update({ plan: newPlan })
      .eq('user_id', user!.id)
    if (error) {
      toast('Erreur', 'error')
      return
    }
    refreshCoach()
    toast(`Plan change en ${newPlan === 'business' ? 'Business' : 'Athlete'}`, 'success')
  }

  const handleSetupCard = async () => {
    try {
      const resp = await authFetch('/api/stripe?action=coach-setup', {
        method: 'POST',
        body: JSON.stringify({ coachId: user!.id, email: user!.email }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setCardClientSecret(data.clientSecret)
      setStripePromise(loadStripe(data.publishableKey))
      setShowCardForm(true)
    } catch (err) {
      toast((err as Error).message || 'Erreur', 'error')
    }
  }

  const handleToggleProrata = async (enabled: boolean) => {
    const { error } = await supabase
      .from('coach_profiles')
      .update({ allow_prorata: enabled })
      .eq('user_id', user!.id)
    if (error) {
      toast('Erreur', 'error')
      return
    }
    refreshCoach()
    toast(enabled ? 'Prorata active' : 'Prorata desactive', 'success')
  }

  const handleUpdateCurrency = async (currency: string) => {
    const { error } = await supabase
      .from('coach_profiles')
      .update({ currency })
      .eq('user_id', user!.id)
    if (error) {
      toast('Erreur', 'error')
      return
    }
    refreshCoach()
    toast('Devise mise a jour', 'success')
  }

  const handleImportSubs = async () => {
    toast('Chargement de vos abonnements Stripe...', 'success')
    try {
      const resp = await authFetch('/api/stripe?action=import-subscriptions', {
        method: 'POST',
        body: JSON.stringify({ coachId: user!.id }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      if (!data.subscriptions?.length) {
        toast('Aucun abonnement actif trouve sur votre Stripe', 'error')
        return
      }
      setImportSubs(data.subscriptions)
      setImportedIndexes(new Set())
      setImportModalOpen(true)
    } catch (err) {
      toast((err as Error).message || 'Erreur import', 'error')
    }
  }

  const handleDoImport = async (index: number) => {
    const sub = importSubs[index]
    if (!sub) return
    try {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id')
        .eq('coach_id', user!.id)
        .eq('email', sub.customer_email)
        .maybeSingle()

      if (!athlete) {
        toast(`Aucun athlete trouve pour ${sub.customer_email || 'ce client'}. Ajoutez-le d'abord.`, 'error')
        return
      }

      const { error: custErr } = await supabase.from('stripe_customers').upsert(
        {
          stripe_customer_id: sub.customer_id,
          stripe_subscription_id: sub.subscription_id,
          coach_id: user!.id,
          athlete_id: athlete.id,
          subscription_status: sub.status,
          monthly_amount: sub.amount,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
        },
        { onConflict: 'stripe_customer_id' },
      )
      if (custErr) {
        toast('Erreur import client: ' + custErr.message, 'error')
        return
      }

      await supabase.from('athlete_payment_plans').upsert(
        {
          coach_id: user!.id,
          athlete_id: athlete.id,
          is_free: false,
          amount: sub.amount,
          currency: sub.currency,
          frequency: sub.interval,
          frequency_interval: sub.interval_count,
          payment_status: 'active',
          stripe_subscription_id: sub.subscription_id,
          stripe_customer_id: sub.customer_id,
        },
        { onConflict: 'coach_id,athlete_id' },
      )
      await supabase.from('athlete_activity_log').insert({
        coach_id: user!.id,
        athlete_id: athlete.id,
        event: 'added',
      })

      setImportedIndexes((prev) => new Set([...prev, index]))
      toast(`${sub.customer_name || sub.customer_email} importe`, 'success')
    } catch (err) {
      toast((err as Error).message || 'Erreur import', 'error')
    }
  }

  const handleImportAll = async () => {
    for (let i = 0; i < importSubs.length; i++) {
      if (!importedIndexes.has(i)) await handleDoImport(i)
    }
    toast(`${importSubs.length} abonnements importes`, 'success')
  }

  if (loading || !coach) {
    return (
      <div className={styles.profilePage}>
        <h1 className="page-title">
          <i className="fas fa-user-cog" /> Profil & Parametres
        </h1>
        <div className="loading">
          <i className="fas fa-spinner fa-spin" /> Chargement...
        </div>
      </div>
    )
  }

  const connectStatus = coach.stripe_onboarding_complete && coach.stripe_charges_enabled
  const trialActive = coach.trial_ends_at && new Date(coach.trial_ends_at) > new Date()
  const trialDaysLeft = trialActive
    ? Math.ceil((new Date(coach.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className={styles.profilePage}>
      <h1 className="page-title">
        <i className="fas fa-user-cog" /> Profil & Parametres
      </h1>

      {/* Personal Info */}
      <Card
        title="Informations personnelles"
        headerRight={
          <button className="btn btn-sm" onClick={handleEditName}>
            <i className="fas fa-pen" /> Modifier
          </button>
        }
        className={styles.section}
      >
        <div className={styles.infoGrid}>
          <div>
            <div className={styles.infoLabel}>Nom</div>
            <div className={styles.infoValue}>{coach.display_name || ''}</div>
          </div>
          <div>
            <div className={styles.infoLabel}>Email</div>
            <div className={styles.infoValue}>{coach.email || user!.email}</div>
          </div>
        </div>
      </Card>

      {/* Payments */}
      <Card title="Paiements" className={styles.section}>
        <div className={styles.cardBody}>
          {/* Stripe Connect */}
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Mon Stripe</div>
              <div className={styles.rowSub}>
                {connectStatus ? (
                  <span className={styles.statusConnected}>
                    <i className="fas fa-check-circle" /> Connecte -- Les paiements de vos athletes arrivent sur votre Stripe
                  </span>
                ) : (
                  'Connectez votre Stripe pour prelever vos athletes'
                )}
              </div>
            </div>
            <div className={styles.rowActions}>
              {connectStatus ? (
                <>
                  <button className="btn btn-sm" onClick={handleOpenDashboard}>
                    <i className="fas fa-external-link-alt" /> Dashboard
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={handleDisconnectStripe}
                  >
                    <i className="fas fa-unlink" /> Deconnecter
                  </button>
                </>
              ) : (
                <button className="btn btn-sm btn-primary" onClick={handleConnectStripe}>
                  <i className="fab fa-stripe-s" /> Connecter mon Stripe
                </button>
              )}
            </div>
          </div>

          {/* Subscription */}
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Mon abonnement</div>
              <div className={styles.rowSub}>
                {coach.plan === 'free' ? (
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>Gratuit</span>
                ) : (
                  <>
                    Plan {coach.plan === 'business' ? 'Business' : 'Athlete'}
                    {trialActive && (
                      <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                        Essai gratuit ({trialDaysLeft}j restants)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            {coach.plan !== 'free' && (
              <div className={styles.rowActions}>
                <button
                  className={`btn btn-sm ${coach.plan === 'business' ? '' : 'btn-primary'}`}
                  onClick={handleChangePlan}
                >
                  {coach.plan === 'business' ? 'Passer en Athlete' : 'Passer en Business'}
                </button>
              </div>
            )}
          </div>

          {/* Card */}
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Carte bancaire</div>
              <div className={styles.rowSub}>
                {coach.plan === 'free'
                  ? 'Non requis (plan gratuit)'
                  : coach.has_payment_method
                    ? 'Carte enregistree'
                    : 'Aucune carte enregistree'}
              </div>
            </div>
            <div className={styles.rowActions}>
              <button className="btn btn-sm" onClick={handleSetupCard}>
                <i className={`fas fa-${coach.has_payment_method ? 'pen' : 'plus'}`} />{' '}
                {coach.has_payment_method ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>

          {/* Stripe card form */}
          {showCardForm && stripePromise && cardClientSecret && (
            <div className={styles.stripeContainer}>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: cardClientSecret,
                  appearance: {
                    theme: 'night',
                    variables: {
                      colorPrimary: '#B30808',
                      colorBackground: '#18181b',
                      colorText: '#f4f4f5',
                      borderRadius: '8px',
                    },
                  },
                }}
              >
                <CardForm
                  onSuccess={() => {
                    setShowCardForm(false)
                    refreshCoach()
                    toast('Carte enregistree avec succes', 'success')
                  }}
                  onCancel={() => setShowCardForm(false)}
                />
              </Elements>
            </div>
          )}

          {/* Import subs */}
          {connectStatus && (
            <div className={styles.row}>
              <div>
                <div className={styles.rowLabel}>Importer des abonnements</div>
                <div className={styles.rowSub}>Importez vos abonnements Stripe existants</div>
              </div>
              <div className={styles.rowActions}>
                <button className="btn btn-sm" onClick={handleImportSubs}>
                  <i className="fas fa-download" /> Importer
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Invoices */}
      <Card title="Mes factures" className={styles.section}>
        <div className={styles.cardBody}>
          {invoices.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 20 }}>
              Aucune facture
            </div>
          ) : (
            <table className={styles.invoiceTable}>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Athletes</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status] || { label: inv.status, color: '#888' }
                  return (
                    <tr key={inv.id}>
                      <td>
                        {MONTH_NAMES[inv.month]} {inv.year}
                      </td>
                      <td>{inv.athlete_count}</td>
                      <td className={styles.invoiceAmount}>{(inv.total_amount / 100).toFixed(2)}EUR</td>
                      <td>
                        <span style={{ color: st.color, fontWeight: 600, fontSize: 13 }}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Preferences */}
      <Card title="Preferences" className={styles.section}>
        <div className={styles.cardBody}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Prorata athletes</div>
              <div className={styles.rowSub}>Rembourser au prorata si un athlete annule en milieu de mois</div>
            </div>
            <Toggle checked={!!coach.allow_prorata} onChange={handleToggleProrata} />
          </div>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Devise</div>
              <div className={styles.rowSub}>Devise utilisee pour les paiements</div>
            </div>
            <select
              style={{
                background: 'var(--bg2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 14,
              }}
              value={coach.currency || 'eur'}
              onChange={(e) => handleUpdateCurrency(e.target.value)}
            >
              <option value="eur">EUR</option>
              <option value="usd">USD ($)</option>
              <option value="gbp">GBP</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Import modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title={`Importer des abonnements (${importSubs.length})`}
      >
        <div className={styles.importListWrap}>
          {importSubs.map((sub, i) => (
            <div key={sub.subscription_id} className={styles.importItem}>
              <div>
                <div className={styles.importName}>
                  {sub.customer_name || sub.customer_email || 'Client'}
                </div>
                <div className={styles.importDetail}>
                  {sub.customer_email || ''} -- {(sub.amount / 100).toFixed(0)}EUR/{sub.interval}
                </div>
              </div>
              {importedIndexes.has(i) ? (
                <span style={{ color: 'var(--success)' }}>
                  <i className="fas fa-check" /> OK
                </span>
              ) : (
                <button className="btn btn-sm" onClick={() => handleDoImport(i)}>
                  <i className="fas fa-download" /> Importer
                </button>
              )}
            </div>
          ))}
        </div>
        <div className={styles.importFooter}>
          <button className="btn btn-primary" onClick={handleImportAll}>
            Tout importer
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ---- Inline CardForm (uses Stripe Elements context) ----

function CardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const supabase = createClient()
  const { user } = useAuth()

  const handleConfirm = async () => {
    if (!stripe || !elements) return
    setConfirming(true)
    setError('')

    const { error: stripeError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/profile?setup=success` },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message || 'Erreur')
      setConfirming(false)
      return
    }

    // Mark payment method in DB
    await supabase
      .from('coach_profiles')
      .update({ has_payment_method: true })
      .eq('user_id', user!.id)

    onSuccess()
  }

  return (
    <div>
      <PaymentElement />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming}>
          {confirming ? 'Verification...' : 'Confirmer'}
        </button>
        <button className="btn btn-outline" onClick={onCancel}>
          Annuler
        </button>
      </div>
      {error && <div className={styles.stripeError}>{error}</div>}
    </div>
  )
}
