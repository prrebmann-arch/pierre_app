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

  // Build the rows to insert: one per athlete, sharing the same media
  const baseRow = {
    coach_id: user.id,
    titre: body.titre.trim(),
    commentaire: body.commentaire?.trim() || null,
    type: body.type,
    audio_url: body.audio_url || null,
    loom_url: body.loom_url || null,
    video_path: body.video_path || null,
    thumbnail_path: body.thumbnail_path || null,
    duration_s: body.duration_s ?? null,
    width: body.width ?? null,
    height: body.height ?? null,
    mime_type: body.mime_type || null,
  }
  const rows = athletes.map((a) => ({ ...baseRow, athlete_id: a.id }))

  const { error: insErr } = await admin.from('bilan_retours').insert(rows)
  if (insErr) {
    console.error('[annonces/broadcast] insert error', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // In-app notifications (one row per athlete with valid user_id)
  const userIds = athletes.map((a) => a.user_id).filter((u): u is string => !!u)
  const meta: Record<string, string> = {}
  if (body.commentaire) { meta.commentaire = body.commentaire; meta.coach_notes = body.commentaire }
  if (body.audio_url) meta.audio_url = body.audio_url
  if (body.loom_url) meta.loom_url = body.loom_url

  const notifTitle =
    body.type === 'audio' ? 'Message vocal de ton coach'
    : body.type === 'loom' || body.type === 'video' ? 'Vidéo de ton coach'
    : 'Annonce de ton coach'
  const notifBody = body.commentaire?.trim()
    || (body.type === 'audio' ? "Ton coach t'a envoyé un message vocal"
    : body.type === 'loom' || body.type === 'video' ? "Ton coach t'a envoyé une vidéo"
    : 'Nouvelle annonce')

  if (userIds.length > 0) {
    const notifRows = userIds.map((uid) => ({
      user_id: uid,
      type: 'retour',
      title: notifTitle,
      body: notifBody,
      metadata: meta,
    }))
    await admin.from('notifications').insert(notifRows)

    // Push notif via Expo — broadcast in one call
    const { data: tokens } = await admin
      .from('push_tokens').select('token').in('user_id', userIds)
    if (tokens && tokens.length > 0) {
      const messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        sound: 'default',
        title: notifTitle,
        body: notifBody,
        data: { type: 'retour', ...meta },
      }))
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
    inserted: rows.length,
    pushed: userIds.length,
    skipped_no_user: athletes.length - userIds.length,
  })
}
