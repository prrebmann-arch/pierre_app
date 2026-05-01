# Prise de sang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Internalize blood test management — upload PDF, structured extraction via Claude API (Haiku), coach validation workflow, per-marker time-series graphs with severity zones (vitamin/hormone/inflammation vocabulary). Lockable feature like FODMAP.

**Architecture:** Toggle `athletes.bloodtest_enabled` + jsonb tracked panel + `bloodtest_uploads` table with extract→validate workflow. Hardcoded marker catalog in source code (parity ATHLETE/COACH). Claude API server-side only (`/api/bloodtest/extract`). Per-marker bands with severity 1-4 mapped to colors.

**Tech stack:** Supabase (Postgres + RLS + Storage), Next.js 16 + React 19 (COACH), React Native + Expo (ATHLETE), Anthropic SDK (server-side), chart.js for graphs.

**Spec source:** `docs/superpowers/specs/2026-05-01-bloodtest-design.md`

---

## Files

### COACH
- Create `sql/2026-05-XX-bloodtest.sql` — DB migration
- Create `lib/bloodtestCatalog.ts` — catalog (markers + presets + zone bands)
- Create `lib/bloodtest.ts` — pure helpers (classifyValue, severityColor)
- Create `app/api/bloodtest/upload/route.ts` — receive PDF metadata, write DB row
- Create `app/api/bloodtest/extract/route.ts` — call Claude with PDF
- Create `app/api/bloodtest/validate/route.ts` — coach validation submit
- Create `app/api/bloodtest/signed-url/route.ts` — signed URL for PDF preview
- Create `app/(app)/athletes/[id]/bloodtest/page.tsx` — main coach page
- Create `app/(app)/athletes/[id]/bloodtest/validate/[upload_id]/page.tsx` — validation queue split-view
- Modify `app/(app)/athletes/[id]/layout.tsx` — add Bloodtest tab
- Create `scripts/test-bloodtest-catalog.mjs` — parity + integrity tests
- Create `scripts/test-bloodtest-helpers.mjs` — classifyValue smoke tests
- Modify `ARCHITECTURE.md` — document feature

### ATHLETE
- Create `src/utils/bloodtestCatalog.js` — mirror
- Create `src/utils/bloodtest.js` — helpers mirror
- Create `src/api/bloodtest.js` — Supabase + COACH API calls
- Create `src/screens/BloodtestScreen.js` — main screen (history + upload trigger)
- Create `src/screens/BloodtestUploadScreen.js` — upload flow
- Create `src/screens/BloodtestMarkerDetailScreen.js` — fullscreen graph
- Modify `src/screens/ProfilScreen.js` — add entry in MENU_ITEMS
- Modify `src/navigation/AppNavigator.js` — register 3 screens
- Modify `src/api/athletes.js` — extend SELECT with `bloodtest_enabled` and `bloodtest_tracked_markers`

---

## Pre-requisites (manual)

1. **Anthropic API key** — `vercel env add ANTHROPIC_API_KEY` for COACH (preview + production), value from console.anthropic.com.
2. **Supabase Storage bucket** — create `coach-bloodtest` (private, max 10MB, mime `application/pdf`) via Supabase Studio.
3. **Anthropic SDK** — confirm `@anthropic-ai/sdk` is in `COACH/package.json` deps. Else `npm install @anthropic-ai/sdk`.
4. **expo-document-picker + react-native-svg** in ATHLETE — confirm or install. `react-native-svg` is **native** → full eas build needed if added.

---

## Phase 1 — Database

### Task 1: SQL migration

**Files:** Create `COACH/sql/2026-05-XX-bloodtest.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS bloodtest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloodtest_tracked_markers jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS coach_custom_markers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marker_key      text NOT NULL,
  label           text NOT NULL,
  unit_canonical  text NOT NULL,
  category        text NOT NULL,
  zones           jsonb NOT NULL,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, marker_key)
);

CREATE TABLE IF NOT EXISTS bloodtest_uploads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  uploaded_by         text NOT NULL CHECK (uploaded_by IN ('athlete','coach')),
  uploader_user_id    uuid NOT NULL,
  file_path           text NOT NULL,
  dated_at            date,
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  validated_at        timestamptz,
  validated_by        uuid,
  extracted_data      jsonb,
  validated_data      jsonb,
  ai_extraction_meta  jsonb,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloodtest_uploads_athlete
  ON bloodtest_uploads (athlete_id, dated_at DESC NULLS LAST)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bloodtest_uploads_pending
  ON bloodtest_uploads (athlete_id, uploaded_at DESC)
  WHERE archived_at IS NULL AND validated_at IS NULL;

ALTER TABLE bloodtest_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_custom_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY bloodtest_select_self ON bloodtest_uploads
  FOR SELECT USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

CREATE POLICY bloodtest_insert_self ON bloodtest_uploads
  FOR INSERT WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND uploaded_by = 'athlete'
    AND uploader_user_id = auth.uid()
    AND validated_at IS NULL
  );

CREATE POLICY bloodtest_delete_pre_validation ON bloodtest_uploads
  FOR DELETE USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND validated_at IS NULL
  );

CREATE POLICY bloodtest_coach_all ON bloodtest_uploads
  FOR ALL USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

CREATE POLICY ccm_coach_all ON coach_custom_markers
  FOR ALL USING (coach_id = auth.uid());
```

- [ ] **Step 2: Apply in Supabase Studio (preview)**

Verify with :

```sql
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='athletes' AND column_name IN ('bloodtest_enabled','bloodtest_tracked_markers')) AS athlete_cols,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('coach_custom_markers','bloodtest_uploads')) AS tables,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('bloodtest_uploads','coach_custom_markers')) AS policies;
```

Expected `2 | 2 | 5`.

- [ ] **Step 3: Create Storage bucket**

Supabase Studio → Storage → New bucket : `coach-bloodtest`, private, file size 10485760, allowed mime `application/pdf`.

- [ ] **Step 4: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git add sql/2026-05-XX-bloodtest.sql
git commit -m "feat(bloodtest): db migration for uploads + custom markers + RLS"
```

---

## Phase 2 — Catalog + helpers

### Task 2: Catalog COACH + ATHLETE + parity test

**Files:**
- Create `COACH/lib/bloodtestCatalog.ts`
- Create `ATHLETE/src/utils/bloodtestCatalog.js`
- Create `COACH/scripts/test-bloodtest-catalog.mjs`

- [ ] **Step 1: COACH catalog (types + helpers + first 9 markers)**

The catalog content (markers + bands) is fully specified in `docs/superpowers/specs/2026-05-01-bloodtest-design.md` §3.2.3 (basic 9), §3.2.4 (hormonal+ ~17), §3.2.5 (total ~8). Read those sections and translate each row into a TS entry. Below is the file scaffold + the 9 basic markers complete :

```ts
// COACH/lib/bloodtestCatalog.ts

export type BloodtestPreset = 'basic' | 'hormonal_plus' | 'total'

export type BloodtestCategory =
  | 'hema' | 'iron' | 'vitamin' | 'mineral'
  | 'hormone_sex' | 'thyroid' | 'inflammation' | 'metabolism' | 'liver' | 'lipid'

export type ZoneSeverity = 1 | 2 | 3 | 4

export type ZoneBand = {
  label: string
  severity: ZoneSeverity
  min?: number
  max?: number
}

export type ZoneConfig = {
  direction: 'higher_is_better' | 'lower_is_better' | 'range_is_normal'
  bands: ZoneBand[]
}

export type SexSpecificZones = {
  male?: ZoneConfig
  female?: ZoneConfig
  female_by_phase?: Partial<Record<'folliculaire' | 'ovulatoire' | 'luteale' | 'menopause', ZoneConfig>>
}

export type BloodtestMarker = {
  key: string
  label: string
  unit_canonical: string
  unit_aliases: string[]
  category: BloodtestCategory
  zones: ZoneConfig | { sex_specific: SexSpecificZones }
  presets: BloodtestPreset[]
  supplementation?: { forms: string[]; dosage_general: string; timing: string }
  notes?: string
}

