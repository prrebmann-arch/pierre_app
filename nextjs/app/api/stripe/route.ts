import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { verifyAuth, verifyCoach, authErrorResponse } from '@/lib/api/auth'
import { encrypt, decrypt } from '@/lib/api/crypto'

// Platform Stripe instance (Pierre's account — for SaaS billing only)
function getPlatformStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )
}

// Get a Stripe instance using the coach's own key
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCoachStripe(supabase: any, coachId: string): Promise<Stripe | null> {
  const { data } = await supabase
    .from('coach_profiles')
    .select('stripe_secret_key')
    .eq('user_id', coachId)
    .single() as { data: { stripe_secret_key?: string } | null }
  if (!data?.stripe_secret_key) return null
  const key = decrypt(data.stripe_secret_key)
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

function errorJson(message: string, status = 400) {
  return json({ error: message }, status)
}

// Actions called by athletes (not coaches)
const ATHLETE_ACTIONS = ['cancellation-request', 'create-payment-sheet', 'confirm-payment']
// Actions that can be called by either athletes or coaches
const DUAL_AUTH_ACTIONS = ['create-checkout']

// Rate limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, max = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > max
}

// ---------- POST /api/stripe?action=... ----------
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')
  if (!action) return errorJson('Missing action parameter')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (checkRateLimit(`${ip}:${action}`, 15, 60000)) {
    return errorJson('Too many requests', 429)
  }

  const body = await req.json().catch(() => ({}))

  try {
    // ── AUTH: verify JWT and ownership ──
    if (ATHLETE_ACTIONS.includes(action)) {
      const { user } = await verifyAuth(req)
      const supabase = getSupabaseAdmin()
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', body?.athleteId)
        .maybeSingle()
      if (!athlete) return errorJson('Forbidden: not your athlete profile', 403)
    } else if (DUAL_AUTH_ACTIONS.includes(action)) {
      // Try athlete auth first (mobile), fall back to coach auth (web)
      const { user } = await verifyAuth(req)
      const supabase = getSupabaseAdmin()
      if (body?.athleteId) {
        const { data: athlete } = await supabase
          .from('athletes')
          .select('id')
          .eq('user_id', user.id)
          .eq('id', body.athleteId)
          .maybeSingle()
        if (!athlete) return errorJson('Forbidden: not your athlete profile', 403)
      } else {
        await verifyCoach(req, body, 'coachId', req.nextUrl.searchParams)
      }
    } else {
      await verifyCoach(req, body, 'coachId', req.nextUrl.searchParams)
    }

    switch (action) {
      case 'coach-setup':
        return await handleCoachSetup(body)
      case 'connect-start':
        return await handleConnectStart(body, req)
      case 'connect-status':
        return await handleConnectStatus(body)
      case 'connect-dashboard':
        return await handleConnectDashboard(body)
      case 'import-subscriptions':
        return await handleImportSubscriptions(body)
      case 'save-key':
        return await handleSaveKey(body)
      case 'verify-key':
        return await handleVerifyKey(body)
      case 'create-checkout':
        return await handleCreateCheckout(body, req)
      case 'create-payment-sheet':
        return await handleCreatePaymentSheet(body)
      case 'cancel':
        return await handleCancel(body)
      case 'cancellation-request':
        return await handleCancellationRequest(body)
      case 'cancellation-respond':
        return await handleCancellationRespond(body)
      case 'confirm-payment':
        return await handleConfirmPayment(body)
      default:
        return errorJson(`Unknown action: ${action}`)
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      return authErrorResponse(err)
    }
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[stripe] action:', action, 'error:', message)
    return errorJson(message, 500)
  }
}

// ---------- GET /api/stripe?action=... ----------
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  try {
    switch (action) {
      case 'connect-complete': {
        const coachId = req.nextUrl.searchParams.get('coachId')
        if (!coachId) return errorJson('Missing coachId')
        return await handleConnectComplete(coachId)
      }
      default:
        return errorJson(`Unknown action: ${action}`)
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      return authErrorResponse(err)
    }
    const message = err instanceof Error ? err.message : 'Internal error'
    return errorJson(message, 500)
  }
}

