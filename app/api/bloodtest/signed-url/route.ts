import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const upload_id = req.nextUrl.searchParams.get('id')
  if (!upload_id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: row } = await admin
    .from('bloodtest_uploads').select('athlete_id, file_path').eq('id', upload_id).single()
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: ath } = await admin
    .from('athletes').select('user_id, coach_id').eq('id', row.athlete_id).single()
  if (!ath) return NextResponse.json({ error: 'athlete not found' }, { status: 404 })
  if (ath.user_id !== user.id && ath.coach_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const paths: string[] = (row.file_path || '').split('|').filter((p: string) => p.length > 0)
  if (paths.length === 0) return NextResponse.json({ error: 'no file_path' }, { status: 500 })

  const urls: { path: string; url: string; mediaType: string }[] = []
  for (const p of paths) {
    const { data: signed, error } = await admin.storage
      .from('coach-bloodtest')
      .createSignedUrl(p, 3600)
    if (error || !signed?.signedUrl) return NextResponse.json({ error: `sign failed for ${p}` }, { status: 500 })
    const ext = (p.split('.').pop() || '').toLowerCase()
    const mediaType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg'
    urls.push({ path: p, url: signed.signedUrl, mediaType })
  }

  // Backward compat : keep single `url` field for first file.
  return NextResponse.json({ url: urls[0].url, urls })
}
