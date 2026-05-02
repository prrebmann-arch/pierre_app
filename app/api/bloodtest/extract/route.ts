import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { MARKERS } from '@/lib/bloodtestCatalog'

export const runtime = 'nodejs'
export const maxDuration = 60

// Catalogue stable → cache ephemeral pour réduire le coût input ~10×.
function buildCatalogBlock(customMarkers: { marker_key: string; label: string; unit_canonical: string }[]): string {
  const standard = MARKERS.map((m) =>
    `- ${m.key} | ${m.label} | unit_canonical: ${m.unit_canonical} | aliases: ${m.unit_aliases.join(', ') || '(aucun)'}`
  ).join('\n')
  const custom = customMarkers.length > 0
    ? '\n\nMarkers custom du coach :\n' + customMarkers.map((c) =>
        `- ${c.marker_key} | ${c.label} | unit_canonical: ${c.unit_canonical}`
      ).join('\n')
    : ''
  return `Catalogue Momentum (clé interne | label | unité canonique | alias d'unités) :\n${standard}${custom}`
}

const SYSTEM_INSTRUCTIONS = `Tu es un assistant qui extrait des valeurs de prises de sang depuis des PDFs ou des screenshots de bilan sanguin en français, et qui mappe chaque valeur vers le catalogue Momentum fourni.

Tu retournes UNIQUEMENT un JSON strict valide (pas de markdown, pas de prose) :

{
  "detected_dated_at": "YYYY-MM-DD" | null,
  "markers": [
    {
      "raw_label": "string",
      "value": number | null,
      "unit": "string" | null,
      "lab_reference_range": "string optional",
      "marker_key": "string from catalog | null",
      "value_canonical": number | null,
      "unit_canonical": "string | null",
      "matched_by_ai": boolean
    }
  ]
}

Règles :
- Extrais TOUS les marqueurs présents, sans filtrer.
- Pour chaque marker, essaie de trouver la \`marker_key\` correspondante dans le catalogue ci-dessous, en t'appuyant sur le label ET sur les alias d'unités.
- Si tu n'es pas certain (label trop ambigu, marker absent du catalogue) : marker_key = null, matched_by_ai = false, value_canonical = null, unit_canonical = null.
- Si tu matches : matched_by_ai = true, value_canonical = la valeur convertie dans unit_canonical (ex: 25 µg/L Vit D → 10 ng/mL), unit_canonical = la valeur canonique du catalogue.
- Pour les conversions standard (µg/L ↔ ng/mL pour Vit D, mmol/L ↔ mg/dL pour glucose, etc.) applique la conversion. Si l'unité est inconnue ou si la conversion n'est pas standard : conserve value_canonical = value et unit_canonical = unit_canonical_du_catalogue (le coach corrigera).
- Si valeur illisible : value = null, value_canonical = null, mais marker_key peut être set.
- Conserve aussi l'unité telle qu'écrite dans la source dans le champ unit (raw).
- Le coach a indiqué ses markers prioritaires (tracked_markers) plus bas — tu peux ÊTRE PLUS AGRESSIF sur le matching pour ceux-là (priorité aux mappings de tracked_markers en cas de doute).
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

  const { upload_id, force } = await req.json()
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
    .from('athletes').select('user_id, coach_id, bloodtest_tracked_markers')
    .eq('id', upload.athlete_id).single()
  if (!ath) return NextResponse.json({ error: 'athlete not found' }, { status: 404 })
  if (ath.user_id !== user.id && ath.coach_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (upload.extracted_data && !force) return NextResponse.json({ already_extracted: true })

  const { data: customMarkers } = await admin
    .from('coach_custom_markers')
    .select('marker_key, label, unit_canonical')
    .eq('coach_id', ath.coach_id)
    .is('archived_at', null)

  const tracked: string[] = ath.bloodtest_tracked_markers || []
  const catalogBlock = buildCatalogBlock(customMarkers || [])
  const trackedBlock = tracked.length > 0
    ? `Markers prioritaires suivis pour cet athlète : ${tracked.join(', ')}`
    : 'Aucun marker prioritaire défini pour cet athlète.'

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
  const aiMeta: any = { model: 'claude-haiku-4-5-20251001', duration_ms: 0, input_tokens: 0, output_tokens: 0, sources_count: sources.length, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

  try {
    const userContent: any[] = sources.map((s) => (
      s.mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: s.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: s.mediaType, data: s.base64 } }
    ))
    userContent.push({ type: 'text', text: `${trackedBlock}\n\nExtrais le bilan en JSON strict comme indiqué.` })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16_000,
      system: `${SYSTEM_INSTRUCTIONS}\n\n${catalogBlock}`,
      messages: [{ role: 'user', content: userContent }],
    })
    aiMeta.duration_ms = Date.now() - startTs
    aiMeta.input_tokens = response.usage.input_tokens
    aiMeta.output_tokens = response.usage.output_tokens
    aiMeta.cache_creation_input_tokens = (response.usage as any).cache_creation_input_tokens || 0
    aiMeta.cache_read_input_tokens = (response.usage as any).cache_read_input_tokens || 0

    if (response.stop_reason === 'max_tokens') {
      throw new Error(`Réponse tronquée (${response.usage.output_tokens} tokens output) — bilan trop long, réduire le nombre de screenshots ou splitter en plusieurs uploads`)
    }
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('no text in claude response')
    let txt = textBlock.text.trim()
    if (txt.startsWith('```')) txt = txt.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    try {
      extracted = JSON.parse(txt)
    } catch (parseErr: any) {
      throw new Error(`JSON invalide de Claude: ${parseErr.message} — extrait: ${txt.slice(0, 200)}…`)
    }
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
