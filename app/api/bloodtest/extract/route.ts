import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Tu es un assistant qui extrait des valeurs de prises de sang depuis des PDFs ou des screenshots de bilan sanguin en français.

Tu retournes UNIQUEMENT un JSON strict valide (pas de markdown, pas de prose) :

{
  "detected_dated_at": "YYYY-MM-DD" | null,
  "markers": [
    { "raw_label": "string", "value": number | null, "unit": "string" | null, "lab_reference_range": "string optional" }
  ]
}

Règles :
- Extrais TOUS les marqueurs présents, sans filtrer.
- Si valeur illisible : null.
- Conserve l'unité telle qu'écrite dans la source (PDF ou screenshot), ne convertis pas.
- detected_dated_at = date du prélèvement si lisible.
- Si plusieurs screenshots sont fournis pour le même bilan, fusionne tous les marqueurs.`

export async function POST(req: NextRequest) {
  let user: { id: string }
  try {
    const auth = await verifyAuth(req)
    user = auth.user as { id: string }
  } catch (err) {
    return authErrorResponse(err)
  }

  const { upload_id } = await req.json()
  if (!upload_id) return NextResponse.json({ error: 'missing upload_id' }, { status: 400 })

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const { data: upload, error: upErr } = await admin
    .from('bloodtest_uploads')
    .select('id, athlete_id, file_path, extracted_data')
    .eq('id', upload_id)
    .single()
  if (upErr || !upload) return NextResponse.json({ error: 'upload not found' }, { status: 404 })

  const { data: ath } = await admin
    .from('athletes').select('user_id, coach_id')
    .eq('id', upload.athlete_id).single()
  if (!ath) return NextResponse.json({ error: 'athlete not found' }, { status: 404 })
  if (ath.user_id !== user.id && ath.coach_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (upload.extracted_data) return NextResponse.json({ already_extracted: true })

  // file_path may be a single path (PDF or image) or multiple paths separated by '|' (multi-screenshots).
  const paths = upload.file_path.split('|').filter((p: string) => p.trim().length > 0)
  if (paths.length === 0) return NextResponse.json({ error: 'no file path' }, { status: 400 })

  const sources: { mediaType: 'application/pdf' | 'image/jpeg' | 'image/png'; base64: string }[] = []
  for (const p of paths) {
    const ext = p.split('.').pop()?.toLowerCase() || ''
    const mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' =
      ext === 'pdf' ? 'application/pdf'
      : ext === 'png' ? 'image/png'
      : 'image/jpeg'
    const { data: signed } = await admin.storage.from('coach-bloodtest').createSignedUrl(p, 300)
    if (!signed?.signedUrl) return NextResponse.json({ error: `cannot sign url for ${p}` }, { status: 500 })
    const fileRes = await fetch(signed.signedUrl)
    if (!fileRes.ok) return NextResponse.json({ error: `cannot fetch file ${p}` }, { status: 500 })
    const buf = Buffer.from(await fileRes.arrayBuffer())
    sources.push({ mediaType, base64: buf.toString('base64') })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const startTs = Date.now()
  let extracted: any = null
  const aiMeta: any = { model: 'claude-haiku-4-5-20251001', duration_ms: 0, input_tokens: 0, output_tokens: 0, sources_count: sources.length }

  try {
    const content: any[] = sources.map((s) => (
      s.mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: s.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: s.mediaType, data: s.base64 } }
    ))
    content.push({ type: 'text', text: 'Extrais le bilan en JSON strict comme indiqué.' })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })
    aiMeta.duration_ms = Date.now() - startTs
    aiMeta.input_tokens = response.usage.input_tokens
    aiMeta.output_tokens = response.usage.output_tokens

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('no text in claude response')
    let txt = textBlock.text.trim()
    if (txt.startsWith('```')) txt = txt.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    extracted = JSON.parse(txt)
    if (!extracted || !Array.isArray(extracted.markers)) throw new Error('invalid JSON shape from claude')
  } catch (e: any) {
    console.error('[bloodtest/extract] claude error', e)
    aiMeta.error = e.message || String(e)
    await admin.from('bloodtest_uploads').update({ ai_extraction_meta: aiMeta }).eq('id', upload_id)
    return NextResponse.json({ error: 'extraction failed', detail: aiMeta.error }, { status: 502 })
  }

  const { error: updErr } = await admin
    .from('bloodtest_uploads')
    .update({
      extracted_data: extracted,
      ai_extraction_meta: aiMeta,
      dated_at: extracted.detected_dated_at || null,
    })
    .eq('id', upload_id)
  if (updErr) {
    console.error('[bloodtest/extract] update', updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ extracted, ai_meta: aiMeta })
}