// ── COACH SETUP (save payment method for SaaS — on PIERRE's Stripe) ──
async function handleCoachSetup(body: Record<string, string>) {
  const stripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { coachId, email } = body
  if (!coachId || !email) return errorJson('Missing coachId or email')

  const { data: profile } = await supabase.from('coach_profiles').select('stripe_customer_id').eq('user_id', coachId).single()
  let customerId = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { coach_id: coachId, type: 'platform_coach' } })
    customerId = customer.id
    await supabase.from('coach_profiles').update({ stripe_customer_id: customerId }).eq('user_id', coachId)
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    metadata: { coach_id: coachId },
  })

  return json({
    clientSecret: setupIntent.client_secret,
    customer_id: customerId,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  })
}

// ── CONNECT START ──
async function handleConnectStart(body: Record<string, string>, req: NextRequest) {
  const stripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { coachId, email } = body
  if (!coachId || !email) return errorJson('Missing coachId or email')

  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id').eq('user_id', coachId).maybeSingle()

  let accountId = profile?.stripe_account_id

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: { coach_id: coachId },
    })
    accountId = account.id

    await supabase.from('coach_profiles').upsert({
      user_id: coachId,
      stripe_account_id: accountId,
      email,
    }, { onConflict: 'user_id' })
  }

  const origin = req.headers.get('origin') || 'https://pierreapp.vercel.app'
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}?connect=refresh#profile`,
    return_url: `${origin}?connect=complete#profile`,
    type: 'account_onboarding',
  })

  await supabase.from('stripe_audit_log').insert({
    action: 'connect_onboarding_started', actor_id: coachId, actor_type: 'coach',
    metadata: { stripe_account_id: accountId },
  })

  return json({ url: accountLink.url, account_id: accountId })
}

// ── CONNECT COMPLETE ──
async function handleConnectComplete(coachId: string) {
  const stripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id').eq('user_id', coachId).maybeSingle()

  if (!profile?.stripe_account_id) {
    return json({ connected: false })
  }

  const account = await stripe.accounts.retrieve(profile.stripe_account_id)

  // Consider connected if details_submitted OR charges_enabled (charges may lag in test mode)
  const isConnected = account.details_submitted || account.charges_enabled

  await supabase.from('coach_profiles').update({
    stripe_onboarding_complete: account.details_submitted,
    stripe_charges_enabled: isConnected,
  }).eq('user_id', coachId)

  return json({
    connected: isConnected,
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    account_id: profile.stripe_account_id,
  })
}

// ── CONNECT STATUS ──
async function handleConnectStatus(body: Record<string, string>) {
  const supabase = getSupabaseAdmin()
  const coachId = body.coachId
  if (!coachId) return errorJson('Missing coachId')

  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled')
    .eq('user_id', coachId).maybeSingle()

  if (!profile?.stripe_account_id) return json({ connected: false })

  return json({
    connected: profile.stripe_onboarding_complete || profile.stripe_charges_enabled || false,
    account_id: profile.stripe_account_id,
  })
}

// ── CONNECT DASHBOARD ──
async function handleConnectDashboard(body: Record<string, string>) {
  const stripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { coachId } = body
  if (!coachId) return errorJson('Missing coachId')

  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id').eq('user_id', coachId).maybeSingle()

  if (!profile?.stripe_account_id) return errorJson('Pas de compte Stripe connecté')

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id)
  return json({ url: loginLink.url })
}

// ── SAVE STRIPE KEY ──
async function handleSaveKey(body: Record<string, string>) {
  const supabase = getSupabaseAdmin()
  const { coachId, stripeKey } = body
  if (!coachId || !stripeKey) return errorJson('Missing coachId or stripeKey')

  try {
    const testStripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
    const account = await testStripe.accounts.retrieve()

    await supabase.from('coach_profiles').upsert({
      user_id: coachId,
      stripe_secret_key: process.env.STRIPE_ENCRYPTION_KEY ? encrypt(stripeKey) : stripeKey,
      stripe_account_id: account.id,
      stripe_onboarding_complete: true,
      stripe_charges_enabled: true,
    }, { onConflict: 'user_id' })

    await supabase.from('stripe_audit_log').insert({
      action: 'stripe_key_saved', actor_id: coachId, actor_type: 'coach',
      metadata: { account_id: account.id, account_name: account.business_profile?.name || account.email },
    })

    return json({
      success: true,
      account_id: account.id,
      account_name: account.business_profile?.name || account.settings?.dashboard?.display_name || account.email,
    })
  } catch {
    return errorJson('Clé Stripe invalide. Vérifiez votre clé secrète.')
  }
}

