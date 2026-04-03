// Stripe Webhook — handles both platform and coach events
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
// decrypt no longer needed — using Stripe Connect (platform key + stripeAccount)

export const runtime = 'nodejs';

// Cached Supabase admin client (service role — persists across requests in same lambda)
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return _supabaseAdmin;
}

// Cached platform Stripe (Pierre's account — for SaaS events)
let _platformStripe: Stripe | null = null;
function getPlatformStripe() {
  if (!_platformStripe) _platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _platformStripe;
}

export async function POST(request: Request) {
  console.log('[webhook] Received webhook call');
  const supabase = getSupabaseAdmin();

  // Log every hit BEFORE signature verification — helps diagnose delivery issues
  await supabase.from('stripe_audit_log').insert({
    action: 'webhook_endpoint_hit', actor_type: 'system',
    metadata: {
      ip: request.headers.get('x-forwarded-for') || '',
      user_agent: request.headers.get('user-agent') || '',
      timestamp: new Date().toISOString(),
    },
  });

  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature')!;
  console.log('[webhook] Signature present:', !!sig, 'Body length:', rawBody.length);

  // Try to verify with platform webhook secret first
  let event: Stripe.Event;
  let isCoachWebhook = false;

  try {
    // Try platform webhook secret first
    event = getPlatformStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    if ((event as unknown as Record<string, unknown>).account) {
      isCoachWebhook = true;
    }
  } catch {
    // Try connect webhook secret (for events from connected accounts)
    try {
      event = getPlatformStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_CONNECT_WEBHOOK_SECRET!);
      isCoachWebhook = true;
      console.log('[webhook] Verified with CONNECT secret, event:', event.type);
    } catch (connectErr: unknown) {
      console.error('[webhook] Both signatures failed:', (connectErr as Error).message);
      await supabase.from('stripe_audit_log').insert({
        action: 'webhook_signature_failed', actor_type: 'system',
        metadata: { ip: request.headers.get('x-forwarded-for') || '', error: (connectErr as Error).message },
      });
      return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }
  }

  // Replay protection: check if this event was already processed
  const { data: existingEvent } = await supabase
    .from('stripe_audit_log')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();
  if (existingEvent) {
    return Response.json({ received: true, duplicate: true });
  }

  // Audit log
  await supabase.from('stripe_audit_log').insert({
    action: 'webhook_received', actor_type: 'system',
    stripe_event_id: event.id,
    metadata: { type: event.type, is_coach: isCoachWebhook },
  });

  try {
    if (isCoachWebhook) {
      await handleCoachEvent(event, supabase);
    } else {
      await handlePlatformEvent(event, supabase);
    }
  } catch (err: unknown) {
    await supabase.from('stripe_audit_log').insert({
      action: 'webhook_processing_error', actor_type: 'system',
      stripe_event_id: event.id,
      metadata: { error: (err as Error).message, type: event.type },
    });
  }

  return Response.json({ received: true });
}

