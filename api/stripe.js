/**
 * Unified Stripe API router
 *
 * Model: Each coach uses THEIR OWN Stripe account (their secret key).
 * Pierre (platform) has his own Stripe for SaaS billing only.
 *
 * POST /api/stripe?action=<action>
 * Actions: save-key, verify-key, import-subscriptions,
 *          create-checkout, cancel, coach-setup,
 *          cancellation-request, cancellation-respond
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, verifyCoach, handleAuthError } = require('./_auth');
const { cors } = require('./_cors');
const { encrypt, decrypt } = require('./_crypto');

// Platform Stripe instance (Pierre's account — for SaaS billing only)
const platformStripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Rate limiter
const rateLimitStore = new Map();
function checkRateLimit(key, max = 10, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

// Get a Stripe instance using the coach's own key
async function getCoachStripe(supabase, coachId) {
  const { data } = await supabase
    .from('coach_profiles')
    .select('stripe_secret_key')
    .eq('user_id', coachId)
    .single();
  if (!data?.stripe_secret_key) return null;
  if (!process.env.STRIPE_ENCRYPTION_KEY) {
    console.warn('[stripe] STRIPE_ENCRYPTION_KEY missing — keys may be stored in plaintext');
  }
  const key = decrypt(data.stripe_secret_key);
  return Stripe(key);
}

// Actions called by athletes (not coaches)
const ATHLETE_ACTIONS = ['cancellation-request', 'create-payment-sheet'];

module.exports = async function handler(req, res) {
  // CORS
  if (cors(req, res)) return;

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action || req.body?.action;
  if (!action) return res.status(400).json({ error: 'Missing action parameter' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (checkRateLimit(`${ip}:${action}`, 15, 60000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    // ── AUTH: verify JWT and ownership ──
    if (ATHLETE_ACTIONS.includes(action)) {
      // Athlete actions: verify the caller is authenticated
      const { user } = await verifyAuth(req);
      // Verify the athlete belongs to this user
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', req.body?.athleteId)
        .maybeSingle();
      if (!athlete) return res.status(403).json({ error: 'Forbidden: not your athlete profile' });
    } else {
      // Coach actions with coachId: verify JWT + coachId ownership
      await verifyCoach(req, 'coachId');
    }

    switch (action) {
      case 'connect-start': return await connectStart(req, res, supabase);
      case 'connect-complete': return await connectComplete(req, res, supabase);
      case 'connect-status': return await connectCheckStatus(req, res, supabase);
      case 'connect-dashboard': return await connectDashboard(req, res, supabase);
      case 'save-key': return await saveStripeKey(req, res, supabase);
      case 'verify-key': return await verifyStripeKey(req, res, supabase);
      case 'import-subscriptions': return await importSubscriptions(req, res, supabase);
      case 'create-checkout': return await createCheckout(req, res, supabase);
      case 'create-payment-sheet': return await createPaymentSheet(req, res, supabase);
      case 'cancel': return await cancelSubscription(req, res, supabase);
      case 'coach-setup': return await coachSetup(req, res, supabase);
      case 'cancellation-request': return await cancellationRequest(req, res, supabase);
      case 'cancellation-respond': return await cancellationRespond(req, res, supabase);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    // Auth errors have status, other errors are 500
    if (err.status) return handleAuthError(res, err);
    console.error('[stripe]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── CONNECT START ──
// Creates a Connect Express account for the coach and returns the onboarding URL
async function connectStart(req, res, supabase) {
  const { coachId, email } = req.body;
  if (!coachId || !email) return res.status(400).json({ error: 'Missing coachId or email' });

  // Check if coach already has a Connect account
  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id').eq('user_id', coachId).maybeSingle();

  let accountId = profile?.stripe_account_id;

  if (!accountId) {
    // Create a new Express account
    const account = await platformStripe.accounts.create({
      type: 'express',
      country: 'FR',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: { coach_id: coachId },
    });
    accountId = account.id;

    await supabase.from('coach_profiles').upsert({
      user_id: coachId,
      stripe_account_id: accountId,
      email,
    }, { onConflict: 'user_id' });
  }

  // Create onboarding link
  const origin = req.headers.origin || 'https://pierreapp.vercel.app';
  const accountLink = await platformStripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}?connect=refresh#profile`,
    return_url: `${origin}?connect=complete#profile`,
    type: 'account_onboarding',
  });

  await supabase.from('stripe_audit_log').insert({
    action: 'connect_onboarding_started', actor_id: coachId, actor_type: 'coach',
    metadata: { stripe_account_id: accountId },
  });

  return res.status(200).json({ url: accountLink.url, account_id: accountId });
}

// ── CONNECT COMPLETE ──
// Called when coach returns from Stripe onboarding — check status
async function connectComplete(req, res, supabase) {
  const coachId = req.query.coachId || req.body?.coachId;
  if (!coachId) return res.status(400).json({ error: 'Missing coachId' });

  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id').eq('user_id', coachId).maybeSingle();

  if (!profile?.stripe_account_id) return res.status(200).json({ connected: false });

  const account = await platformStripe.accounts.retrieve(profile.stripe_account_id);

  // Consider connected if details_submitted (charges_enabled may lag in test mode)
  const isConnected = account.details_submitted || account.charges_enabled;

  await supabase.from('coach_profiles').update({
    stripe_onboarding_complete: account.details_submitted,
    stripe_charges_enabled: isConnected,
  }).eq('user_id', coachId);

  return res.status(200).json({
    connected: isConnected,
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    account_id: profile.stripe_account_id,
  });
}

// ── CONNECT STATUS ──
async function connectCheckStatus(req, res, supabase) {
  const coachId = req.query.coachId || req.body?.coachId;
  if (!coachId) return res.status(400).json({ error: 'Missing coachId' });

  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled')
    .eq('user_id', coachId).maybeSingle();

  if (!profile?.stripe_account_id) return res.status(200).json({ connected: false });

  return res.status(200).json({
    connected: profile.stripe_onboarding_complete || profile.stripe_charges_enabled || false,
    account_id: profile.stripe_account_id,
  });
}

// ── CONNECT DASHBOARD ──
// Generate a login link so the coach can access their Express dashboard
async function connectDashboard(req, res, supabase) {
  const { coachId } = req.body;
  if (!coachId) return res.status(400).json({ error: 'Missing coachId' });

  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id').eq('user_id', coachId).maybeSingle();

  if (!profile?.stripe_account_id) return res.status(400).json({ error: 'Pas de compte Stripe connecté' });

  const loginLink = await platformStripe.accounts.createLoginLink(profile.stripe_account_id);
  return res.status(200).json({ url: loginLink.url });
}

// ── SAVE STRIPE KEY ──
// Coach saves their own Stripe secret key
async function saveStripeKey(req, res, supabase) {
  const { coachId, stripeKey } = req.body;
  if (!coachId || !stripeKey) return res.status(400).json({ error: 'Missing coachId or stripeKey' });

  // Validate the key by making a test call
  try {
    const testStripe = Stripe(stripeKey);
    const account = await testStripe.accounts.retrieve();

    await supabase.from('coach_profiles').upsert({
      user_id: coachId,
      stripe_secret_key: process.env.STRIPE_ENCRYPTION_KEY ? encrypt(stripeKey) : stripeKey,
      stripe_account_id: account.id,
      stripe_onboarding_complete: true,
      stripe_charges_enabled: true,
    }, { onConflict: 'user_id' });

    await supabase.from('stripe_audit_log').insert({
      action: 'stripe_key_saved', actor_id: coachId, actor_type: 'coach',
      metadata: { account_id: account.id, account_name: account.business_profile?.name || account.email },
    });

    return res.status(200).json({
      success: true,
      account_id: account.id,
      account_name: account.business_profile?.name || account.settings?.dashboard?.display_name || account.email,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Clé Stripe invalide. Vérifiez votre clé secrète.' });
  }
}

// ── VERIFY STRIPE KEY ──
// Check if coach's key is still valid
async function verifyStripeKey(req, res, supabase) {
  const coachId = req.query.coachId || req.body?.coachId;
  if (!coachId) return res.status(400).json({ error: 'Missing coachId' });

  const coachStripe = await getCoachStripe(supabase, coachId);
  if (!coachStripe) return res.status(200).json({ connected: false });

  try {
    const account = await coachStripe.accounts.retrieve();
    return res.status(200).json({
      connected: true,
      account_id: account.id,
      account_name: account.business_profile?.name || account.settings?.dashboard?.display_name || account.email,
    });
  } catch {
    return res.status(200).json({ connected: false, error: 'Key invalid' });
  }
}

// ── IMPORT SUBSCRIPTIONS ──
// Import existing subscriptions from coach's Stripe
async function importSubscriptions(req, res, supabase) {
  const { coachId } = req.body;
  if (!coachId) return res.status(400).json({ error: 'Missing coachId' });

  // Get coach profile to determine Stripe mode
  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_charges_enabled, stripe_secret_key')
    .eq('user_id', coachId).single();

  let stripeInstance;
  let stripeOpts = {};

  // Try Connect first (verify charges_enabled live)
  if (profile?.stripe_account_id) {
    try {
      const account = await platformStripe.accounts.retrieve(profile.stripe_account_id);
      if (account.charges_enabled) {
        stripeInstance = platformStripe;
        stripeOpts = { stripeAccount: profile.stripe_account_id };
      }
    } catch {}
  }
  // Fallback to direct key
  if (!stripeInstance && profile?.stripe_secret_key) {
    const k = decrypt(profile.stripe_secret_key);
    stripeInstance = Stripe(k);
  }
  if (!stripeInstance) {
    return res.status(400).json({ error: 'Stripe non configuré. Connectez votre Stripe dans Profil.' });
  }

  try {
    // List all active subscriptions
    const subscriptions = [];
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
      const params = { status: 'active', limit: 100, expand: ['data.customer'] };
      if (startingAfter) params.starting_after = startingAfter;
      const batch = await stripeInstance.subscriptions.list(params, stripeOpts);
      subscriptions.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length) startingAfter = batch.data[batch.data.length - 1].id;
    }

    // Format for frontend
    const results = subscriptions.map(sub => {
      const customer = sub.customer;
      const item = sub.items.data[0];
      return {
        subscription_id: sub.id,
        customer_id: typeof customer === 'string' ? customer : customer.id,
        customer_email: typeof customer === 'string' ? null : customer.email,
        customer_name: typeof customer === 'string' ? null : customer.name,
        amount: item?.price?.unit_amount || 0,
        currency: item?.price?.currency || 'eur',
        interval: item?.price?.recurring?.interval || 'month',
        interval_count: item?.price?.recurring?.interval_count || 1,
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        created: new Date(sub.created * 1000).toISOString(),
      };
    });

    return res.status(200).json({ subscriptions: results, count: results.length });
  } catch (err) {
    console.error('[stripe] importSubscriptions error:', err.message);
    return res.status(500).json({ error: 'Erreur lors de l\'import des abonnements' });
  }
}

// ── CREATE CHECKOUT ──
// Creates a checkout on the COACH'S Stripe account
async function createCheckout(req, res, supabase) {
  const { athleteName, athleteEmail, coachId, athleteId } = req.body;
  if (!coachId || !athleteId || !athleteEmail) return res.status(400).json({ error: 'Missing required fields' });

  const { data: plan } = await supabase.from('athlete_payment_plans').select('*').eq('coach_id', coachId).eq('athlete_id', athleteId).single();
  if (!plan) return res.status(400).json({ error: 'No payment plan found' });
  if (plan.is_free) return res.status(400).json({ error: 'Athlete is on free plan' });
  if (plan.payment_status === 'active') return res.status(400).json({ error: 'Already has active subscription' });

  // Server-side amount validation
  if (!plan.amount || plan.amount <= 0) return res.status(400).json({ error: 'Invalid payment amount' });
  if (plan.amount > 10_000_00) return res.status(400).json({ error: 'Amount exceeds maximum' });
  const validCurrencies = ['eur', 'usd', 'gbp', 'chf'];
  if (plan.currency && !validCurrencies.includes(plan.currency.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid currency' });
  }

  // Get coach profile to determine which Stripe mode to use
  const { data: coachProfile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_charges_enabled, stripe_onboarding_complete, stripe_secret_key')
    .eq('user_id', coachId).single();

  // Determine which Stripe instance + options to use
  let stripeInstance;
  let stripeOpts = {};

  if (coachProfile?.stripe_account_id) {
    // Verify the Connect account can actually charge
    try {
      const account = await platformStripe.accounts.retrieve(coachProfile.stripe_account_id);
      if (account.charges_enabled) {
        stripeInstance = platformStripe;
        stripeOpts = { stripeAccount: coachProfile.stripe_account_id };
      }
    } catch {}
  }

  // Fallback: use coach's own key if Connect not ready
  if (!stripeInstance && coachProfile?.stripe_secret_key) {
    const k = decrypt(coachProfile.stripe_secret_key);
    stripeInstance = Stripe(k);
  }

  // Last fallback: use platform Stripe directly (for testing)
  if (!stripeInstance && coachProfile?.stripe_account_id) {
    stripeInstance = platformStripe;
  }

  if (!stripeInstance) {
    return res.status(400).json({ error: 'Stripe non configuré. Connectez votre Stripe dans Profil.' });
  }

  // Create/get customer
  const customers = await stripeInstance.customers.list({ email: athleteEmail, limit: 1 }, stripeOpts);
  let customer = customers.data[0];
  if (!customer) {
    customer = await stripeInstance.customers.create(
      { email: athleteEmail, name: athleteName || athleteEmail, metadata: { coach_id: coachId, athlete_id: athleteId } },
      stripeOpts
    );
  }

  const origin = req.headers.origin || 'https://pierreapp.vercel.app';
  const metadata = { coach_id: coachId, athlete_id: athleteId, plan_id: plan.id, engagement_months: String(plan.engagement_months || 0) };
  let session;

  if (plan.frequency === 'once') {
    session = await stripeInstance.checkout.sessions.create({
      customer: customer.id, payment_method_types: ['card'], mode: 'payment',
      line_items: [{ price_data: { currency: plan.currency || 'eur', product_data: { name: `Coaching ${athleteName || 'Athlète'}` }, unit_amount: plan.amount }, quantity: 1 }],
      success_url: `${origin}?payment=success`, cancel_url: `${origin}?payment=cancel`, metadata,
    }, stripeOpts);
  } else {
    const interval = { day: 'day', week: 'week', month: 'month' }[plan.frequency] || 'month';
    const params = {
      customer: customer.id, payment_method_types: ['card'], mode: 'subscription',
      line_items: [{ price_data: { currency: plan.currency || 'eur', product_data: { name: `Coaching ${athleteName || 'Athlète'}` }, unit_amount: plan.amount, recurring: { interval, interval_count: plan.frequency_interval || 1 } }, quantity: 1 }],
      success_url: `${origin}?payment=success`, cancel_url: `${origin}?payment=cancel`, metadata,
    };
    if (plan.total_payments) params.metadata.total_payments = String(plan.total_payments);

    if (plan.billing_anchor === 'fixed' && plan.billing_day) {
      const now = new Date();
      let anchorDate = new Date(now.getFullYear(), now.getMonth(), plan.billing_day);
      if (anchorDate <= now) anchorDate.setMonth(anchorDate.getMonth() + 1);
      params.subscription_data = { billing_cycle_anchor: Math.floor(anchorDate.getTime() / 1000) };
    }

    session = await stripeInstance.checkout.sessions.create(params, stripeOpts);
  }

  await supabase.from('athlete_payment_plans').update({ stripe_customer_id: customer.id }).eq('id', plan.id);
  await supabase.from('stripe_audit_log').insert({
    action: 'checkout_created', actor_id: coachId, actor_type: 'coach', target_id: athleteId, amount: plan.amount,
    metadata: { session_id: session.id, mode: plan.frequency === 'once' ? 'payment' : 'subscription' },
  });

  return res.status(200).json({ url: session.url, customer_id: customer.id });
}

// ── CANCEL SUBSCRIPTION ──
// ── CREATE PAYMENT SHEET (for mobile native payment) ──
async function createPaymentSheet(req, res, supabase) {
  const { athleteEmail, athleteName, coachId, athleteId } = req.body;
  if (!coachId || !athleteId || !athleteEmail) return res.status(400).json({ error: 'Missing required fields' });

  const { data: plan } = await supabase.from('athlete_payment_plans').select('*').eq('coach_id', coachId).eq('athlete_id', athleteId).single();
  if (!plan) return res.status(400).json({ error: 'No payment plan found' });
  if (plan.is_free) return res.status(400).json({ error: 'Athlete is on free plan' });
  if (plan.payment_status === 'active') return res.status(400).json({ error: 'Already has active subscription' });

  // Server-side amount validation
  if (!plan.amount || plan.amount <= 0) return res.status(400).json({ error: 'Invalid payment amount' });
  if (plan.amount > 10_000_00) return res.status(400).json({ error: 'Amount exceeds maximum' });
  const validCurrencies = ['eur', 'usd', 'gbp', 'chf'];
  if (plan.currency && !validCurrencies.includes(plan.currency.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid currency' });
  }

  // Determine Stripe instance (same logic as createCheckout)
  const { data: coachProfile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_secret_key')
    .eq('user_id', coachId).single();

  let stripeInstance = platformStripe;
  let connectAccountId = null;
  let publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (coachProfile?.stripe_account_id) {
    try {
      const account = await platformStripe.accounts.retrieve(coachProfile.stripe_account_id);
      if (account.charges_enabled) {
        connectAccountId = coachProfile.stripe_account_id;
      }
    } catch {}
  }
  if (!connectAccountId && coachProfile?.stripe_secret_key) {
    const k = decrypt(coachProfile.stripe_secret_key);
    stripeInstance = Stripe(k);
  }

  // Helper to pass stripeAccount only when using Connect
  const opts = connectAccountId ? { stripeAccount: connectAccountId } : undefined;

  // Create or get customer
  const customers = connectAccountId
    ? await stripeInstance.customers.list({ email: athleteEmail, limit: 1 }, opts)
    : await stripeInstance.customers.list({ email: athleteEmail, limit: 1 });
  let customer = customers.data[0];
  if (!customer) {
    customer = connectAccountId
      ? await stripeInstance.customers.create({ email: athleteEmail, name: athleteName || athleteEmail, metadata: { coach_id: coachId, athlete_id: athleteId } }, opts)
      : await stripeInstance.customers.create({ email: athleteEmail, name: athleteName || athleteEmail, metadata: { coach_id: coachId, athlete_id: athleteId } });
  }

  // Create ephemeral key
  const ephemeralKey = connectAccountId
    ? await stripeInstance.ephemeralKeys.create({ customer: customer.id }, { apiVersion: '2023-10-16', stripeAccount: connectAccountId })
    : await stripeInstance.ephemeralKeys.create({ customer: customer.id }, { apiVersion: '2023-10-16' });

  const metadata = { coach_id: coachId, athlete_id: athleteId, plan_id: plan.id };

  if (plan.frequency === 'once') {
    const piParams = { amount: plan.amount, currency: plan.currency || 'eur', customer: customer.id, metadata, automatic_payment_methods: { enabled: true } };
    const paymentIntent = connectAccountId
      ? await stripeInstance.paymentIntents.create(piParams, opts)
      : await stripeInstance.paymentIntents.create(piParams);

    return res.status(200).json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      publishableKey,
    });
  } else {
    // Subscription → create subscription with payment_behavior
    const interval = { day: 'day', week: 'week', month: 'month' }[plan.frequency] || 'month';

    // Create a price
    const priceParams = {
      unit_amount: plan.amount,
      currency: plan.currency || 'eur',
      recurring: { interval, interval_count: plan.frequency_interval || 1 },
      product_data: { name: `Coaching ${athleteName || 'Athlète'}` },
    };
    const price = connectAccountId
      ? await stripeInstance.prices.create(priceParams, opts)
      : await stripeInstance.prices.create(priceParams);

    const subParams = {
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata,
    };

    if (plan.billing_anchor === 'fixed' && plan.billing_day) {
      const now = new Date();
      let anchorDate = new Date(now.getFullYear(), now.getMonth(), plan.billing_day);
      if (anchorDate <= now) anchorDate.setMonth(anchorDate.getMonth() + 1);
      subParams.billing_cycle_anchor = Math.floor(anchorDate.getTime() / 1000);
    }

    const subscription = connectAccountId
      ? await stripeInstance.subscriptions.create(subParams, opts)
      : await stripeInstance.subscriptions.create(subParams);

    // Update plan with subscription ID
    await supabase.from('athlete_payment_plans').update({
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
    }).eq('id', plan.id);

    return res.status(200).json({
      paymentIntent: subscription.latest_invoice.payment_intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      publishableKey,
      subscriptionId: subscription.id,
    });
  }
}

async function cancelSubscription(req, res, supabase) {
  const { subscriptionId, coachId, athleteId } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: 'Missing subscriptionId' });

  // Try Connect first, then direct key, then platform
  let sub;
  const { data: profile } = await supabase.from('coach_profiles')
    .select('stripe_account_id, stripe_secret_key').eq('user_id', coachId).maybeSingle();

  if (profile?.stripe_account_id) {
    try {
      sub = await platformStripe.subscriptions.cancel(subscriptionId, { stripeAccount: profile.stripe_account_id });
    } catch {}
  }
  if (!sub && profile?.stripe_secret_key) {
    try {
      const k = decrypt(profile.stripe_secret_key);
      sub = await Stripe(k).subscriptions.cancel(subscriptionId);
    } catch {}
  }
  if (!sub) {
    sub = await platformStripe.subscriptions.cancel(subscriptionId);
  }

  await supabase.from('stripe_customers').update({ subscription_status: 'canceled' }).eq('stripe_subscription_id', subscriptionId);
  if (athleteId && coachId) {
    await supabase.from('athlete_payment_plans').update({ payment_status: 'canceled' }).eq('athlete_id', athleteId).eq('coach_id', coachId);
    await supabase.from('athlete_activity_log').insert({ coach_id: coachId, athlete_id: athleteId, event: 'removed' });
  }

  return res.status(200).json({ status: sub.status });
}

// ── COACH SETUP (save payment method for SaaS — on PIERRE's Stripe) ──
async function coachSetup(req, res, supabase) {
  const { coachId, email } = req.body;
  if (!coachId || !email) return res.status(400).json({ error: 'Missing coachId or email' });

  const { data: profile } = await supabase.from('coach_profiles').select('stripe_customer_id').eq('user_id', coachId).single();
  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await platformStripe.customers.create({ email, metadata: { coach_id: coachId, type: 'platform_coach' } });
    customerId = customer.id;
    await supabase.from('coach_profiles').update({ stripe_customer_id: customerId }).eq('user_id', coachId);
  }

  const origin = req.headers.origin || 'https://pierreapp.vercel.app';
  const session = await platformStripe.checkout.sessions.create({
    customer: customerId, mode: 'setup', payment_method_types: ['card'],
    success_url: `${origin}?setup=success#profile`, cancel_url: `${origin}?setup=cancel#profile`,
    metadata: { coach_id: coachId },
  });

  return res.status(200).json({ url: session.url, customer_id: customerId });
}

// ── CANCELLATION REQUEST (from athlete) ──
async function cancellationRequest(req, res, supabase) {
  const { athleteId, coachId } = req.body;
  if (!athleteId || !coachId) return res.status(400).json({ error: 'Missing athleteId or coachId' });

  const { data: plan } = await supabase.from('athlete_payment_plans').select('*').eq('athlete_id', athleteId).eq('coach_id', coachId).single();
  if (!plan) return res.status(404).json({ error: 'No payment plan found' });

  const now = new Date();
  const isEngaged = plan.engagement_end && new Date(plan.engagement_end) > now;

  if (isEngaged) {
    await supabase.from('cancellation_requests').insert({
      athlete_id: athleteId, coach_id: coachId, payment_plan_id: plan.id,
      status: 'blocked_engaged', was_engaged: true, engagement_end_date: plan.engagement_end,
    });
    try {
      await supabase.from('notifications').insert({
        user_id: coachId, type: 'cancellation', title: 'Tentative de résiliation',
        body: `Un athlète a tenté de résilier (engagé jusqu'au ${new Date(plan.engagement_end).toLocaleDateString('fr-FR')})`,
        metadata: { athlete_id: athleteId, blocked: true },
      });
    } catch {}
    return res.status(200).json({ blocked: true, engagement_end: plan.engagement_end, message: `Engagé jusqu'au ${new Date(plan.engagement_end).toLocaleDateString('fr-FR')}` });
  }

  await supabase.from('cancellation_requests').insert({
    athlete_id: athleteId, coach_id: coachId, payment_plan_id: plan.id, status: 'pending',
  });
  try {
    await supabase.from('notifications').insert({
      user_id: coachId, type: 'cancellation', title: 'Demande de résiliation',
      body: 'Un athlète demande la résiliation', metadata: { athlete_id: athleteId, status: 'pending' },
    });
  } catch {}

  return res.status(200).json({ pending: true, message: 'Demande envoyée à votre coach' });
}

// ── CANCELLATION RESPOND (from coach) ──
async function cancellationRespond(req, res, supabase) {
  const { requestId, decision, note } = req.body;
  if (!requestId || !['accepted', 'refused'].includes(decision)) return res.status(400).json({ error: 'Invalid params' });

  const { data: request } = await supabase.from('cancellation_requests').select('*, athlete_payment_plans(*)').eq('id', requestId).single();
  if (!request || request.status !== 'pending') return res.status(400).json({ error: 'Request not found or already processed' });

  // Verify the coach owns this cancellation request
  if (request.coach_id !== req.body.coachId) return res.status(403).json({ error: 'Forbidden' });

  await supabase.from('cancellation_requests').update({ status: decision, coach_response_at: new Date().toISOString(), coach_note: note || null }).eq('id', requestId);

  if (decision === 'accepted') {
    const plan = request.athlete_payment_plans;
    if (plan?.stripe_subscription_id) {
      const coachStripe = await getCoachStripe(supabase, request.coach_id);
      if (coachStripe) {
        await coachStripe.subscriptions.update(plan.stripe_subscription_id, { cancel_at_period_end: true });
      }
    }
    await supabase.from('athlete_payment_plans').update({ payment_status: 'canceled' }).eq('id', request.payment_plan_id);
    await supabase.from('athlete_activity_log').insert({ coach_id: request.coach_id, athlete_id: request.athlete_id, event: 'removed' });
  }

  const { data: athlete } = await supabase.from('athletes').select('user_id').eq('id', request.athlete_id).single();
  if (athlete?.user_id) {
    const msg = decision === 'accepted'
      ? { title: 'Résiliation acceptée', body: 'Votre abonnement prendra fin à la fin de la période.' }
      : { title: 'Résiliation refusée', body: note || 'Votre demande a été refusée.' };
    try { await supabase.from('notifications').insert({ user_id: athlete.user_id, type: 'cancellation', ...msg, metadata: { request_id: requestId, decision } }); } catch {}
  }

  return res.status(200).json({ success: true, decision });
}
