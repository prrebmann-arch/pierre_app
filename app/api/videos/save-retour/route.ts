import { createClient } from '@supabase/supabase-js'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 30

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
      await supabase.from('notifications').insert({
        user_id: athlete.user_id,
        type: 'retour',
        title: 'Nouveau retour vidéo',
        body: `Votre coach vous a envoyé : ${titre}`,
        metadata: { retour_id: retourId, has_video: true },
      })

      // Expo push (mirror notifyAthlete logic since this runs server-side)
      const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', athlete.user_id)
      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: { token: string }) => ({
          to: t.token,
          sound: 'default',
          title: 'Nouveau retour vidéo',
          body: `Votre coach vous a envoyé : ${titre}`,
          data: { type: 'retour', retour_id: retourId, has_video: true },
        }))
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        })
      }
    } catch (pushErr) {
      console.error('[save-retour] push failed (non-fatal):', pushErr)
    }
  }

  return Response.json({ ok: true, id: inserted.id })
}