// ── VERIFY STRIPE KEY ──
async function handleVerifyKey(body: Record<string, string>) {
  const supabase = getSupabaseAdmin()
  const coachId = body.coachId
  if (!coachId) return errorJson('Missing coachId')

  const coachStripe = await getCoachStripe(supabase, coachId)
  if (!coachStripe) return json({ connected: false })

  try {
    const account = await coachStripe.accounts.retrieve()
    return json({
      connected: true,
      account_id: account.id,
      account_name: account.business_profile?.name || account.settings?.dashboard?.display_name || account.email,
    })
  } catch {
    return json({ connected: false, error: 'Key invalid' })
  }
}

// ── IMPORT SUBSCRIPTIONS ──
async function handleImportSubscriptions(body: Record<string, string>) {
  const platformStripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { coachId } = body
  if (!coachId) return errorJson('Missing coachId')

  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_charges_enabled, stripe_secret_key')
    .eq('user_id', coachId).single()

  let stripeInstance: Stripe | null = null
  let stripeOpts: Stripe.RequestOptions = {}

  // Try Connect first (verify charges_enabled live)
  if (profile?.stripe_account_id) {
    try {
      const account = await platformStripe.accounts.retrieve(profile.stripe_account_id)
      if (account.charges_enabled) {
        stripeInstance = platformStripe
        stripeOpts = { stripeAccount: profile.stripe_account_id }
      }
    } catch { /* ignore */ }
  }
  // Fallback to direct key
  if (!stripeInstance && profile?.stripe_secret_key) {
    const k = decrypt(profile.stripe_secret_key)
    stripeInstance = new Stripe(k, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
  }
  if (!stripeInstance) {
    return errorJson('Stripe non configuré. Connectez votre Stripe dans Profil.')
  }

  try {
    const subscriptions: Stripe.Subscription[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const params: Stripe.SubscriptionListParams = { status: 'active', limit: 100, expand: ['data.customer'] }
      if (startingAfter) params.starting_after = startingAfter
      const batch = await stripeInstance.subscriptions.list(params, stripeOpts)
      subscriptions.push(...batch.data)
      hasMore = batch.has_more
      if (batch.data.length) startingAfter = batch.data[batch.data.length - 1].id
    }

    const results = subscriptions.map(sub => {
      const customer = sub.customer
      const item = sub.items.data[0]
      return {
        subscription_id: sub.id,
        customer_id: typeof customer === 'string' ? customer : customer.id,
        customer_email: typeof customer === 'string' ? null : ('email' in customer ? customer.email : null),
        customer_name: typeof customer === 'string' ? null : ('name' in customer ? customer.name : null),
        amount: item?.price?.unit_amount || 0,
        currency: item?.price?.currency || 'eur',
        interval: item?.price?.recurring?.interval || 'month',
        interval_count: item?.price?.recurring?.interval_count || 1,
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        created: new Date(sub.created * 1000).toISOString(),
      }
    })

    return json({ subscriptions: results, count: results.length })
  } catch (err: unknown) {
    console.error('[stripe] importSubscriptions error:', err instanceof Error ? err.message : err)
    return errorJson("Erreur lors de l'import des abonnements", 500)
  }
}

// ── CREATE CHECKOUT ──
async function handleCreateCheckout(body: Record<string, string>, req: NextRequest) {
  const platformStripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { athleteName, athleteEmail, coachId, athleteId } = body
  if (!coachId || !athleteId || !athleteEmail) return errorJson('Missing required fields')

  const { data: plan } = await supabase.from('athlete_payment_plans').select('*').eq('coach_id', coachId).eq('athlete_id', athleteId).single()
  if (!plan) return errorJson('No payment plan found')
  if (plan.is_free) return errorJson('Athlete is on free plan')
  if (plan.payment_status === 'active') return errorJson('Already has active subscription')

  // Server-side amount validation
  if (!plan.amount || plan.amount <= 0) return errorJson('Invalid payment amount')
  if (plan.amount > 10_000_00) return errorJson('Amount exceeds maximum')
  const validCurrencies = ['eur', 'usd', 'gbp', 'chf']
  if (plan.currency && !validCurrencies.includes(plan.currency.toLowerCase())) {
    return errorJson('Invalid currency')
  }

  // Get coach profile to determine which Stripe mode to use
  const { data: coachProfile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_charges_enabled, stripe_onboarding_complete, stripe_secret_key')
    .eq('user_id', coachId).single()

  let stripeInstance: Stripe | null = null
  let stripeOpts: Stripe.RequestOptions = {}

  if (coachProfile?.stripe_account_id) {
    try {
      const account = await platformStripe.accounts.retrieve(coachProfile.stripe_account_id)
      if (account.charges_enabled) {
        stripeInstance = platformStripe
        stripeOpts = { stripeAccount: coachProfile.stripe_account_id }
      }
    } catch { /* ignore */ }
  }

  if (!stripeInstance && coachProfile?.stripe_secret_key) {
    const k = decrypt(coachProfile.stripe_secret_key)
    stripeInstance = new Stripe(k, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
  }

  // Last fallback: use platform Stripe directly (for testing)
  if (!stripeInstance && coachProfile?.stripe_account_id) {
    stripeInstance = platformStripe
  }

  if (!stripeInstance) {
    return errorJson('Stripe non configuré. Connectez votre Stripe dans Profil.')
  }

  // Create/get customer
  const customers = await stripeInstance.customers.list({ email: athleteEmail, limit: 1 }, stripeOpts)
  let customer = customers.data[0]
  if (!customer) {
    customer = await stripeInstance.customers.create(
      { email: athleteEmail, name: athleteName || athleteEmail, metadata: { coach_id: coachId, athlete_id: athleteId } },
      stripeOpts
    )
  }

  const origin = req.headers.get('origin') || 'https://pierreapp.vercel.app'
  // Allow mobile apps to pass custom deep-link URLs for success/cancel redirects
  const successUrl = body.successUrl || `${origin}?payment=success`
  const cancelUrl = body.cancelUrl || `${origin}?payment=cancel`
  const metadata: Record<string, string> = { coach_id: coachId, athlete_id: athleteId, plan_id: plan.id, engagement_months: String(plan.engagement_months || 0) }
  let session: Stripe.Checkout.Session

  if (plan.frequency === 'once') {
    session = await stripeInstance.checkout.sessions.create({
      customer: customer.id, payment_method_types: ['card'], mode: 'payment',
      line_items: [{ price_data: { currency: plan.currency || 'eur', product_data: { name: `Coaching ${athleteName || 'Athlète'}` }, unit_amount: plan.amount }, quantity: 1 }],
      success_url: successUrl, cancel_url: cancelUrl, metadata,
    }, stripeOpts)
  } else {
    const interval = ({ day: 'day', week: 'week', month: 'month' } as Record<string, string>)[plan.frequency] || 'month'
    const params: Record<string, unknown> = {
      customer: customer.id, payment_method_types: ['card'], mode: 'subscription',
      line_items: [{ price_data: { currency: plan.currency || 'eur', product_data: { name: `Coaching ${athleteName || 'Athlète'}` }, unit_amount: plan.amount, recurring: { interval, interval_count: plan.frequency_interval || 1 } }, quantity: 1 }],
      success_url: successUrl, cancel_url: cancelUrl, metadata,
    }
    if (plan.total_payments) (params.metadata as Record<string, string>).total_payments = String(plan.total_payments)

    if (plan.billing_anchor === 'fixed' && plan.billing_day) {
      const now = new Date()
      const anchorDate = new Date(now.getFullYear(), now.getMonth(), plan.billing_day)
      if (anchorDate <= now) anchorDate.setMonth(anchorDate.getMonth() + 1)
      params.subscription_data = { billing_cycle_anchor: Math.floor(anchorDate.getTime() / 1000) }
    }

    session = await stripeInstance.checkout.sessions.create(params as Stripe.Checkout.SessionCreateParams, stripeOpts)
  }

  await supabase.from('athlete_payment_plans').update({ stripe_customer_id: customer.id }).eq('id', plan.id)
  await supabase.from('stripe_audit_log').insert({
    action: 'checkout_created', actor_id: coachId, actor_type: 'coach', target_id: athleteId, amount: plan.amount,
    metadata: { session_id: session.id, mode: plan.frequency === 'once' ? 'payment' : 'subscription' },
  })

  return json({ url: session.url, customer_id: customer.id })
}

// ── CREATE PAYMENT SHEET (for mobile native payment) ──
async function handleCreatePaymentSheet(body: Record<string, string>) {
  const platformStripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { athleteEmail, athleteName, coachId, athleteId } = body
  if (!coachId || !athleteId || !athleteEmail) return errorJson('Missing required fields')

  const { data: plan } = await supabase.from('athlete_payment_plans').select('*').eq('coach_id', coachId).eq('athlete_id', athleteId).single()
  if (!plan) return errorJson('No payment plan found')
  if (plan.is_free) return errorJson('Athlete is on free plan')
  if (plan.payment_status === 'active') return errorJson('Already has active subscription')

  if (!plan.amount || plan.amount <= 0) return errorJson('Invalid payment amount')
  if (plan.amount > 10_000_00) return errorJson('Amount exceeds maximum')

  // Get coach Connect account for destination charges
  const { data: coachProfile } = await supabase.from('coach_profiles')
    .select('stripe_account_id')
    .eq('user_id', coachId).single()

  if (!coachProfile?.stripe_account_id) {
    return errorJson('Coach has no Stripe account connected')
  }

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY
  const metadata: Record<string, string> = { coach_id: coachId, athlete_id: athleteId, plan_id: plan.id }

  // Cancel any previous pending subscription on platform
  if (plan.stripe_subscription_id) {
    try { await platformStripe.subscriptions.cancel(plan.stripe_subscription_id) } catch { /* ignore */ }
    await supabase.from('athlete_payment_plans').update({
      stripe_subscription_id: null, stripe_customer_id: null,
    }).eq('id', plan.id)
  }

  // All objects created on PLATFORM account (not Connect) — destination charges transfer money to coach
  let customer: Stripe.Customer
  try {
    const customers = await platformStripe.customers.list({ email: athleteEmail, limit: 1 })
    const existing = customers.data[0]
    if (existing) {
      customer = existing
    } else {
      customer = await platformStripe.customers.create({
        email: athleteEmail, name: athleteName || athleteEmail, metadata,
      })
    }
  } catch (err: unknown) {
    console.error('[stripe] Customer failed:', err instanceof Error ? err.message : err)
    return errorJson('Customer creation failed: ' + (err instanceof Error ? err.message : 'unknown'), 500)
  }

  // Ephemeral key on platform
  let ephemeralKey: Stripe.EphemeralKey
  try {
    ephemeralKey = await platformStripe.ephemeralKeys.create(
      { customer: customer.id }, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion }
    )
  } catch (err: unknown) {
    console.error('[stripe] Ephemeral key failed:', err instanceof Error ? err.message : err)
    return errorJson('Session creation failed: ' + (err instanceof Error ? err.message : 'unknown'), 500)
  }

  if (plan.frequency === 'once') {
    // One-time payment with destination charge
    try {
      const pi = await platformStripe.paymentIntents.create({
        amount: plan.amount, currency: plan.currency || 'eur',
        customer: customer.id, metadata,
        automatic_payment_methods: { enabled: true },
        transfer_data: { destination: coachProfile.stripe_account_id },
      })
      return json({
        paymentIntent: pi.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id, publishableKey,
      })
    } catch (err: unknown) {
      console.error('[stripe] PaymentIntent failed:', err instanceof Error ? err.message : err)
      return errorJson('Payment creation failed: ' + (err instanceof Error ? err.message : 'unknown'), 500)
    }
  } else {
    // Subscription with destination charges
    try {
      const interval = ({ day: 'day', week: 'week', month: 'month' } as Record<string, string>)[plan.frequency] || 'month'
      const price = await platformStripe.prices.create({
        unit_amount: plan.amount, currency: plan.currency || 'eur',
        recurring: { interval: interval as Stripe.PriceCreateParams.Recurring.Interval, interval_count: plan.frequency_interval || 1 },
        product_data: { name: `Coaching ${athleteName || 'Athlète'}` },
      })

      const subParams: Record<string, unknown> = {
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        transfer_data: { destination: coachProfile.stripe_account_id },
        metadata,
      }

      // Prorata: if billing_day is set, charge prorata now, then start recurring on billing_day
      if (plan.billing_anchor === 'fixed' && plan.billing_day) {
        const now = new Date()
        const anchorDate = new Date(now.getFullYear(), now.getMonth(), plan.billing_day)
        if (anchorDate <= now) anchorDate.setMonth(anchorDate.getMonth() + 1)

        const msPerDay = 86400000
        const daysUntilAnchor = Math.ceil((anchorDate.getTime() - now.getTime()) / msPerDay)
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        const prorataAmount = Math.round(plan.amount * daysUntilAnchor / daysInMonth)

        if (prorataAmount > 0 && daysUntilAnchor < daysInMonth) {
          // Create a one-time PaymentIntent for the prorata amount
          const prorataPI = await platformStripe.paymentIntents.create({
            amount: prorataAmount,
            currency: plan.currency || 'eur',
            customer: customer.id,
            automatic_payment_methods: { enabled: true },
            transfer_data: { destination: coachProfile.stripe_account_id },
            metadata: { ...metadata, type: 'prorata', days: String(daysUntilAnchor) },
          })

          // Create subscription with trial until anchor (no immediate charge)
          const trialSub = await platformStripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: price.id }],
            trial_end: Math.floor(anchorDate.getTime() / 1000),
            transfer_data: { destination: coachProfile.stripe_account_id },
            metadata,
          })

          await supabase.from('athlete_payment_plans').update({
            stripe_subscription_id: trialSub.id,
            stripe_customer_id: customer.id,
          }).eq('id', plan.id)

          return json({
            paymentIntent: prorataPI.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customer: customer.id, publishableKey,
            subscriptionId: trialSub.id,
          })
        }
      }

      // No prorata — standard subscription with immediate first payment
      const subscription = await platformStripe.subscriptions.create(subParams as unknown as Stripe.SubscriptionCreateParams)

      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
      const pi = latestInvoice?.payment_intent as Stripe.PaymentIntent | null
      if (!pi?.client_secret) {
        try { await platformStripe.subscriptions.cancel(subscription.id) } catch { /* ignore */ }
        return errorJson('Payment setup failed', 500)
      }

      await supabase.from('athlete_payment_plans').update({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customer.id,
      }).eq('id', plan.id)

      return json({
        paymentIntent: pi.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id, publishableKey,
        subscriptionId: subscription.id,
      })
    } catch (err: unknown) {
      console.error('[stripe] Subscription failed:', err instanceof Error ? err.message : err)
      return errorJson('Subscription creation failed: ' + (err instanceof Error ? err.message : 'unknown'), 500)
    }
  }
}