// ── Coach events (athlete payments on coach's Stripe) ──
async function handleCoachEvent(event: Stripe.Event, supabase: ReturnType<typeof createClient<any>>) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const coachId = session.metadata?.coach_id;
      const athleteId = session.metadata?.athlete_id;
      const planId = session.metadata?.plan_id;

      if (session.mode === 'subscription' && session.subscription) {
        const coachConnect = await getCoachStripeInstance(supabase, coachId);

        let sub: Stripe.Subscription | null = null;
        if (coachConnect) {
          sub = await coachConnect.stripe.subscriptions.retrieve(session.subscription as string, { stripeAccount: coachConnect.accountId }).catch(() => null) as Stripe.Subscription | null;
        }

        await supabase.from('stripe_customers').upsert({
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          coach_id: coachId,
          athlete_id: athleteId,
          subscription_status: 'active',
          monthly_amount: (sub?.items?.data[0]?.price?.unit_amount) || 0,
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

        // If a billing anchor was requested, update the subscription's
        // billing_cycle_anchor now (after payment was collected)
        const anchorTs = session.metadata?.billing_anchor_ts;
        if (anchorTs && coachConnect && session.subscription) {
          try {
            await coachConnect.stripe.subscriptions.update(
              session.subscription as string,
              { billing_cycle_anchor: parseInt(anchorTs) as unknown as Stripe.SubscriptionUpdateParams['billing_cycle_anchor'], proration_behavior: 'none' },
              { stripeAccount: coachConnect.accountId }
            );
            console.log('[webhook] Updated billing_cycle_anchor to', anchorTs);
          } catch (anchorErr) {
            console.error('[webhook] Failed to set billing anchor:', (anchorErr as Error).message);
          }
        }
      } else if (session.mode === 'payment') {
        // Check if this is a prorata payment that needs a subscription created
        const anchorTs = session.metadata?.billing_anchor_ts;
        const recurringAmount = session.metadata?.recurring_amount;

        if (anchorTs && recurringAmount) {
          // Prorata paid — now create the recurring subscription
          const coachConnect = await getCoachStripeInstance(supabase, coachId);
          if (coachConnect) {
            try {
              const interval = (session.metadata?.recurring_interval || 'month') as Stripe.PriceCreateParams.Recurring.Interval;
              const intervalCount = parseInt(session.metadata?.recurring_interval_count || '1');

              // Create price
              const price = await coachConnect.stripe.prices.create({
                currency: session.currency || 'eur',
                unit_amount: parseInt(recurringAmount),
                recurring: { interval, interval_count: intervalCount },
                product_data: { name: `Coaching ${session.customer_details?.name || 'Athlète'}` },
              }, { stripeAccount: coachConnect.accountId });

              // Create subscription starting at anchor date
              const sub = await coachConnect.stripe.subscriptions.create({
                customer: session.customer as string,
                items: [{ price: price.id }],
                billing_cycle_anchor: parseInt(anchorTs),
                proration_behavior: 'none',
                default_payment_method: session.payment_intent ? undefined : undefined,
              }, { stripeAccount: coachConnect.accountId });

              console.log('[webhook] Created subscription', sub.id, 'with anchor', anchorTs);

              // Save subscription to DB
              await supabase.from('stripe_customers').upsert({
                stripe_customer_id: session.customer,
                stripe_subscription_id: sub.id,
                coach_id: coachId,
                athlete_id: athleteId,
                subscription_status: 'active',
                monthly_amount: parseInt(recurringAmount),
              }, { onConflict: 'stripe_customer_id' });

              if (planId) {
                await supabase.from('athlete_payment_plans').update({
                  payment_status: 'active',
                  stripe_subscription_id: sub.id,
                  stripe_customer_id: session.customer,
                }).eq('id', planId);
              }
            } catch (subErr) {
              console.error('[webhook] Failed to create subscription after prorata:', (subErr as Error).message);
              // Still mark as active since prorata was paid
              if (planId) {
                await supabase.from('athlete_payment_plans').update({
                  payment_status: 'active',
                  stripe_customer_id: session.customer,
                }).eq('id', planId);
              }
            }
          }
        } else {
          // Regular one-time payment
          if (planId) {
            await supabase.from('athlete_payment_plans').update({
              payment_status: 'completed', payments_completed: 1,
              stripe_customer_id: session.customer,
            }).eq('id', planId);
          }
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
      const invoice = event.data.object as Stripe.Invoice;
      const { data: sc } = await supabase.from('stripe_customers')
        .select('coach_id, athlete_id').eq('stripe_customer_id', invoice.customer).maybeSingle();

      // Build description from invoice line items (captures proration info)
      const lines = invoice.lines?.data || [];
      const hasProration = lines.some(l => l.proration);
      let description: string | null = null;
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
          const updates: Record<string, unknown> = { payments_completed: newCount, payment_status: 'active' };
          if (plan.total_payments && newCount >= plan.total_payments) {
            updates.payment_status = 'completed';
            const coachConnect = await getCoachStripeInstance(supabase, sc.coach_id);
            if (coachConnect && plan.stripe_subscription_id) {
              await coachConnect.stripe.subscriptions.cancel(plan.stripe_subscription_id, { stripeAccount: coachConnect.accountId });
            }
          }
          await supabase.from('athlete_payment_plans').update(updates).eq('id', plan.id);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
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
      const sub = event.data.object as Stripe.Subscription;
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
      const pi = event.data.object as Stripe.PaymentIntent;
      const coachId = pi.metadata?.coach_id;
      const athleteId = pi.metadata?.athlete_id;
      const planId = pi.metadata?.plan_id;

      if (planId) {
        const { data: plan } = await supabase.from('athlete_payment_plans')
          .select('frequency').eq('id', planId).maybeSingle();

        if (plan?.frequency === 'once') {
          await supabase.from('athlete_payment_plans').update({
            payment_status: 'completed',
            payments_completed: 1,
            stripe_customer_id: pi.customer as string,
          }).eq('id', planId);
        } else {
          await supabase.from('athlete_payment_plans').update({
            payment_status: 'active',
            stripe_customer_id: pi.customer as string,
          }).eq('id', planId);
        }
      }

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
async function handlePlatformEvent(event: Stripe.Event, supabase: ReturnType<typeof createClient<any>>) {
  switch (event.type) {
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
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
      const invoice = event.data.object as Stripe.Invoice;
      const coachId = invoice.metadata?.coach_id;
      if (!coachId) break;
      await supabase.from('payment_history').insert({
        coach_id: coachId, amount: invoice.amount_due, currency: invoice.currency, status: 'failed',
        stripe_invoice_id: invoice.id, is_platform_payment: true, description: 'Échec prélèvement plateforme',
      });
      break;
    }

    case 'setup_intent.succeeded': {
      const si = event.data.object as Stripe.SetupIntent;
      const coachId = si.metadata?.coach_id;
      if (!coachId) break;
      await supabase.from('coach_profiles')
        .update({ has_payment_method: true, stripe_payment_method_id: si.payment_method as string })
        .eq('user_id', coachId);

      if (si.customer && si.payment_method) {
        try {
          await getPlatformStripe().customers.update(si.customer as string, {
            invoice_settings: { default_payment_method: si.payment_method as string },
          });
        } catch { /* ignore */ }
      }
      break;
    }
  }
}

// Helper: get Stripe instance + account ID for a coach via Connect
async function getCoachStripeInstance(supabase: ReturnType<typeof createClient<any>>, coachId: string | undefined): Promise<{ stripe: Stripe; accountId: string } | null> {
  if (!coachId) return null;
  const { data } = await supabase.from('coach_profiles')
    .select('stripe_account_id').eq('user_id', coachId).single();
  if (!data?.stripe_account_id) return null;
  return { stripe: getPlatformStripe(), accountId: data.stripe_account_id };
}
