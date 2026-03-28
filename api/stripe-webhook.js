const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Platform Stripe (Pierre's account — for SaaS events)
const platformStripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports.config = { api: { bodyParser: false } };

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  // Try to verify with platform webhook secret first
  let event;
  let isCoachWebhook = false;

  try {
    event = platformStripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    // Not a platform event — try verifying with coach's own webhook secret
    try {
      const body = JSON.parse(rawBody.toString());
      const accountId = body.account; // Stripe Connect sets this on connected account events
      if (accountId) {
        // Lookup coach by Stripe account ID and verify with their webhook secret
        const { data: coach } = await supabase
          .from('coach_profiles')
          .select('user_id, stripe_webhook_secret')
          .eq('stripe_account_id', accountId)
          .maybeSingle();
        if (coach?.stripe_webhook_secret) {
          // Verify signature with coach's webhook secret
          event = platformStripe.webhooks.constructEvent(rawBody, sig, coach.stripe_webhook_secret);
          isCoachWebhook = true;
        } else {
          // Coach found but no webhook secret — reject for security
          await supabase.from('stripe_audit_log').insert({
            action: 'webhook_no_secret', actor_type: 'system',
            metadata: { account_id: accountId, ip: req.headers['x-forwarded-for'] || '' },
          }).catch(() => {});
          return res.status(400).json({ error: 'Webhook secret not configured for this account' });
        }
      } else {
        // No account ID and platform signature failed — reject
        await supabase.from('stripe_audit_log').insert({
          action: 'webhook_signature_failed', actor_type: 'system',
          metadata: { ip: req.headers['x-forwarded-for'] || '' },
        }).catch(() => {});
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    } catch (verifyErr) {
      await supabase.from('stripe_audit_log').insert({
        action: 'webhook_signature_failed', actor_type: 'system',
        metadata: { ip: req.headers['x-forwarded-for'] || '', error: verifyErr.message },
      }).catch(() => {});
      return res.status(400).json({ error: 'Invalid webhook' });
    }
  }

  // Replay protection: check if this event was already processed
  const { data: existingEvent } = await supabase
    .from('stripe_audit_log')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();
  if (existingEvent) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Audit log
  await supabase.from('stripe_audit_log').insert({
    action: 'webhook_received', actor_type: 'system',
    stripe_event_id: event.id,
    metadata: { type: event.type, is_coach: isCoachWebhook },
  }).catch(() => {});

  try {
    if (isCoachWebhook) {
      await handleCoachEvent(event, supabase);
    } else {
      await handlePlatformEvent(event, supabase);
    }
  } catch (err) {
    await supabase.from('stripe_audit_log').insert({
      action: 'webhook_processing_error', actor_type: 'system',
      stripe_event_id: event.id,
      metadata: { error: err.message, type: event.type },
    }).catch(() => {});
  }

  res.status(200).json({ received: true });
};

// ── Coach events (athlete payments on coach's Stripe) ──
async function handleCoachEvent(event, supabase) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const coachId = session.metadata?.coach_id;
      const athleteId = session.metadata?.athlete_id;
      const planId = session.metadata?.plan_id;

      if (session.mode === 'subscription' && session.subscription) {
        // Find the coach's stripe key to retrieve subscription details
        const coachStripe = await getCoachStripeInstance(supabase, coachId);

        let sub = null;
        if (coachStripe) {
          sub = await coachStripe.subscriptions.retrieve(session.subscription).catch(() => null);
        }

        await supabase.from('stripe_customers').upsert({
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          coach_id: coachId,
          athlete_id: athleteId,
          subscription_status: 'active',
          monthly_amount: sub?.items?.data[0]?.price?.unit_amount || 0,
          current_period_start: sub ? new Date(sub.current_period_start * 1000).toISOString() : null,
          current_period_end: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
        }, { onConflict: 'stripe_customer_id' });

        if (planId) {
          await supabase.from('athlete_payment_plans').update({
            payment_status: 'active',
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
          }).eq('id', planId);
        }
      } else if (session.mode === 'payment') {
        if (planId) {
          await supabase.from('athlete_payment_plans').update({
            payment_status: 'completed', payments_completed: 1,
            stripe_customer_id: session.customer,
          }).eq('id', planId);
        }
        await supabase.from('payment_history').insert({
          stripe_customer_id: session.customer, coach_id: coachId, athlete_id: athleteId,
          amount: session.amount_total, currency: session.currency, status: 'succeeded',
          stripe_payment_intent_id: session.payment_intent,
        });
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const { data: sc } = await supabase.from('stripe_customers')
        .select('coach_id, athlete_id').eq('stripe_customer_id', invoice.customer).maybeSingle();

      // Build description from invoice line items (captures proration info)
      const lines = invoice.lines?.data || [];
      const hasProration = lines.some(l => l.proration);
      let description = null;
      if (hasProration) {
        description = 'Montant proraté (ajustement en cours de cycle)';
      } else if (lines.length === 1 && lines[0].description) {
        description = lines[0].description;
      }

      await supabase.from('payment_history').insert({
        stripe_customer_id: invoice.customer, coach_id: sc?.coach_id, athlete_id: sc?.athlete_id,
        amount: invoice.amount_paid, currency: invoice.currency, status: 'succeeded',
        stripe_invoice_id: invoice.id, stripe_payment_intent_id: invoice.payment_intent,
        period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        description,
      });

      await supabase.from('stripe_customers')
        .update({ subscription_status: 'active' })
        .eq('stripe_customer_id', invoice.customer);

      // Check payments_completed for limited plans
      if (sc?.athlete_id && sc?.coach_id) {
        const { data: plan } = await supabase.from('athlete_payment_plans')
          .select('*').eq('athlete_id', sc.athlete_id).eq('coach_id', sc.coach_id).maybeSingle();
        if (plan) {
          const newCount = (plan.payments_completed || 0) + 1;
          const updates = { payments_completed: newCount, payment_status: 'active' };
          if (plan.total_payments && newCount >= plan.total_payments) {
            updates.payment_status = 'completed';
            const coachStripe = await getCoachStripeInstance(supabase, sc.coach_id);
            if (coachStripe && plan.stripe_subscription_id) {
              await coachStripe.subscriptions.cancel(plan.stripe_subscription_id).catch(() => {});
            }
          }
          await supabase.from('athlete_payment_plans').update(updates).eq('id', plan.id);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const { data: sc } = await supabase.from('stripe_customers')
        .select('coach_id, athlete_id').eq('stripe_customer_id', invoice.customer).maybeSingle();

      await supabase.from('payment_history').insert({
        stripe_customer_id: invoice.customer, coach_id: sc?.coach_id, athlete_id: sc?.athlete_id,
        amount: invoice.amount_due, currency: invoice.currency, status: 'failed',
        stripe_invoice_id: invoice.id,
      });
      await supabase.from('stripe_customers')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', invoice.customer);
      if (sc?.athlete_id) {
        await supabase.from('athlete_payment_plans')
          .update({ payment_status: 'past_due' })
          .eq('athlete_id', sc.athlete_id).eq('coach_id', sc.coach_id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await supabase.from('stripe_customers')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_subscription_id', sub.id);
      const { data: sc } = await supabase.from('stripe_customers')
        .select('coach_id, athlete_id').eq('stripe_subscription_id', sub.id).maybeSingle();
      if (sc) {
        await supabase.from('athlete_payment_plans')
          .update({ payment_status: 'canceled' })
          .eq('athlete_id', sc.athlete_id).eq('coach_id', sc.coach_id);
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const coachId = pi.metadata?.coach_id;
      const athleteId = pi.metadata?.athlete_id;
      const planId = pi.metadata?.plan_id;

      if (planId) {
        // Update payment plan status
        const { data: plan } = await supabase.from('athlete_payment_plans')
          .select('frequency').eq('id', planId).maybeSingle();

        if (plan?.frequency === 'once') {
          // One-time payment completed
          await supabase.from('athlete_payment_plans').update({
            payment_status: 'completed',
            payments_completed: 1,
            stripe_customer_id: pi.customer,
          }).eq('id', planId);
        } else {
          // Subscription first payment
          await supabase.from('athlete_payment_plans').update({
            payment_status: 'active',
            stripe_customer_id: pi.customer,
          }).eq('id', planId);
        }
      }

      // Record payment
      if (coachId && athleteId) {
        await supabase.from('payment_history').insert({
          stripe_customer_id: pi.customer,
          coach_id: coachId,
          athlete_id: athleteId,
          amount: pi.amount,
          currency: pi.currency,
          status: 'succeeded',
          stripe_payment_intent_id: pi.id,
        });
      }
      break;
    }
  }
}

// ── Platform events (coach pays Pierre for SaaS) ──
async function handlePlatformEvent(event, supabase) {
  switch (event.type) {
    case 'invoice.paid': {
      const invoice = event.data.object;
      const coachId = invoice.metadata?.coach_id;
      if (!coachId) break;
      await supabase.from('platform_invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent_id: invoice.payment_intent })
        .eq('stripe_invoice_id', invoice.id);
      await supabase.from('payment_history').insert({
        coach_id: coachId, amount: invoice.amount_paid, currency: invoice.currency, status: 'succeeded',
        stripe_invoice_id: invoice.id, is_platform_payment: true, description: 'Abonnement AthleteFlow',
      });
      await supabase.from('coach_profiles')
        .update({ is_blocked: false, blocked_at: null, blocked_reason: null })
        .eq('user_id', coachId);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const coachId = invoice.metadata?.coach_id;
      if (!coachId) break;
      await supabase.from('payment_history').insert({
        coach_id: coachId, amount: invoice.amount_due, currency: invoice.currency, status: 'failed',
        stripe_invoice_id: invoice.id, is_platform_payment: true, description: 'Échec prélèvement plateforme',
      });
      break;
    }

    case 'setup_intent.succeeded': {
      const si = event.data.object;
      const coachId = si.metadata?.coach_id;
      if (!coachId) break;
      await supabase.from('coach_profiles')
        .update({ has_payment_method: true, stripe_payment_method_id: si.payment_method })
        .eq('user_id', coachId);

      // Set as default payment method on the customer
      if (si.customer && si.payment_method) {
        try {
          await platformStripe.customers.update(si.customer, {
            invoice_settings: { default_payment_method: si.payment_method },
          });
        } catch {}
      }
      break;
    }
  }
}

// Helper: get Stripe instance from coach's saved key
async function getCoachStripeInstance(supabase, coachId) {
  if (!coachId) return null;
  const { data } = await supabase.from('coach_profiles')
    .select('stripe_secret_key').eq('user_id', coachId).single();
  if (!data?.stripe_secret_key) return null;
  const { decrypt } = require('./_crypto');
  const key = decrypt(data.stripe_secret_key);
  return Stripe(key);
}
