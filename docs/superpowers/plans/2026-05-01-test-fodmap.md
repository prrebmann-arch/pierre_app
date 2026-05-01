# Test FODMAP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Internaliser le protocole de réintroduction FODMAP utilisé par le coach (aujourd'hui dans Google Sheets) en feature lockable par athlète, dupliquée côté ATHLETE (RN/Expo) et COACH (Next.js web).

**Architecture:** 1 toggle `athletes.fodmap_enabled`, 1 table `athlete_fodmap_logs` partagée, catalogue figé hardcodé en source dans chaque app (8 groupes × 3 aliments × 3 portions = 72 entrées), parité ATHLETE/COACH vérifiée par script. Cascade edit→red via RPC SECURITY DEFINER.

**Tech stack:** Supabase (Postgres + RLS), Next.js 16 + React 19 (COACH), React Native + Expo (ATHLETE), date-fns pour les ISO weeks.

**Spec source:** `docs/superpowers/specs/2026-05-01-fodmap-test-design.md`

---

## Files

### COACH
- Create `sql/2026-05-01-fodmap-test.sql` — DB migration
- Create `lib/fodmapCatalog.ts` — catalogue source de vérité COACH
- Create `lib/fodmap.ts` — helpers purs (ISO week start, status derivation)
- Create `app/(app)/athletes/[id]/fodmap/page.tsx` — page coach
- Modify `app/(app)/athletes/[id]/layout.tsx` — ajouter onglet FODMAP
- Create `scripts/test-fodmap-catalog.mjs` — smoke test catalogue + helpers
- Modify `ARCHITECTURE.md` — documenter route + table

### ATHLETE
- Create `src/utils/fodmapCatalog.js` — mirror du catalogue COACH
- Create `src/utils/fodmap.js` — mirror des helpers
- Create `src/api/fodmap.js` — appels Supabase (load, insert, edit via RPC, archive)
- Create `src/screens/FodmapScreen.js` — écran principal
- Modify `src/screens/ProfilScreen.js` — entrée "Test FODMAP" gated par `fodmap_enabled`
- Modify navigation root (App.js ou stack file) — enregistrer FodmapScreen
- Create `scripts/test-fodmap-parity.mjs` — vérifie parité avec COACH

---

## Phase 1 — Database

### Task 1: SQL migration

**Files:**
- Create `COACH/sql/2026-05-01-fodmap-test.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Toggle par athlète
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS fodmap_enabled boolean NOT NULL DEFAULT false;

-- Enum ordonné (S < M < L) pour comparaison portions
DO $$ BEGIN
  CREATE TYPE fodmap_portion_size AS ENUM ('S','M','L');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table logs Lun/Mer/Ven
CREATE TABLE IF NOT EXISTS athlete_fodmap_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  group_key       text NOT NULL,
  food_key        text NOT NULL,
  portion_size    fodmap_portion_size NOT NULL,
  rating          text NOT NULL CHECK (rating IN ('green','yellow','red')),
  note            text,
  logged_at       timestamptz NOT NULL DEFAULT now(),
  iso_week_start  date GENERATED ALWAYS AS (date_trunc('week', logged_at)::date) STORED,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, iso_week_start, portion_size)
);

CREATE INDEX IF NOT EXISTS idx_fodmap_logs_athlete_week
  ON athlete_fodmap_logs (athlete_id, iso_week_start DESC)
  WHERE archived_at IS NULL;

ALTER TABLE athlete_fodmap_logs ENABLE ROW LEVEL SECURITY;

-- Athlète : SELECT/INSERT/UPDATE sur ses propres rows, sans toucher archived_at, sans DELETE
CREATE POLICY athlete_fodmap_logs_select_self ON athlete_fodmap_logs
  FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));

CREATE POLICY athlete_fodmap_logs_insert_self ON athlete_fodmap_logs
  FOR INSERT
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND archived_at IS NULL
  );

CREATE POLICY athlete_fodmap_logs_update_self ON athlete_fodmap_logs
  FOR UPDATE
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND archived_at IS NULL
  );

-- Coach : SELECT et UPDATE sur ses athlètes
CREATE POLICY athlete_fodmap_logs_coach_read ON athlete_fodmap_logs
  FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

CREATE POLICY athlete_fodmap_logs_coach_update ON athlete_fodmap_logs
  FOR UPDATE
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

-- RPC pour edit avec cascade-delete des portions ultérieures
CREATE OR REPLACE FUNCTION update_fodmap_log_with_cascade(
  p_log_id uuid,
  p_new_rating text,
  p_new_note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_athlete_id uuid;
  v_iso_week_start date;
  v_portion_size fodmap_portion_size;
  v_caller_user_id uuid;
  v_owner_user_id uuid;
BEGIN
  v_caller_user_id := auth.uid();

  SELECT athlete_id, iso_week_start, portion_size
    INTO v_athlete_id, v_iso_week_start, v_portion_size
  FROM athlete_fodmap_logs WHERE id = p_log_id AND archived_at IS NULL;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'log not found or archived';
  END IF;

  SELECT user_id INTO v_owner_user_id FROM athletes WHERE id = v_athlete_id;
  IF v_owner_user_id IS NULL OR v_owner_user_id <> v_caller_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_new_rating NOT IN ('green','yellow','red') THEN
    RAISE EXCEPTION 'invalid rating';
  END IF;

  IF p_new_rating = 'red' THEN
    DELETE FROM athlete_fodmap_logs
    WHERE athlete_id = v_athlete_id
      AND iso_week_start = v_iso_week_start
      AND archived_at IS NULL
      AND portion_size > v_portion_size;
  END IF;

  UPDATE athlete_fodmap_logs
    SET rating = p_new_rating, note = p_new_note
  WHERE id = p_log_id;
END $$;

REVOKE ALL ON FUNCTION update_fodmap_log_with_cascade(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_fodmap_log_with_cascade(uuid, text, text) TO authenticated;
```

- [ ] **Step 2: Apply en preview Supabase**

Ouvrir Supabase Studio (projet preview), SQL Editor, coller, run. Verify : `SELECT * FROM athlete_fodmap_logs LIMIT 1` retourne 0 rows sans erreur, `\d athlete_fodmap_logs` liste les colonnes attendues.

- [ ] **Step 3: Commit**

```bash
git add sql/2026-05-01-fodmap-test.sql
git commit -m "feat(fodmap): db migration for fodmap test logs"
```

---

## Phase 2 — Catalogue partagé

### Task 2: Catalogue COACH

**Files:**
- Create `COACH/lib/fodmapCatalog.ts`

- [ ] **Step 1: Écrire le catalogue**

Source : `RÉINTRODUCTION FODMAPS - RÉINTRODUCTION FODMAPS.csv` fourni par le coach. Lire le CSV, en extraire 8 groupes × 3 aliments × 3 portions = 72 entrées. Forme :