// ── CONFIRM PAYMENT ──
async function handleConfirmPayment(body: Record<string, string>) {
  const platformStripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { athleteId, coachId } = body
  if (!athleteId || !coachId) return errorJson('Missing fields')

  const { data: plan } = await supabase.from('athlete_payment_plans')
    .select('id, stripe_subscription_id, frequency, payment_status, payments_completed')
    .eq('athlete_id', athleteId).eq('coach_id', coachId).single()

  if (!plan) return errorJson('No plan found')
  if (plan.payment_status === 'active' || plan.payment_status === 'completed') {
    return json({ status: plan.payment_status })
  }

  // Verify with Stripe that the subscription/payment is actually paid
  if (plan.stripe_subscription_id) {
    try {
      const sub = await platformStripe.subscriptions.retrieve(plan.stripe_subscription_id)
      if (sub.status === 'active' || sub.status === 'trialing') {
        await supabase.from('athlete_payment_plans').update({
          payment_status: 'active',
          payments_completed: (plan.payments_completed || 0) + 1,
        }).eq('id', plan.id)
        return json({ status: 'active' })
      }
    } catch (err: unknown) {
      console.error('[stripe] confirm-payment sub check failed:', err instanceof Error ? err.message : err)
    }
  }

  return json({ status: plan.payment_status })
}

