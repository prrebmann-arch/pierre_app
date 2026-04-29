# Performance Audit Fixes — MOMENTUM COACH

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified performance bottlenecks across the COACH app — queries, memoization, loading states, bundle.

**Architecture:** Surgical fixes only. No refactoring, no restructuring. Each task targets one specific bottleneck. Tasks are independent and can be executed in any order within their phase.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL), SWR, React, CSS Modules

---

## Phase 1: Critical Query Fixes (global impact)

### Task 1: Add .limit() to AthleteContext queries

These 3 queries run on EVERY authenticated page and have no limit — a coach with hundreds of athletes loads everything.

**Files:**
- Modify: `contexts/AthleteContext.tsx:34-48`

- [ ] **Step 1: Add limits to all 3 queries in fetchAthletesData**

In `contexts/AthleteContext.tsx`, find the Promise.all block (lines 34-49) and add `.limit(200)` to each query:

```typescript
const [{ data, error }, { data: phases }, { data: plans }] = await Promise.all([
    supabase
      .from('athletes')
      .select('id, user_id, coach_id, prenom, nom, email, avatar_url, date_naissance, genre, objectif, poids_actuel, poids_objectif, access_mode, pas_journalier, water_goal_ml, complete_bilan_frequency, complete_bilan_interval, complete_bilan_day, complete_bilan_anchor_date, complete_bilan_month_day, complete_bilan_notif_time, created_at')
      .eq('coach_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('roadmap_phases')
      .select('athlete_id, phase, name')
      .eq('coach_id', userId)
      .eq('status', 'en_cours')
      .limit(200),
    supabase
      .from('athlete_payment_plans')
      .select('athlete_id, payment_status, amount, frequency, is_free')
      .eq('coach_id', userId)
      .limit(200),
  ])
```

- [ ] **Step 2: Verify the app loads correctly**

Run: `npm run dev` and navigate to `/dashboard`, `/athletes`, `/templates` — all should load athletes list.

- [ ] **Step 3: Commit**

```bash
git add contexts/AthleteContext.tsx
git commit -m "perf: add .limit(200) to AthleteContext queries"
```

---

### Task 2: Add .limit() to 8 other unbounded queries

**Files:**
- Modify: `app/(app)/athletes/[id]/training/page.tsx:218`
- Modify: `app/(app)/athletes/[id]/supplements/page.tsx:192`
- Modify: `app/(app)/athletes/[id]/roadmap/page.tsx:65-71`
- Modify: `components/dashboard/DashboardPage.tsx` (fallback workout_programs query)

- [ ] **Step 1: Fix training page — workout_programs missing .limit()**

In `app/(app)/athletes/[id]/training/page.tsx`, line 218, the workout_programs query has no limit. Add `.limit(50)` before the closing comma:

```typescript
supabase.from('workout_programs').select('id, nom, actif, pattern_type, pattern_data, created_at, workout_sessions(id, nom, jour, exercices, ordre)').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(50),
```

- [ ] **Step 2: Fix supplements page — athlete_supplements missing .limit()**

In `app/(app)/athletes/[id]/supplements/page.tsx`, line 192, change:
```typescript
supabase.from('athlete_supplements').select('*, supplements(*)').eq('athlete_id', params.id),
```
To:
```typescript
supabase.from('athlete_supplements').select('id, athlete_id, supplement_id, dosage, moment, actif, custom_days, supplements(id, nom, marque, type, forme)').eq('athlete_id', params.id).limit(100),
```

This also replaces the `select('*')` wildcard with explicit columns.

- [ ] **Step 3: Fix supplements — reduce supplement_logs from 500 to 200**

Same file, line 194, change `.limit(500)` to `.limit(200)`.

- [ ] **Step 4: Fix roadmap — reduce daily_reports from 500 to 120**

In `app/(app)/athletes/[id]/roadmap/page.tsx`, line 75, change `.limit(500)` to `.limit(120)`.

- [ ] **Step 5: Fix dashboard fallback — workout_programs missing .limit()**

