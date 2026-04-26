// Initialize an athlete_onboarding row. Runs server-side with the service
// role key to bypass RLS — the coach's client-side insert was silently
// failing on RLS (coach's auth.uid != new athlete's auth.uid in the row).
//
// Verifies the caller is authenticated and that the athlete belongs to them
// before inserting.

import { NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  let user: { id: string; [key: string]: unknown }
  try { ({ user } = await verifyAuth(request)) } catch (e) { return authErrorResponse(e) }

  try {
    const { athlete_id, workflow_id } = await request.json()
    if (!athlete_id || !workflow_id) {
      return NextResponse.json({ error: 'athlete_id and workflow_id required' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } },
    )

    // Ownership check: the athlete_id here is the new user's auth.uid; verify
    // they have an athletes row owned by the caller (the coach).
    const { data: athRow, error: athErr } = await admin
      .from('athletes')
      .select('id, coach_id')
      .eq('user_id', athlete_id)
      .maybeSingle()
    if (athErr) return NextResponse.json({ error: athErr.message }, { status: 500 })
    if (!athRow) return NextResponse.json({ error: 'athlete not found for user_id' }, { status: 404 })
    if (athRow.coach_id !== user.id) {
      return NextResponse.json({ error: 'forbidden — not your athlete' }, { status: 403 })
    }

    // Verify the workflow belongs to the caller too.
    const { data: wfRow, error: wfErr } = await admin
      .from('onboarding_workflows')
      .select('id, coach_id')
      .eq('id', workflow_id)
      .maybeSingle()
    if (wfErr) return NextResponse.json({ error: wfErr.message }, { status: 500 })
    if (!wfRow || wfRow.coach_id !== user.id) {
      return NextResponse.json({ error: 'workflow not found or not yours' }, { status: 403 })
    }

    // Idempotent insert — skip if a row already exists for this athlete/workflow.
    const { data: existing } = await admin
      .from('athlete_onboarding')
      .select('id')
      .eq('athlete_id', athlete_id)
      .eq('workflow_id', workflow_id)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, id: existing.id, existed: true })

    const { data: inserted, error: insErr } = await admin
      .from('athlete_onboarding')
      .insert({
        athlete_id,
        workflow_id,
        current_step: 0,
        steps_completed: [],
        completed: false,
        responses: {},
      })
      .select('id')
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message, details: insErr }, { status: 500 })

    return NextResponse.json({ ok: true, id: inserted.id, existed: false })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