// ── CANCEL SUBSCRIPTION ──
async function handleCancel(body: Record<string, string>) {
  const platformStripe = getPlatformStripe()
  const supabase = getSupabaseAdmin()
  const { subscriptionId, coachId, athleteId } = body
  if (!subscriptionId) return errorJson('Missing subscriptionId')

  // Try Connect first, then direct key, then platform
  let sub: Stripe.Subscription | null = null
  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_secret_key').eq('user_id', coachId).maybeSingle()

  if (profile?.stripe_account_id) {
    try {
      sub = await platformStripe.subscriptions.cancel(subscriptionId, { stripeAccount: profile.stripe_account_id })
    } catch { /* ignore */ }
  }
  if (!sub && profile?.stripe_secret_key) {
    try {
      const k = decrypt(profile.stripe_secret_key)
      sub = await new Stripe(k, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion }).subscriptions.cancel(subscriptionId)
    } catch { /* ignore */ }
  }
  if (!sub) {
    sub = await platformStripe.subscriptions.cancel(subscriptionId)
  }

  await supabase.from('stripe_customers').update({ subscription_status: 'canceled' }).eq('stripe_subscription_id', subscriptionId)
  if (athleteId && coachId) {
    await supabase.from('athlete_payment_plans').update({ payment_status: 'canceled' }).eq('athlete_id', athleteId).eq('coach_id', coachId)
    await supabase.from('athlete_activity_log').insert({ coach_id: coachId, athlete_id: athleteId, event: 'removed' })
  }

  return json({ status: sub.status })
}

