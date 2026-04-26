// Upload de photos de bilan (front/side/back) pour un athlète, par le coach.
// - Vérifie que le coach est authentifié et propriétaire de l'athlète.
// - Upload chaque fichier dans athlete-photos/{user_id}/{date}_{position}.jpg.
// - Upsert daily_reports (insert ou update les colonnes photo_*).
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'

const POSITIONS = ['front', 'side', 'back'] as const
type Position = typeof POSITIONS[number]

function admin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(request: Request) {
  let coachId: string
  try {
    const { user } = await verifyAuth(request)
    coachId = user.id
  } catch (e) {
    return authErrorResponse(e)
  }

  let form: FormData
  try { form = await request.formData() }
  catch { return NextResponse.json({ error: 'FormData attendu' }, { status: 400 }) }

  const athleteId = String(form.get('athlete_id') || '')
  const date = String(form.get('date') || '')

  if (!athleteId) return NextResponse.json({ error: 'athlete_id requis' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'date invalide (YYYY-MM-DD)' }, { status: 400 })

  const sb = admin()

  // Vérifier que l'athlète existe et appartient au coach
  const { data: athlete, error: athErr } = await sb
    .from('athletes')
    .select('id, user_id, coach_id')
    .eq('id', athleteId)
    .single()
  if (athErr || !athlete) return NextResponse.json({ error: 'Athlète introuvable' }, { status: 404 })
  if (athlete.coach_id !== coachId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (!athlete.user_id) return NextResponse.json({ error: "Athlète sans user_id" }, { status: 400 })

  // Récolter les fichiers présents dans le formulaire
  const files: Partial<Record<Position, File>> = {}
  for (const pos of POSITIONS) {
    const f = form.get(pos)
    if (f instanceof File && f.size > 0) files[pos] = f
  }
  if (Object.keys(files).length === 0) {
    return NextResponse.json({ error: 'Aucune photo fournie' }, { status: 400 })
  }

  // Upload Storage
  const paths: Partial<Record<Position, string>> = {}
  for (const [pos, file] of Object.entries(files) as Array<[Position, File]>) {
    const path = `${athlete.user_id}/${date}_${pos}.jpg`
    const buf = Buffer.from(await file.arrayBuffer())
    const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
    const { error: upErr } = await sb.storage
      .from('athlete-photos')
      .upload(path, buf, { contentType, upsert: true })
    if (upErr) {
      return NextResponse.json({ error: `Upload ${pos} échoué: ${upErr.message}` }, { status: 500 })
    }
    paths[pos] = path
  }

  // Upsert daily_reports (user_id, date)
  const { data: existing, error: selErr } = await sb
    .from('daily_reports')
    .select('id')
    .eq('user_id', athlete.user_id)
    .eq('date', date)
    .maybeSingle()
  if (selErr) {
    return NextResponse.json({ error: `Lecture bilan: ${selErr.message}` }, { status: 500 })
  }

  const patch: Record<string, string> = {}
  for (const [pos, p] of Object.entries(paths)) patch[`photo_${pos}`] = p as string

  if (existing?.id) {
    const { error: updErr } = await sb.from('daily_reports').update(patch).eq('id', existing.id)
    if (updErr) return NextResponse.json({ error: `Update bilan: ${updErr.message}` }, { status: 500 })
  } else {
    const { error: insErr } = await sb.from('daily_reports').insert({
      user_id: athlete.user_id,
      date,
      ...patch,
    })
    if (insErr) return NextResponse.json({ error: `Insert bilan: ${insErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, paths })
}
