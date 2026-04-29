import { createClient } from '@supabase/supabase-js'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 10

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

const TTL_SECONDS = 3600  // 1 hour

export async function GET(request: Request) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(request)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { searchParams } = new URL(request.url)
  const retourId = searchParams.get('id')
  if (!retourId) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  // Fetch the retour and verify access
  const { data: retour, error } = await supabase
    .from('bilan_retours')
    .select('id, athlete_id, coach_id, video_path, thumbnail_path, archived_at, athletes(user_id)')
    .eq('id', retourId)
    .maybeSingle()

  if (error || !retour) return Response.json({ error: 'Not found' }, { status: 404 })
  if (retour.archived_at) return Response.json({ error: 'Archived' }, { status: 410 })
  if (!retour.video_path || !retour.thumbnail_path) return Response.json({ error: 'No video' }, { status: 404 })

  // Access check: caller must be the coach OR the athlete (via athletes.user_id)
  const isCoach = retour.coach_id === user.id
  // athletes was joined as nested; depending on PG/PostgREST it may be array or object
  type AthleteRef = { user_id: string | null } | { user_id: string | null }[] | null
  const athletesRef = retour.athletes as AthleteRef
  const athleteUserId = Array.isArray(athletesRef)
    ? athletesRef[0]?.user_id
    : athletesRef?.user_id ?? null
  const isAthlete = !!athleteUserId && athleteUserId === user.id

  if (!isCoach && !isAthlete) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // Generate signed URLs
  const [{ data: vidSigned, error: vidErr }, { data: thumbSigned, error: thumbErr }] = await Promise.all([
    supabase.storage.from('coach-video').createSignedUrl(retour.video_path, TTL_SECONDS),
    supabase.storage.from('coach-video').createSignedUrl(retour.thumbnail_path, TTL_SECONDS),
  ])

  if (vidErr || !vidSigned) return Response.json({ error: 'Sign video URL failed' }, { status: 500 })
  if (thumbErr || !thumbSigned) return Response.json({ error: 'Sign thumb URL failed' }, { status: 500 })

  return Response.json({
    videoUrl: vidSigned.signedUrl,
    thumbnailUrl: thumbSigned.signedUrl,
    expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
  })
}