// ── CANCELLATION REQUEST (from athlete) ──
async function handleCancellationRequest(body: Record<string, string>) {
  const supabase = getSupabaseAdmin()
  const { athleteId, coachId } = body
  if (!athleteId || !coachId) return errorJson('Missing athleteId or coachId')

  const { data: plan } = await supabase.from('athlete_payment_plans').select('*').eq('athlete_id', athleteId).eq('coach_id', coachId).single()
  if (!plan) return errorJson('No payment plan found', 404)

  const now = new Date()
  const isEngaged = plan.engagement_end && new Date(plan.engagement_end) > now

  if (isEngaged) {
    await supabase.from('cancellation_requests').insert({
      athlete_id: athleteId, coach_id: coachId, payment_plan_id: plan.id,
      status: 'blocked_engaged', was_engaged: true, engagement_end_date: plan.engagement_end,
    })
    try {
      await supabase.from('notifications').insert({
        user_id: coachId, type: 'cancellation', title: 'Tentative de résiliation',
        body: `Un athlète a tenté de résilier (engagé jusqu'au ${new Date(plan.engagement_end).toLocaleDateString('fr-FR')})`,
        metadata: { athlete_id: athleteId, blocked: true },
      })
    } catch { /* ignore */ }
    return json({ blocked: true, engagement_end: plan.engagement_end, message: `Engagé jusqu'au ${new Date(plan.engagement_end).toLocaleDateString('fr-FR')}` })
  }

  await supabase.from('cancellation_requests').insert({
    athlete_id: athleteId, coach_id: coachId, payment_plan_id: plan.id, status: 'pending',
  })
  try {
    await supabase.from('notifications').insert({
      user_id: coachId, type: 'cancellation', title: 'Demande de résiliation',
      body: 'Un athlète demande la résiliation', metadata: { athlete_id: athleteId, status: 'pending' },
    })
  } catch { /* ignore */ }

  return json({ pending: true, message: 'Demande envoyée à votre coach' })
}