```ts
export type GroupKey = string

export type FodmapGroup = { key: string; label: string }
export type FodmapFood = { key: string; group_key: string; label: string; emoji?: string }
export type FodmapPortionSize = 'S' | 'M' | 'L'
export type FodmapPortion = { food_key: string; size: FodmapPortionSize; label: string }

export const GROUPS: FodmapGroup[] = [
  { key: 'fructanes_legumes', label: 'Fructanes (Légumes)' },
  { key: 'fructanes_fruits',  label: 'Fructanes (Fruits)' },
  { key: 'fructanes_pains',   label: 'Fructanes (Pains, céréales, grains)' },
  { key: 'gos',               label: 'GOS' },
  { key: 'fructose',          label: 'Fructose' },
  { key: 'lactose',           label: 'Lactose' },
  { key: 'polyols_sorbitol',  label: 'Polyols (sorbitol)' },
  { key: 'polyols_mannitol',  label: 'Polyols (mannitol)' },
]

export const FOODS: FodmapFood[] = [
  // À remplir depuis CSV — 24 entrées (3 par groupe).
  // Exemple :
  { key: 'ail',     group_key: 'fructanes_legumes', label: 'Ail',     emoji: '🧄' },
  { key: 'poireau', group_key: 'fructanes_legumes', label: 'Poireau', emoji: '🥬' },
  { key: 'oignon',  group_key: 'fructanes_legumes', label: 'Oignon',  emoji: '🧅' },
  // ... 21 autres
]

export const PORTIONS: FodmapPortion[] = [
  // À remplir depuis CSV — 72 entrées (3 par aliment).
  // Exemple :
  { food_key: 'ail', size: 'S', label: '1/4 gousse' },
  { food_key: 'ail', size: 'M', label: '1/2 gousse' },
  { food_key: 'ail', size: 'L', label: '1 gousse entière' },
  // ... 69 autres
]

export function getFood(key: string): FodmapFood | undefined {
  return FOODS.find((f) => f.key === key)
}

export function getGroupFoods(groupKey: string): FodmapFood[] {
  return FOODS.filter((f) => f.group_key === groupKey)
}

export function getFoodPortions(foodKey: string): FodmapPortion[] {
  const order: Record<FodmapPortionSize, number> = { S: 0, M: 1, L: 2 }
  return PORTIONS.filter((p) => p.food_key === foodKey).sort((a, b) => order[a.size] - order[b.size])
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/fodmapCatalog.ts
git commit -m "feat(fodmap): catalog COACH (8 groups, 24 foods, 72 portions)"
```

### Task 3: Catalogue ATHLETE (mirror)

**Files:**
- Create `ATHLETE/src/utils/fodmapCatalog.js`

- [ ] **Step 1: Mirror en JS**

Identique à COACH mais sans types TS. Mêmes clés, mêmes labels, mêmes emojis. Toute divergence sera détectée par le test de parité (Task 5).

```js
export const GROUPS = [
  { key: 'fructanes_legumes', label: 'Fructanes (Légumes)' },
  { key: 'fructanes_fruits',  label: 'Fructanes (Fruits)' },
  { key: 'fructanes_pains',   label: 'Fructanes (Pains, céréales, grains)' },
  { key: 'gos',               label: 'GOS' },
  { key: 'fructose',          label: 'Fructose' },
  { key: 'lactose',           label: 'Lactose' },
  { key: 'polyols_sorbitol',  label: 'Polyols (sorbitol)' },
  { key: 'polyols_mannitol',  label: 'Polyols (mannitol)' },
];

export const FOODS = [
  { key: 'ail',     group_key: 'fructanes_legumes', label: 'Ail',     emoji: '🧄' },
  { key: 'poireau', group_key: 'fructanes_legumes', label: 'Poireau', emoji: '🥬' },
  { key: 'oignon',  group_key: 'fructanes_legumes', label: 'Oignon',  emoji: '🧅' },
  // ... 21 autres
];

export const PORTIONS = [
  { food_key: 'ail', size: 'S', label: '1/4 gousse' },
  { food_key: 'ail', size: 'M', label: '1/2 gousse' },
  { food_key: 'ail', size: 'L', label: '1 gousse entière' },
  // ... 69 autres
];

export function getFood(key) { return FOODS.find((f) => f.key === key); }
export function getGroupFoods(groupKey) { return FOODS.filter((f) => f.group_key === groupKey); }
export function getFoodPortions(foodKey) {
  const order = { S: 0, M: 1, L: 2 };
  return PORTIONS.filter((p) => p.food_key === foodKey).sort((a, b) => order[a.size] - order[b.size]);
}
```

- [ ] **Step 2: Commit dans ATHLETE**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/utils/fodmapCatalog.js
git commit -m "feat(fodmap): catalog ATHLETE mirror"
```

### Task 4: Script de parité

**Files:**
- Create `COACH/scripts/test-fodmap-catalog.mjs`

- [ ] **Step 1: Écrire le script**

Compare les deux catalogues via JSON deep equality. Pas de framework de test — `node:test` natif.

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const COACH_PATH  = path.resolve('lib/fodmapCatalog.ts')
const ATHLETE_PATH = path.resolve('../ATHLETE/src/utils/fodmapCatalog.js')

// Extrait simple par regex des arrays exportées (suffit pour smoke test).
async function extractArrays(file) {
  const src = await readFile(file, 'utf8')
  const grab = (name) => {
    const re = new RegExp(`export const ${name}[^=]*=\\s*(\\[[\\s\\S]*?\\n\\])`)
    const m = src.match(re)
    if (!m) throw new Error(`Could not find export const ${name} in ${file}`)
    // Nettoie les commentaires et trailing commas pour parsing JSON-loose.
    const cleaned = m[1].replace(/\/\/[^\n]*/g, '').replace(/,(\s*[\]\}])/g, '$1')
    // Parse via JSON après remplacement des keys non-quotées.
    const json = cleaned.replace(/([\{,]\s*)(\w+)\s*:/g, '$1"$2":').replace(/'/g, '"')
    return JSON.parse(json)
  }
  return { GROUPS: grab('GROUPS'), FOODS: grab('FOODS'), PORTIONS: grab('PORTIONS') }
}

test('catalogue COACH a la bonne forme', async () => {
  const c = await extractArrays(COACH_PATH)
  assert.equal(c.GROUPS.length, 8, '8 groups attendus')
  assert.equal(c.FOODS.length, 24, '24 foods attendus (3 par groupe)')
  assert.equal(c.PORTIONS.length, 72, '72 portions attendues (3 par food)')
})

test('catalogue ATHLETE = catalogue COACH', async () => {
  const c = await extractArrays(COACH_PATH)
  const a = await extractArrays(ATHLETE_PATH)
  assert.deepEqual(a.GROUPS, c.GROUPS)
  assert.deepEqual(a.FOODS, c.FOODS)
  assert.deepEqual(a.PORTIONS, c.PORTIONS)
})

test('cohérence interne : tous les food.group_key existent', async () => {
  const c = await extractArrays(COACH_PATH)
  const groupKeys = new Set(c.GROUPS.map((g) => g.key))
  for (const f of c.FOODS) assert.ok(groupKeys.has(f.group_key), `group_key inconnu: ${f.group_key}`)
})

test('cohérence interne : toutes les portions.food_key existent', async () => {
  const c = await extractArrays(COACH_PATH)
  const foodKeys = new Set(c.FOODS.map((f) => f.key))
  for (const p of c.PORTIONS) assert.ok(foodKeys.has(p.food_key), `food_key inconnu: ${p.food_key}`)
})
```

