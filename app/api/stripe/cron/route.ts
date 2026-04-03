// Stripe CRON — Monthly invoicing + daily retry
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret, authErrorResponse } from '@/lib/api/auth';

export const maxDuration = 120;

// Cached Stripe instance (persists across requests in same lambda)
let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

// Cached Supabase admin client (service role)
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return _supabaseAdmin;
}

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
  try { verifyCronSecret(request); } catch (e) { return authErrorResponse(e); }

  const { searchParams } = new URL(request.url);
  const supabase = getSupabaseAdmin();
  const action = searchParams.get('action');
  const now = new Date();
  const results: Record<string, unknown> = {};

  try {
    // If called without action (daily cron), run retry always + invoice on the 10th
    if (!action) {
      results.retry = await runRetry(supabase, now);
      if (now.getDate() === 10) {
        results.invoice = await runInvoice(supabase, now);
      }
    } else if (action === 'invoice') {
      results.invoice = await runInvoice(supabase, now);
    } else if (action === 'retry') {
      results.retry = await runRetry(supabase, now);
    } else {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return Response.json({ success: true, results });
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}

// ── INVOICE (runs on 10th) ──
async function runInvoice(supabase: ReturnType<typeof createClient<any>>, now: Date) {
  const stripe = getStripe();
  const billMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const billYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const daysInMonth = new Date(billYear, billMonth, 0).getDate();
  const PRICE_PER_ATHLETE_MONTH = 500;
  const BUSINESS_FEE = 6000;
  const results = { invoiced: 0, skipped: 0, errors: [] as { coach: string; error: string }[] };

  const { data: coaches } = await supabase.from('coach_profiles')
    .select('user_id, plan, stripe_customer_id, has_payment_method, trial_ends_at, email, display_name');

  if (!coaches?.length) return results;

  for (const coach of coaches) {
    try {
      const { data: existing } = await supabase.from('platform_invoices')
        .select('id').eq('coach_id', coach.user_id).eq('month', billMonth).eq('year', billYear).maybeSingle();
      if (existing) { results.skipped++; continue; }
      if (coach.trial_ends_at && new Date(coach.trial_ends_at) > now) { results.skipped++; continue; }

      const monthStart = `${billYear}-${String(billMonth).padStart(2, '0')}-01`;
      const monthEnd = `${billYear}-${String(billMonth).padStart(2, '0')}-${daysInMonth}`;

      const { data: allActivities } = await supabase.from('athlete_activity_log')
        .select('athlete_id, event, event_date').eq('coach_id', coach.user_id)
        .lte('event_date', monthEnd).order('event_date', { ascending: true });

      const uniqueAthletes = [...new Set((allActivities || []).map((a: { athlete_id: string }) => a.athlete_id))];
      const detail: { athlete_id: string; days: number; cost: number }[] = [];

      for (const athleteId of uniqueAthletes) {
        const acts = (allActivities || []).filter((a: { athlete_id: string }) => a.athlete_id === athleteId);
        let activeStart: Date | null = null;
        let totalDays = 0;

        for (const act of acts) {
          const actDate = new Date(act.event_date);
          if (act.event === 'added') { activeStart = actDate; }
          else if (act.event === 'removed' && activeStart) {
            const s = new Date(Math.max(activeStart.getTime(), new Date(monthStart).getTime()));
            const e = new Date(Math.min(actDate.getTime(), new Date(monthEnd).getTime()));
            if (e > s) totalDays += Math.ceil((e.getTime() - s.getTime()) / 86400000);
            activeStart = null;
          }
        }
        if (activeStart) {
          const s = new Date(Math.max(activeStart.getTime(), new Date(monthStart).getTime()));
          const e = new Date(billYear, billMonth, 0);
          if (e >= s) totalDays += Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
        }
        totalDays = Math.min(totalDays, daysInMonth);
        if (totalDays > 0) detail.push({ athlete_id: athleteId, days: totalDays, cost: Math.round(PRICE_PER_ATHLETE_MONTH * totalDays / daysInMonth) });
      }

      const athleteTotal = detail.reduce((s, d) => s + d.cost, 0);
      const businessFee = coach.plan === 'business' ? BUSINESS_FEE : 0;
      const totalAmount = athleteTotal + businessFee;
      if (totalAmount === 0) { results.skipped++; continue; }

      let stripeInvoiceId: string | null = null;
      let status = 'pending';

      if (coach.stripe_customer_id && coach.has_payment_method) {
        try {
          if (athleteTotal > 0) await stripe.invoiceItems.create({ customer: coach.stripe_customer_id, amount: athleteTotal, currency: 'eur', description: `AthleteFlow — ${detail.length} athlète(s) ${billMonth}/${billYear}` });
          if (businessFee > 0) await stripe.invoiceItems.create({ customer: coach.stripe_customer_id, amount: businessFee, currency: 'eur', description: `AthleteFlow — Plan Business ${billMonth}/${billYear}` });
          const inv = await stripe.invoices.create({ customer: coach.stripe_customer_id, auto_advance: true, collection_method: 'charge_automatically', metadata: { coach_id: coach.user_id, month: String(billMonth), year: String(billYear) } });
          const fin = await stripe.invoices.finalizeInvoice(inv.id);
          try { const paid = await stripe.invoices.pay(fin.id); stripeInvoiceId = paid.id; status = paid.status === 'paid' ? 'paid' : 'failed'; }
          catch { stripeInvoiceId = fin.id; status = 'failed'; }
        } catch (e: unknown) { status = 'failed'; results.errors.push({ coach: coach.user_id, error: (e as Error).message }); }
      }

      await supabase.from('platform_invoices').insert({
        coach_id: coach.user_id, month: billMonth, year: billYear,
        athlete_count: detail.length, athlete_days_detail: detail,
        athlete_total: athleteTotal, business_fee: businessFee, total_amount: totalAmount,
        stripe_invoice_id: stripeInvoiceId, status,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
        next_retry_at: status === 'failed' ? new Date(Date.now() + 3 * 86400000).toISOString() : null,
      });

      await supabase.from('stripe_audit_log').insert({
        action: 'platform_invoice_created', actor_type: 'cron', actor_id: coach.user_id,
        amount: totalAmount, metadata: { month: billMonth, year: billYear, athletes: detail.length, status },
      });

      results.invoiced++;
    } catch (e: unknown) { results.errors.push({ coach: coach.user_id, error: (e as Error).message }); }
  }
  return results;
}

// ── RETRY (runs daily) ──
async function runRetry(supabase: ReturnType<typeof createClient<any>>, now: Date) {
  const stripe = getStripe();
  const results = { retried: 0, blocked: 0, errors: [] as { invoice: string; error: string }[] };

  const { data: invoices } = await supabase.from('platform_invoices')
    .select('*').in('status', ['failed', 'retry_1', 'retry_2', 'retry_3'])
    .lte('next_retry_at', now.toISOString());

  if (!invoices?.length) return results;

  for (const inv of invoices) {
    try {
      const retryCount = inv.retry_count || 0;

      if (retryCount >= 3) {
        const daysSince = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / 86400000);
        if (daysSince >= 30) {
          await supabase.from('coach_profiles').update({
            is_blocked: true, blocked_at: now.toISOString(),
            blocked_reason: `Impayé ${inv.month}/${inv.year} — ${(inv.total_amount / 100).toFixed(2)}€`,
          }).eq('user_id', inv.coach_id);
          await supabase.from('platform_invoices').update({ status: 'blocked' }).eq('id', inv.id);
          await supabase.from('notifications').insert({
            user_id: inv.coach_id, type: 'billing', title: 'Compte bloqué',
            body: `Impayé de ${(inv.total_amount / 100).toFixed(2)}€. Régularisez pour réactiver.`,
          });
          results.blocked++; continue;
        }
      }

      let paid = false;
      if (inv.stripe_invoice_id) {
        try { const p = await stripe.invoices.pay(inv.stripe_invoice_id); paid = p.status === 'paid'; } catch { /* ignore */ }
      }

      const newRetry = retryCount + 1;
      const delays = [3, 4, 7];
      const nextDays = delays[Math.min(newRetry, delays.length - 1)] || 7;

      if (paid) {
        await supabase.from('platform_invoices').update({ status: 'paid', paid_at: now.toISOString(), retry_count: newRetry }).eq('id', inv.id);
        await supabase.from('coach_profiles').update({ is_blocked: false, blocked_at: null, blocked_reason: null }).eq('user_id', inv.coach_id);
        await supabase.from('notifications').insert({ user_id: inv.coach_id, type: 'billing', title: 'Paiement réussi', body: `${(inv.total_amount / 100).toFixed(2)}€ prélevé.` });
      } else {
        const statusMap: Record<number, string> = { 0: 'retry_1', 1: 'retry_2', 2: 'retry_3' };
        await supabase.from('platform_invoices').update({
          status: statusMap[retryCount] || 'retry_3', retry_count: newRetry,
          next_retry_at: new Date(now.getTime() + nextDays * 86400000).toISOString(),
        }).eq('id', inv.id);
        await supabase.from('notifications').insert({ user_id: inv.coach_id, type: 'billing', title: 'Échec prélèvement', body: `Nouvelle tentative dans ${nextDays}j.` });
      }

      results.retried++;
    } catch (e: unknown) { results.errors.push({ invoice: inv.id, error: (e as Error).message }); }
  }
  return results;
}
