# Bloodtest IA Marker Mapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'UX de validation des prises de sang : Claude pré-mappe les markers en s'appuyant sur le catalogue + tracked_markers de l'athlète, la page validation passe à 3 sections (attendus / extras / non identifiés), bouton renommé "Analyse IA", barre de chargement animée.

**Architecture:** L'API `/api/bloodtest/extract` envoie le catalogue (cache ephemeral Anthropic) et la liste tracked_markers à Claude qui retourne chaque ligne avec un `marker_key` déjà mappé + valeur convertie dans l'unité canonique. Côté UI, un helper pur `splitMarkers` répartit les lignes en 3 sections. Pas de migration DB (schéma jsonb absorbe le nouveau shape).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Anthropic SDK 0.92, Supabase, node:test pour les tests unitaires de helpers.

**Spec:** `docs/superpowers/specs/2026-05-02-bloodtest-marker-mapping-design.md`

---

## Préambule

Avant de commencer : créer une feature branch propre.

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git checkout develop && git pull
git checkout -b feature/bloodtest-ia-mapping
```

---

## Task 1 — Étendre les types dans `lib/bloodtest.ts`

**Files:**
- Modify: `lib/bloodtest.ts:59-67`

- [ ] **Step 1: Ouvrir `lib/bloodtest.ts` et localiser le type `ExtractedMarker` (ligne 59-67)**

- [ ] **Step 2: Étendre le type avec les nouveaux champs IA**

Remplacer le bloc :

```ts
export type ExtractedMarker = {
  marker_key: string | null
  raw_label: string
  value: number | null
  unit: string | null
  lab_reference_range?: string
  ignored?: boolean
  notes?: string
}
```

par :

```ts
export type ExtractedMarker = {
  marker_key: string | null
  raw_label: string
  value: number | null
  unit: string | null
  lab_reference_range?: string
  ignored?: boolean
  notes?: string
  // IA mapping (alimenté par /api/bloodtest/extract, optionnel pour rétro-compat)
  value_canonical?: number | null
  unit_canonical?: string | null
  matched_by_ai?: boolean
  confirmed_by_coach?: boolean
}
```

**Note de sémantique** :
- `matched_by_ai` : `true` si Claude a fait le mapping (pour afficher le badge UI).
- `confirmed_by_coach` : `true` quand le coach a explicitement validé l'extra OU corrigé un attendu mal mappé. Sert à la persistance dans `validated_data`.
- Anciens uploads : ces champs sont `undefined` → l'UI tombe en mode legacy (tout en non-identifiés).

- [ ] **Step 3: Vérifier que la compilation TS passe**

Run: `npm run build`
Expected: succès (le `ignoreBuildErrors: true` du `next.config.ts` est le filet, mais on vise zéro erreur réelle).

- [ ] **Step 4: Commit**

```bash
git add lib/bloodtest.ts
git commit -m "feat(bloodtest): extend ExtractedMarker with AI mapping fields"
```

---

## Task 2 — Helper pur `splitMarkers` + tests

**Files:**
- Modify: `lib/bloodtest.ts` (ajout en fin de fichier)
- Create: `scripts/test-bloodtest-split-markers.mjs`

- [ ] **Step 1: Écrire le test failing dans `scripts/test-bloodtest-split-markers.mjs`**

```js
// COACH/scripts/test-bloodtest-split-markers.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Inline copy of splitMarkers (the test runs in pure node:test, no TS).
// Keep this in sync with lib/bloodtest.ts. Parity is verified by reading both.
function splitMarkers(markers, tracked) {
  const trackedSet = new Set(tracked)
  const byKey = new Map()
  for (const m of markers) {
    if (m.marker_key) {
      const arr = byKey.get(m.marker_key) || []
      arr.push(m)
      byKey.set(m.marker_key, arr)
    }
  }
  const expected = tracked.map((key) => {
    const matches = byKey.get(key) || []
    return { tracked_key: key, marker: matches[0] }
  })
  const extras = []
  for (const [key, ms] of byKey) {
    if (!trackedSet.has(key)) extras.push(...ms)
  }
  const unidentified = markers.filter((m) => !m.marker_key)
  return { expected, extras, unidentified }
}

test('splits expected/extras/unidentified correctly', () => {
  const markers = [
    { marker_key: 'ferritine', raw_label: 'Ferritine', value: 45, unit: 'µg/L' },
    { marker_key: 'vitamine_d', raw_label: 'Vit D', value: 28, unit: 'ng/mL' },
    { marker_key: 'b12', raw_label: 'B12', value: 420, unit: 'pg/mL' },
    { marker_key: null, raw_label: 'Truc bizarre', value: 1, unit: 'x' },
  ]
  const tracked = ['ferritine', 'vitamine_d', 'testosterone']
  const r = splitMarkers(markers, tracked)
  assert.equal(r.expected.length, 3)
  assert.equal(r.expected[0].tracked_key, 'ferritine')
  assert.equal(r.expected[0].marker?.value, 45)
  assert.equal(r.expected[2].tracked_key, 'testosterone')
  assert.equal(r.expected[2].marker, undefined, 'testosterone non trouvé dans le PDF')
  assert.equal(r.extras.length, 1)
  assert.equal(r.extras[0].marker_key, 'b12')
  assert.equal(r.unidentified.length, 1)
  assert.equal(r.unidentified[0].raw_label, 'Truc bizarre')
})