export const MARKERS: BloodtestMarker[] = [
  // === basic ===
  {
    key: 'hemoglobine', label: 'Hémoglobine', unit_canonical: 'g/L', unit_aliases: ['g/dL'],
    category: 'hema', presets: ['basic','hormonal_plus','total'],
    zones: { sex_specific: {
      male: { direction: 'range_is_normal', bands: [
        { label: 'bas', severity: 3, max: 130 },
        { label: 'normal', severity: 1, min: 130, max: 170 },
        { label: 'haut', severity: 3, min: 170 },
      ]},
      female: { direction: 'range_is_normal', bands: [
        { label: 'bas', severity: 3, max: 120 },
        { label: 'normal', severity: 1, min: 120, max: 160 },
        { label: 'haut', severity: 3, min: 160 },
      ]},
    }},
  },
  {
    key: 'ferritine', label: 'Ferritine', unit_canonical: 'µg/L', unit_aliases: ['ng/mL'],
    category: 'iron', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'higher_is_better', bands: [
      { label: 'optimal', severity: 1, min: 50 },
      { label: 'deficience', severity: 2, min: 30, max: 50 },
      { label: 'carence', severity: 3, min: 15, max: 30 },
      { label: 'avitaminose', severity: 4, max: 15 },
    ]},
    supplementation: {
      forms: ['Bisglycinate de fer','Sulfate ferreux','Fer héminique'],
      dosage_general: '14-28 mg/jour',
      timing: 'À jeun ou 2h après repas, loin du calcium',
    },
  },
  {
    key: 'fer_serique', label: 'Fer sérique', unit_canonical: 'µmol/L', unit_aliases: [],
    category: 'iron', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'higher_is_better', bands: [
      { label: 'optimal', severity: 1, min: 12 },
      { label: 'deficience', severity: 2, min: 9, max: 12 },
      { label: 'carence', severity: 3, min: 6, max: 9 },
      { label: 'avitaminose', severity: 4, max: 6 },
    ]},
  },
  {
    key: 'vitamine_d', label: 'Vitamine D (25-OH-D)', unit_canonical: 'ng/mL', unit_aliases: ['nmol/L'],
    category: 'vitamin', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'higher_is_better', bands: [
      { label: 'optimal', severity: 1, min: 30 },
      { label: 'deficience', severity: 2, min: 20, max: 30 },
      { label: 'carence', severity: 3, min: 10, max: 20 },
      { label: 'avitaminose', severity: 4, max: 10 },
    ]},
    supplementation: {
      forms: ['Cholécalciférol naturel (D3)'],
      dosage_general: 'Entretien: 800-1000 UI · Déficience: 2000-3000 UI · Carence: 4000-5000 UI · Avitaminose: 5000+ UI',
      timing: 'Avec une source de lipides / après un repas',
    },
  },
  {
    key: 'b12', label: 'Vitamine B12', unit_canonical: 'pmol/L', unit_aliases: ['pg/mL'],
    category: 'vitamin', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'higher_is_better', bands: [
      { label: 'optimal', severity: 1, min: 250 },
      { label: 'deficience', severity: 2, min: 150, max: 250 },
      { label: 'carence', severity: 3, min: 75, max: 150 },
      { label: 'avitaminose', severity: 4, max: 75 },
    ]},
    supplementation: {
      forms: ['Méthylcobalamine','Adénosylcobalamine'],
      dosage_general: '2.5-25 µg/jour',
      timing: 'À distance des repas',
    },
  },
  {
    key: 'folates_b9', label: 'Folates (B9)', unit_canonical: 'nmol/L', unit_aliases: [],
    category: 'vitamin', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'higher_is_better', bands: [
      { label: 'optimal', severity: 1, min: 1300 },
      { label: 'deficience', severity: 2, min: 800, max: 1300 },
      { label: 'carence', severity: 3, min: 300, max: 800 },
      { label: 'avitaminose', severity: 4, max: 300 },
    ]},
    supplementation: {
      forms: ['Quatrefolic','Folinate de calcium','Calcium L-méthylfolate','5-MTHF'],
      dosage_general: '200-500 µg/jour',
      timing: 'Avec un repas',
    },
  },
  {
    key: 'magnesium_serique', label: 'Magnésium sérique', unit_canonical: 'mmol/L', unit_aliases: ['mg/L'],
    category: 'mineral', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'higher_is_better', bands: [
      { label: 'optimal', severity: 1, min: 0.75 },
      { label: 'deficience', severity: 2, min: 0.65, max: 0.75 },
      { label: 'carence', severity: 3, min: 0.55, max: 0.65 },
      { label: 'avitaminose', severity: 4, max: 0.55 },
    ]},
    supplementation: {
      forms: ['Bisglycinate de magnésium','Malate','Pidolate','Glycérophosphate','Acétyl-taurinate','Citrate','Thréonate','Gluconate'],
      dosage_general: '200-300 mg/jour (min 500 mg si carence)',
      timing: 'Soir, hors repas riche en calcium',
    },
  },
  {
    key: 'tsh_us', label: 'TSH ultrasensible', unit_canonical: 'mUI/L', unit_aliases: ['mIU/L'],
    category: 'thyroid', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'range_is_normal', bands: [
      { label: 'low', severity: 3, max: 0.4 },
      { label: 'normal', severity: 1, min: 0.4, max: 4.0 },
      { label: 'high', severity: 3, min: 4.0 },
    ]},
  },
  {
    key: 'crp_us', label: 'CRP ultrasensible', unit_canonical: 'mg/L', unit_aliases: [],
    category: 'inflammation', presets: ['basic','hormonal_plus','total'],
    zones: { direction: 'lower_is_better', bands: [
      { label: 'optimal', severity: 1, max: 1 },
      { label: 'leger', severity: 2, min: 1, max: 3 },
      { label: 'modere', severity: 3, min: 3, max: 10 },
      { label: 'severe', severity: 4, min: 10 },
    ]},
  },

  // === hormonal+ : add markers from spec §3.2.4 ===
  // Estrone (E1), Estradiol (E2 — sex+phase), Estriol (E3),
  // Progesterone (sex+phase), LH (sex+phase), FSH (sex+phase),
  // SHBG (sex_specific), Testosterone totale & libre (sex_specific),
  // DHEA-S (sex_specific), Androstènedione (sex_specific),
  // 17-OH-progesterone (sex+phase), Prolactine (sex_specific),
  // FT4, FT3 (range), Anti-TPO, Anti-Tg (lower_is_better four-zone)

  // === total : add markers from spec §3.2.5 ===
  // Vitamine E, Magnésium érythrocytaire, Zinc, Cuivre, Sélénium,
  // Transferrine (range), CFT/TIBC (range), Coef sat transferrine
]

export const PRESETS: Record<BloodtestPreset, string[]> = {
  basic:         MARKERS.filter((m) => m.presets.includes('basic')).map((m) => m.key),
  hormonal_plus: MARKERS.filter((m) => m.presets.includes('hormonal_plus')).map((m) => m.key),
  total:         MARKERS.filter((m) => m.presets.includes('total')).map((m) => m.key),
}

export function getMarker(key: string): BloodtestMarker | undefined {
  return MARKERS.find((m) => m.key === key)
}

export function getPresetMarkers(preset: BloodtestPreset): BloodtestMarker[] {
  return MARKERS.filter((m) => m.presets.includes(preset))
}
```

To complete the catalog, **read spec §3.2.4 + §3.2.5** and translate every row's threshold values into a TS entry, following the same shape as the 9 basic markers above. For markers with phase-dependent zones (E2, Progesterone, LH, FSH, 17-OH-prog), use `sex_specific` with `female_by_phase`. For markers with sex-only difference (testosterone, DHEA-S, etc.), use `sex_specific` with `male` and `female` only.

- [ ] **Step 2: ATHLETE catalog mirror**

```js
// ATHLETE/src/utils/bloodtestCatalog.js
export const MARKERS = [
  // copy/paste all entries from COACH MARKERS, removing TS type annotations
];

export const PRESETS = {
  basic:         MARKERS.filter((m) => m.presets.includes('basic')).map((m) => m.key),
  hormonal_plus: MARKERS.filter((m) => m.presets.includes('hormonal_plus')).map((m) => m.key),
  total:         MARKERS.filter((m) => m.presets.includes('total')).map((m) => m.key),
};

export function getMarker(key) { return MARKERS.find((m) => m.key === key); }
export function getPresetMarkers(preset) { return MARKERS.filter((m) => m.presets.includes(preset)); }
```

- [ ] **Step 3: Parity + integrity test**

```js
// COACH/scripts/test-bloodtest-catalog.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const COACH_PATH  = path.resolve('lib/bloodtestCatalog.ts')
const ATHLETE_PATH = path.resolve('../ATHLETE/src/utils/bloodtestCatalog.js')