// ── CANCELLATION RESPOND (from coach) ──
async function handleCancellationRespond(body: Record<string, string>) {
  const supabase = getSupabaseAdmin()
  const { requestId, decision, note, coachId } = body
  if (!requestId || !['accepted', 'refused'].includes(decision)) return errorJson('Invalid params')

  const { data: request } = await supabase.from('cancellation_requests').select('*, athlete_payment_plans(*)').eq('id', requestId).single()
  if (!request || request.status !== 'pending') return errorJson('Request not found or already processed')

  // Verify the coach owns this cancellation request
  if (request.coach_id !== coachId) return errorJson('Forbidden', 403)

  await supabase.from('cancellation_requests').update({ status: decision, coach_response_at: new Date().toISOString(), coach_note: note || null }).eq('id', requestId)

  if (decision === 'accepted') {
    const plan = request.athlete_payment_plans
    if (plan?.stripe_subscription_id) {
      const coachStripeInstance = await getCoachStripe(supabase, request.coach_id)
      if (coachStripeInstance) {
        await coachStripeInstance.subscriptions.update(plan.stripe_subscription_id, { cancel_at_period_end: true })
      }
    }
    await supabase.from('athlete_payment_plans').update({ payment_status: 'canceled' }).eq('id', request.payment_plan_id)
    await supabase.from('athlete_activity_log').insert({ coach_id: request.coach_id, athlete_id: request.athlete_id, event: 'removed' })
  }

  const { data: athlete } = await supabase.from('athletes').select('user_id').eq('id', request.athlete_id).single()
  if (athlete?.user_id) {
    const msg = decision === 'accepted'
      ? { title: 'Résiliation acceptée', body: 'Votre abonnement prendra fin à la fin de la période.' }
      : { title: 'Résiliation refusée', body: note || 'Votre demande a été refusée.' }
    try {
      await supabase.from('notifications').insert({ user_id: athlete.user_id, type: 'cancellation', ...msg, metadata: { request_id: requestId, decision } })
    } catch { /* ignore */ }
  }

  return json({ success: true, decision })
}
