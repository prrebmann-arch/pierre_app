import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { upload_id, validated_data, dated_at } = await req.json()
  if (!upload_id || !validated_data) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: row } = await admin
    .from('bloodtest_uploads').select('id, athlete_id')
    .eq('id', upload_id).single()
  if (!row) return NextResponse.json({ error: 'upload not found' }, { status: 404 })
  const { data: ath } = await admin
    .from('athletes').select('coach_id').eq('id', row.athlete_id).single()
  if (!ath || ath.coach_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin
    .from('bloodtest_uploads')
    .update({
      validated_data,
      validated_at: new Date().toISOString(),
      validated_by: user.id,
      dated_at: dated_at || null,
    })
    .eq('id', upload_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