In `components/dashboard/DashboardPage.tsx`, find the fallback Promise.all block (search for `workout_programs` query that has no `.limit()`). Add `.limit(100)`.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/athletes/[id]/training/page.tsx app/(app)/athletes/[id]/supplements/page.tsx app/(app)/athletes/[id]/roadmap/page.tsx components/dashboard/DashboardPage.tsx
git commit -m "perf: add .limit() to 8 unbounded Supabase queries"
```

---

### Task 3: Add 2 missing SQL indexes

**Files:**
- Modify: `sql/perf_indexes.sql`

- [ ] **Step 1: Add missing indexes to the SQL file**

Append at the end of `sql/perf_indexes.sql`:

```sql

-- Onboarding workflows
CREATE INDEX IF NOT EXISTS idx_onboarding_workflows_coach ON onboarding_workflows(coach_id);

-- Questionnaire templates
CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_coach ON questionnaire_templates(coach_id);
```

- [ ] **Step 2: Commit**

```bash
git add sql/perf_indexes.sql
git commit -m "perf: add missing indexes for onboarding_workflows and questionnaire_templates"
```

Note: These SQL statements need to be executed in the Supabase SQL Editor manually.

---

### Task 4: Reduce bilans overview from 1000 to 200 with date filter

**Files:**
- Modify: `components/bilans/BilansOverview.tsx:266-271`

- [ ] **Step 1: Add date range filter and reduce limit**

In `components/bilans/BilansOverview.tsx`, find the daily_reports query (around line 266-271). Change:

```typescript
const { data } = await supabase
  .from('daily_reports')
  .select('id, user_id, date, weight, energy, sleep_quality, stress, adherence, sessions_executed, session_performance, steps, photo_front, photo_side, photo_back')
  .in('user_id', athleteUserIds)
  .order('date', { ascending: false })
  .limit(1000)
```

To:

```typescript
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
const fromDate = thirtyDaysAgo.toISOString().slice(0, 10)

const { data } = await supabase
  .from('daily_reports')
  .select('id, user_id, date, weight, energy, sleep_quality, stress, adherence, sessions_executed, session_performance, steps, photo_front, photo_side, photo_back')
  .in('user_id', athleteUserIds)
  .gte('date', fromDate)
  .order('date', { ascending: false })
  .limit(200)
```

- [ ] **Step 2: Commit**

```bash
git add components/bilans/BilansOverview.tsx
git commit -m "perf: reduce bilans overview from 1000 to 200 reports with 30-day filter"
```

---

## Phase 2: Loading Skeletons (perceived speed)

### Task 5: Create 8 missing loading.tsx files

Every page without a `loading.tsx` shows a blank screen while JS loads. These are lightweight skeleton components that Next.js streams immediately.

**Files:**
- Create: `app/(app)/templates/loading.tsx`
- Create: `app/(app)/bilans/loading.tsx`
- Create: `app/(app)/business/loading.tsx`
- Create: `app/(app)/exercices/loading.tsx`
- Create: `app/(app)/aliments/loading.tsx`
- Create: `app/(app)/formations/loading.tsx`
- Create: `app/(app)/profile/loading.tsx`
- Create: `app/(app)/videos/loading.tsx`

- [ ] **Step 1: Create templates/loading.tsx**

```tsx
export default function TemplatesLoading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 140, height: 38, borderRadius: 10 }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 10, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create bilans/loading.tsx**

