'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe, type Stripe as StripeJS } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import styles from '@/styles/profile.module.css'

export default function SetupPaymentPage() {
  const { user, coach, loading, refreshCoach, accessToken } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const [stripePromise, setStripePromise] = useState<Promise<StripeJS | null> | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState('')

  const authFetch = useCallback(
    async (url: string, opts: RequestInit = {}) => {
      return fetch(url, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken || ''}`,
          ...(opts.headers || {}),
        },
      })
    },
    [accessToken],
  )

  // Redirect if not logged in or already has payment method
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (coach?.has_payment_method) {
      router.replace('/dashboard')
      return
    }
    if (coach?.plan === 'free') {
      router.replace('/dashboard')
      return
    }
  }, [user, coach, loading, router])

  // Handle return from Stripe 3D Secure redirect
  useEffect(() => {
    if (loading || !user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('setup') === 'success') {
      supabase
        .from('coach_profiles')
        .update({ has_payment_method: true })
        .eq('user_id', user.id)
        .then(() => {
          refreshCoach()
          toast('Carte enregistree !', 'success')
          router.replace('/dashboard')
        })
    }
  }, [user, loading, router, refreshCoach, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetup = async () => {
    if (!user) return
    setInitializing(true)
    setError('')
    try {
      const resp = await authFetch('/api/stripe?action=coach-setup', {
        method: 'POST',
        body: JSON.stringify({ coachId: user.id, email: user.email }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setClientSecret(data.clientSecret)
      setStripePromise(loadStripe(data.publishableKey))
    } catch (err) {
      setError((err as Error).message || 'Erreur')
      setInitializing(false)
    }
  }

  const handleSuccess = async () => {
    await supabase
      .from('coach_profiles')
      .update({ has_payment_method: true })
      .eq('user_id', user!.id)
    await refreshCoach()
    toast('Carte enregistree !', 'success')
    router.replace('/dashboard')
  }

  if (loading) {
    return (
      <div className={styles.paymentWall}>
        <div className={styles.paymentCard}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.paymentWall}>
      <div className={styles.paymentCard}>
        <h1>
          <i className="fas fa-credit-card" /> Ajouter une carte
        </h1>
        <p>
          Pour commencer a utiliser Momentum, ajoutez un moyen de paiement. Vous ne serez pas debite
          pendant votre periode d&apos;essai.
        </p>

        {!clientSecret ? (
          <>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleSetup}
              disabled={initializing}
            >
              {initializing ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Chargement...
                </>
              ) : (
                'Ajouter ma carte'
              )}
            </button>
            {error && <div className={styles.paymentError}>{error}</div>}
          </>
        ) : (
          stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
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
              <SetupForm onSuccess={handleSuccess} />
            </Elements>
          )
        )}
      </div>
    </div>
  )
}

function SetupForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    if (!stripe || !elements) return
    setConfirming(true)
    setError('')

    const { error: stripeError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/setup-payment?setup=success` },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message || 'Erreur')
      setConfirming(false)
      return
    }

    onSuccess()
  }

  return (
    <div>
      <div className={styles.paymentStripeWrap}>
        <PaymentElement />
      </div>
      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={handleConfirm}
        disabled={confirming || !stripe}
      >
        {confirming ? 'Verification...' : 'Confirmer ma carte'}
      </button>
      {error && <div className={styles.paymentError}>{error}</div>}
    </div>
  )
}
