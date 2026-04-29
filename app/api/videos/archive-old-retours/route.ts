import { createClient } from '@supabase/supabase-js'
import { verifyCronSecret, authErrorResponse } from '@/lib/api/auth'

export const maxDuration = 60

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  return _supabaseAdmin
}

const RETENTION_DAYS = 30
const BATCH_SIZE = 100

export async function GET(request: Request) {
  try { verifyCronSecret(request) } catch (err) { return authErrorResponse(err) }

  const supabase = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400 * 1000).toISOString()

  // 1. Query batch of candidates
  const { data: candidates, error: qErr } = await supabase
    .from('bilan_retours')
    .select('id, video_path, thumbnail_path')
    .lt('created_at', cutoff)
    .is('archived_at', null)
    .not('video_path', 'is', null)
    .limit(BATCH_SIZE)

  if (qErr) return Response.json({ error: 'Query failed', details: qErr.message }, { status: 500 })
  if (!candidates || candidates.length === 0) return Response.json({ archived: 0, message: 'No candidates' })

  // 2. Delete files from storage
  const paths: string[] = []
  for (const r of candidates) {
    if (r.video_path) paths.push(r.video_path)
    if (r.thumbnail_path) paths.push(r.thumbnail_path)
  }
  const { error: delErr } = await supabase.storage.from('coach-video').remove(paths)
  if (delErr) {
    console.error('[archive] storage.remove error (continuing to mark archived):', delErr)
    // Don't fail — we still want to mark archived to avoid retry loops on missing files
  }

  // 3. Mark as archived
  const ids = candidates.map(r => r.id)
  const { error: updErr } = await supabase
    .from('bilan_retours')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids)
  if (updErr) return Response.json({ error: 'Update failed', details: updErr.message }, { status: 500 })

  return Response.json({ archived: ids.length, ids })
}