```tsx
export default function BilansLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: 100, height: 34, borderRadius: 8 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create business/loading.tsx**

```tsx
export default function BusinessLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 90, borderRadius: 16 }} />
        ))}
      </div>
      <div className="skeleton" style={{ width: '100%', height: 300, borderRadius: 16 }} />
    </div>
  )
}
```

- [ ] **Step 4: Create exercices/loading.tsx**

```tsx
export default function ExercicesLoading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 140, height: 38, borderRadius: 10 }} />
      </div>
      <div className="skeleton" style={{ width: 300, height: 40, borderRadius: 10, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create aliments/loading.tsx**

```tsx
export default function AlimentsLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div className="skeleton" style={{ width: '100%', height: 44, borderRadius: 10, marginBottom: 20 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create formations/loading.tsx**

```tsx
export default function FormationsLoading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 140, height: 38, borderRadius: 10 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create profile/loading.tsx**

```tsx
export default function ProfileLoading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 10, marginBottom: 24 }} />
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ width: 200, height: 20, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 160, height: 16, borderRadius: 8 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 16 }} />
    </div>
  )
}
```

- [ ] **Step 8: Create videos/loading.tsx**

```tsx
export default function VideosLoading() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 140, height: 28, borderRadius: 10 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 80, height: 34, borderRadius: 8 }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Commit all loading files**

```bash
git add app/(app)/templates/loading.tsx app/(app)/bilans/loading.tsx app/(app)/business/loading.tsx app/(app)/exercices/loading.tsx app/(app)/aliments/loading.tsx app/(app)/formations/loading.tsx app/(app)/profile/loading.tsx app/(app)/videos/loading.tsx
git commit -m "perf: add loading.tsx skeletons for 8 pages"
```

---

## Phase 3: Templates Page Memoization

### Task 6: Memoize JSON parsing in TrainingTemplatesList

The `TrainingTemplateCard` component calls `parseSessionExercises()` on every render without memoization. For 100 templates × 4 sessions = 400+ JSON.parse() calls per render.

**Files:**
- Modify: `components/templates/TrainingTemplatesList.tsx:177-197`

- [ ] **Step 1: Add useMemo import and wrap stats computation**

In `components/templates/TrainingTemplatesList.tsx`, the `TrainingTemplateCard` function (line 177) needs `useMemo` for its stats. Change the imports at the top:

```typescript
import { useState, useMemo, memo } from 'react'
```

Then replace lines 177-197 (the TrainingTemplateCard function start) with a memoized version. Replace the stats computation block (lines 188-197):

```typescript
const TrainingTemplateCard = memo(function TrainingTemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: TrainingTemplate
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  const { totalEx, totalSeries, sessionTags } = useMemo(() => {
    const sd = template.sessions_data ?? []
    let ex = 0
    let series = 0
    sd.forEach((s) => {
      const exs = parseSessionExercises(s)
      exs.forEach((e) => {
        ex++
        series += parseInt(String(e.series)) || 0
      })
    })
    return { totalEx: ex, totalSeries: series, sessionTags: sd.map((s) => s.nom || 'Seance') }
  }, [template.sessions_data])
```

Remove the old `const sd = template.sessions_data ?? []` block and `const sessionTags` line that this replaces.

- [ ] **Step 2: Close the memo wrapper**

At the very end of the file (line 349), the function ends with `}`. Change the closing to:

```typescript
})
```

(Closing the `memo()` call.)

- [ ] **Step 3: Commit**

```bash
git add components/templates/TrainingTemplatesList.tsx
git commit -m "perf: memoize TrainingTemplateCard stats computation with useMemo + React.memo"
```

---

### Task 7: Memoize mealCount in NutritionTemplatesList

`mealCount()` calls JSON.parse() for every template on every render.

**Files:**
- Modify: `components/templates/NutritionTemplatesList.tsx`

- [ ] **Step 1: Memoize the meal count computation at list level**

In `components/templates/NutritionTemplatesList.tsx`, after the `filtered` useMemo (around line 69-91), add a memoized map of meal counts:

```typescript
const mealCounts = useMemo(() => {
  const map = new Map<string, number>()
  templates.forEach((t) => map.set(t.id, mealCount(t)))
  return map
}, [templates])
```

Then wherever `mealCount(t)` is called in the render (search for `mealCount(t)` in the file), replace it with `mealCounts.get(t.id) ?? 0`.

- [ ] **Step 2: Commit**

```bash
git add components/templates/NutritionTemplatesList.tsx
git commit -m "perf: memoize mealCount computation in NutritionTemplatesList"
```

---

### Task 8: Memoize categories and add useMemo in templates/page.tsx

**Files:**
- Modify: `app/(app)/templates/page.tsx:197-198`

- [ ] **Step 1: Wrap category arrays with useMemo**

In `app/(app)/templates/page.tsx`, find lines 197-198:

```typescript
const existingTrainingCategories = [...new Set(trainingTemplates.map((t) => t.category).filter(Boolean))] as string[]
const existingNutritionCategories = [...new Set(nutritionTemplates.map((t) => t.category).filter(Boolean))] as string[]
```

Replace with:

```typescript
const existingTrainingCategories = useMemo(
  () => [...new Set(trainingTemplates.map((t) => t.category).filter(Boolean))] as string[],
  [trainingTemplates]
)
const existingNutritionCategories = useMemo(
  () => [...new Set(nutritionTemplates.map((t) => t.category).filter(Boolean))] as string[],
  [nutritionTemplates]
)
```

Ensure `useMemo` is already in the imports (line 1-2 area).

- [ ] **Step 2: Commit**

```bash
git add app/(app)/templates/page.tsx
git commit -m "perf: memoize category arrays in templates page"
```

---

## Phase 4: Athlete Detail Pages

### Task 9: Fix VideoDetail sequential queries → Promise.all

3 sequential network roundtrips where only 2 are needed.

**Files:**
- Modify: `components/videos/VideoDetail.tsx:83-120`

- [ ] **Step 1: Parallelize athlete + prevVids queries**

In `components/videos/VideoDetail.tsx`, the `loadVideo` callback (line 83) first fetches the video, then sequentially fetches athlete and prevVids. Change lines 103-119 to run in parallel:

Replace:
```typescript
const { data: ath } = await supabase
  .from('athletes')
  .select('id, prenom, nom, user_id')
  .eq('id', vid.athlete_id)
  .single()