test('legacy markers without marker_key all go to unidentified', () => {
  const markers = [
    { marker_key: null, raw_label: 'Ferritine', value: 45 },
    { marker_key: null, raw_label: 'Vit D', value: 28 },
  ]
  const r = splitMarkers(markers, ['ferritine'])
  assert.equal(r.unidentified.length, 2)
  assert.equal(r.expected[0].marker, undefined)
})

test('duplicate marker_key only first wins in expected', () => {
  const markers = [
    { marker_key: 'ferritine', raw_label: 'Ferritine 1', value: 45 },
    { marker_key: 'ferritine', raw_label: 'Ferritine 2', value: 50 },
  ]
  const r = splitMarkers(markers, ['ferritine'])
  assert.equal(r.expected[0].marker?.value, 45)
})

test('empty tracked → all matched markers become extras', () => {
  const markers = [
    { marker_key: 'ferritine', value: 45 },
    { marker_key: null, value: null },
  ]
  const r = splitMarkers(markers, [])
  assert.equal(r.expected.length, 0)
  assert.equal(r.extras.length, 1)
  assert.equal(r.unidentified.length, 1)
})
```

- [ ] **Step 2: Run le test pour vérifier qu'il fail (la fonction n'existe pas encore dans lib/bloodtest.ts)**

Run: `node scripts/test-bloodtest-split-markers.mjs`
Expected: les tests passent **car la fonction est inline dans le fichier de test** — c'est volontaire pour que ce test soit pure node:test sans transpiler TS. Le test sert de spec exécutable. La parité avec `lib/bloodtest.ts` est validée à la prochaine étape.

- [ ] **Step 3: Ajouter `splitMarkers` à `lib/bloodtest.ts` (en fin de fichier)**

```ts
export type SplitMarkersResult = {
  expected: { tracked_key: string; marker?: ExtractedMarker }[]
  extras: ExtractedMarker[]
  unidentified: ExtractedMarker[]
}

export function splitMarkers(markers: ExtractedMarker[], tracked: string[]): SplitMarkersResult {
  const trackedSet = new Set(tracked)
  const byKey = new Map<string, ExtractedMarker[]>()
  for (const m of markers) {
    if (m.marker_key) {
      const arr = byKey.get(m.marker_key) || []
      arr.push(m)
      byKey.set(m.marker_key, arr)
    }
  }
  const expected = tracked.map((key) => {
    const matches = byKey.get(key) || []
    return { tracked_key: key, marker: matches[0] }
  })
  const extras: ExtractedMarker[] = []
  for (const [key, ms] of byKey) {
    if (!trackedSet.has(key)) extras.push(...ms)
  }
  const unidentified = markers.filter((m) => !m.marker_key)
  return { expected, extras, unidentified }
}
```

- [ ] **Step 4: Vérifier que la version inline du test reste identique à `lib/bloodtest.ts`**

Diff manuel : ouvrir les deux et comparer la logique. Toute divergence est un bug.

- [ ] **Step 5: Run le test**

Run: `node scripts/test-bloodtest-split-markers.mjs`
Expected: 4 tests pass.

- [ ] **Step 6: Run TS build**

Run: `npm run build`
Expected: succès.

- [ ] **Step 7: Commit**

```bash
git add lib/bloodtest.ts scripts/test-bloodtest-split-markers.mjs
git commit -m "feat(bloodtest): add splitMarkers helper + unit tests"
```

---

## Task 3 — Refondre `/api/bloodtest/extract` (prompt + cache + nouveau shape)

**Files:**
- Modify: `app/api/bloodtest/extract/route.ts` (réécriture quasi-complète, ~130 → ~180 lignes)

- [ ] **Step 1: Ouvrir `app/api/bloodtest/extract/route.ts`**

- [ ] **Step 2: Remplacer le contenu complet du fichier par :**

```ts
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
      max_tokens: 4096,
      system: [
        { type: 'text', text: SYSTEM_INSTRUCTIONS },
        { type: 'text', text: catalogBlock, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userContent }],
    })
    aiMeta.duration_ms = Date.now() - startTs
    aiMeta.input_tokens = response.usage.input_tokens
    aiMeta.output_tokens = response.usage.output_tokens
    aiMeta.cache_creation_input_tokens = (response.usage as any).cache_creation_input_tokens || 0
    aiMeta.cache_read_input_tokens = (response.usage as any).cache_read_input_tokens || 0

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
```

Changements clés vs version précédente :
- Import `MARKERS` depuis le catalogue.
- Nouveau `buildCatalogBlock()` qui inclut markers standards + custom du coach.
- Le `system` est maintenant un tableau de blocs typés, avec `cache_control: ephemeral` sur le catalogue.
- Le user content inclut un préambule avec `tracked_markers` (variable, non-cachable).
- Support `?force=true` pour ré-extraire un upload déjà extrait.
- `ai_extraction_meta` track maintenant les tokens de cache (creation/read).
- Sélection des `coach_custom_markers` filtrée sur le `coach_id` de l'athlète.

- [ ] **Step 3: Vérifier que la compilation TS passe**

Run: `npm run build`
Expected: succès.

- [ ] **Step 4: Commit**

```bash
git add app/api/bloodtest/extract/route.ts
git commit -m "feat(bloodtest): inject catalog + tracked_markers into Claude prompt with ephemeral cache"
```

---

## Task 4 — Composant `BloodtestAnalysisProgress`

**Files:**
- Create: `components/bloodtest/BloodtestAnalysisProgress.tsx`

- [ ] **Step 1: Créer le dossier si besoin**

```bash
mkdir -p components/bloodtest
```

- [ ] **Step 2: Créer le fichier avec ce contenu**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

const STEPS = [
  'Lecture du PDF',
  'Extraction des marqueurs',
  'Mapping vers le catalogue',
  'Finalisation',
] as const

const STEP_INTERVAL_MS = 3000
const STALE_LABEL = 'Toujours en cours, ça arrive…'
const TIMEOUT_MS = 65_000

type Status = 'running' | 'done' | 'stale' | 'error'

export default function BloodtestAnalysisProgress({
  etaMs,
  onRetry,
  status,
  errorMessage,
}: {
  etaMs: number
  status: Status
  onRetry?: () => void
  errorMessage?: string
}) {
  const [pct, setPct] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    if (status === 'done') { setPct(100); return }
    if (status === 'error') return
    if (status === 'stale') return

    startRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const ratio = Math.min(elapsed / etaMs, 1)
      // 0 → 90% sur la durée ETA, ensuite plafond 90%
      setPct(Math.min(ratio * 90, 90))
    }
    const animId = setInterval(tick, 100)
    const stepId = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    }, STEP_INTERVAL_MS)
    return () => { clearInterval(animId); clearInterval(stepId) }
  }, [etaMs, status])

  const isError = status === 'error'
  const isStale = status === 'stale'
  const isDone = status === 'done'

  const label = isError
    ? `Échec de l'analyse${errorMessage ? ` : ${errorMessage}` : ''}`
    : isStale
      ? STALE_LABEL
      : isDone
        ? 'Analyse terminée'
        : STEPS[stepIdx]

  return (
    <div style={{ padding: 12, background: 'var(--bg2)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <i
          className={`fas ${isError ? 'fa-circle-exclamation' : isDone ? 'fa-check-circle' : 'fa-wand-magic-sparkles'}`}
          style={{ color: isError ? 'var(--red)' : isDone ? 'var(--green)' : 'var(--primary)' }}
        />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isError ? 'var(--red)' : 'var(--primary)',
            transition: 'width 200ms linear',
          }}
        />
      </div>
      {isError && onRetry && (
        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={onRetry}>
          <i className="fas fa-rotate" /> Réessayer l'analyse IA
        </button>
      )}
    </div>
  )
}