- [ ] **Step 2: Run**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
node --test scripts/test-fodmap-catalog.mjs
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-fodmap-catalog.mjs
git commit -m "test(fodmap): catalog parity + integrity smoke test"
```

---

## Phase 3 — Helpers purs

### Task 5: Helpers COACH

**Files:**
- Create `COACH/lib/fodmap.ts`

- [ ] **Step 1: Écrire les helpers**

```ts
import { GROUPS, FOODS, PORTIONS, type FodmapPortionSize } from './fodmapCatalog'

export type FodmapLog = {
  id: string
  athlete_id: string
  group_key: string
  food_key: string
  portion_size: FodmapPortionSize
  rating: 'green' | 'yellow' | 'red'
  note: string | null
  logged_at: string
  iso_week_start: string
  archived_at: string | null
}

// Renvoie le lundi de la semaine ISO de la date donnée, en YYYY-MM-DD.
// Sans dépendance externe : ISO week = lundi.
export function getISOWeekStart(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=dim, 1=lun, ..., 6=sam
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isMonday(date: Date): boolean {
  return date.getDay() === 1
}

export type GroupStatus =
  | 'not_started'
  | 'in_progress'
  | 'done_all_green'
  | 'done_yellow'
  | 'done_red'

// Logs filtrés par group_key, archived_at IS NULL, sortés S<M<L.
function sortPortion(a: FodmapLog, b: FodmapLog): number {
  const order = { S: 0, M: 1, L: 2 } as const
  return order[a.portion_size] - order[b.portion_size]
}

export function deriveGroupStatus(allLogs: FodmapLog[], group_key: string): GroupStatus {
  const logs = allLogs.filter((l) => !l.archived_at && l.group_key === group_key).sort(sortPortion)
  if (logs.length === 0) return 'not_started'
  const hasRed = logs.some((l) => l.rating === 'red')
  const sLog = logs.find((l) => l.portion_size === 'S')
  // Early stop: S=red close la semaine.
  if (sLog && sLog.rating === 'red') return 'done_red'
  if (logs.length === 3) {
    if (hasRed) return 'done_red'
    if (logs.some((l) => l.rating === 'yellow')) return 'done_yellow'
    return 'done_all_green'
  }
  return 'in_progress'
}

export type ActiveWeek = {
  iso_week_start: string
  group_key: string
  food_key: string
  logs: FodmapLog[]
} | null

export function deriveActiveWeek(allLogs: FodmapLog[], today: Date): ActiveWeek {
  const wk = getISOWeekStart(today)
  const wkLogs = allLogs.filter((l) => !l.archived_at && l.iso_week_start === wk).sort(sortPortion)
  if (wkLogs.length === 0) return null
  const status = deriveGroupStatus(wkLogs, wkLogs[0].group_key)
  if (status === 'done_red' || status === 'done_yellow' || status === 'done_all_green') return null
  return {
    iso_week_start: wk,
    group_key: wkLogs[0].group_key,
    food_key: wkLogs[0].food_key,
    logs: wkLogs,
  }
}

export function deriveProgress(allLogs: FodmapLog[]): { done: number; total: number } {
  const total = GROUPS.length
  const done = GROUPS.filter((g) => {
    const s = deriveGroupStatus(allLogs, g.key)
    return s === 'done_all_green' || s === 'done_yellow' || s === 'done_red'
  }).length
  return { done, total }
}

export function getNextPortionToLog(activeLogs: FodmapLog[]): FodmapPortionSize | null {
  const sizes: FodmapPortionSize[] = ['S', 'M', 'L']
  const logged = new Set(activeLogs.map((l) => l.portion_size))
  for (const s of sizes) if (!logged.has(s)) return s
  return null
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH && npx tsc --noEmit
```

Expected: pas de nouvelle erreur sur `lib/fodmap.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/fodmap.ts
git commit -m "feat(fodmap): pure helpers (iso week, group status, active week)"
```

### Task 6: Helpers ATHLETE (mirror)

**Files:**
- Create `ATHLETE/src/utils/fodmap.js`

- [ ] **Step 1: Mirror en JS**

Mêmes signatures que COACH, sans types. Réutiliser exactement les algorithmes.

```js
import { GROUPS } from './fodmapCatalog';

export function getISOWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isMonday(date) { return date.getDay() === 1; }

const PORTION_ORDER = { S: 0, M: 1, L: 2 };
function sortPortion(a, b) { return PORTION_ORDER[a.portion_size] - PORTION_ORDER[b.portion_size]; }

export function deriveGroupStatus(allLogs, group_key) {
  const logs = allLogs.filter((l) => !l.archived_at && l.group_key === group_key).sort(sortPortion);
  if (logs.length === 0) return 'not_started';
  const sLog = logs.find((l) => l.portion_size === 'S');
  if (sLog && sLog.rating === 'red') return 'done_red';
  const hasRed = logs.some((l) => l.rating === 'red');
  if (logs.length === 3) {
    if (hasRed) return 'done_red';
    if (logs.some((l) => l.rating === 'yellow')) return 'done_yellow';
    return 'done_all_green';
  }
  return 'in_progress';
}

export function deriveActiveWeek(allLogs, today) {
  const wk = getISOWeekStart(today);
  const wkLogs = allLogs.filter((l) => !l.archived_at && l.iso_week_start === wk).sort(sortPortion);
  if (wkLogs.length === 0) return null;
  const status = deriveGroupStatus(wkLogs, wkLogs[0].group_key);
  if (status === 'done_red' || status === 'done_yellow' || status === 'done_all_green') return null;
  return {
    iso_week_start: wk,
    group_key: wkLogs[0].group_key,
    food_key: wkLogs[0].food_key,
    logs: wkLogs,
  };
}

export function deriveProgress(allLogs) {
  const total = GROUPS.length;
  const done = GROUPS.filter((g) => {
    const s = deriveGroupStatus(allLogs, g.key);
    return s === 'done_all_green' || s === 'done_yellow' || s === 'done_red';
  }).length;
  return { done, total };
}

export function getNextPortionToLog(activeLogs) {
  const sizes = ['S', 'M', 'L'];
  const logged = new Set(activeLogs.map((l) => l.portion_size));
  for (const s of sizes) if (!logged.has(s)) return s;
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/utils/fodmap.js
git commit -m "feat(fodmap): pure helpers ATHLETE mirror"
```

---

## Phase 4 — UI Coach

### Task 7: Ajouter onglet FODMAP au layout

**Files:**
- Modify `COACH/app/(app)/athletes/[id]/layout.tsx`

- [ ] **Step 1: Ajouter une entrée dans `TABS`**

Insérer après l'entrée `posing` (ligne 19) :

```ts
{ label: 'FODMAP', route: 'fodmap', icon: 'fa-vial' },
```

- [ ] **Step 2: Verify nav**

`npm run dev`, ouvrir `/athletes/<id>/apercu`, vérifier que l'onglet FODMAP apparaît dans la barre. Cliquer = 404 (page pas encore créée), normal.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/athletes/[id]/layout.tsx
git commit -m "feat(fodmap): add FODMAP tab to athlete detail layout"
```

### Task 8: Page coach — toggle, empty state, vue active week

**Files:**
- Create `COACH/app/(app)/athletes/[id]/fodmap/page.tsx`

- [ ] **Step 1: Page complète**

Pattern miroir de `posing/page.tsx`. Structure : load → toggle → empty/full layout. Code complet ci-dessous (~250 lignes).

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/contexts/ToastContext'
import { useRefetchOnResume } from '@/hooks/useRefetchOnResume'
import Toggle from '@/components/ui/Toggle'
import Skeleton from '@/components/ui/Skeleton'
import {
  GROUPS,
  getFood,
  getGroupFoods,
  getFoodPortions,
} from '@/lib/fodmapCatalog'
import {
  deriveActiveWeek,
  deriveGroupStatus,
  deriveProgress,
  type FodmapLog,
  type GroupStatus,
} from '@/lib/fodmap'

const RATING_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
}

const STATUS_LABEL: Record<GroupStatus, string> = {
  not_started: 'À faire',
  in_progress: 'En cours',
  done_all_green: '✓ Toléré',
  done_yellow: '✓ Modéré',
  done_red: '✗ Symptômes',
}

const STATUS_BG: Record<GroupStatus, string> = {
  not_started: 'var(--bg2)',
  in_progress: 'rgba(179,8,8,0.18)',
  done_all_green: 'rgba(34,197,94,0.18)',
  done_yellow: 'rgba(234,179,8,0.18)',
  done_red: 'rgba(239,68,68,0.18)',
}

export default function FodmapPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [logs, setLogs] = useState<FodmapLog[]>([])

  const loadData = useCallback(async () => {
    try {
      const { data: ath, error: athErr } = await supabase
        .from('athletes').select('fodmap_enabled').eq('id', params.id).single()
      if (athErr) { console.error('[fodmap] athlete', athErr); toast(`Erreur: ${athErr.message}`, 'error'); return }
      const on = ath?.fodmap_enabled || false
      setEnabled(on)
      if (!on) { setLogs([]); return }
      const { data, error } = await supabase
        .from('athlete_fodmap_logs')
        .select('id, athlete_id, group_key, food_key, portion_size, rating, note, logged_at, iso_week_start, archived_at')
        .eq('athlete_id', params.id)
        .is('archived_at', null)
        .order('logged_at', { ascending: false })
        .limit(500)
      if (error) { console.error('[fodmap] logs', error); toast(`Erreur: ${error.message}`, 'error'); return }
      setLogs((data || []) as FodmapLog[])
    } finally {
      setLoading(false)
    }
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (params.id) loadData() }, [params.id, loadData])
  useRefetchOnResume(loadData, loading)

  async function toggleFodmap(on: boolean) {
    const { error } = await supabase.from('athletes').update({ fodmap_enabled: on }).eq('id', params.id)
    if (error) { console.error('[fodmap] toggle', error); toast(`Erreur: ${error.message}`, 'error'); return }
    toast(on ? 'Test FODMAP activé' : 'Test FODMAP désactivé', 'success')
    setEnabled(on)
    if (on) loadData()
  }

  async function rearmWeek(iso_week_start: string, group_key: string) {
    const ok = confirm(`Ré-armer la semaine du ${iso_week_start} pour le groupe "${GROUPS.find((g) => g.key === group_key)?.label}" ? L'athlète pourra refaire ce groupe lundi prochain.`)
    if (!ok) return
    const { error } = await supabase
      .from('athlete_fodmap_logs')
      .update({ archived_at: new Date().toISOString() })
      .eq('athlete_id', params.id)
      .eq('iso_week_start', iso_week_start)
      .is('archived_at', null)
    if (error) { console.error('[fodmap] rearm', error); toast(`Erreur: ${error.message}`, 'error'); return }
    toast('Semaine ré-armée', 'success')
    loadData()
  }

  if (loading) return <Skeleton height={300} borderRadius={12} />

  if (!enabled) {
    return (
      <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
        <i className="fas fa-vial" style={{ fontSize: 36, color: 'var(--text3)', marginBottom: 16, display: 'block' }} />
        <p style={{ color: 'var(--text3)', marginBottom: 16 }}>Test FODMAP désactivé pour cet athlète</p>
        <Toggle checked={false} onChange={toggleFodmap} />
      </div>
    )
  }

  const today = new Date()
  const active = deriveActiveWeek(logs, today)
  const progress = deriveProgress(logs)

  // Historique : 1 entrée par (iso_week_start, group_key) terminé.
  const groupedByWeek = new Map<string, FodmapLog[]>()
  for (const l of logs) {
    const key = `${l.iso_week_start}__${l.group_key}`
    const arr = groupedByWeek.get(key) || []
    arr.push(l)
    groupedByWeek.set(key, arr)
  }
  const history = Array.from(groupedByWeek.entries())
    .map(([k, arr]) => {
      const [iso_week_start, group_key] = k.split('__')
      return { iso_week_start, group_key, logs: arr, status: deriveGroupStatus(arr, group_key) }
    })
    .filter((h) => h.status !== 'in_progress' && h.status !== 'not_started')
    .filter((h) => !active || h.iso_week_start !== active.iso_week_start)
    .sort((a, b) => b.iso_week_start.localeCompare(a.iso_week_start))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 8, flexWrap: 'wrap' }}>
        <Toggle checked={enabled} onChange={toggleFodmap} label="Test FODMAP actif" />
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Progression : <strong style={{ color: 'var(--text)' }}>{progress.done} / {progress.total}</strong>
        </div>
      </div>

      {/* Semaine en cours */}
      {active && (() => {
        const food = getFood(active.food_key)
        const group = GROUPS.find((g) => g.key === active.group_key)
        const portions = getFoodPortions(active.food_key)
        return (
          <div style={{ padding: 16, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Semaine en cours</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{group?.label} · {food?.emoji} {food?.label}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => rearmWeek(active.iso_week_start, active.group_key)}>
                <i className="fas fa-rotate-left" /> Ré-armer
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(['S', 'M', 'L'] as const).map((size, i) => {
                const dayLabel = ['Lundi', 'Mercredi', 'Vendredi'][i]
                const log = active.logs.find((l) => l.portion_size === size)
                const portion = portions.find((p) => p.size === size)
                return (
                  <div key={size} style={{ padding: 10, background: 'var(--bg3)', borderRadius: 8, borderLeft: log ? `3px solid ${RATING_COLOR[log.rating]}` : '3px solid transparent' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{dayLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{portion?.label}</div>
                    {log ? (
                      <>
                        <div style={{ fontSize: 12, color: RATING_COLOR[log.rating], marginTop: 4 }}>
                          {log.rating === 'green' ? '🟢 Toléré' : log.rating === 'yellow' ? '🟡 Modéré' : '🔴 Symptômes'}
                        </div>
                        {log.note && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>{log.note}</div>}
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>En attente</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Historique */}
      {history.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            <i className="fas fa-clock-rotate-left" style={{ color: 'var(--primary)', marginRight: 6 }} />Historique
          </h3>
          {history.map((h) => {
            const food = getFood(h.logs[0].food_key)
            const group = GROUPS.find((g) => g.key === h.group_key)
            return (
              <div key={`${h.iso_week_start}-${h.group_key}`} style={{ padding: 12, background: 'var(--bg2)', borderRadius: 10, borderLeft: `3px solid ${STATUS_BG[h.status]}`, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{group?.label} · {food?.emoji} {food?.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Semaine du {h.iso_week_start} · {STATUS_LABEL[h.status]}</div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => rearmWeek(h.iso_week_start, h.group_key)}>
                    <i className="fas fa-rotate-left" /> Ré-armer
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text2)' }}>
                  {h.logs.sort((a, b) => ['S','M','L'].indexOf(a.portion_size) - ['S','M','L'].indexOf(b.portion_size)).map((l) => (
                    <span key={l.id}>
                      <span style={{ color: RATING_COLOR[l.rating] }}>●</span> {l.portion_size}{l.note ? ` — ${l.note}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Pas encore testés */}
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '24px 0 10px' }}>
        <i className="fas fa-list" style={{ color: 'var(--primary)', marginRight: 6 }} />Tous les groupes
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {GROUPS.map((g) => {
          const status = deriveGroupStatus(logs, g.key)
          return (
            <div key={g.key} style={{ padding: 10, background: STATUS_BG[status], borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{g.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{STATUS_LABEL[status]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + build**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
npx tsc --noEmit
npm run build
```

Expected: 0 erreurs nouvelles.

- [ ] **Step 3: Smoke test manuel**

`npm run dev`, login coach, ouvrir `/athletes/<id>/fodmap` :
- Toggle off : empty state OK
- Toggle on : page bascule, 8 groupes affichés en "À faire"
- Ré-armer : pas de bouton tant qu'aucune semaine active

- [ ] **Step 4: Commit**

```bash
git add app/(app)/athletes/[id]/fodmap/page.tsx
git commit -m "feat(fodmap): coach page (toggle, active week, history, re-arm)"
```

---

## Phase 5 — ATHLETE API + Screen

### Task 9: API helpers ATHLETE

**Files:**
- Create `ATHLETE/src/api/fodmap.js`

- [ ] **Step 1: Helpers Supabase**

```js
import { supabase } from '../lib/supabase';

export async function getFodmapEnabled(athleteId) {
  const { data, error } = await supabase
    .from('athletes').select('fodmap_enabled').eq('id', athleteId).single();
  if (error) { console.error('[fodmap] getFodmapEnabled', error); throw error; }
  return data?.fodmap_enabled || false;
}

export async function loadFodmapLogs(athleteId) {
  const { data, error } = await supabase
    .from('athlete_fodmap_logs')
    .select('id, athlete_id, group_key, food_key, portion_size, rating, note, logged_at, iso_week_start, archived_at')
    .eq('athlete_id', athleteId)
    .is('archived_at', null)
    .order('logged_at', { ascending: false })
    .limit(500);
  if (error) { console.error('[fodmap] loadFodmapLogs', error); throw error; }
  return data || [];
}

export async function insertFodmapLog({ athleteId, group_key, food_key, portion_size, rating, note }) {
  const { data, error } = await supabase
    .from('athlete_fodmap_logs')
    .insert({ athlete_id: athleteId, group_key, food_key, portion_size, rating, note: note || null })
    .select('id, athlete_id, group_key, food_key, portion_size, rating, note, logged_at, iso_week_start, archived_at')
    .single();
  if (error) { console.error('[fodmap] insertFodmapLog', error); throw error; }
  return data;
}

export async function updateFodmapNote({ logId, note }) {
  const { error } = await supabase
    .from('athlete_fodmap_logs')
    .update({ note: note || null })
    .eq('id', logId);
  if (error) { console.error('[fodmap] updateFodmapNote', error); throw error; }
}

export async function updateFodmapLogWithCascade({ logId, newRating, newNote }) {
  const { error } = await supabase.rpc('update_fodmap_log_with_cascade', {
    p_log_id: logId,
    p_new_rating: newRating,
    p_new_note: newNote || null,
  });
  if (error) { console.error('[fodmap] updateFodmapLogWithCascade', error); throw error; }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git add src/api/fodmap.js
git commit -m "feat(fodmap): ATHLETE supabase api helpers"
```

### Task 10: FodmapScreen — vue principale

**Files:**
- Create `ATHLETE/src/screens/FodmapScreen.js`

- [ ] **Step 1: Squelette + écran principal**

Reprendre le pattern `MenstrualScreen.js` (utiliser comme template visuel — couleurs/spacing/headers). Pseudocode des 3 états gérés dans cette task :
- pas de semaine active + < 8 groupes complétés → grid des 8 groupes (cards "À faire" / "✓ Toléré" / etc.) + CTA "Choisis un groupe"
- semaine active → carte large + timeline Lun/Mer/Ven + bouton "Logger ma portion {S/M/L}" si jour OK
- 8/8 done → header "Réintroduction terminée 🎉" + grid en read-only

```js
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, fonts } from '../theme';
import { GROUPS, getFood, getGroupFoods, getFoodPortions } from '../utils/fodmapCatalog';
import {
  getISOWeekStart, isMonday, deriveActiveWeek, deriveGroupStatus,
  deriveProgress, getNextPortionToLog,
} from '../utils/fodmap';
import {
  getFodmapEnabled, loadFodmapLogs, insertFodmapLog,
  updateFodmapNote, updateFodmapLogWithCascade,
} from '../api/fodmap';

const RATING_LABEL = { green: '🟢 Toléré', yellow: '🟡 Modéré', red: '🔴 Symptômes' };
const RATING_COLOR = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };
const PORTION_LABEL = { S: 'petite', M: 'moyenne', L: 'grande' };
const DAY_LABEL = { S: 'Lundi', M: 'Mercredi', L: 'Vendredi' };

export default function FodmapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { athlete } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState([]);

  // Modals — chacun rempli par les sous-tasks suivantes.
  const [pickFoodFor, setPickFoodFor] = useState(null);   // { group_key }
  const [logModal, setLogModal] = useState(null);          // { group_key, food_key, portion_size, existingLogId }
  const [editNoteFor, setEditNoteFor] = useState(null);    // { logId, currentNote }

  const loadAll = useCallback(async () => {
    if (!athlete?.id) return;
    try {
      const [en, ls] = await Promise.all([
        getFodmapEnabled(athlete.id),
        loadFodmapLogs(athlete.id),
      ]);
      setEnabled(en);
      setLogs(ls);
    } catch (e) {
      Alert.alert('Erreur', e.message || String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athlete?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;

  if (!enabled) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + spacing.md, padding: spacing.md, backgroundColor: colors.background }}>
        <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md }}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, ...fonts.body }}>Test FODMAP n'est pas activé pour ton compte.</Text>
      </View>
    );
  }

  const today = new Date();
  const active = deriveActiveWeek(logs, today);
  const progress = deriveProgress(logs);
  const allDone = progress.done === progress.total;

  const onTapGroup = (g) => {
    const status = deriveGroupStatus(logs, g.key);
    if (status !== 'not_started') return; // historique : pas d'action ici
    if (active) { Alert.alert('Une semaine est déjà en cours', 'Termine ou attends qu\'elle se ferme avant d\'en démarrer une autre.'); return; }
    if (!isMonday(today)) { Alert.alert('Démarre lundi', 'Tu pourras démarrer ce groupe lundi prochain.'); return; }
    setPickFoodFor({ group_key: g.key });
  };

  const next = active ? getNextPortionToLog(active.logs) : null;
  const todayMatchesNext =
    next === 'S' ? today.getDay() === 1 :
    next === 'M' ? today.getDay() === 3 :
    next === 'L' ? today.getDay() === 5 : false;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, ...fonts.h2, marginLeft: spacing.md }}>Test FODMAP</Text>
        <Text style={{ marginLeft: 'auto', color: colors.text2, ...fonts.body }}>{progress.done} / {progress.total}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={colors.primary} />}
      >
        {allDone && (
          <View style={{ padding: spacing.lg, backgroundColor: 'rgba(34,197,94,0.18)', borderRadius: radius.md, marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, ...fonts.h2 }}>Réintroduction terminée 🎉</Text>
            <Text style={{ color: colors.text2, marginTop: 6 }}>Tu as testé les 8 groupes FODMAP. Discute des résultats avec ton coach.</Text>
          </View>
        )}

        {active && (() => {
          const food = getFood(active.food_key);
          const group = GROUPS.find((g) => g.key === active.group_key);
          const portions = getFoodPortions(active.food_key);
          return (
            <View style={{ padding: spacing.md, backgroundColor: 'rgba(179,8,8,0.18)', borderRadius: radius.md, marginBottom: spacing.md }}>
              <Text style={{ color: colors.text2, ...fonts.small }}>SEMAINE EN COURS</Text>
              <Text style={{ color: colors.text, ...fonts.h2, marginTop: 4 }}>{group?.label}</Text>
              <Text style={{ color: colors.text, ...fonts.body, marginTop: 2 }}>{food?.emoji} {food?.label}</Text>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                {['S','M','L'].map((size) => {
                  const log = active.logs.find((l) => l.portion_size === size);
                  const portion = portions.find((p) => p.size === size);
                  return (
                    <Pressable
                      key={size}
                      onPress={() => log
                        ? setLogModal({ group_key: active.group_key, food_key: active.food_key, portion_size: size, existingLogId: log.id, existingRating: log.rating, existingNote: log.note })
                        : null}
                      style={{ flex: 1, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: log ? `${RATING_COLOR[log.rating]}33` : colors.bg2, borderWidth: log ? 1 : 0, borderColor: log ? RATING_COLOR[log.rating] : 'transparent' }}
                    >
                      <Text style={{ color: colors.text2, ...fonts.small }}>{DAY_LABEL[size]}</Text>
                      <Text style={{ color: colors.text, ...fonts.body, marginTop: 2 }}>{portion?.label}</Text>
                      <Text style={{ color: log ? RATING_COLOR[log.rating] : colors.text3, ...fonts.small, marginTop: 4 }}>
                        {log ? RATING_LABEL[log.rating] : 'En attente'}
                      </Text>
                      {log?.note && <Text style={{ color: colors.text2, ...fonts.small, marginTop: 2, fontStyle: 'italic' }}>{log.note}</Text>}
                    </Pressable>
                  );
                })}
              </View>

              {next && todayMatchesNext && (
                <Pressable
                  onPress={() => setLogModal({ group_key: active.group_key, food_key: active.food_key, portion_size: next })}
                  style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primary, borderRadius: radius.sm, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', ...fonts.bodyBold }}>Logger ma portion {PORTION_LABEL[next]}</Text>
                </Pressable>
              )}
            </View>
          );
        })()}

        {!active && !allDone && (
          <View style={{ padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.md, marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, ...fonts.bodyBold }}>Choisis ton groupe</Text>
            <Text style={{ color: colors.text2, ...fonts.small, marginTop: 4 }}>
              {isMonday(today) ? 'Tape un groupe "À faire" pour commencer cette semaine.' : 'Reviens lundi pour démarrer un nouveau groupe.'}
            </Text>
          </View>
        )}

        <Text style={{ color: colors.text, ...fonts.h3, marginTop: spacing.md, marginBottom: spacing.sm }}>Tous les groupes</Text>
        {GROUPS.map((g) => {
          const status = deriveGroupStatus(logs, g.key);
          const bg = status === 'not_started' ? colors.bg2
            : status === 'in_progress' ? 'rgba(179,8,8,0.18)'
            : status === 'done_all_green' ? 'rgba(34,197,94,0.18)'
            : status === 'done_yellow' ? 'rgba(234,179,8,0.18)'
            : 'rgba(239,68,68,0.18)';
          const label = status === 'not_started' ? 'À faire'
            : status === 'in_progress' ? 'En cours'
            : status === 'done_all_green' ? '✓ Toléré'
            : status === 'done_yellow' ? '✓ Modéré'
            : '✗ Symptômes';
          return (
            <Pressable
              key={g.key}
              onPress={() => onTapGroup(g)}
              style={{ padding: spacing.md, backgroundColor: bg, borderRadius: radius.sm, marginBottom: spacing.sm }}
            >
              <Text style={{ color: colors.text, ...fonts.bodyBold }}>{g.label}</Text>
              <Text style={{ color: colors.text2, ...fonts.small, marginTop: 2 }}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Modals — implémentés dans Tasks 11 + 12 */}
      <PickFoodModal
        visible={!!pickFoodFor}
        groupKey={pickFoodFor?.group_key}
        onCancel={() => setPickFoodFor(null)}
        onPicked={(food_key) => {
          setLogModal({ group_key: pickFoodFor.group_key, food_key, portion_size: 'S' });
          setPickFoodFor(null);
        }}
      />
      <LogModal
        visible={!!logModal}
        params={logModal}
        athleteId={athlete?.id}
        onCancel={() => setLogModal(null)}
        onSaved={() => { setLogModal(null); loadAll(); }}
      />
    </View>
  );
}

// PickFoodModal et LogModal sont définis dans la même file — voir Tasks 11 et 12.
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/FodmapScreen.js
git commit -m "feat(fodmap): ATHLETE main screen scaffold"
```

### Task 11: FodmapScreen — modal sélection aliment (start-week Lundi)

**Files:**
- Modify `ATHLETE/src/screens/FodmapScreen.js` — ajouter `PickFoodModal` à la fin

- [ ] **Step 1: Modal**

```js
function PickFoodModal({ visible, groupKey, onCancel, onPicked }) {
  if (!visible || !groupKey) return null;
  const foods = getGroupFoods(groupKey);
  const group = GROUPS.find((g) => g.key === groupKey);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{ padding: spacing.md, backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <Text style={{ color: colors.text, ...fonts.h2 }}>{group?.label}</Text>
          <Text style={{ color: colors.text2, ...fonts.small, marginTop: 4, marginBottom: spacing.md }}>Choisis 1 aliment à tester cette semaine</Text>
          {foods.map((f) => {
            const portions = getFoodPortions(f.key);
            return (
              <Pressable
                key={f.key}
                onPress={() => onPicked(f.key)}
                style={{ padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.sm, marginBottom: spacing.sm }}
              >
                <Text style={{ color: colors.text, ...fonts.bodyBold }}>{f.emoji} {f.label}</Text>
                <Text style={{ color: colors.text3, ...fonts.small, marginTop: 4 }}>
                  Lun: {portions.find((p) => p.size === 'S')?.label} · Mer: {portions.find((p) => p.size === 'M')?.label} · Ven: {portions.find((p) => p.size === 'L')?.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={onCancel} style={{ padding: spacing.md, alignItems: 'center', marginTop: spacing.sm }}>
            <Text style={{ color: colors.text2 }}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/FodmapScreen.js
git commit -m "feat(fodmap): ATHLETE pick-food modal"
```

### Task 12: FodmapScreen — modal de log + edit rating cascade

**Files:**
- Modify `ATHLETE/src/screens/FodmapScreen.js` — ajouter `LogModal`

- [ ] **Step 1: Modal log/edit**

Une seule modal qui gère insert (nouveau log) + edit rating (cascade RPC) + edit note (UPDATE simple).

```js
function LogModal({ visible, params, athleteId, onCancel, onSaved }) {
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params) {
      setRating(params.existingRating || null);
      setNote(params.existingNote || '');
    } else {
      setRating(null);
      setNote('');
    }
  }, [params]);

  if (!visible || !params) return null;

  const food = getFood(params.food_key);
  const portion = getFoodPortions(params.food_key).find((p) => p.size === params.portion_size);
  const isEdit = !!params.existingLogId;

  async function submit() {
    if (!rating) { Alert.alert('Choisis un rating'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        // Edit avec cascade : si rating change vers red, RPC delete les portions ultérieures.
        if (rating !== params.existingRating) {
          if (rating === 'red' && params.portion_size !== 'L') {
            const ok = await new Promise((r) => Alert.alert(
              'Confirmer',
              'Cela invalidera les portions Mer/Ven déjà loggées de cette semaine. Continuer ?',
              [{ text: 'Annuler', onPress: () => r(false) }, { text: 'Confirmer', onPress: () => r(true) }],
            ));
            if (!ok) { setSaving(false); return; }
          }
          await updateFodmapLogWithCascade({ logId: params.existingLogId, newRating: rating, newNote: note });
        } else {
          await updateFodmapNote({ logId: params.existingLogId, note });
        }
      } else {
        await insertFodmapLog({
          athleteId,
          group_key: params.group_key,
          food_key: params.food_key,
          portion_size: params.portion_size,
          rating,
          note,
        });
      }
      onSaved();
    } catch (e) {
      Alert.alert('Erreur', e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{ padding: spacing.md, backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <Text style={{ color: colors.text, ...fonts.h2 }}>{food?.emoji} {food?.label}</Text>
          <Text style={{ color: colors.text2, ...fonts.body, marginTop: 4 }}>{DAY_LABEL[params.portion_size]} · {portion?.label}</Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {['green','yellow','red'].map((r) => (
              <Pressable
                key={r}
                onPress={() => setRating(r)}
                style={{ padding: spacing.md, backgroundColor: rating === r ? `${RATING_COLOR[r]}33` : colors.bg2, borderRadius: radius.sm, borderWidth: rating === r ? 1 : 0, borderColor: RATING_COLOR[r] }}
              >
                <Text style={{ color: colors.text, ...fonts.bodyBold }}>{RATING_LABEL[r]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: colors.text2, ...fonts.small, marginTop: spacing.md }}>Note (optionnel)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Symptômes, contexte du repas..."
            placeholderTextColor={colors.text3}
            multiline
            style={{ marginTop: 4, padding: spacing.sm, color: colors.text, backgroundColor: colors.bg2, borderRadius: radius.sm, minHeight: 60 }}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable onPress={onCancel} style={{ flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: colors.bg2, borderRadius: radius.sm }}>
              <Text style={{ color: colors.text2 }}>Annuler</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={saving} style={{ flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.sm, opacity: saving ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', ...fonts.bodyBold }}>{saving ? '...' : (isEdit ? 'Mettre à jour' : 'Enregistrer')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/FodmapScreen.js
git commit -m "feat(fodmap): ATHLETE log modal with cascade-edit support"
```

### Task 13: Entrée ProfilScreen + enregistrement Stack

**Files:**
- Modify `ATHLETE/src/screens/ProfilScreen.js` — ajouter une row "Test FODMAP" gated par `athlete.fodmap_enabled`
- Modify le fichier de navigation root (probablement `App.js` ou `src/navigation/...`) — enregistrer `FodmapScreen`

- [ ] **Step 1: Repérer la section "settings rows" dans ProfilScreen.js**

Lire la section ~bas du fichier où sont rendues les autres rows lockables (probablement Posing, Bilan, Roadmap). Reproduire le même pattern :

```js
{athlete?.fodmap_enabled && (
  <Pressable onPress={() => navigation.navigate('Fodmap')} style={settingsRowStyle}>
    <Ionicons name="flask" size={20} color={colors.primary} />
    <Text style={{ color: colors.text, marginLeft: spacing.sm, flex: 1 }}>Test FODMAP</Text>
    <Ionicons name="chevron-forward" size={18} color={colors.text3} />
  </Pressable>
)}
```

- [ ] **Step 2: Enregistrer la screen**

Dans le navigation file, ajouter :

```js
import FodmapScreen from './src/screens/FodmapScreen';
// ...
<Stack.Screen name="Fodmap" component={FodmapScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Charger fodmap_enabled dans le useAuth**

Vérifier que `athlete` retourné par `useAuth` contient bien `fodmap_enabled`. Si non, ajouter à la query Supabase qui hydrate l'athlete (chercher dans `src/context/AuthContext.js` ou équivalent, tout SELECT sur `athletes` doit être étendu).

- [ ] **Step 4: Smoke test**

`npx expo start`, login athlète test, ouvrir Profil :
- toggle off côté coach → entrée masquée
- toggle on → entrée visible → tap → ouvre `FodmapScreen` → 8 cards "À faire"

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProfilScreen.js App.js src/context/AuthContext.js
git commit -m "feat(fodmap): ATHLETE profile entry + screen registration"
```

---

## Phase 6 — ARCHITECTURE.md + tests E2E + cascade

### Task 14: Update ARCHITECTURE.md COACH

**Files:**
- Modify `COACH/ARCHITECTURE.md`

- [ ] **Step 1: Ajouter la route**

Section "Routes" (table) : ajouter
```
| `/athletes/[id]/fodmap` | fodmap test tab | FODMAP reintro tracking |
```

Section "DB schema → Health / Posing / Suppl." : ajouter
```
- `athlete_fodmap_logs` (cols: id, athlete_id, group_key, food_key, portion_size enum S/M/L, rating, note, logged_at, iso_week_start GENERATED, archived_at). RPC `update_fodmap_log_with_cascade` for athlete edits.
- `athletes.fodmap_enabled` boolean toggle (mirror posing).
```

Section "Where to look for X" : ajouter
```
| Modify FODMAP coach UI | `app/(app)/athletes/[id]/fodmap/page.tsx` |
| Modify FODMAP catalog (8 groups, 24 foods, 72 portions) | `lib/fodmapCatalog.ts` (mirror in ATHLETE/src/utils/fodmapCatalog.js) |
| Modify FODMAP status derivation | `lib/fodmap.ts` |
```

- [ ] **Step 2: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs(arch): document FODMAP route + table + helpers"
```

### Task 15: E2E manuel sur preview

- [ ] **Step 1: Activer FODMAP côté coach**

Login coach (preview), `/athletes/<test>/fodmap` → toggle ON.

- [ ] **Step 2: Sur ATHLETE preview, login + démarrer un groupe**

Profil → Test FODMAP. Si pas Lundi : message bloquant. Si Lundi : modal aliment → choisir → modal log S → submit avec rating green + note.

- [ ] **Step 3: Vérifier côté coach**

Refresh `/athletes/<test>/fodmap` : carte "Semaine en cours" affiche le groupe + l'aliment + S = 🟢 + note.

- [ ] **Step 4: Edit cascade**

ATHLETE : tap S log existant → modal preset au rating green → changer en red → confirmation cascade → submit. Vérifier qu'aucun M/L n'apparaît (si existaient avant).

- [ ] **Step 5: Re-arme coach**

COACH : bouton "Ré-armer" sur la semaine → confirmer. ATHLETE : pull-to-refresh → écran retombe en "pas de semaine active".

### Task 16: Cascade preview → develop → main

- [ ] **Step 1: Workflow PR COACH**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git push -u origin feature/fodmap-test
gh pr create --base develop --title "feat(fodmap): test FODMAP coach + db"
```

Attendre validation user. Puis cascade selon CLAUDE.md (squash develop, PR develop→main).

- [ ] **Step 2: Workflow PR ATHLETE**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git push -u origin feature/fodmap-test
gh pr create --base develop --title "feat(fodmap): test FODMAP screen + api"
```

- [ ] **Step 3: ATHLETE OTA preview**

```bash
eas update --branch preview --message "feat: FODMAP test"
```

User force-quit app → tester → si OK, demander confirmation pour `eas update --branch production`.

---

## Verification (post-merge)

- DB : preview Supabase a `athlete_fodmap_logs` + RPC + RLS policies actives, `\df update_fodmap_log_with_cascade` retourne SECURITY DEFINER
- Catalogue : `node --test scripts/test-fodmap-catalog.mjs` (4 tests pass)
- Coach : `npm run build` pass, route `/athletes/<id>/fodmap` rend, toggle marche, ré-arme marche
- Athlète : entrée Profil visible si toggle on, écran principal rend, log S/M/L marche selon le jour, edit avec cascade marche
- RLS : test cross-account (athlète A ne lit pas les logs de B, coach C ne lit pas un athlète qu'il ne coache pas)

---

## Notes pour l'exécutant

- Le CSV "RÉINTRODUCTION FODMAPS - RÉINTRODUCTION FODMAPS.csv" est à demander au coach pour remplir les 24 foods + 72 portions (les exemples du plan ne sont pas exhaustifs).
- Les chemins `colors`, `spacing`, `radius`, `fonts` ATHLETE sont importés depuis `../theme` — vérifier les noms exacts (e.g. `colors.bg2` vs `colors.background2`) en regardant `src/theme/index.js`.
- Le pattern Posing (`COACH/app/(app)/athletes/[id]/posing/page.tsx`) sert de référence pour les conventions visuelles côté coach. Pas besoin de tout dupliquer, juste les briques pertinentes (Toggle + empty state + skeleton).
- Le test snapshot (Task 4) parse les `.ts`/`.js` via regex — c'est rough mais suffisant pour le smoke. Si jamais il devient fragile, switcher vers un build TS qui re-export les arrays en JSON puis comparer.