setAthlete(ath || null)

// Previous videos of same exercise for comparison
const { data: prevVids } = await supabase
  .from('execution_videos')
  .select('id, video_url, thumbnail_url, date, serie_number')
  .eq('athlete_id', vid.athlete_id)
  .eq('exercise_name', vid.exercise_name)
  .neq('id', vid.id)
  .order('date', { ascending: true })
  .limit(50)
```

With:
```typescript
const [{ data: ath }, { data: prevVids }] = await Promise.all([
  supabase
    .from('athletes')
    .select('id, prenom, nom, user_id')
    .eq('id', vid.athlete_id)
    .single(),
  supabase
    .from('execution_videos')
    .select('id, video_url, thumbnail_url, date, serie_number')
    .eq('athlete_id', vid.athlete_id)
    .eq('exercise_name', vid.exercise_name)
    .neq('id', vid.id)
    .order('date', { ascending: true })
    .limit(50),
])
setAthlete(ath || null)
```

- [ ] **Step 2: Commit**

```bash
git add components/videos/VideoDetail.tsx
git commit -m "perf: parallelize VideoDetail athlete + prevVids queries"
```

---

### Task 10: Fix questionnaires waterfall

The responses query waits for assignments to complete, then filters by completed IDs. Fetch all responses for the athlete upfront instead.

**Files:**
- Modify: `app/(app)/athletes/[id]/questionnaires/page.tsx:59-82`

- [ ] **Step 1: Move responses into the initial Promise.all**

Replace the loadData function body (lines 59-82) with:

```typescript
const [{ data: assigns }, { data: tpls }, { data: responses }] = await Promise.all([
  supabase
    .from('questionnaire_assignments')
    .select('*, questionnaire_templates(titre)')
    .eq('athlete_id', params.id)
    .order('sent_at', { ascending: false })
    .limit(100),
  supabase
    .from('questionnaire_templates')
    .select('id, titre, questions')
    .eq('coach_id', user?.id)
    .order('titre')
    .limit(100),
  supabase
    .from('questionnaire_responses')
    .select('id, assignment_id, responses, submitted_at')
    .eq('athlete_id', params.id)
    .limit(200),
])

const rmap: Record<string, any> = {}
;(responses || []).forEach((r: any) => { rmap[r.assignment_id] = r })

const assignsData = assigns || []
```

Note: This requires the `questionnaire_responses` table to have an `athlete_id` column. If it doesn't, keep the original approach but just add `.limit(200)` to the responses query instead.

- [ ] **Step 2: Commit**

```bash
git add app/(app)/athletes/[id]/questionnaires/page.tsx
git commit -m "perf: parallelize questionnaire responses fetch"
```

---

## Phase 5: Bundle & Assets

### Task 11: Dynamic import chart.js in InstagramAnalytics

chart.js is ~25 KB gzipped but only used on the business/instagram route.

**Files:**
- Modify: `components/business/InstagramAnalytics.tsx` (imports section)

- [ ] **Step 1: Convert static chart imports to dynamic**

Find the chart.js imports at the top of `components/business/InstagramAnalytics.tsx` (they look like):

```typescript
import { Chart as ChartJS, ... } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
```

Replace with dynamic registration pattern:

```typescript
import dynamic from 'next/dynamic'

