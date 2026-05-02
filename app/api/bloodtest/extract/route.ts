import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { MARKERS } from '@/lib/bloodtestCatalog'

export const runtime = 'nodejs'
export const maxDuration = 120

function buildCatalogBlock(customMarkers: { marker_key: string; label: string; unit_canonical: string }[]): string {
  const standard = MARKERS.map((m) =>
    `- ${m.key} | ${m.label} | unit_canonical: ${m.unit_canonical} | aliases: ${m.unit_aliases.join(', ') || '(aucun)'}`
  ).join('\n')
  const custom = customMarkers.length > 0
    ? '\n\nMarkers custom du coach :\n' + customMarkers.map((c) =>
        `- ${c.marker_key} | ${c.label} | unit_canonical: ${c.unit_canonical}`
      ).join('\n')
    : ''
  return `CATALOGUE MOMENTUM (clé interne | label | unité canonique | alias d'unités) :\n${standard}${custom}`
}

const SYSTEM_INSTRUCTIONS = `Tu es un expert en biologie médicale qui extrait des valeurs de prises de sang depuis des PDFs ou screenshots de bilans sanguins en français, et qui mappe chaque valeur vers le catalogue Momentum.

# OUTPUT
Tu retournes UNIQUEMENT un JSON strict valide (pas de markdown, pas de prose, pas de \`\`\`) :

{
  "detected_dated_at": "YYYY-MM-DD" | null,
  "markers": [
    {
      "raw_label": "string (label exact du PDF, ex: 'L.H.', 'Cholestérol total')",
      "value": number | null,
      "unit": "string | null (unité brute telle que dans le PDF)",
      "lab_reference_range": "string optional (plage labo, ex: '0.40-5.330')",
      "marker_key": "string from catalog | null",
      "value_canonical": number | null,
      "unit_canonical": "string | null",
      "matched_by_ai": boolean,
      "below_detection": boolean (optional, true si valeur source était '<X'),
      "above_detection": boolean (optional, true si valeur source était '>X')
    }
  ]
}

# RÈGLES D'EXTRACTION (CRITIQUES — RELIS AVANT DE COMMENCER)

## 1. Exhaustivité — extrais TOUS les markers
- Parcours CHAQUE page, CHAQUE section (Hématologie, Hormonologie, Biochimie, etc.)
- Inclus les markers calculés (LDL, NON-HDL, Coefficient de saturation, DFG, etc.)
- Inclus les markers transmis à un autre labo s'ils ont une valeur ailleurs dans le document (ex: bilan Cerba en fin de PDF)
- Si un marker apparaît UNE FOIS dans le document, il doit être dans le JSON. Aucune omission tolérée.
- À la fin, COMPTE mentalement le nombre de lignes "valeur" dans le PDF original et compare au nombre de markers extraits. Ils doivent être proches.

## 2. Valeurs sous/au-dessus du seuil de détection — JAMAIS null
Quand une valeur est de la forme \`<X\` ou \`>X\` (ex: "<0.2 mUI/ml", ">100 ng/mL") :
- value = X (le nombre numérique, pas null)
- below_detection = true si "<", above_detection = true si ">"
- unit, marker_key etc. sont remplis normalement
- Exemple : "L.H. <0.2 mUI/ml" → \`{ "raw_label": "L.H.", "value": 0.2, "unit": "mUI/ml", "below_detection": true, "marker_key": "lh", ... }\`

## 3. Bilans dual-unit (TRÈS IMPORTANT — source d'erreurs fréquentes)
Beaucoup de bilans français listent une valeur sur DEUX lignes consécutives, en deux unités :
\`\`\`
Cholestérol total       1.57   g/l
                        4.05   mmol/l
\`\`\`
\`\`\`
Testostérone libre      187,7  pmol/l
                        54,1   pg/ml
\`\`\`
Règles :
- Tu produis UNE SEULE entrée par marker (pas une par unité)
- Tu prends la valeur dans l'unité canonique du catalogue (ou la plus proche). Si le catalogue dit "ng/ml" et le PDF a "pmol/l + pg/ml" : tu utilises pg/ml dans value et value_canonical (pg/ml ≈ ng/ml/1000, attention).
- Si aucune des deux unités du PDF ne matche unit_canonical : convertis. Sinon copie unit_canonical du catalogue.
- NE JAMAIS confondre la valeur d'une unité avec celle d'une autre. "187,7 pmol/l / 54,1 pg/ml" → value=54,1 (pg/ml), JAMAIS 5,41 ou 187,7 ou autre.
- raw_label = label du marker (ligne du dessus), pas la deuxième ligne d'unité.

## 4. Format français des nombres
- La VIRGULE est le séparateur DÉCIMAL en français. "54,1" = cinquante-quatre virgule un = 54.1.
- Le POINT peut aussi être décimal selon le labo. "1.572" = 1.572.
- Espace ou point comme séparateur de milliers : "3 020 ng/ml" = 3020. "3.020" = 3020 SI contexte (ex: SDHEA en ng/ml). Utilise le contexte (plage labo, ordre de grandeur attendu).
- Convertis tous les nombres dans le format JSON standard (point décimal) : "54,1" → 54.1.

## 5. Mapping vers le catalogue
- Pour chaque marker, cherche la marker_key dans le catalogue ci-dessous (plus bas dans le system prompt) en t'appuyant sur le label ET les alias d'unités.
- Si tu matches : matched_by_ai = true, value_canonical = la valeur convertie dans unit_canonical, unit_canonical = la valeur du catalogue.
- Si tu ne matches pas : marker_key = null, matched_by_ai = false, value_canonical = null, unit_canonical = null. La valeur reste dans value/unit raw.
- Pour les markers avec plusieurs candidats (ex: "Sodium" pourrait être "sodium" ou "sodium_plasmatique"), prends celui dont l'unité canonique correspond.

## 6. Conversions courantes (applique-les)
- Vit D : 1 ng/mL = 2.5 nmol/L (donc 25 nmol/L = 10 ng/mL)
- Glycémie : 1 g/L = 5.55 mmol/L
- Cholestérol : 1 g/L = 2.586 mmol/L (factor 2.59 pour LDL/HDL en France)
- Créatinine : 1 mg/L = 8.84 µmol/L (donc 11.4 mg/L = 100.7 µmol/L)
- Fer sérique : 1 µg/dL = 0.179 µmol/L
- Testostérone : 1 ng/mL = 3.467 nmol/L
- Estradiol : 1 pg/mL = 3.671 pmol/L
- Si tu ne connais pas la conversion exacte avec certitude : value_canonical = value (sans conversion) et signale dans notes.

## 7. Markers prioritaires
Le coach a indiqué ses markers suivis (tracked_markers, listés plus bas dans le user message). Pour ces markers, sois PARTICULIÈREMENT VIGILANT :
- Vérifie deux fois leur présence dans le PDF
- En cas de doute sur le matching, privilégie le mapping vers un tracked_marker plutôt que null
- Mais ne FORCE PAS un matching erroné

# RÈGLES D'OUTPUT
- detected_dated_at = date du PRÉLÈVEMENT (pas de l'édition du document)
- Si plusieurs screenshots/pages sont fournis pour le même bilan : fusionne en UNE liste de markers (dédoublonne si un marker apparaît sur plusieurs pages avec la même valeur)
- raw_label : conserve la casse, ponctuation, parenthèses du PDF (ex: "Transaminases GOT (ASAT)")
- JSON valide strict, pas de virgule trailing, pas de commentaire`

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
    ? `MARKERS PRIORITAIRES SUIVIS POUR CET ATHLÈTE (vigilance maximale) : ${tracked.join(', ')}`
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
  const MODEL = 'claude-sonnet-4-6'
  const aiMeta: any = { model: MODEL, duration_ms: 0, input_tokens: 0, output_tokens: 0, sources_count: sources.length }

  try {
    const userContent: any[] = sources.map((s) => (
      s.mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: s.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: s.mediaType, data: s.base64 } }
    ))
    userContent.push({
      type: 'text',
      text: `${trackedBlock}\n\nExtrais TOUS les marqueurs du document(s) en JSON strict comme indiqué dans le system prompt. Vérifie deux fois les markers prioritaires et les valeurs '<X' / '>X'. Aucune omission.`,
    })

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16_000,
      system: `${SYSTEM_INSTRUCTIONS}\n\n${catalogBlock}`,
      messages: [{ role: 'user', content: userContent }],
    })
    aiMeta.duration_ms = Date.now() - startTs
    aiMeta.input_tokens = response.usage.input_tokens
    aiMeta.output_tokens = response.usage.output_tokens

    if (response.stop_reason === 'max_tokens') {
      throw new Error(`Réponse tronquée (${response.usage.output_tokens} tokens output) — bilan trop long, réduire le nombre de screenshots`)
    }
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('no text in claude response')
    let txt = textBlock.text.trim()
    if (txt.startsWith('```')) txt = txt.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    try {
      extracted = JSON.parse(txt)
    } catch (parseErr: any) {
      throw new Error(`JSON invalide: ${parseErr.message} — extrait: ${txt.slice(0, 200)}…`)
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
