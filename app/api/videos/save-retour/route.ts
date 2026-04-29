import { createClient } from '@supabase/supabase-js'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 30

const MAX_DURATION_S = 15 * 60  // 900 — matches client-side hard cap
const MAX_WIDTH = 4096
const MAX_HEIGHT = 4096

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

interface SaveBody {
  retourId?: string
  athleteId?: string
  videoPath?: string
  thumbnailPath?: string
  durationS?: number
  width?: number
  height?: number
  mimeType?: string
  titre?: string
  commentaire?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(request)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  let body: SaveBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { retourId, athleteId, videoPath, thumbnailPath, durationS, width, height, mimeType, titre, commentaire } = body
  if (!retourId || !athleteId || !videoPath || !thumbnailPath || !mimeType || !titre) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!UUID_RE.test(retourId) || !UUID_RE.test(athleteId)) {
    return Response.json({ error: 'Invalid UUID format' }, { status: 400 })
  }

  // Path validation: must be under the caller's coach folder
  const expectedPrefix = `${user.id}/`
  if (!videoPath.startsWith(expectedPrefix) || !thumbnailPath.startsWith(expectedPrefix)) {
    return Response.json({ error: 'Path ownership violation' }, { status: 403 })
  }

  // Sanity caps to prevent abusive metadata
  if (typeof durationS === 'number' && (durationS < 0 || durationS > MAX_DURATION_S)) {
    return Response.json({ error: 'Invalid durationS' }, { status: 400 })
  }
  if (typeof width === 'number' && (width < 0 || width > MAX_WIDTH)) {
    return Response.json({ error: 'Invalid width' }, { status: 400 })
  }
  if (typeof height === 'number' && (height < 0 || height > MAX_HEIGHT)) {
    return Response.json({ error: 'Invalid height' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Verify the athlete belongs to this coach
  const { data: athlete, error: athErr } = await supabase
    .from('athletes')
    .select('id, user_id, coach_id')
    .eq('id', athleteId)
    .eq('coach_id', user.id)
    .maybeSingle()
  if (athErr || !athlete) {
    return Response.json({ error: 'Athlete not found or not yours' }, { status: 403 })
  }

  // Verify the uploaded files actually exist in storage (prevents orphan rows + path phishing)
  const folder = user.id
  const { data: files, error: listErr } = await supabase.storage
    .from('coach-video')
    .list(folder, { search: retourId })
  if (listErr) {
    console.error('[save-retour] storage.list error:', listErr)
    return Response.json({ error: 'Storage check failed' }, { status: 500 })
  }
  const filenames = new Set((files || []).map(f => f.name))
  const expectedVideoName = videoPath.slice(expectedPrefix.length)
  const expectedThumbName = thumbnailPath.slice(expectedPrefix.length)
  if (!filenames.has(expectedVideoName) || !filenames.has(expectedThumbName)) {
    return Response.json({ error: 'Uploaded files not found in storage' }, { status: 400 })
  }

  // Insert bilan_retours row
  const { data: inserted, error: insErr } = await supabase
    .from('bilan_retours')
    .insert({
      id: retourId,
      athlete_id: athleteId,
      coach_id: user.id,
      titre,
      commentaire: commentaire ?? null,
      video_path: videoPath,
      thumbnail_path: thumbnailPath,
      duration_s: durationS ?? null,
      width: width ?? null,
      height: height ?? null,
      mime_type: mimeType,
    })
    .select()
    .single()
  if (insErr) {
    console.error('[save-retour] insert error:', insErr)
    return Response.json({ error: 'DB insert failed', details: insErr.message }, { status: 500 })
  }

  // Send push notification (best-effort, don't fail request if push fails)
  if (athlete.user_id) {
    try {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: athlete.user_id,
        type: 'retour',
        title: 'Nouveau retour vidéo',
        body: `Votre coach vous a envoyé : ${titre}`,
        metadata: { retour_id: retourId, has_video: true, titre, commentaire: commentaire ?? null },
      })
      if (notifErr) console.error('[save-retour] notification insert failed:', notifErr)

      // Expo push (mirror notifyAthlete logic since this runs server-side)
      const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', athlete.user_id)
      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: { token: string }) => ({
          to: t.token,
          sound: 'default',
          title: 'Nouveau retour vidéo',
          body: `Votre coach vous a envoyé : ${titre}`,
          data: { type: 'retour', retour_id: retourId, has_video: true, titre, commentaire: commentaire ?? null },
        }))
        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        })
        if (!expoRes.ok) {
          console.error('[save-retour] expo push HTTP error:', expoRes.status, await expoRes.text())
        }
      }
    } catch (pushErr) {
      console.error('[save-retour] push failed (non-fatal):', pushErr)
    }
  }

  const insertedId = (inserted as { id: string } | null)?.id ?? retourId
  return Response.json({ ok: true, id: insertedId })
}