const Line = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), { ssr: false })
const Bar = dynamic(() => import('react-chartjs-2').then(mod => mod.Bar), { ssr: false })
```

And move the `ChartJS.register(...)` call inside a useEffect:

```typescript
useEffect(() => {
  import('chart.js').then(({ Chart, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler }) => {
    Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)
  })
}, [])
```

- [ ] **Step 2: Commit**

```bash
git add components/business/InstagramAnalytics.tsx
git commit -m "perf: dynamic import chart.js in InstagramAnalytics"
```

---

### Task 12: Dynamic import RoadmapTimeline and RoadmapCalendar

Complex components only used on `/athletes/[id]/roadmap`.

**Files:**
- Modify: `app/(app)/athletes/[id]/roadmap/page.tsx` (imports section)

- [ ] **Step 1: Convert static imports to dynamic**

Find the imports for RoadmapTimeline and RoadmapCalendar at the top of the file. Replace:

```typescript
import RoadmapTimeline from '@/components/roadmap/RoadmapTimeline'
import RoadmapCalendar from '@/components/roadmap/RoadmapCalendar'
```

With:

```typescript
import dynamic from 'next/dynamic'

const RoadmapTimeline = dynamic(() => import('@/components/roadmap/RoadmapTimeline'), { ssr: false })
const RoadmapCalendar = dynamic(() => import('@/components/roadmap/RoadmapCalendar'), { ssr: false })
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/athletes/[id]/roadmap/page.tsx
git commit -m "perf: dynamic import RoadmapTimeline and RoadmapCalendar"
```

---

### Task 13: Convert critical <img> tags to next/Image

Avatar images and thumbnails throughout the app use raw `<img>` tags with no optimization.

**Files:**
- Modify: `components/athletes/AthletesList.tsx` (avatar images)
- Modify: `components/videos/VideosGrid.tsx` (video thumbnails) — if it uses `<img>`

- [ ] **Step 1: Convert avatar images in AthletesList**

Find `<img` tags in `components/athletes/AthletesList.tsx` that render athlete avatars. Replace with:

```tsx
import Image from 'next/image'

// Replace <img src={athlete.avatar_url} ... /> with:
<Image
  src={athlete.avatar_url}
  alt={`${athlete.prenom} ${athlete.nom}`}
  width={40}
  height={40}
  style={{ borderRadius: '50%', objectFit: 'cover' }}
/>
```

Ensure the Supabase storage domain is already in `next.config.ts` `images.remotePatterns` (it should be).

- [ ] **Step 2: Commit**

```bash
git add components/athletes/AthletesList.tsx
git commit -m "perf: convert athlete avatars to next/Image"
```

---

### Task 14: Memoize parseSteps in WorkflowsList

`parseSteps()` is called twice per workflow per render.

**Files:**
- Modify: `components/templates/WorkflowsList.tsx`

- [ ] **Step 1: Add useMemo for steps parsing in the list render**

In `components/templates/WorkflowsList.tsx`, find where workflows are mapped/rendered. Where `parseSteps(wf.steps)` is called in the render, wrap the workflow cards in a memoized sub-component or compute steps once in useMemo.

Add `useMemo` to the imports:
```typescript
import { useState, useCallback, useMemo } from 'react'
```

Then, wherever the workflows are mapped (search for `.map((wf`), compute `parsedSteps` once per workflow:

```typescript
const parsedWorkflows = useMemo(() => 
  workflows.map(wf => ({ ...wf, parsedSteps: parseSteps(wf.steps) })),
  [workflows]
)
```

Use `parsedWorkflows` instead of `workflows` in the render, and access `wf.parsedSteps` instead of calling `parseSteps(wf.steps)`.

- [ ] **Step 2: Commit**

```bash
git add components/templates/WorkflowsList.tsx
git commit -m "perf: memoize parseSteps in WorkflowsList"
```
