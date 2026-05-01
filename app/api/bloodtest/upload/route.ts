import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const body = await req.json()
  const { athlete_id, uploaded_by, dated_at } = body
  // Accept either `file_path` (string) or `file_paths` (array) for multi-screenshot uploads.
  const rawPaths: string[] = Array.isArray(body.file_paths)
    ? body.file_paths
    : (typeof body.file_path === 'string' ? [body.file_path] : [])
  if (!athlete_id || rawPaths.length === 0 || !uploaded_by) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (uploaded_by !== 'athlete' && uploaded_by !== 'coach') {
    return NextResponse.json({ error: 'invalid uploaded_by' }, { status: 400 })
  }
  if (rawPaths.length > 10) {
    return NextResponse.json({ error: 'too many files (max 10)' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: ath, error: athErr } = await admin
    .from('athletes').select('id, user_id, coach_id')
    .eq('id', athlete_id).single()
  if (athErr || !ath) return NextResponse.json({ error: 'athlete not found' }, { status: 404 })

  // Validate path prefix + existence for each file
  for (const file_path of rawPaths) {
    if (uploaded_by === 'athlete') {
      if (ath.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      if (!file_path.startsWith(`${user.id}/`)) return NextResponse.json({ error: `invalid path for athlete: ${file_path}` }, { status: 400 })
    } else {
      if (ath.coach_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      if (!file_path.startsWith(`coach/${user.id}/${athlete_id}/`)) return NextResponse.json({ error: `invalid path for coach: ${file_path}` }, { status: 400 })
    }
    const lastSlash = file_path.lastIndexOf('/')
    const folder = file_path.slice(0, lastSlash)
    const filename = file_path.slice(lastSlash + 1)
    const { data: list } = await admin.storage.from('coach-bloodtest').list(folder, { search: filename })
    if (!list || list.length === 0) return NextResponse.json({ error: `file not found in storage: ${file_path}` }, { status: 400 })
  }

  // Store as pipe-joined string (extract route splits by '|').
  const file_path_joined = rawPaths.join('|')

  const { data: upload, error: insErr } = await admin
    .from('bloodtest_uploads')
    .insert({
      athlete_id,
      uploaded_by,
      uploader_user_id: user.id,
      file_path: file_path_joined,
      dated_at: dated_at || null,
    })
    .select('id')
    .single()
  if (insErr) {
    console.error('[bloodtest/upload] insert', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ upload_id: upload.id })
}