async function extractMarkers(file) {
  const src = await readFile(file, 'utf8')
  const re = /export const MARKERS[^=]*=\s*(\[[\s\S]*?\n\])/
  const m = src.match(re)
  if (!m) throw new Error(`Could not find export const MARKERS in ${file}`)
  const cleaned = m[1].replace(/\/\/[^\n]*/g, '').replace(/,(\s*[\]\}])/g, '$1')
  const json = cleaned
    .replace(/([\{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
  return JSON.parse(json)
}

test('catalog has 30+ markers, no duplicate keys', async () => {
  const markers = await extractMarkers(COACH_PATH)
  assert.ok(markers.length >= 30, `expected at least 30 markers, got ${markers.length}`)
  const keys = new Set(markers.map((m) => m.key))
  assert.equal(keys.size, markers.length, 'duplicate marker keys detected')
})

test('catalog ATHLETE matches COACH (keys + labels + presets)', async () => {
  const c = await extractMarkers(COACH_PATH)
  const a = await extractMarkers(ATHLETE_PATH)
  const cByKey = Object.fromEntries(c.map((m) => [m.key, m]))
  const aByKey = Object.fromEntries(a.map((m) => [m.key, m]))
  const cKeys = Object.keys(cByKey).sort()
  const aKeys = Object.keys(aByKey).sort()
  assert.deepEqual(aKeys, cKeys, 'key set differs')
  for (const k of cKeys) {
    assert.equal(aByKey[k].label, cByKey[k].label, `label drift on ${k}`)
    assert.equal(aByKey[k].unit_canonical, cByKey[k].unit_canonical, `unit drift on ${k}`)
    assert.deepEqual(aByKey[k].presets, cByKey[k].presets, `presets drift on ${k}`)
  }
})

test('every marker has zones and non-empty presets', async () => {
  const c = await extractMarkers(COACH_PATH)
  for (const m of c) {
    assert.ok(m.zones, `${m.key} missing zones`)
    assert.ok(Array.isArray(m.presets) && m.presets.length > 0, `${m.key} no presets`)
  }
})

test('basic preset has at least 8 markers', async () => {
  const c = await extractMarkers(COACH_PATH)
  const basic = c.filter((m) => m.presets.includes('basic'))
  assert.ok(basic.length >= 8, `basic preset has ${basic.length}, expected >= 8`)
})
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
node --test scripts/test-bloodtest-catalog.mjs
```

Expected 4 tests pass.

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | grep "bloodtest" || echo "no bloodtest errors"

cd /Users/pierrerebmann/MOMENTUM/COACH
git add lib/bloodtestCatalog.ts
git commit -m "feat(bloodtest): COACH catalog (basic + hormonal+ + total presets)"

cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/utils/bloodtestCatalog.js
git commit -m "feat(bloodtest): ATHLETE catalog mirror"

cd /Users/pierrerebmann/MOMENTUM/COACH
git add scripts/test-bloodtest-catalog.mjs
git commit -m "test(bloodtest): catalog parity + integrity tests"
```

### Task 3: Helpers — classifyValue + severityColor

**Files:**
- Create `COACH/lib/bloodtest.ts`
- Create `ATHLETE/src/utils/bloodtest.js`
- Create `COACH/scripts/test-bloodtest-helpers.mjs`

- [ ] **Step 1: COACH helpers**

```ts
// COACH/lib/bloodtest.ts

import { type BloodtestMarker, type ZoneBand, type ZoneConfig, type ZoneSeverity } from './bloodtestCatalog'

export type ClassifyContext = {
  sex?: 'M' | 'F'
  phase?: 'folliculaire' | 'ovulatoire' | 'luteale' | 'menopause'
}

export type ClassifyResult =
  | { ok: true; band: ZoneBand; zone_config: ZoneConfig }
  | { ok: false; error: 'missing_phase' | 'missing_sex' | 'no_zones_for_context' | 'value_outside_bands' }

export function classifyValue(marker: BloodtestMarker, value: number, ctx?: ClassifyContext): ClassifyResult {
  const config = resolveZoneConfig(marker, ctx)
  if (!config.ok) return config
  const band = config.zone.bands.find((b) => valueInBand(b, value))
  if (!band) return { ok: false, error: 'value_outside_bands' }
  return { ok: true, band, zone_config: config.zone }
}

function resolveZoneConfig(
  marker: BloodtestMarker,
  ctx?: ClassifyContext,
): { ok: true; zone: ZoneConfig } | { ok: false; error: 'missing_phase' | 'missing_sex' | 'no_zones_for_context' } {
  const z = marker.zones
  if ('direction' in z) return { ok: true, zone: z }
  const ss = z.sex_specific
  if (ctx?.sex === 'M' && ss.male) return { ok: true, zone: ss.male }
  if (ctx?.sex === 'F') {
    if (ss.female_by_phase) {
      if (!ctx.phase) return { ok: false, error: 'missing_phase' }
      const phaseZone = ss.female_by_phase[ctx.phase]
      if (!phaseZone) return { ok: false, error: 'no_zones_for_context' }
      return { ok: true, zone: phaseZone }
    }
    if (ss.female) return { ok: true, zone: ss.female }
  }
  return { ok: false, error: 'missing_sex' }
}

function valueInBand(b: ZoneBand, v: number): boolean {
  if (b.min !== undefined && v < b.min) return false
  if (b.max !== undefined && v >= b.max) return false
  return true
}

export function severityColor(severity: ZoneSeverity): string {
  switch (severity) {
    case 1: return '#22c55e'
    case 2: return '#eab308'
    case 3: return '#f97316'
    case 4: return '#ef4444'
  }
}

// Shared types used by API + UI

export type ExtractedMarker = {
  marker_key: string | null
  raw_label: string
  value: number | null
  unit: string | null
  lab_reference_range?: string
  ignored?: boolean
  notes?: string
}

export type ExtractedData = {
  markers: ExtractedMarker[]
  detected_dated_at?: string
}

export type AiMeta = {
  model: string
  input_tokens: number
  output_tokens: number
  duration_ms: number
  error?: string
}

export type BloodtestUploadRow = {
  id: string
  athlete_id: string
  uploaded_by: 'athlete' | 'coach'
  uploader_user_id: string
  file_path: string
  dated_at: string | null
  uploaded_at: string
  validated_at: string | null
  validated_by: string | null
  extracted_data: ExtractedData | null
  validated_data: ExtractedData | null
  ai_extraction_meta: AiMeta | null
  archived_at: string | null
  created_at: string
}
```

- [ ] **Step 2: ATHLETE helpers (mirror)**

```js
// ATHLETE/src/utils/bloodtest.js

export function classifyValue(marker, value, ctx) {
  const config = resolveZoneConfig(marker, ctx);
  if (!config.ok) return config;
  const band = config.zone.bands.find((b) => valueInBand(b, value));
  if (!band) return { ok: false, error: 'value_outside_bands' };
  return { ok: true, band, zone_config: config.zone };
}

function resolveZoneConfig(marker, ctx) {
  const z = marker.zones;
  if (z.direction) return { ok: true, zone: z };
  const ss = z.sex_specific;
  if (ctx && ctx.sex === 'M' && ss.male) return { ok: true, zone: ss.male };
  if (ctx && ctx.sex === 'F') {
    if (ss.female_by_phase) {
      if (!ctx.phase) return { ok: false, error: 'missing_phase' };
      const phaseZone = ss.female_by_phase[ctx.phase];
      if (!phaseZone) return { ok: false, error: 'no_zones_for_context' };
      return { ok: true, zone: phaseZone };
    }
    if (ss.female) return { ok: true, zone: ss.female };
  }
  return { ok: false, error: 'missing_sex' };
}

function valueInBand(b, v) {
  if (b.min !== undefined && v < b.min) return false;
  if (b.max !== undefined && v >= b.max) return false;
  return true;
}

export function severityColor(severity) {
  if (severity === 1) return '#22c55e';
  if (severity === 2) return '#eab308';
  if (severity === 3) return '#f97316';
  return '#ef4444';
}
```

- [ ] **Step 3: Smoke tests**

```js
// COACH/scripts/test-bloodtest-helpers.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'

function classifyValue(marker, value, ctx) {
  const z = marker.zones
  let zone
  if (z.direction) { zone = z }
  else {
    const ss = z.sex_specific
    if (ctx?.sex === 'M' && ss.male) zone = ss.male
    else if (ctx?.sex === 'F') {
      if (ss.female_by_phase) {
        if (!ctx.phase) return { ok: false, error: 'missing_phase' }
        zone = ss.female_by_phase[ctx.phase]
        if (!zone) return { ok: false, error: 'no_zones_for_context' }
      } else if (ss.female) zone = ss.female
    }
    if (!zone) return { ok: false, error: 'missing_sex' }
  }
  const band = zone.bands.find((b) => (b.min === undefined || value >= b.min) && (b.max === undefined || value < b.max))
  if (!band) return { ok: false, error: 'value_outside_bands' }
  return { ok: true, band, zone_config: zone }
}

const VIT_D = {
  zones: { direction: 'higher_is_better', bands: [
    { label: 'optimal', severity: 1, min: 30 },
    { label: 'deficience', severity: 2, min: 20, max: 30 },
    { label: 'carence', severity: 3, min: 10, max: 20 },
    { label: 'avitaminose', severity: 4, max: 10 },
  ]}
}

test('vit D 35 -> optimal', () => {
  const r = classifyValue(VIT_D, 35)
  assert.ok(r.ok); assert.equal(r.band.label, 'optimal')
})
test('vit D 25 -> deficience', () => {
  const r = classifyValue(VIT_D, 25)
  assert.ok(r.ok); assert.equal(r.band.label, 'deficience')
})
test('vit D 8 -> avitaminose', () => {
  const r = classifyValue(VIT_D, 8)
  assert.ok(r.ok); assert.equal(r.band.label, 'avitaminose')
})

const E2 = {
  zones: { sex_specific: {
    male: { direction: 'range_is_normal', bands: [
      { label: 'low', severity: 3, max: 10 },
      { label: 'normal', severity: 1, min: 10, max: 40 },
      { label: 'high', severity: 3, min: 40 },
    ]},
    female_by_phase: {
      folliculaire: { direction: 'range_is_normal', bands: [
        { label: 'low', severity: 3, max: 30 },
        { label: 'normal', severity: 1, min: 30, max: 120 },
        { label: 'high', severity: 3, min: 120 },
      ]}
    }
  }}
}

test('E2 missing sex -> error', () => {
  const r = classifyValue(E2, 25, {})
  assert.equal(r.ok, false); assert.equal(r.error, 'missing_sex')
})
test('E2 female missing phase -> error', () => {
  const r = classifyValue(E2, 25, { sex: 'F' })
  assert.equal(r.ok, false); assert.equal(r.error, 'missing_phase')
})
test('E2 female folliculaire 50 -> normal', () => {
  const r = classifyValue(E2, 50, { sex: 'F', phase: 'folliculaire' })
  assert.ok(r.ok); assert.equal(r.band.label, 'normal')
})
```

- [ ] **Step 4: Run tests + commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
node --test scripts/test-bloodtest-helpers.mjs
# Expected: 6 tests pass
npx tsc --noEmit 2>&1 | grep "bloodtest" || echo "no errors"
git add lib/bloodtest.ts scripts/test-bloodtest-helpers.mjs
git commit -m "feat(bloodtest): pure helpers + smoke tests"

cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/utils/bloodtest.js
git commit -m "feat(bloodtest): ATHLETE helpers mirror"
```

---

## Phase 3 — API server-side (COACH)

### Task 4: Upload endpoint

**File:** Create `COACH/app/api/bloodtest/upload/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { athlete_id, file_path, uploaded_by, dated_at } = body
  if (!athlete_id || !file_path || !uploaded_by) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (uploaded_by !== 'athlete' && uploaded_by !== 'coach') {
    return NextResponse.json({ error: 'invalid uploaded_by' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: ath, error: athErr } = await admin
    .from('athletes').select('id, user_id, coach_id')
    .eq('id', athlete_id).single()
  if (athErr || !ath) return NextResponse.json({ error: 'athlete not found' }, { status: 404 })

  if (uploaded_by === 'athlete') {
    if (ath.user_id !== auth.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (!file_path.startsWith(`${auth.userId}/`)) return NextResponse.json({ error: 'invalid path for athlete' }, { status: 400 })
  } else {
    if (ath.coach_id !== auth.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    if (!file_path.startsWith(`coach/${auth.userId}/${athlete_id}/`)) return NextResponse.json({ error: 'invalid path for coach' }, { status: 400 })
  }

  const lastSlash = file_path.lastIndexOf('/')
  const folder = file_path.slice(0, lastSlash)
  const filename = file_path.slice(lastSlash + 1)
  const { data: list } = await admin.storage.from('coach-bloodtest').list(folder, { search: filename })
  if (!list || list.length === 0) return NextResponse.json({ error: 'file not found in storage' }, { status: 400 })

  const { data: upload, error: insErr } = await admin
    .from('bloodtest_uploads')
    .insert({
      athlete_id,
      uploaded_by,
      uploader_user_id: auth.userId,
      file_path,
      dated_at: dated_at || null,
    })
    .select('id')
    .single()
  if (insErr) {
    console.error('[bloodtest/upload] insert', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ upload_id: upload.id })
}
```

- [ ] **Step 2: Build + commit**

```bash
npx tsc --noEmit 2>&1 | grep "bloodtest/upload" || echo "no errors"
git add app/api/bloodtest/upload/route.ts
git commit -m "feat(bloodtest): /api/bloodtest/upload route with path validation"
```

### Task 5: Extract endpoint (Claude API)

**File:** Create `COACH/app/api/bloodtest/extract/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Tu es un assistant qui extrait des valeurs de prises de sang depuis des PDFs en français.

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
- Conserve l'unité telle qu'écrite dans le PDF, ne convertis pas.
- detected_dated_at = date du prélèvement si lisible.`

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { upload_id } = await req.json()
  if (!upload_id) return NextResponse.json({ error: 'missing upload_id' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  if (ath.user_id !== auth.userId && ath.coach_id !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (upload.extracted_data) return NextResponse.json({ already_extracted: true })

  const { data: signed } = await admin.storage
    .from('coach-bloodtest')
    .createSignedUrl(upload.file_path, 300)
  if (!signed?.signedUrl) return NextResponse.json({ error: 'cannot sign url' }, { status: 500 })

  const pdfRes = await fetch(signed.signedUrl)
  if (!pdfRes.ok) return NextResponse.json({ error: 'cannot fetch pdf' }, { status: 500 })
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())
  const pdfBase64 = pdfBuf.toString('base64')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const startTs = Date.now()
  let extracted: any = null
  const aiMeta: any = { model: 'claude-haiku-4-5-20251001', duration_ms: 0, input_tokens: 0, output_tokens: 0 }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: 'Extrais le bilan en JSON strict comme indiqué.' },
        ],
      }],
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
```

- [ ] **Step 2: Verify env + commit**

```bash
vercel env ls | grep ANTHROPIC
# If missing: vercel env add ANTHROPIC_API_KEY preview

npx tsc --noEmit 2>&1 | grep "bloodtest/extract" || echo "no errors"
git add app/api/bloodtest/extract/route.ts
git commit -m "feat(bloodtest): /api/bloodtest/extract using Claude Haiku PDF input"
```

### Task 6: Validate endpoint

**File:** Create `COACH/app/api/bloodtest/validate/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { upload_id, validated_data, dated_at } = await req.json()
  if (!upload_id || !validated_data) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: row } = await admin
    .from('bloodtest_uploads').select('id, athlete_id')
    .eq('id', upload_id).single()
  if (!row) return NextResponse.json({ error: 'upload not found' }, { status: 404 })
  const { data: ath } = await admin
    .from('athletes').select('coach_id').eq('id', row.athlete_id).single()
  if (!ath || ath.coach_id !== auth.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin
    .from('bloodtest_uploads')
    .update({
      validated_data,
      validated_at: new Date().toISOString(),
      validated_by: auth.userId,
      dated_at: dated_at || null,
    })
    .eq('id', upload_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/bloodtest/validate/route.ts
git commit -m "feat(bloodtest): /api/bloodtest/validate route"
```

### Task 7: Signed-URL endpoint

**File:** Create `COACH/app/api/bloodtest/signed-url/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const upload_id = req.nextUrl.searchParams.get('id')
  if (!upload_id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: row } = await admin
    .from('bloodtest_uploads').select('athlete_id, file_path').eq('id', upload_id).single()
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: ath } = await admin
    .from('athletes').select('user_id, coach_id').eq('id', row.athlete_id).single()
  if (!ath) return NextResponse.json({ error: 'athlete not found' }, { status: 404 })
  if (ath.user_id !== auth.userId && ath.coach_id !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: signed, error } = await admin.storage
    .from('coach-bloodtest')
    .createSignedUrl(row.file_path, 3600)
  if (error || !signed?.signedUrl) return NextResponse.json({ error: 'sign failed' }, { status: 500 })
  return NextResponse.json({ url: signed.signedUrl })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/bloodtest/signed-url/route.ts
git commit -m "feat(bloodtest): /api/bloodtest/signed-url for PDF preview"
```

---

## Phase 4 — Coach UI

### Task 8: Add Bloodtest tab

**File:** Modify `COACH/app/(app)/athletes/[id]/layout.tsx`

- [ ] **Step 1: Insert tab line**

After the FODMAP entry in the `TABS` array, add :

```ts
  { label: 'Sang', route: 'bloodtest', icon: 'fa-droplet' },
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/athletes/\[id\]/layout.tsx
git commit -m "feat(bloodtest): add Bloodtest tab in athlete layout"
```

### Task 9: Coach main page

**File:** Create `COACH/app/(app)/athletes/[id]/bloodtest/page.tsx`

- [ ] **Step 1: Implement (~400 lines, single file)**

Full code, see template below. Pattern mirrors `posing/page.tsx` and `fodmap/page.tsx`. Read those for conventions (Toggle, Skeleton, useToast, useRefetchOnResume, error logging style).

```tsx
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Toggle from '@/components/ui/Toggle'
import Skeleton from '@/components/ui/Skeleton'
import Modal from '@/components/ui/Modal'
import { MARKERS, PRESETS, type BloodtestPreset } from '@/lib/bloodtestCatalog'
import { classifyValue, severityColor, type BloodtestUploadRow, type ExtractedData } from '@/lib/bloodtest'

type CustomMarker = { id: string; marker_key: string; label: string; unit_canonical: string; category: string; zones: any }

export default function BloodtestPage() {
  const params = useParams<{ id: string }>()
  const { user, accessToken } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [tracked, setTracked] = useState<string[]>([])
  const [uploads, setUploads] = useState<BloodtestUploadRow[]>([])
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([])
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [{ data: ath, error: athErr }, { data: ups }, { data: cms }] = await Promise.all([
        supabase.from('athletes').select('bloodtest_enabled, bloodtest_tracked_markers').eq('id', params.id).single(),
        supabase.from('bloodtest_uploads')
          .select('id, athlete_id, uploaded_by, uploader_user_id, file_path, dated_at, uploaded_at, validated_at, validated_by, extracted_data, validated_data, ai_extraction_meta, archived_at, created_at')
          .eq('athlete_id', params.id).is('archived_at', null)
          .order('dated_at', { ascending: false, nullsFirst: false })
          .order('uploaded_at', { ascending: false }).limit(50),
        supabase.from('coach_custom_markers').select('id, marker_key, label, unit_canonical, category, zones').is('archived_at', null),
      ])
      if (athErr) { console.error('[bloodtest] athlete', athErr); toast(`Erreur: ${athErr.message}`, 'error'); return }
      setEnabled(ath?.bloodtest_enabled || false)
      setTracked(ath?.bloodtest_tracked_markers || [])
      setUploads((ups || []) as BloodtestUploadRow[])
      setCustomMarkers((cms || []) as CustomMarker[])
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (params.id) loadData() }, [params.id, loadData])
  useRefetchOnResume(loadData, loading)

  async function toggleEnabled(on: boolean) {
    const update: any = { bloodtest_enabled: on }
    if (on && tracked.length === 0) update.bloodtest_tracked_markers = PRESETS.basic
    const { error } = await supabase.from('athletes').update(update).eq('id', params.id)
    if (error) { console.error('[bloodtest] toggle', error); toast(`Erreur: ${error.message}`, 'error'); return }
    toast(on ? 'Prise de sang activée' : 'Prise de sang désactivée', 'success')
    setEnabled(on)
    if (on && tracked.length === 0) setTracked(PRESETS.basic)
  }

  async function applyPreset(preset: BloodtestPreset) {
    const list = PRESETS[preset]
    const { error } = await supabase.from('athletes').update({ bloodtest_tracked_markers: list }).eq('id', params.id)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    setTracked(list)
    toast(`Preset ${preset} appliqué`, 'success')
  }

  async function toggleMarker(key: string) {
    const next = tracked.includes(key) ? tracked.filter((k) => k !== key) : [...tracked, key]
    const { error } = await supabase.from('athletes').update({ bloodtest_tracked_markers: next }).eq('id', params.id)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    setTracked(next)
  }

  async function uploadPdf(file: File) {
    if (!user) return
    setUploading(true)
    try {
      const ts = Date.now()
      const path = `coach/${user.id}/${params.id}/${ts}.pdf`
      const { error: upErr } = await supabase.storage.from('coach-bloodtest').upload(path, file, { contentType: 'application/pdf', upsert: false })
      if (upErr) throw upErr
      const res = await fetch('/api/bloodtest/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ athlete_id: params.id, uploaded_by: 'coach', file_path: path }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'upload failed')
      fetch('/api/bloodtest/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ upload_id: json.upload_id }),
      }).then(() => loadData()).catch((e) => console.error('[bloodtest] extract bg', e))
      toast('Upload OK, extraction en cours...', 'success')
      loadData()
    } catch (e: any) {
      console.error('[bloodtest] upload', e)
      toast(`Erreur: ${e.message || e}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <Skeleton height={400} borderRadius={12} />

  if (!enabled) {
    return (
      <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
        <i className="fas fa-droplet" style={{ fontSize: 36, color: 'var(--text3)', marginBottom: 16, display: 'block' }} />
        <p style={{ color: 'var(--text3)', marginBottom: 16 }}>Prise de sang désactivée pour cet athlète</p>
        <Toggle checked={false} onChange={toggleEnabled} />
      </div>
    )
  }

  const pendingValidation = uploads.filter((u) => u.extracted_data && !u.validated_at)
  const validated = uploads.filter((u) => u.validated_at)
  const allMarkers = [...MARKERS, ...customMarkers.map((cm) => ({
    key: cm.marker_key, label: cm.label, unit_canonical: cm.unit_canonical, unit_aliases: [],
    category: cm.category as any, zones: cm.zones, presets: [] as BloodtestPreset[],
  }))]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Toggle checked={enabled} onChange={toggleEnabled} label="Prise de sang activée" />
        <input type="file" accept="application/pdf" id="bt-upload" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f) }} />
        <button className="btn btn-red btn-sm" disabled={uploading} onClick={() => document.getElementById('bt-upload')?.click()}>
          <i className="fas fa-upload" /> {uploading ? 'Upload...' : 'Upload PDF'}
        </button>
      </div>

      <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg2)', borderRadius: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Panel suivi</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['basic','hormonal_plus','total'] as const).map((p) => (
            <button key={p} className="btn btn-outline btn-sm" onClick={() => applyPreset(p)}>Preset {p}</button>
          ))}
          <button className="btn btn-outline btn-sm" onClick={() => setShowCustomModal(true)}><i className="fas fa-plus" /> Marker custom</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
          {allMarkers.map((m) => {
            const on = tracked.includes(m.key)
            return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: on ? 'var(--bg3)' : 'transparent', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => toggleMarker(m.key)} />{m.label}
              </label>
            )
          })}
        </div>
      </div>

      {pendingValidation.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            <i className="fas fa-hourglass-half" style={{ color: 'var(--warning)', marginRight: 6 }} />À valider ({pendingValidation.length})
          </h3>
          {pendingValidation.map((u) => (
            <Link key={u.id} href={`/athletes/${params.id}/bloodtest/validate/${u.id}`} style={{ display: 'block', padding: 12, background: 'var(--bg2)', borderLeft: '3px solid var(--warning)', borderRadius: 8, marginBottom: 8, textDecoration: 'none', color: 'var(--text)' }}>
              <div style={{ fontWeight: 600 }}>Upload {u.uploaded_by} · {new Date(u.uploaded_at).toLocaleDateString('fr-FR')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {u.extracted_data ? `${(u.extracted_data as ExtractedData).markers.length} markers extraits — clique pour valider` : 'Extraction en cours...'}
              </div>
            </Link>
          ))}
        </>
      )}

      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '24px 0 10px' }}>
        <i className="fas fa-chart-line" style={{ color: 'var(--primary)', marginRight: 6 }} />Historique ({validated.length})
      </h3>
      {validated.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 13 }}>Aucun upload validé pour le moment</div>
      ) : (
        <BloodtestHistoryGraphs uploads={validated} tracked={tracked} allMarkers={allMarkers} />
      )}

      <CustomMarkerModal open={showCustomModal} onClose={() => setShowCustomModal(false)} onCreated={() => { setShowCustomModal(false); loadData() }} coachId={user?.id || ''} />
    </div>
  )
}