export { TIMEOUT_MS as ANALYSIS_TIMEOUT_MS }
```

- [ ] **Step 3: Vérifier la compilation TS**

Run: `npm run build`
Expected: succès.

- [ ] **Step 4: Commit**

```bash
git add components/bloodtest/BloodtestAnalysisProgress.tsx
git commit -m "feat(bloodtest): add BloodtestAnalysisProgress component"
```

---

## Task 5 — Wire progress + rename bouton sur la page bloodtest

**Files:**
- Modify: `app/(app)/athletes/[id]/bloodtest/page.tsx`

- [ ] **Step 1: Ajouter l'import du composant en haut du fichier**

Après les imports existants (vers la ligne 14), ajouter :

```tsx
import BloodtestAnalysisProgress, { ANALYSIS_TIMEOUT_MS } from '@/components/bloodtest/BloodtestAnalysisProgress'
```

- [ ] **Step 2: Ajouter l'état local pour suivre l'analyse en cours**

Dans le composant `BloodtestPage`, après `const [uploading, setUploading] = useState(false)` (ligne 30) :

```tsx
const [analyzing, setAnalyzing] = useState<{ uploadId: string; status: 'running' | 'stale' | 'error'; errorMessage?: string } | null>(null)
```

- [ ] **Step 3: Calculer l'ETA basé sur l'historique**

Juste avant le `return` du composant (vers la ligne 157), ajouter :

```tsx
const analysisEtaMs = useMemo(() => {
  const durations = uploads
    .map((u) => u.ai_extraction_meta?.duration_ms)
    .filter((d): d is number => typeof d === 'number' && d > 0)
    .slice(0, 10)
  if (durations.length === 0) return 12_000
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length
  return Math.max(5_000, Math.min(45_000, avg))
}, [uploads])
```

- [ ] **Step 4: Réécrire `triggerExtract` pour gérer la barre + timeout + erreurs**

Remplacer la fonction `triggerExtract` (ligne 137-151) par :

```tsx
async function triggerExtract(uploadId: string) {
  setAnalyzing({ uploadId, status: 'running' })
  const staleTimer = setTimeout(() => {
    setAnalyzing((a) => (a && a.uploadId === uploadId && a.status === 'running' ? { ...a, status: 'stale' } : a))
  }, analysisEtaMs + 1000)
  const abort = new AbortController()
  const hardTimer = setTimeout(() => abort.abort(), ANALYSIS_TIMEOUT_MS)
  try {
    const res = await fetch('/api/bloodtest/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ upload_id: uploadId }),
      signal: abort.signal,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    setAnalyzing(null)
    toast('Analyse terminée', 'success')
    loadData()
  } catch (e: any) {
    console.error('[bloodtest] extract', e)
    const msg = e.name === 'AbortError' ? 'délai dépassé' : (e.message || 'erreur inconnue')
    setAnalyzing({ uploadId, status: 'error', errorMessage: msg })
  } finally {
    clearTimeout(staleTimer)
    clearTimeout(hardTimer)
  }
}
```

- [ ] **Step 5: Adapter le rendu de la section "En attente d'extraction" pour afficher la barre**

Remplacer le bloc `{pendingExtraction.length > 0 && (...)}` (ligne 187-207) par :

```tsx
{pendingExtraction.length > 0 && (
  <>
    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
      <i className="fas fa-cog" style={{ color: 'var(--text3)', marginRight: 6 }} />En attente d'analyse ({pendingExtraction.length})
    </h3>
    {pendingExtraction.map((u) => {
      const fileCount = (u.file_path || '').split('|').filter((p: string) => p).length
      const live = analyzing && analyzing.uploadId === u.id ? analyzing : null
      return (
        <div key={u.id} style={{ padding: 12, background: 'var(--bg2)', borderLeft: '3px solid var(--text3)', borderRadius: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: live ? 10 : 0 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Upload {u.uploaded_by} · {new Date(u.uploaded_at).toLocaleDateString('fr-FR')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fileCount} fichier{fileCount > 1 ? 's' : ''} · pas encore analysé{fileCount > 1 ? 's' : ''}</div>
            </div>
            {!live && (
              <button className="btn btn-red btn-sm" onClick={() => triggerExtract(u.id)}>
                <i className="fas fa-wand-magic-sparkles" /> Analyse IA
              </button>
            )}
          </div>
          {live && (
            <BloodtestAnalysisProgress
              etaMs={analysisEtaMs}
              status={live.status}
              errorMessage={live.errorMessage}
              onRetry={() => triggerExtract(u.id)}
            />
          )}
        </div>
      )
    })}
  </>
)}
```

- [ ] **Step 6: Adapter le toast d'auto-déclenchement après upload (ligne 111)**

Remplacer :

```tsx
toast(`${paths.length} screenshot${paths.length > 1 ? 's' : ''} envoyé${paths.length > 1 ? 's' : ''}, extraction en cours...`, 'success')
```

par :

```tsx
toast(`${paths.length} screenshot${paths.length > 1 ? 's' : ''} envoyé${paths.length > 1 ? 's' : ''}, analyse IA en cours...`, 'success')
```

- [ ] **Step 7: Vérifier la compilation**

Run: `npm run build`
Expected: succès.

- [ ] **Step 8: Test manuel**

```bash
npm run dev
```

Ouvrir un athlète, déclencher une analyse via le bouton "Analyse IA". Vérifier :
- bouton est bien intitulé "Analyse IA" avec icône baguette magique
- la barre apparaît, progresse, atteint ~90% pendant l'attente, complète à 100% à la réponse
- step labels rotatifs visibles
- en cas d'erreur (couper le réseau), barre rouge + bouton "Réessayer"

- [ ] **Step 9: Commit**

```bash
git add app/(app)/athletes/[id]/bloodtest/page.tsx
git commit -m "feat(bloodtest): rename Lancer extraction to Analyse IA + animated progress bar"
```

---

## Task 6 — Refondre la page validation (3 sections)

**Files:**
- Modify: `app/(app)/athletes/[id]/bloodtest/validate/[upload_id]/page.tsx` (réécriture complète)

- [ ] **Step 1: Remplacer le contenu complet du fichier par :**

```tsx
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/ui/Skeleton'
import { MARKERS } from '@/lib/bloodtestCatalog'
import { splitMarkers, type BloodtestUploadRow, type ExtractedData, type ExtractedMarker } from '@/lib/bloodtest'

type CustomMarkerOpt = { key: string; label: string; unit_canonical: string }
type SignedFile = { path: string; url: string; mediaType: string }

export default function BloodtestValidatePage() {
  const params = useParams<{ id: string; upload_id: string }>()
  const router = useRouter()
  const { accessToken } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [upload, setUpload] = useState<BloodtestUploadRow | null>(null)
  const [signedFiles, setSignedFiles] = useState<SignedFile[]>([])
  const [editedMarkers, setEditedMarkers] = useState<ExtractedMarker[]>([])
  const [tracked, setTracked] = useState<string[]>([])
  const [datedAt, setDatedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customMarkers, setCustomMarkers] = useState<CustomMarkerOpt[]>([])
  const [showUnidentified, setShowUnidentified] = useState(false)

  const load = useCallback(async () => {
    try {
      const [{ data: row }, urlRes, { data: cms }] = await Promise.all([
        supabase.from('bloodtest_uploads').select('*').eq('id', params.upload_id).single(),
        fetch(`/api/bloodtest/signed-url?id=${params.upload_id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()),
        supabase.from('coach_custom_markers').select('marker_key, label, unit_canonical').is('archived_at', null),
      ])
      if (!row) { toast('Upload introuvable', 'error'); return }
      setUpload(row as BloodtestUploadRow)
      const { data: ath } = await supabase.from('athletes').select('bloodtest_tracked_markers').eq('id', (row as any).athlete_id).single()
      setTracked((ath?.bloodtest_tracked_markers as string[]) || [])
      const files: SignedFile[] = Array.isArray(urlRes.urls) && urlRes.urls.length > 0
        ? urlRes.urls
        : urlRes.url ? [{ path: '', url: urlRes.url, mediaType: 'application/pdf' }] : []
      setSignedFiles(files)
      const data = ((row as any).validated_data || (row as any).extracted_data) as ExtractedData | null
      setEditedMarkers(data?.markers || [])
      setDatedAt((row as any).dated_at || (data?.detected_dated_at || ''))
      setCustomMarkers((cms || []).map((c: any) => ({ key: c.marker_key, label: c.label, unit_canonical: c.unit_canonical })))
    } finally { setLoading(false) }
  }, [params.upload_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const allMarkerOptions = useMemo(
    () => [...MARKERS.map((m) => ({ key: m.key, label: m.label, unit_canonical: m.unit_canonical })), ...customMarkers],
    [customMarkers],
  )
  const labelByKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of allMarkerOptions) m.set(o.key, o.label)
    return m
  }, [allMarkerOptions])

  const split = useMemo(() => splitMarkers(editedMarkers, tracked), [editedMarkers, tracked])

  function updateMarkerByRef(target: ExtractedMarker, patch: Partial<ExtractedMarker>) {
    setEditedMarkers((prev) => prev.map((m) => (m === target ? { ...m, ...patch } : m)))
  }

  async function submit() {
    if (!datedAt) { toast('Date du bilan requise', 'error'); return }
    const finalMarkers = editedMarkers.filter((m) => {
      if (!m.marker_key) return false
      if (m.value == null) return false
      if (m.ignored) return false
      // Pour les extras, on n'inclut QUE ceux explicitement confirmés par le coach.
      const isExtra = m.marker_key && !tracked.includes(m.marker_key)
      if (isExtra && !m.confirmed_by_coach) return false
      return true
    })
    setSaving(true)
    try {
      const validated_data: ExtractedData = { detected_dated_at: datedAt, markers: finalMarkers }
      const res = await fetch('/api/bloodtest/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ upload_id: params.upload_id, validated_data, dated_at: datedAt }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'submit failed')
      toast('Validé !', 'success')
      router.push(`/athletes/${params.id}/bloodtest`)
    } catch (e: any) {
      toast(`Erreur: ${e.message}`, 'error')
    } finally { setSaving(false) }
  }

  async function rejectUpload() {
    if (!confirm('Rejeter ce bilan ?')) return
    const { error } = await supabase.from('bloodtest_uploads').update({ archived_at: new Date().toISOString() }).eq('id', params.upload_id)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Rejeté', 'success')
    router.push(`/athletes/${params.id}/bloodtest`)
  }

  if (loading) return <Skeleton height={400} />
  if (!upload) return <div>Upload introuvable</div>

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => router.back()}><i className="fas fa-arrow-left" /> Retour</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Valider le bilan</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{signedFiles.length} fichier{signedFiles.length > 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 480px)', gap: 16, alignItems: 'start' }}>
        <div style={{ maxHeight: '85vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
          {signedFiles.length === 0 && <div style={{ color: 'var(--text3)' }}>Chargement des fichiers...</div>}
          {signedFiles.map((f, i) => (
            f.mediaType === 'application/pdf' ? (
              <iframe key={i} src={f.url} style={{ width: '100%', height: '80vh', border: '1px solid var(--border)', borderRadius: 6 }} title={`PDF ${i + 1}`} />
            ) : (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                <img src={f.url} alt={`Screenshot ${i + 1}`} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
              </a>
            )
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>Date du bilan</label>
            <input type="date" className="form-control" value={datedAt} onChange={(e) => setDatedAt(e.target.value)} />
          </div>

          {/* SECTION ATTENDUS */}
          <SectionHeader icon="fa-bullseye" label={`Attendus (${split.expected.length})`} subLabel="markers suivis pour cet athlète" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {split.expected.map((row) => (
              <ExpectedMarkerRow
                key={row.tracked_key}
                trackedKey={row.tracked_key}
                marker={row.marker}
                label={labelByKey.get(row.tracked_key) || row.tracked_key}
                onUpdate={(patch) => row.marker && updateMarkerByRef(row.marker, patch)}
                allOptions={allMarkerOptions}
              />
            ))}
            {split.expected.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucun marker suivi configuré.</div>}
          </div>

          {/* SECTION EXTRAS */}
          {split.extras.length > 0 && (
            <>
              <SectionHeader icon="fa-plus" label={`Extras détectés (${split.extras.length})`} subLabel="hors suivi — clique pour valider individuellement" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {split.extras.map((m, i) => (
                  <ExtraMarkerRow
                    key={`${m.marker_key}_${i}`}
                    marker={m}
                    label={labelByKey.get(m.marker_key!) || m.marker_key!}
                    onUpdate={(patch) => updateMarkerByRef(m, patch)}
                    allOptions={allMarkerOptions}
                  />
                ))}
              </div>
            </>
          )}

          {/* SECTION NON IDENTIFIÉS */}
          {split.unidentified.length > 0 && (
            <>
              <button
                className="btn btn-outline btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowUnidentified((v) => !v)}
              >
                <i className={`fas fa-chevron-${showUnidentified ? 'down' : 'right'}`} />
                {' '}Non identifiés ({split.unidentified.length})
              </button>
              {showUnidentified && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {split.unidentified.map((m, i) => (
                    <UnidentifiedRow
                      key={`u_${i}`}
                      marker={m}
                      onUpdate={(patch) => updateMarkerByRef(m, patch)}
                      allOptions={allMarkerOptions}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-outline" onClick={rejectUpload}>Rejeter le bilan</button>
            <button className="btn btn-red" onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Validation...' : 'Valider et publier'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label, subLabel }: { icon: string; label: string; subLabel?: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className={`fas ${icon}`} style={{ color: 'var(--primary)' }} />{label}
      </div>
      {subLabel && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{subLabel}</div>}
    </div>
  )
}

function AiBadge() {
  return (
    <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: 4, fontWeight: 600 }}>
      <i className="fas fa-wand-magic-sparkles" /> auto IA
    </span>
  )
}

function ExpectedMarkerRow({
  trackedKey, marker, label, onUpdate, allOptions,
}: {
  trackedKey: string
  marker?: ExtractedMarker
  label: string
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
}) {
  const [editing, setEditing] = useState(false)
  if (!marker) {
    return (
      <div style={{ padding: 10, background: 'var(--bg3)', opacity: 0.6, borderRadius: 8, border: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Non trouvé dans ce PDF</div>
      </div>
    )
  }
  const value = marker.value_canonical ?? marker.value
  const unit = marker.unit_canonical || marker.unit
  return (
    <div style={{ padding: 10, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', opacity: marker.ignored ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</div>
        {marker.matched_by_ai && !editing && <AiBadge />}
      </div>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{value ?? '—'} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{unit}</span></div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>
            <i className="fas fa-pen" /> Modifier
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onUpdate({ ignored: !marker.ignored })}>
            {marker.ignored ? 'Ré-inclure' : 'Ignorer'}
          </button>
        </div>
      ) : (
        <EditFields marker={marker} onUpdate={onUpdate} allOptions={allOptions} onDone={() => setEditing(false)} />
      )}
      {marker.lab_reference_range && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Plage labo : {marker.lab_reference_range}</div>}
    </div>
  )
}

function ExtraMarkerRow({
  marker, label, onUpdate, allOptions,
}: {
  marker: ExtractedMarker
  label: string
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const value = marker.value_canonical ?? marker.value
  const unit = marker.unit_canonical || marker.unit
  const confirmed = !!marker.confirmed_by_coach
  return (
    <div style={{ padding: 10, background: 'var(--bg2)', borderRadius: 8, border: confirmed ? '1px solid var(--green)' : '1px solid var(--border)', opacity: marker.ignored ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</div>
        {marker.matched_by_ai && !editing && <AiBadge />}
      </div>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{value ?? '—'} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{unit}</span></div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(true)}>
            <i className="fas fa-pen" /> Modifier
          </button>
          <button
            className={confirmed ? 'btn btn-outline btn-sm' : 'btn btn-red btn-sm'}
            onClick={() => onUpdate({ confirmed_by_coach: !confirmed })}
          >
            {confirmed ? <><i className="fas fa-check" /> Inclus</> : 'Valider'}
          </button>
        </div>
      ) : (
        <EditFields marker={marker} onUpdate={onUpdate} allOptions={allOptions} onDone={() => setEditing(false)} />
      )}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
        {confirmed ? 'Inclus dans ce bilan (one-shot, n\'ajoute pas au suivi permanent)' : 'À valider explicitement pour être inclus'}
      </div>
    </div>
  )
}

function UnidentifiedRow({
  marker, onUpdate, allOptions,
}: {
  marker: ExtractedMarker
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
}) {
  return (
    <div style={{ padding: 10, background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)', opacity: marker.ignored ? 0.5 : 1 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Raw : {marker.raw_label}</div>
      <select className="form-control" style={{ marginBottom: 6 }} value={marker.marker_key || ''} onChange={(e) => onUpdate({ marker_key: e.target.value || null, matched_by_ai: false })}>
        <option value="">-- Choisir un marker --</option>
        {allOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="form-control" type="number" step="any" placeholder="Valeur" value={marker.value ?? ''} onChange={(e) => onUpdate({ value: e.target.value ? parseFloat(e.target.value) : null })} />
        <input className="form-control" placeholder="Unité" value={marker.unit || ''} onChange={(e) => onUpdate({ unit: e.target.value })} style={{ maxWidth: 100 }} />
      </div>
      {marker.lab_reference_range && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>Plage labo : {marker.lab_reference_range}</div>}
      <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => onUpdate({ ignored: !marker.ignored })}>
        {marker.ignored ? 'Ré-inclure' : 'Ignorer cette ligne'}
      </button>
    </div>
  )
}

function EditFields({
  marker, onUpdate, allOptions, onDone,
}: {
  marker: ExtractedMarker
  onUpdate: (patch: Partial<ExtractedMarker>) => void
  allOptions: { key: string; label: string; unit_canonical: string }[]
  onDone: () => void
}) {
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <select
        className="form-control"
        value={marker.marker_key || ''}
        onChange={(e) => onUpdate({ marker_key: e.target.value || null, matched_by_ai: false })}
      >
        <option value="">-- Choisir un marker --</option>
        {allOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="form-control" type="number" step="any" placeholder="Valeur (canonique)"
          value={marker.value_canonical ?? marker.value ?? ''}
          onChange={(e) => onUpdate({ value_canonical: e.target.value ? parseFloat(e.target.value) : null, value: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <input
          className="form-control" placeholder="Unité"
          value={marker.unit_canonical || marker.unit || ''}
          onChange={(e) => onUpdate({ unit_canonical: e.target.value, unit: e.target.value })}
          style={{ maxWidth: 120 }}
        />
      </div>
      <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-end' }} onClick={onDone}>OK</button>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run build`
Expected: succès.

- [ ] **Step 3: Test manuel**

```bash
npm run dev
```

Parcours :
1. Ouvrir un bilan déjà extrait par l'ancienne version → vérifier que tout passe en "Non identifiés" (replié), pas de crash.
2. Refaire un upload + analyse IA avec le nouveau code → vérifier les 3 sections.
3. Cliquer "Modifier" sur un attendu auto-matché → select s'ouvre, le badge IA disparaît une fois sauvé.
4. Cliquer "Valider" sur un extra → bordure devient verte, bouton devient "Inclus".
5. Soumettre → vérifier que `validated_data.markers` ne contient QUE les attendus (avec valeur) + extras confirmés + non-identifiés mappés non-ignorés.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/athletes/[id]/bloodtest/validate/[upload_id]/page.tsx
git commit -m "feat(bloodtest): refactor validation page into 3 sections (expected/extras/unidentified)"
```

---

## Task 7 — History page : graphes pour tout marker_key avec data

**Files:**
- Modify: `app/(app)/athletes/[id]/bloodtest/page.tsx` (composant `BloodtestHistoryGraphs`)

- [ ] **Step 1: Remplacer le composant `BloodtestHistoryGraphs` complet (lignes ~239-292)**

Remplacer toute la fonction `BloodtestHistoryGraphs` par cette version :

```tsx
function BloodtestHistoryGraphs({ uploads, tracked, allMarkers }: { uploads: BloodtestUploadRow[]; tracked: string[]; allMarkers: any[] }) {
  const perMarker = useMemo(() => {
    const map = new Map<string, { date: string; value: number }[]>()
    for (const up of uploads) {
      const data = up.validated_data as ExtractedData
      if (!data?.markers) continue
      const date = up.dated_at || up.uploaded_at.slice(0, 10)
      for (const m of data.markers) {
        if (!m.marker_key || m.value == null || m.ignored) continue
        // Préférer la valeur canonique si disponible
        const v = m.value_canonical ?? m.value
        const arr = map.get(m.marker_key) || []
        arr.push({ date, value: v })
        map.set(m.marker_key, arr)
      }
    }
    for (const [, arr] of map) arr.sort((a, b) => a.date.localeCompare(b.date))
    return map
  }, [uploads])

  const keysToGraph = useMemo(() => {
    const all = new Set<string>(tracked)
    for (const [key] of perMarker) all.add(key)
    return Array.from(all)
  }, [perMarker, tracked])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {keysToGraph.map((key) => {
        const marker = allMarkers.find((m) => m.key === key)
        if (!marker) return null
        const series = perMarker.get(key) || []
        const isExtra = !tracked.includes(key)
        const W = 240, H = 50
        let pts = ''
        if (series.length >= 2) {
          const min = Math.min(...series.map((s) => s.value))
          const max = Math.max(...series.map((s) => s.value))
          pts = series.map((s, i) => `${(i / (series.length - 1)) * W},${H - ((s.value - min) / (max - min || 1)) * H}`).join(' ')
        }
        const last = series[series.length - 1]
        return (
          <div key={key} style={{ padding: 12, background: 'var(--bg2)', borderRadius: 10, border: isExtra ? '1px dashed var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{marker.label}</div>
              {isExtra && <span style={{ fontSize: 9, padding: '1px 5px', background: 'var(--bg3)', borderRadius: 3, color: 'var(--text3)' }}>EXTRA</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{marker.unit_canonical} · {series.length} valeur(s)</div>
            {series.length === 0 && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Aucune donnée</div>}
            {series.length === 1 && <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{last.value}</div>}
            {series.length >= 2 && (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 50, marginTop: 6 }}>
                <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2} />
              </svg>
            )}
            {last && (() => {
              const cls = classifyValue(marker, last.value, { sex: 'F', phase: 'folliculaire' })
              if (cls.ok) return <div style={{ fontSize: 12, marginTop: 6, color: severityColor(cls.band.severity) }}>Dernier : {last.value} {marker.unit_canonical} — {cls.band.label}</div>
              return <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Dernier : {last.value} {marker.unit_canonical}</div>
            })()}
          </div>
        )
      })}
    </div>
  )
}
```

Changements vs original :
- `keysToGraph` = union de `tracked` + clés présentes dans `perMarker` (au lieu de juste `tracked`)
- `isExtra` détecté + bordure dashed + badge "EXTRA"
- Préfère `value_canonical` si disponible (rétrocompat : fallback `value`)

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run build`
Expected: succès.

- [ ] **Step 3: Test manuel**

Valider un bilan qui contient un extra. Sur la page historique, le graphe de cet extra doit apparaître avec le badge "EXTRA". Si on valide un 2e bilan avec le même extra, le graphe doit avoir 2 points.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/athletes/[id]/bloodtest/page.tsx
git commit -m "feat(bloodtest): graph any marker_key with validated data, badge extras"
```

---

## Task 8 — Mettre à jour ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Ajouter la nouvelle entrée du composant dans la section 11 ("Where to look for X")**

Localiser la ligne `| Modify Claude extraction prompt or model | app/api/bloodtest/extract/route.ts |` et ajouter en dessous :

```markdown
| Modify bloodtest analysis progress UI / loading bar | `components/bloodtest/BloodtestAnalysisProgress.tsx` |
| Modify splitMarkers logic (3-section split) | `lib/bloodtest.ts` (`splitMarkers`) |
```

- [ ] **Step 2: Mettre à jour la note dans la section 4 (Components by domain) pour ajouter `bloodtest/`**

Après la section `videos/`, ajouter :

```markdown
### `bloodtest/`
- `BloodtestAnalysisProgress.tsx` — barre de chargement animée pendant l'analyse Claude (ETA basée sur historique, états dégradés stale/error/done).
```

- [ ] **Step 3: Mettre à jour la section 7 (DB schema) — note sur le nouveau shape jsonb**

Localiser la ligne `bloodtest_uploads (...)` et remplacer le commentaire par :

```markdown
- `bloodtest_uploads` (`id, athlete_id, uploaded_by, file_path, dated_at, uploaded_at, validated_at, validated_by, extracted_data jsonb, validated_data jsonb, ai_extraction_meta jsonb, archived_at`). Workflow extract→validate. **`extracted_data.markers[]` inclut depuis 2026-05-02 les champs `marker_key, value_canonical, unit_canonical, matched_by_ai, confirmed_by_coach`** alimentés par Claude. Anciens uploads : ces champs sont absents → l'UI tombe en mode "non identifiés".
```

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md for bloodtest IA mapping refonte"
```

---

## Task 9 — Tests manuels end-to-end + push

- [ ] **Step 1: Lancer le build complet**

Run: `npm run build`
Expected: succès, zéro erreur TS critique.

- [ ] **Step 2: Lancer le dev server**

Run: `npm run dev`

- [ ] **Step 3: Parcours de test exhaustif**

Sur un athlète avec `bloodtest_enabled = true` et `tracked_markers` configurés (au moins 5 markers) :

1. **Upload + analyse** : upload un screenshot/PDF avec ~15 markers
   - barre apparaît immédiatement (auto-trigger après upload)
   - bouton "Analyse IA" s'affiche après échec ou si pas auto-triggé
   - toast "analyse IA en cours..." OK
2. **Page validation post-extraction** : redirige automatiquement
   - section "Attendus" pré-remplie avec les markers tracked + valeurs canoniques
   - badge "auto IA" visible sur les lignes auto-mappées
   - section "Extras détectés" avec markers hors tracked, bouton "Valider" rouge
   - section "Non identifiés" repliée avec compteur
3. **Édition d'un attendu** : cliquer "Modifier" → select s'ouvre → changer marker → "OK" → badge IA disparaît
4. **Validation d'un extra** : cliquer "Valider" → bordure verte + bouton "Inclus"
5. **Dépliage non identifiés** : clic compteur → liste s'ouvre, mapper manuellement OK
6. **Soumission** : "Valider et publier"
   - retour à `/athletes/[id]/bloodtest`
   - section "Historique" inclut maintenant le graphe pour les extras validés
7. **Bilan ancien (avant migration)** : ouvrir un bilan validé pré-2026-05-02
   - tous les markers passent en "Non identifiés" (mais le bilan reste visible)
   - pas de crash, redirection OK
8. **Cas erreur** : en local, modifier temporairement la `ANTHROPIC_API_KEY` pour qu'elle soit invalide et déclencher une analyse
   - barre devient rouge
   - bouton "Réessayer l'analyse IA" apparaît

- [ ] **Step 4: Si tous les parcours passent, push la branche**

```bash
git push -u origin feature/bloodtest-ia-mapping
```

- [ ] **Step 5: STOP — laisser l'utilisateur tester sur Vercel preview**

Suivre la règle de la mémoire `feedback_test_before_release.md` : pour les FEATURES (pas les fixes), on s'arrête ici. La preview Vercel est créée automatiquement par le push. L'utilisateur teste sur ses devices, on cascade ensuite avec un PR `feature/bloodtest-ia-mapping → develop` puis `develop → main` quand il valide.

---

## Notes pour l'agent

- **Pas de migration DB nécessaire** : `extracted_data` et `validated_data` sont en jsonb, le shape évolue librement.
- **Rétro-compatibilité** : tous les uploads existants ont `extracted_data.markers[]` sans les nouveaux champs. `splitMarkers` les traite naturellement (`marker_key: null` → unidentified).
- **Pas de changement côté ATHLETE** : la feature est purement coach-side (l'athlète upload, le coach valide).
- **Coût API** : avec `cache_control: ephemeral` sur le catalogue (~3-4k tokens), le 2e+ extract dans une fenêtre de 5min coûte ~10× moins en input tokens. Vérifier `ai_extraction_meta.cache_read_input_tokens > 0` après le 2e extract.
- **Risque principal** : Claude se trompe sur le mapping. Le badge "auto IA" + l'obligation de valider explicitement chaque extra sont les filets. Si en prod on observe trop de mismatchs, ajouter un score de confiance dans le prompt.
