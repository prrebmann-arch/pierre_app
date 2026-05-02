import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type BroadcastBody = {
  athlete_ids: string[]
  type: 'message' | 'audio' | 'loom' | 'mixed' | 'video'
  titre: string
  commentaire?: string | null
  audio_url?: string | null
  loom_url?: string | null
  // video fields (when type === 'video' or 'mixed' with video)
  video_path?: string | null
  thumbnail_path?: string | null
  duration_s?: number | null
  width?: number | null
  height?: number | null
  mime_type?: string | null
}

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  let body: BroadcastBody
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const ids = Array.isArray(body.athlete_ids) ? body.athlete_ids.filter((s) => typeof s === 'string' && s) : []
  if (ids.length === 0) return NextResponse.json({ error: 'no_recipients' }, { status: 400 })
  if (ids.length > 500) return NextResponse.json({ error: 'too_many_recipients' }, { status: 400 })
  if (!body.titre || !body.titre.trim()) return NextResponse.json({ error: 'titre_required' }, { status: 400 })
  if (!body.type) return NextResponse.json({ error: 'type_required' }, { status: 400 })

  // Path-phishing guard for storage paths
  if (body.video_path && !body.video_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'invalid_video_path' }, { status: 400 })
  }
  if (body.thumbnail_path && !body.thumbnail_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'invalid_thumbnail_path' }, { status: 400 })
  }

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

  // Verify ALL athlete_ids belong to this coach. Fetch user_id for push notif at the same time.
  const { data: athletes, error: athErr } = await admin
    .from('athletes')
    .select('id, user_id, prenom')
    .in('id', ids)
    .eq('coach_id', user.id)

  if (athErr) return NextResponse.json({ error: athErr.message }, { status: 500 })
  if (!athletes || athletes.length !== ids.length) {
    return NextResponse.json({
      error: 'athlete_ownership_mismatch',
      detail: `${athletes?.length || 0}/${ids.length} athletes belong to coach`,
    }, { status: 403 })
  }

  // If video paths provided, verify the files actually exist in storage (best-effort).
  if (body.video_path) {
    const { data: vid } = await admin.storage.from('coach-video').list(body.video_path.split('/').slice(0, -1).join('/'), {
      search: body.video_path.split('/').pop() || '',
      limit: 1,
    })
    if (!vid || vid.length === 0) {
      return NextResponse.json({ error: 'video_not_found' }, { status: 400 })
    }
  }

  // Build the rows to insert: one per athlete, sharing the same media.
  // For video: do NOT set `type` column (matches save-retour behavior — the
  // athlete app reads video_path/thumbnail_path directly, not type).
  const isVideoBroadcast = body.type === 'video'
  const baseRow: Record<string, unknown> = {
    coach_id: user.id,
    titre: body.titre.trim(),
    commentaire: body.commentaire?.trim() || null,
    audio_url: body.audio_url || null,
    loom_url: body.loom_url || null,
    video_path: body.video_path || null,
    thumbnail_path: body.thumbnail_path || null,
    duration_s: body.duration_s ?? null,
    width: body.width ?? null,
    height: body.height ?? null,
    mime_type: body.mime_type || null,
  }
  if (!isVideoBroadcast) baseRow.type = body.type
  const rowsToInsert = athletes.map((a) => ({ ...baseRow, athlete_id: a.id }))

  // RETURNING id so we can pair each athlete with its retour_id for the push
  const { data: insertedRows, error: insErr } = await admin
    .from('bilan_retours')
    .insert(rowsToInsert)
    .select('id, athlete_id')
  if (insErr) {
    console.error('[annonces/broadcast] insert error', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }
  const retourIdByAthleteId = new Map<string, string>()
  for (const r of insertedRows || []) retourIdByAthleteId.set(r.athlete_id, r.id)

  // Build per-athlete notif rows (each carries its own retour_id so the
  // athlete app can route the tap to the correct bilan_retours row).
  const athletesWithUserId = athletes.filter((a) => !!a.user_id) as { id: string; user_id: string; prenom: string | null }[]
  const baseMeta: Record<string, unknown> = {}
  if (body.commentaire) { baseMeta.commentaire = body.commentaire; baseMeta.coach_notes = body.commentaire }
  if (body.audio_url) baseMeta.audio_url = body.audio_url
  if (body.loom_url) baseMeta.loom_url = body.loom_url
  if (body.video_path) baseMeta.has_video = true

  const notifTitle =
    isVideoBroadcast || body.type === 'loom' ? 'Vidéo de ton coach'
    : body.type === 'audio' ? 'Message vocal de ton coach'
    : 'Annonce de ton coach'
  const notifBody = body.commentaire?.trim()
    || (isVideoBroadcast || body.type === 'loom' ? "Ton coach t'a envoyé une vidéo"
    : body.type === 'audio' ? "Ton coach t'a envoyé un message vocal"
    : 'Nouvelle annonce')

  if (athletesWithUserId.length > 0) {
    const notifRows = athletesWithUserId.map((a) => ({
      user_id: a.user_id,
      type: 'retour',
      title: notifTitle,
      body: notifBody,
      metadata: { ...baseMeta, retour_id: retourIdByAthleteId.get(a.id), titre: baseRow.titre },
    }))
    await admin.from('notifications').insert(notifRows)

    // Push : 1 message par token (per-athlete data because retour_id différent)
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', athletesWithUserId.map((a) => a.user_id))
    if (tokens && tokens.length > 0) {
      const userIdToAthlete = new Map(athletesWithUserId.map((a) => [a.user_id, a]))
      const messages = tokens.map((t: { token: string; user_id: string }) => {
        const a = userIdToAthlete.get(t.user_id)
        const retourId = a ? retourIdByAthleteId.get(a.id) : undefined
        return {
          to: t.token,
          sound: 'default',
          title: notifTitle,
          body: notifBody,
          data: { type: 'retour', ...baseMeta, retour_id: retourId, titre: baseRow.titre },
        }
      })
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        })
      } catch (e) {
        console.error('[annonces/broadcast] expo push failed', e)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: rowsToInsert.length,
    pushed: athletesWithUserId.length,
    skipped_no_user: athletes.length - athletesWithUserId.length,
  })
}