function BloodtestHistoryGraphs({ uploads, tracked, allMarkers }: { uploads: BloodtestUploadRow[]; tracked: string[]; allMarkers: any[] }) {
  const perMarker = useMemo(() => {
    const map = new Map<string, { date: string; value: number }[]>()
    for (const up of uploads) {
      const data = up.validated_data as ExtractedData
      if (!data?.markers) continue
      const date = up.dated_at || up.uploaded_at.slice(0, 10)
      for (const m of data.markers) {
        if (!m.marker_key || m.value == null || m.ignored) continue
        const arr = map.get(m.marker_key) || []
        arr.push({ date, value: m.value })
        map.set(m.marker_key, arr)
      }
    }
    for (const [, arr] of map) arr.sort((a, b) => a.date.localeCompare(b.date))
    return map
  }, [uploads])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {tracked.map((key) => {
        const marker = allMarkers.find((m) => m.key === key)
        if (!marker) return null
        const series = perMarker.get(key) || []
        const W = 240, H = 50
        let pts = ''
        if (series.length >= 2) {
          const min = Math.min(...series.map((s) => s.value))
          const max = Math.max(...series.map((s) => s.value))
          pts = series.map((s, i) => `${(i / (series.length - 1)) * W},${H - ((s.value - min) / (max - min || 1)) * H}`).join(' ')
        }
        const last = series[series.length - 1]
        return (
          <div key={key} style={{ padding: 12, background: 'var(--bg2)', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{marker.label}</div>
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

function CustomMarkerModal({ open, onClose, onCreated, coachId }: { open: boolean; onClose: () => void; onCreated: () => void; coachId: string }) {
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('vitamin')
  const [direction, setDirection] = useState<'higher_is_better'|'lower_is_better'|'range_is_normal'>('higher_is_better')
  const [b1, setB1] = useState(''); const [b2, setB2] = useState(''); const [b3, setB3] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  async function submit() {
    const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!key || !unit) { toast('Label et unité requis', 'error'); return }
    setSaving(true)
    const bands = direction === 'higher_is_better' ? [
      { label: 'optimal', severity: 1, min: parseFloat(b1) },
      { label: 'deficience', severity: 2, min: parseFloat(b2), max: parseFloat(b1) },
      { label: 'carence', severity: 3, min: parseFloat(b3), max: parseFloat(b2) },
      { label: 'avitaminose', severity: 4, max: parseFloat(b3) },
    ] : [
      { label: 'optimal', severity: 1, max: parseFloat(b1) },
      { label: 'leger', severity: 2, min: parseFloat(b1), max: parseFloat(b2) },
      { label: 'modere', severity: 3, min: parseFloat(b2), max: parseFloat(b3) },
      { label: 'severe', severity: 4, min: parseFloat(b3) },
    ]
    const { error } = await supabase.from('coach_custom_markers').insert({
      coach_id: coachId, marker_key: key, label, unit_canonical: unit, category,
      zones: { direction, bands },
    })
    setSaving(false)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Marker custom créé', 'success')
    onCreated()
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Marker custom">
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input className="form-control" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="form-control" placeholder="Unité canonical" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="vitamin">Vitamine</option><option value="mineral">Minéral</option>
          <option value="iron">Fer</option><option value="hormone_sex">Hormone</option>
          <option value="thyroid">Thyroïde</option><option value="inflammation">Inflammation</option>
          <option value="metabolism">Métabolisme</option><option value="liver">Hépatique</option>
          <option value="lipid">Lipide</option><option value="hema">Hématologie</option>
        </select>
        <select className="form-control" value={direction} onChange={(e) => setDirection(e.target.value as any)}>
          <option value="higher_is_better">+ haut = mieux (vitamines)</option>
          <option value="lower_is_better">+ bas = mieux (CRP, ASAT)</option>
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="form-control" type="number" step="any" placeholder="Seuil 1" value={b1} onChange={(e) => setB1(e.target.value)} />
          <input className="form-control" type="number" step="any" placeholder="Seuil 2" value={b2} onChange={(e) => setB2(e.target.value)} />
          <input className="form-control" type="number" step="any" placeholder="Seuil 3" value={b3} onChange={(e) => setB3(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-red" onClick={submit} disabled={saving}>{saving ? '...' : 'Créer'}</button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Build + commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
npx tsc --noEmit 2>&1 | grep "bloodtest" || echo "no errors"
npm run build 2>&1 | tail -10
git add app/\(app\)/athletes/\[id\]/bloodtest/page.tsx
git commit -m "feat(bloodtest): coach main page (toggle, panel config, history graphs)"
```

### Task 10: Coach validation queue page

**File:** Create `COACH/app/(app)/athletes/[id]/bloodtest/validate/[upload_id]/page.tsx`

- [ ] **Step 1: Implement (split-view PDF + form)**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/ui/Skeleton'
import { MARKERS } from '@/lib/bloodtestCatalog'
import type { BloodtestUploadRow, ExtractedData, ExtractedMarker } from '@/lib/bloodtest'

export default function BloodtestValidatePage() {
  const params = useParams<{ id: string; upload_id: string }>()
  const router = useRouter()
  const { accessToken } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [upload, setUpload] = useState<BloodtestUploadRow | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [editedMarkers, setEditedMarkers] = useState<ExtractedMarker[]>([])
  const [datedAt, setDatedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customMarkers, setCustomMarkers] = useState<{ key: string; label: string; unit_canonical: string }[]>([])

  const load = useCallback(async () => {
    try {
      const [{ data: row }, urlRes, { data: cms }] = await Promise.all([
        supabase.from('bloodtest_uploads').select('*').eq('id', params.upload_id).single(),
        fetch(`/api/bloodtest/signed-url?id=${params.upload_id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()),
        supabase.from('coach_custom_markers').select('marker_key, label, unit_canonical').is('archived_at', null),
      ])
      if (!row) { toast('Upload introuvable', 'error'); return }
      setUpload(row as BloodtestUploadRow)
      setPdfUrl(urlRes.url)
      const data = (row.validated_data || row.extracted_data) as ExtractedData | null
      setEditedMarkers(data?.markers || [])
      setDatedAt(row.dated_at || (data?.detected_dated_at || ''))
      setCustomMarkers((cms || []).map((c: any) => ({ key: c.marker_key, label: c.label, unit_canonical: c.unit_canonical })))
    } finally { setLoading(false) }
  }, [params.upload_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function updateMarker(idx: number, patch: Partial<ExtractedMarker>) {
    setEditedMarkers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }
  function toggleIgnore(idx: number) {
    setEditedMarkers((prev) => prev.map((m, i) => (i === idx ? { ...m, ignored: !m.ignored } : m)))
  }

  async function submit() {
    if (!datedAt) { toast('Date du bilan requise', 'error'); return }
    setSaving(true)
    try {
      const validated_data: ExtractedData = { detected_dated_at: datedAt, markers: editedMarkers }
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
    if (!confirm('Rejeter ce PDF ?')) return
    const { error } = await supabase.from('bloodtest_uploads').update({ archived_at: new Date().toISOString() }).eq('id', params.upload_id)
    if (error) { toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Rejeté', 'success')
    router.push(`/athletes/${params.id}/bloodtest`)
  }

  if (loading) return <Skeleton height={400} />
  if (!upload) return <div>Upload introuvable</div>

  const allMarkerOptions = [...MARKERS.map((m) => ({ key: m.key, label: m.label, unit_canonical: m.unit_canonical })), ...customMarkers]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-outline btn-sm" onClick={() => router.back()}><i className="fas fa-arrow-left" /> Retour</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Valider le bilan</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 480px)', gap: 16, alignItems: 'start' }}>
        <div>
          {pdfUrl ? (
            <iframe src={pdfUrl} style={{ width: '100%', height: '80vh', border: '1px solid var(--border)', borderRadius: 8 }} title="PDF" />
          ) : <div>Chargement PDF...</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>Date du bilan</label>
            <input type="date" className="form-control" value={datedAt} onChange={(e) => setDatedAt(e.target.value)} />
          </div>

          <div style={{ maxHeight: '70vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {editedMarkers.map((m, i) => (
              <div key={i} style={{ padding: 10, background: m.ignored ? 'var(--bg3)' : 'var(--bg2)', opacity: m.ignored ? 0.5 : 1, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Raw : {m.raw_label}</div>
                <select className="form-control" style={{ marginBottom: 6 }} value={m.marker_key || ''} onChange={(e) => updateMarker(i, { marker_key: e.target.value || null })}>
                  <option value="">-- Choisir un marker --</option>
                  {allMarkerOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-control" type="number" step="any" placeholder="Valeur" value={m.value ?? ''} onChange={(e) => updateMarker(i, { value: e.target.value ? parseFloat(e.target.value) : null })} />
                  <input className="form-control" placeholder="Unité" value={m.unit || ''} onChange={(e) => updateMarker(i, { unit: e.target.value })} style={{ maxWidth: 100 }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>Plage labo : {m.lab_reference_range || '—'}</div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => toggleIgnore(i)}>
                  {m.ignored ? 'Ré-inclure' : 'Ignorer cette ligne'}
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={rejectUpload}>Rejeter le PDF</button>
            <button className="btn btn-red" onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Validation...' : 'Valider et publier'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build + commit**

```bash
npx tsc --noEmit 2>&1 | grep "bloodtest" || echo "no errors"
git add app/\(app\)/athletes/\[id\]/bloodtest/validate/\[upload_id\]/page.tsx
git commit -m "feat(bloodtest): validation queue split-view page"
```

---

## Phase 5 — ATHLETE

### Task 11: API helpers ATHLETE

**File:** Create `ATHLETE/src/api/bloodtest.js`

- [ ] **Step 1: Implement**

```js
import { supabase } from '../lib/supabase';

export async function getBloodtestEnabled(athleteId) {
  const { data, error } = await supabase
    .from('athletes').select('bloodtest_enabled, bloodtest_tracked_markers').eq('id', athleteId).single();
  if (error) { console.error('[bloodtest] enabled', error); throw error; }
  return { enabled: data?.bloodtest_enabled || false, tracked: data?.bloodtest_tracked_markers || [] };
}

export async function loadBloodtestUploads(athleteId) {
  const { data, error } = await supabase
    .from('bloodtest_uploads')
    .select('id, athlete_id, uploaded_by, file_path, dated_at, uploaded_at, validated_at, validated_data, extracted_data, archived_at')
    .eq('athlete_id', athleteId)
    .is('archived_at', null)
    .order('dated_at', { ascending: false, nullsFirst: false })
    .order('uploaded_at', { ascending: false })
    .limit(50);
  if (error) { console.error('[bloodtest] uploads', error); throw error; }
  return data || [];
}

export async function uploadBloodtestPdf({ athleteId, athleteUserId, pdfBlob, accessToken, apiBase }) {
  const ts = Date.now();
  const path = `${athleteUserId}/${ts}.pdf`;
  const { error: upErr } = await supabase.storage.from('coach-bloodtest').upload(path, pdfBlob, { contentType: 'application/pdf', upsert: false });
  if (upErr) { console.error('[bloodtest] storage upload', upErr); throw upErr; }
  const res = await fetch(`${apiBase}/api/bloodtest/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ athlete_id: athleteId, uploaded_by: 'athlete', file_path: path }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'upload api error');
  fetch(`${apiBase}/api/bloodtest/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ upload_id: json.upload_id }),
  }).catch((e) => console.error('[bloodtest] extract bg', e));
  return json.upload_id;
}

export async function deleteBloodtestUpload(uploadId) {
  const { error } = await supabase.from('bloodtest_uploads').delete().eq('id', uploadId);
  if (error) { console.error('[bloodtest] delete', error); throw error; }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/api/bloodtest.js
git commit -m "feat(bloodtest): ATHLETE supabase + COACH api helpers"
```

### Task 12: Extend AuthContext SELECT

**File:** Modify `ATHLETE/src/api/athletes.js`

- [ ] **Step 1: Add fields to SELECT**

Locate the SELECT(s) on `athletes` (likely in `getAthleteByEmail`). Add `bloodtest_enabled, bloodtest_tracked_markers` to the column list, next to `fodmap_enabled` for consistency.

- [ ] **Step 2: Commit**

```bash
git add src/api/athletes.js
git commit -m "feat(bloodtest): ATHLETE select bloodtest fields in athletes hydrate"
```

### Task 13: BloodtestScreen

**File:** Create `ATHLETE/src/screens/BloodtestScreen.js`

- [ ] **Step 1: Implement (history + pending)**

```js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, fonts } from '../theme';
import { getMarker } from '../utils/bloodtestCatalog';
import { classifyValue, severityColor } from '../utils/bloodtest';
import { getBloodtestEnabled, loadBloodtestUploads, deleteBloodtestUpload } from '../api/bloodtest';

export default function BloodtestScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { athlete } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [tracked, setTracked] = useState([]);
  const [uploads, setUploads] = useState([]);

  const loadAll = useCallback(async () => {
    if (!athlete?.id) return;
    try {
      const [{ enabled: en, tracked: tr }, ups] = await Promise.all([
        getBloodtestEnabled(athlete.id),
        loadBloodtestUploads(athlete.id),
      ]);
      setEnabled(en); setTracked(tr); setUploads(ups);
    } catch (e) { Alert.alert('Erreur', e.message || String(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [athlete?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
  if (!enabled) return (
    <View style={{ flex: 1, paddingTop: insets.top + spacing.md, padding: spacing.md, backgroundColor: colors.bg }}>
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md }}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
      <Text style={{ color: colors.text }}>Prise de sang non activée pour ton compte.</Text>
    </View>
  );

  const validated = uploads.filter((u) => u.validated_at);
  const pending = uploads.filter((u) => !u.validated_at);

  const seriesMap = new Map();
  for (const up of validated) {
    const data = up.validated_data;
    if (!data?.markers) continue;
    const date = up.dated_at || up.uploaded_at.slice(0, 10);
    for (const m of data.markers) {
      if (!m.marker_key || m.value == null || m.ignored) continue;
      const arr = seriesMap.get(m.marker_key) || [];
      arr.push({ date, value: m.value });
      seriesMap.set(m.marker_key, arr);
    }
  }
  for (const [, arr] of seriesMap) arr.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginLeft: spacing.md }}>Prise de sang</Text>
        <Pressable onPress={() => navigation.navigate('BloodtestUpload')} style={{ marginLeft: 'auto', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>+ Upload</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={colors.primary} />}
      >
        {pending.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.sm }}>EN ATTENTE DE VALIDATION COACH</Text>
            {pending.map((p) => (
              <View key={p.id} style={{ padding: spacing.md, backgroundColor: 'rgba(234,179,8,0.18)', borderRadius: radius.sm, marginBottom: spacing.sm }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Upload {new Date(p.uploaded_at).toLocaleDateString('fr-FR')}</Text>
                <Text style={{ color: colors.text2, fontSize: 12, marginTop: 4 }}>
                  {p.extracted_data ? `${p.extracted_data.markers?.length || 0} valeurs extraites — en attente` : 'Extraction en cours...'}
                </Text>
                <Pressable onPress={() => Alert.alert('Supprimer', 'Confirmer ?', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await deleteBloodtestUpload(p.id); loadAll(); } catch (e) { Alert.alert('Erreur', e.message); } } },
                ])} style={{ marginTop: spacing.sm }}>
                  <Text style={{ color: colors.text3, fontSize: 12 }}>Supprimer</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={{ color: colors.text2, fontSize: 13, marginBottom: spacing.sm }}>HISTORIQUE</Text>
        {tracked.length === 0 ? (
          <Text style={{ color: colors.text3 }}>Pas de markers suivis. Demande à ton coach de configurer ton panel.</Text>
        ) : tracked.map((key) => {
          const m = getMarker(key);
          if (!m) return null;
          const series = seriesMap.get(key) || [];
          const last = series[series.length - 1];
          return (
            <Pressable key={key} onPress={() => navigation.navigate('BloodtestMarkerDetail', { markerKey: key })} style={{ padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.sm, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{m.label}</Text>
                  <Text style={{ color: colors.text3, fontSize: 11 }}>{m.unit_canonical} · {series.length} mesure(s)</Text>
                </View>
                {last && (() => {
                  const cls = classifyValue(m, last.value, { sex: 'F', phase: 'folliculaire' });
                  return (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: cls.ok ? severityColor(cls.band.severity) : colors.text, fontWeight: '700' }}>{last.value} {m.unit_canonical}</Text>
                      {cls.ok && <Text style={{ color: severityColor(cls.band.severity), fontSize: 11 }}>{cls.band.label}</Text>}
                    </View>
                  );
                })()}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/BloodtestScreen.js
git commit -m "feat(bloodtest): ATHLETE main screen (history + pending list)"
```

### Task 14: BloodtestUploadScreen

**File:** Create `ATHLETE/src/screens/BloodtestUploadScreen.js`

- [ ] **Step 1: Implement**

```js
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme';
import { uploadBloodtestPdf } from '../api/bloodtest';
import { COACH_API_BASE } from '../config'; // adjust path to your project's config

export default function BloodtestUploadScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { athlete, accessToken } = useAuth();
  const [busy, setBusy] = useState(false);

  async function pickAndUpload() {
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (res.canceled) { setBusy(false); return; }
      const file = res.assets[0];
      if (file.size > 10 * 1024 * 1024) { Alert.alert('Fichier trop gros', 'Max 10 MB'); setBusy(false); return; }
      const fileBlob = await fetch(file.uri).then((r) => r.blob());
      await uploadBloodtestPdf({ athleteId: athlete.id, athleteUserId: athlete.user_id, pdfBlob: fileBlob, accessToken, apiBase: COACH_API_BASE });
      Alert.alert('Upload réussi', 'En attente de validation par ton coach.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Erreur', e.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: spacing.md }}>Upload prise de sang</Text>
      </View>
      <View style={{ padding: spacing.md, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <Ionicons name="document-attach-outline" size={64} color={colors.text3} />
        <Text style={{ color: colors.text2, marginTop: spacing.md, textAlign: 'center' }}>Sélectionne le PDF de ton bilan{'\n'}(max 10 MB)</Text>
        <Pressable onPress={pickAndUpload} disabled={busy} style={{ marginTop: spacing.lg, backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.sm, minWidth: 200, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Choisir un PDF</Text>}
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/BloodtestUploadScreen.js
git commit -m "feat(bloodtest): ATHLETE upload screen (document picker + post)"
```

### Task 15: BloodtestMarkerDetailScreen (fullscreen graph)

**File:** Create `ATHLETE/src/screens/BloodtestMarkerDetailScreen.js`

- [ ] **Step 1: Implement (with react-native-svg)**

```js
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Polyline, Rect, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme';
import { getMarker } from '../utils/bloodtestCatalog';
import { classifyValue, severityColor } from '../utils/bloodtest';
import { loadBloodtestUploads } from '../api/bloodtest';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BloodtestMarkerDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { athlete } = useAuth();
  const markerKey = route.params?.markerKey;
  const marker = markerKey ? getMarker(markerKey) : null;
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState([]);

  useEffect(() => {
    (async () => {
      if (!athlete?.id) return;
      const ups = await loadBloodtestUploads(athlete.id);
      const validated = ups.filter((u) => u.validated_at);
      const points = [];
      for (const up of validated) {
        const data = up.validated_data;
        if (!data?.markers) continue;
        const date = up.dated_at || up.uploaded_at.slice(0, 10);
        const m = data.markers.find((mk) => mk.marker_key === markerKey && !mk.ignored && mk.value != null);
        if (m) points.push({ date, value: m.value });
      }
      points.sort((a, b) => a.date.localeCompare(b.date));
      setSeries(points);
      setLoading(false);
    })();
  }, [athlete?.id, markerKey]);

  if (!marker) return (
    <View style={{ flex: 1, paddingTop: insets.top, padding: spacing.md, backgroundColor: colors.bg }}>
      <Pressable onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
      <Text style={{ color: colors.text }}>Marker inconnu</Text>
    </View>
  );
  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />;

  const W = SCREEN_WIDTH - spacing.md * 2;
  const H = 280;
  const PAD = 30;
  const minVal = series.length ? Math.min(...series.map((s) => s.value)) : 0;
  const maxVal = series.length ? Math.max(...series.map((s) => s.value)) : 1;
  const range = maxVal - minVal || 1;
  const xFor = (i) => PAD + (series.length > 1 ? (i / (series.length - 1)) * (W - PAD * 2) : (W - PAD * 2) / 2);
  const yFor = (v) => H - PAD - ((v - minVal) / range) * (H - PAD * 2);
  const pointsStr = series.map((s, i) => `${xFor(i)},${yFor(s.value)}`).join(' ');

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginLeft: spacing.md }}>{marker.label}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={{ color: colors.text3, marginBottom: spacing.sm }}>{marker.unit_canonical} · {series.length} mesure(s)</Text>
        {series.length === 0 ? (
          <Text style={{ color: colors.text3 }}>Aucune mesure validée</Text>
        ) : (
          <Svg width={W} height={H} style={{ backgroundColor: colors.bg2, borderRadius: radius.sm }}>
            <Line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={colors.text3} strokeWidth={1} />
            <Polyline points={pointsStr} fill="none" stroke={colors.primary} strokeWidth={2} />
            {series.map((s, i) => <Rect key={i} x={xFor(i) - 3} y={yFor(s.value) - 3} width={6} height={6} fill={colors.primary} />)}
          </Svg>
        )}
        <View style={{ marginTop: spacing.lg }}>
          {series.slice().reverse().map((s, i) => {
            const cls = classifyValue(marker, s.value, { sex: 'F', phase: 'folliculaire' });
            return (
              <View key={i} style={{ padding: spacing.sm, backgroundColor: colors.bg2, borderRadius: radius.sm, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text2 }}>{s.date}</Text>
                <Text style={{ color: cls.ok ? severityColor(cls.band.severity) : colors.text, fontWeight: '700' }}>
                  {s.value} {marker.unit_canonical}{cls.ok ? ` — ${cls.band.label}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/BloodtestMarkerDetailScreen.js
git commit -m "feat(bloodtest): ATHLETE marker detail screen (fullscreen graph)"
```

### Task 16: ProfilScreen entry + Stack registration

**Files:**
- Modify `ATHLETE/src/screens/ProfilScreen.js`
- Modify `ATHLETE/src/navigation/AppNavigator.js`

- [ ] **Step 1: ProfilScreen MENU_ITEMS**

In `MENU_ITEMS` (around line 2222 after FODMAP entry), add :

```js
{ key: 'bloodtest', icon: 'water-outline', label: 'Prise de sang', subtitle: 'Bilans sanguins suivis dans le temps', color: '#ef4444', navigateTo: 'Bloodtest', locked: true },
```

In the `isLocked` expression (around line 2362), add :

```js
|| (item.key === 'bloodtest' && !athlete?.bloodtest_enabled)
```

- [ ] **Step 2: AppNavigator registration**

Add lazy imports near other lazy imports :

```js
const BloodtestScreen = lazy(() => import('../screens/BloodtestScreen'));
const BloodtestUploadScreen = lazy(() => import('../screens/BloodtestUploadScreen'));
const BloodtestMarkerDetailScreen = lazy(() => import('../screens/BloodtestMarkerDetailScreen'));
```

Add Stack.Screen declarations near the FODMAP one :

```jsx
<Stack.Screen name="Bloodtest" component={withSuspense(BloodtestScreen)} options={{ animation: 'slide_from_right' }} />
<Stack.Screen name="BloodtestUpload" component={withSuspense(BloodtestUploadScreen)} options={{ animation: 'slide_from_bottom' }} />
<Stack.Screen name="BloodtestMarkerDetail" component={withSuspense(BloodtestMarkerDetailScreen)} options={{ animation: 'slide_from_right' }} />
```

- [ ] **Step 3: Confirm deps**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
grep -E '"expo-document-picker"|"react-native-svg"' package.json
```

If missing :
- `npx expo install expo-document-picker` (JS-only, no rebuild)
- `npx expo install react-native-svg` (native — full eas build needed)

- [ ] **Step 4: Commit**

```bash
git add src/screens/ProfilScreen.js src/navigation/AppNavigator.js package.json package-lock.json
git commit -m "feat(bloodtest): ATHLETE profile entry + stack registration"
```

---

## Phase 6 — Architecture doc + cascade

### Task 17: Update ARCHITECTURE.md

**File:** Modify `COACH/ARCHITECTURE.md`

- [ ] **Step 1: Routes table (§2)**

After `/athletes/[id]/fodmap` row, add :

```markdown
| `/athletes/[id]/bloodtest` | bloodtest tab | Blood test PDF upload + extraction + validation + history graphs |
| `/athletes/[id]/bloodtest/validate/[upload_id]` | validation page | Coach split-view PDF / extracted markers |
```

- [ ] **Step 2: API routes table (§3)**

```markdown
| `/api/bloodtest/upload` | POST | `bloodtest/upload/route.ts` | Validates path + inserts row in `bloodtest_uploads`. |
| `/api/bloodtest/extract` | POST | `bloodtest/extract/route.ts` | Calls Claude Haiku with PDF, persists `extracted_data`. Server-only ANTHROPIC_API_KEY. |
| `/api/bloodtest/validate` | POST | `bloodtest/validate/route.ts` | Coach submits validated markers + dated_at. |
| `/api/bloodtest/signed-url` | GET `?id=` | `bloodtest/signed-url/route.ts` | 1h signed URL for PDF preview. |
```

- [ ] **Step 3: DB schema (§7) under "Health / Posing / Suppl."**

```markdown
- `bloodtest_uploads` (`id, athlete_id, uploaded_by, file_path, dated_at, uploaded_at, validated_at, validated_by, extracted_data jsonb, validated_data jsonb, ai_extraction_meta jsonb, archived_at`). Workflow extract→validate.
- `coach_custom_markers` (`coach_id, marker_key, label, unit_canonical, category, zones jsonb`). Per-coach custom markers.
- `athletes.bloodtest_enabled` (bool toggle), `athletes.bloodtest_tracked_markers` (jsonb array).
```

- [ ] **Step 4: Storage buckets (§8.3)**

```markdown
| `coach-bloodtest` | `{user_id}/{ts}.pdf` (athlète) or `coach/{coach_id}/{athlete_id}/{ts}.pdf` (coach) | Private. 10MB max, PDF only. Signed URL via `/api/bloodtest/signed-url`. |
```

- [ ] **Step 5: "Where to look for X" (§11)**

```markdown
| Modify bloodtest coach UI | `app/(app)/athletes/[id]/bloodtest/page.tsx` |
| Modify bloodtest validation queue | `app/(app)/athletes/[id]/bloodtest/validate/[upload_id]/page.tsx` |
| Modify bloodtest catalog | `lib/bloodtestCatalog.ts` (mirror in ATHLETE/src/utils/bloodtestCatalog.js) |
| Modify Claude extraction prompt or model | `app/api/bloodtest/extract/route.ts` |
| Modify zone classification logic | `lib/bloodtest.ts` (`classifyValue`) |
```

- [ ] **Step 6: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs(arch): document bloodtest feature"
```

### Task 18: Push branches + E2E + cascade

- [ ] **Step 1: Push**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH && git push -u origin feature/bloodtest
cd /Users/pierrerebmann/MOMENTUM/ATHLETE && git push -u origin feature/bloodtest
```

- [ ] **Step 2: ATHLETE preview**

If `react-native-svg` was installed (native), run a full preview build :
```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
eas build --profile preview --platform ios --non-interactive --no-wait
```
Otherwise, OTA update :
```bash
eas update --branch preview --environment preview --message "feat: bloodtest" --non-interactive
```

- [ ] **Step 3: E2E checklist (manual, on preview)**

1. SQL migration applied (`SELECT count(*) FROM bloodtest_uploads` returns 0 cleanly)
2. `vercel env ls` confirms `ANTHROPIC_API_KEY` present in Preview env
3. Coach toggle ON for a test athlete → tab "Sang" appears, basic preset auto-applied
4. Coach uploads a real PDF → ~10s wait → "À valider" card appears with N markers
5. Coach opens validation queue → split-view shows PDF + form, edit one value, save → record validated
6. Athlete logs in preview app → "Prise de sang" entry visible in Profil → tap → see history with sparklines
7. Tap a marker → fullscreen graph opens
8. Athlete uploads from app → "En attente de validation" appears in his pending list
9. Athlete deletes pending upload → row gone
10. Coach creates a custom marker → appears in checkbox list → can be assigned during validation

- [ ] **Step 4: Cascade preview → develop → main (after E2E green)**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
gh pr create --base develop --head feature/bloodtest --title "feat(bloodtest): full feature"
# user approval → merge
gh pr merge <num> --squash --delete-branch
gh pr create --base main --head develop --title "Release: bloodtest"
gh pr merge <num> --merge

cd /Users/pierrerebmann/MOMENTUM/ATHLETE
gh pr create --base develop --head feature/bloodtest --title "feat(bloodtest): full feature"
gh pr merge <num> --squash --delete-branch
gh pr create --base main --head develop --title "Release: bloodtest"
gh pr merge <num> --merge
```

- [ ] **Step 5: ATHLETE production OTA (after explicit user GO)**

```bash
eas update --branch production --message "feat: bloodtest" --non-interactive
```

User force-quits app to fetch update.

---

## Verification (post-merge)

- DB migration applied in production Supabase (re-run the verify query from Task 1)
- `vercel env ls` shows ANTHROPIC_API_KEY in Production env
- Catalog tests pass : `node --test scripts/test-bloodtest-catalog.mjs`
- Helper tests pass : `node --test scripts/test-bloodtest-helpers.mjs`
- COACH build pass : `npm run build` shows route `/athletes/[id]/bloodtest` and 4 API routes
- Athlete app on prod : Profil shows "Prise de sang" entry (locked or unlocked depending on `bloodtest_enabled`)
- RLS sanity : query `bloodtest_uploads` from athlete A's session returns only A's rows

---

## Notes pour l'exécutant

- Pour les markers `hormonal+` et `total` non détaillés inline (Task 2), **lis le spec §3.2.4 et §3.2.5** et traduis chaque ligne du tableau en entrée TS, en respectant la même shape que les 9 markers `basic` montrés. Pour les hormones féminines à phase variable (E2, Progesterone, LH, FSH, 17-OH-prog), utilise `sex_specific.female_by_phase`. Pour les hormones sex-différenciées sans phase (Testostérone totale/libre, DHEA-S, Androstènedione, Prolactine, SHBG), utilise `sex_specific.male` + `sex_specific.female`.
- Le **prompt Claude** dans Task 5 est minimaliste. Si la qualité d'extraction est mauvaise (markers oubliés, valeurs mal lues), enrichir avec : (a) few-shot examples dans le system prompt, (b) un schéma JSON plus strict en sortie, (c) test d'autres modèles (Sonnet 5x plus cher mais plus précis).
- Les **graphs ATHLETE** utilisent `react-native-svg`. Si pas déjà dans deps, installation = native dep → full eas build (pas d'OTA possible).
- Le **classifyValue** côté UI utilise `{ sex: 'F', phase: 'folliculaire' }` par défaut dans les exemples. À terme, dériver `sex` du profil athlète et `phase` de `menstrual_logs`. Pour MVP, hardcodé est acceptable.
- Le **type guard `'direction' in z`** dans `resolveZoneConfig` exploite le narrowing TypeScript : si la zone a `direction`, c'est ZoneConfig direct ; sinon c'est `sex_specific`. Pas de cast nécessaire.
- Pour le **rate limit**, MVP = pas de limite. Si abus constaté en prod, ajouter une vérif côté API : compter les uploads de la dernière heure pour cet `athlete_id`, si > 1, retourner 429.
