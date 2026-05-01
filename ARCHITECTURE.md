# COACH — Architecture Map

> **Goal of this document**: tell any agent where to look for any task in seconds, without scanning the repo. Read it at session start. Keep it current when architecture changes.

---

## 1. Stack

| Layer | Version / Lib |
|---|---|
| Framework | **Next.js 16.2.1** (App Router, `--webpack`) |
| React | **19.2.4** |
| Auth + DB | **@supabase/ssr 0.10**, **@supabase/supabase-js 2.101** |
| Data fetching | **SWR 2.4** + custom hooks |
| Charts | chart.js 4.5 + react-chartjs-2 5.3 |
| Payments | stripe 14.25 + @stripe/react-stripe-js 3.10 |
| Theming | next-themes (data-theme attr, dark default) |
| Style | CSS Modules (`styles/*.module.css`) + globals |
| Misc | html-to-image, react-zoom-pan-pinch, @vercel/speed-insights |

`tsconfig` paths: `@/*` -> repo root. `next.config.ts` has `ignoreBuildErrors: true` and security headers including `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self)`.

---

## 2. Routes — `app/(app)/*`

All routes inside `(app)` are protected by `app/(app)/layout.tsx` (auth gate, providers).

| Route | File | Role |
|---|---|---|
| `/dashboard` | `app/(app)/dashboard/page.tsx` -> `components/dashboard/DashboardPage.tsx` | KPIs, activity feed |
| `/athletes` | `app/(app)/athletes/page.tsx` -> `components/athletes/AthletesList.tsx` | Athletes list, add athlete |
| `/athletes/[id]` | `page.tsx` (redirects to /apercu) | — |
| `/athletes/[id]/apercu` | overview tab | Athlete summary |
| `/athletes/[id]/infos` | profile/contact info | Personal info edit |
| `/athletes/[id]/training` | training tab | Workout programs, sessions, logs |
| `/athletes/[id]/nutrition` | nutrition tab | Diet plans, logs |
| `/athletes/[id]/roadmap` | progression phases | Seche/Reverse/Masse cycles |
| `/athletes/[id]/bilans` | bilans (check-ins) tab | Daily reports + photos |
| `/athletes/[id]/videos` | technique videos tab | Athlete-uploaded execution videos |
| `/athletes/[id]/retours` | coach feedback tab | List + send retours (video/loom/audio/msg) |
| `/athletes/[id]/posing` | posing videos tab | — |
| `/athletes/[id]/fodmap` | fodmap test tab | FODMAP reintro tracking |
| `/athletes/[id]/questionnaires` | quest. assignments | — |
| `/athletes/[id]/supplements` | suppl. tracking | — |
| `/athletes/[id]/routine` | morning routine | — |
| `/athletes/[id]/menstrual` | cycle logs | — |
| `/bilans` | `app/(app)/bilans/page.tsx` -> `components/bilans/BilansOverview.tsx` | Cross-athlete bilans review |
| `/videos` | `app/(app)/videos/page.tsx` | Cross-athlete technique videos to review |
| `/templates` | `app/(app)/templates/page.tsx` (439 lines) | Training/Nutrition/Workflows/Questionnaires tabs |
| `/aliments` | `app/(app)/aliments/page.tsx` (464 lines) | Coach's food DB CRUD |
| `/exercices` | `app/(app)/exercices/page.tsx` | Coach's exercises DB CRUD |
| `/formations` | `app/(app)/formations/page.tsx` -> `FormationsPage.tsx` | Course content |
| `/profile` | `app/(app)/profile/page.tsx` -> `ProfilePage.tsx` | Coach profile, Stripe Connect, IG layout |
| `/business` | `business/page.tsx` -> `BusinessDashboard.tsx` | Top-level KPIs |
| `/business/leads` | `LeadsPipeline.tsx` | Sales pipeline |
| `/business/messages` | `MessagesInbox.tsx` | IG inbox |
| `/business/instagram` | `InstagramAnalytics.tsx` | IG metrics |
| `/business/content` | `ContentPlanner.tsx` | Drafts, hashtags, captions |
| `/business/automations` | `AutomationsPage.tsx` | DM/comment automations |

**Outside `(app)`**: `/` (landing), `/login`, `/privacy`, `/delete-account`, `/setup-payment`, `/admin/*` (separate `AdminSidebar`).

---

## 3. API Routes — `app/api/*`

| Endpoint | Method | File | Role / Tables |
|---|---|---|---|
| `/api/videos/save-retour` | POST | `videos/save-retour/route.ts` | Inserts `bilan_retours` after coach uploaded video+thumb to `coach-video` bucket. Path-phishing guarded (`${user.id}/`), verifies file exists. Sends Expo push to athlete. Service role. |
| `/api/videos/retour-signed-url` | GET `?id=` | `videos/retour-signed-url/route.ts` | Returns signed URLs (1h TTL) for video+thumb. Access: coach OR `athletes.user_id`. |
| `/api/videos/archive-old-retours` | GET (cron) | `videos/archive-old-retours/route.ts` | 30-day retention. Removes storage + sets `archived_at`. Auth via `verifyCronSecret`. |
| `/api/bilan-photos/upload` | POST (multipart) | `bilan-photos/upload/route.ts` | Coach uploads front/side/back photos to `athlete-photos/{user_id}/{date}_{pos}.jpg`, upserts `daily_reports.photo_*`. |
| `/api/athlete-onboarding/init` | POST | `athlete-onboarding/init/route.ts` | Server-side insert of `athlete_onboarding` row (RLS workaround — coach inserting for another user). |
| `/api/push` | POST | `push/route.ts` | Bearer-auth proxy to `https://exp.host/--/api/v2/push/send`. |
| `/api/stripe` | GET/POST `?action=` | `stripe/route.ts` (888 lines) | Switchboard. Actions: `coach-setup`, `connect-start`, `connect-status`, `connect-dashboard`, `connect-complete`, `import-subscriptions`, `save-key`, `verify-key`, `create-checkout`, `create-payment-sheet`, `cancel`, `cancellation-request`, `cancellation-respond`, `confirm-payment`. |
| `/api/stripe/webhook` | POST | `stripe/webhook/route.ts` (418 l) | Stripe events -> `payment_history`, `athlete_payment_plans`, etc. |
| `/api/stripe/cron` | GET | `stripe/cron/route.ts` (219 l) | Monthly `platform_invoices` generation + block-on-overdue. `verifyCronSecret`. |
| `/api/stripe-webhook` | POST | `stripe-webhook/route.ts` | 11-line proxy (kept for legacy Stripe URL). |
| `/api/instagram/auth` | POST | exchange code -> long-lived token, encrypts via `lib/api/crypto.ts`, stores in `ig_accounts`. |
| `/api/instagram/messages` | GET/POST | DMs read/send via `ig_conversations` + `ig_messages`. |
| `/api/instagram/publish` | POST | Publish reel/story to IG. |
| `/api/instagram/sync-profile` | POST | Refresh `ig_snapshots`. |
| `/api/instagram/sync-reels` | POST | Refresh `ig_reels`. |
| `/api/instagram/sync-stories` | POST | Refresh `ig_stories`. |
| `/api/instagram/webhook` | GET (verify) / POST | Meta webhook (DMs, comments). Triggers `automations`. |
| `/api/facebook/page-auth` | POST | FB Page OAuth (paired with IG Business). |

All non-cron endpoints use `verifyAuth(request)` from `lib/api/auth.ts` (Bearer JWT -> `supabase.auth.getUser()`).

---

## 4. Components by domain — `components/*`

### `recorder/` — Native screen recorder feature
- `NouveauRetourButton.tsx` — modal with 3 input modes (screen rec / message / loom / audio). **Modify here for the "Nouveau retour" UX**.
- `RetourFinalizeModal.tsx` — post-stop modal: title + comment + send.
- `RecordingPill.tsx` (+ `.module.css`) — global recording indicator (rendered once in `(app)/layout.tsx`).
- `LiveCamPiP.tsx` — webcam Picture-in-Picture during screen recording.
- `CanvasCompositor.ts` — canvas-based webcam-on-screen compositor. **rAF id captured via `idRef` (see lessons).**

### `videos/`
- `VideosGrid.tsx` — list view of athlete-submitted videos.
- `VideoDetail.tsx` (499 l) — single video review w/ commenting.
- `VideoCompare.tsx` (758 l) — side-by-side comparison.
- `RetourVideoPlayer.tsx` — player for coach-recorded retours; uses `useAuth().accessToken` to fetch signed URL via `/api/videos/retour-signed-url`.

### `bilans/`
- `BilansOverview.tsx` — `/bilans` page body. Pulls `daily_reports`.
- `BilanAccordion.tsx` — single-day expanded view.
- `BilanProgressView.tsx` — chart view.
- `BilanPhotosUploadModal.tsx` — coach uploads photos via `/api/bilan-photos/upload`.
- `MensurationCharts.tsx`, `PhotoCompare.tsx` — reusable.

### `training/`
- `ProgramEditor.tsx` — full program editor (also supports `templateMode`).
- `SessionTab.tsx`, `ExerciseRow.tsx`, `SetRow.tsx`, `CardioSection.tsx`, `ExerciseLibrary.tsx`.

### `nutrition/`
- `MealEditor.tsx` — diet plan editor (supports `templateMode`, `templateType: diete|jour|repas`).
- `FoodSearch.tsx` — `aliments_db` search w/ favorites.

### `templates/`
- `TrainingTemplatesList.tsx`, `NutritionTemplatesList.tsx`, `WorkflowsList.tsx`, `QuestionnaireTemplatesList.tsx`.
- `TrainingTemplateEditor.tsx` (legacy — `ProgramEditor` is preferred).

### `business/`
- `BusinessDashboard.tsx`, `LeadsPipeline.tsx`, `MessagesInbox.tsx`, `InstagramAnalytics.tsx`, `ContentPlanner.tsx`, `AutomationsPage.tsx`.

### `roadmap/`
- `RoadmapTimeline.tsx`, `RoadmapCalendar.tsx`, `PhaseModal.tsx`. Tables: `roadmap_phases`, `programming_weeks`, `weekly_objectives`.

### `dashboard/`, `athletes/`, `formations/`, `profile/`, `landing/`, `charts/`
Self-contained per-domain components; check folder for the right file.

### `layout/`
- `Sidebar.tsx` — main app nav (lines 16-45 = nav groups).
- `AdminSidebar.tsx` — `/admin` nav.
- `Navbar.tsx`, `Footer.tsx` — public landing.

### `ui/` — primitives
`Avatar`, `Badge`, `Button`, `Card`, `EmptyState`, `FormGroup`, `Modal`, `Skeleton`, `Tabs`, `Toggle`. All small (≤55 lines).

---

## 5. Contexts — `contexts/*`

| Context | Purpose | Key fields |
|---|---|---|
| `AuthContext.tsx` | Coach session + profile | `user`, `coach`, `accessToken`, `loading`, `signIn/signUp/signOut`, `refreshCoach`, `updateCoach`. **Uses no-op auth lock + stop/startAutoRefresh on visibility (Safari fix).** Caches `user` & `coach` in localStorage for instant load. Emits `coach:wake` event on tab return. |
| `AthleteContext.tsx` | Coach's athletes list | SWR-backed, `athletes`, `selectedAthlete`, `setSelectedAthleteId`, `refreshAthletes`. Triple-parallel fetch (athletes + roadmap_phases + athlete_payment_plans). `revalidateOnFocus: false`. |
| `RecorderContext.tsx` | Global screen recorder state | Wraps `useScreenRecorder`. Manages `pending`, `isProcessing`, `isUploading`, `uploadProgress`, finalize -> `/api/videos/save-retour`. **Auto-pickup `autoStoppedAt` for browser-end / hard-cap.** |
| `ToastContext.tsx` | `toast(msg, type)` | Portal-based, mounted post-hydration. |
| `ThemeContext.tsx` | next-themes wrapper | `data-theme="dark"` default, storageKey `prc-theme`. |

Provider tree (root): `ThemeProvider` -> `AuthProvider` -> `ToastProvider` -> children. Inside `(app)/layout.tsx`: `AthleteProvider` -> `RecorderProvider` -> shell.

---

## 6. Hooks — `hooks/*`

| Hook | Purpose |
|---|---|
| `useScreenRecorder.ts` | Core MediaRecorder wrapper. Exposes `startRecording/stopRecording/cancelRecording/consumeAutoStopped`, `autoStoppedAt`, `liveCamStream`. Single `recorder.onstop` set at construction (race-safe). 15-min hard cap, 4 Mbps. |
| `useAudioRecorder.ts` | Audio-only recorder, uploads to `coach-audio` bucket, returns signed URL. Used in `NouveauRetourButton`. |
| `useThumbnailExtractor.ts` | `extractThumbnail(blob): Blob` — JPEG frame at t=1s, 5s timeouts. |
| `useRefetchOnResume.ts` | Refetch on `coach:wake` (tab return) and on `visibilityState=visible` if currently loading. **Use this on every athlete sub-tab page.** |
| `useCachedQuery.ts` | sessionStorage stale-while-revalidate. **Note: legacy — `getPageCache/setPageCache` in `lib/utils.ts` are now no-ops** (caused 10-30s freezes). Prefer SWR or plain useState. |
| `useSupabaseQuery.ts` | Thin SWR wrapper, throws on `result.error`, `revalidateOnFocus: false`. |

---

## 7. DB schema (Supabase, public schema)

Source of truth = SQL migrations in `sql/*.sql` + observed SELECTs.

### Auth & profiles
- `coach_profiles` — PK `id`, FK `user_id -> auth.users`. Stripe Connect + SaaS plan (`athlete|business`), `trial_ends_at`, `stripe_account_id`, `stripe_charges_enabled`, `is_blocked`.
- `athletes` — PK `id`, `user_id` (auth.uid of athlete, nullable), `coach_id` (auth.uid of coach). `prenom/nom/email`, `objectif`, `poids_*`, `complete_bilan_*` config, `pas_journalier`, `water_goal_ml`, `access_mode`, `onboarding_workflow_id`. **Owned by `coach_id` for RLS.**

### Suivi (tracking)
- `daily_reports` — daily check-ins (poids, mensurations, photo_front/side/back, energie, sommeil, etc.). FK: `athlete_id`. `coach_reviewed_at` (added).
- `daily_tracking` — per-day pas/water/etc.
- `daily_entries`, `daily_actions`, `weekly_objectives`.
- `bilan_retours` — coach's video/loom/audio/text feedback. Cols: `id, athlete_id, coach_id, titre, commentaire, type ('video'|'loom'|'audio'|'message'|'mixed'), video_path, thumbnail_path, duration_s, width, height, mime_type, archived_at, loom_url, audio_url, created_at`.

### Training
- `workout_programs`, `workout_sessions`, `workout_logs`, `execution_videos` (athlete-uploaded technique videos).
- `exercices` — coach's exercise library.
- `programming_weeks`, `roadmap_phases` (cols: `athlete_id, coach_id, phase, name, status` — `en_cours` for active).

### Nutrition
- `nutrition_plans`, `nutrition_logs` (`plan_id` nullable per migration), `aliments_db`, `athlete_food_items` (favorites/recent — see MEMORY.md).

### Templates / Onboarding
- `training_templates`, `nutrition_templates` (col `nom`, JSON `meals_data` heavy — exclude from list queries), `questionnaire_templates`, `questionnaire_assignments`, `questionnaire_responses`.
- `onboarding_workflows` (col `name`!), `athlete_onboarding`.

### Health / Posing / Suppl.
- `posing_retours`, `posing_videos` (audio col added).
- `supplements`, `athlete_supplements`, `supplement_logs`, `supplement_dosage_history`.
- `routine_items`, `routine_logs` — morning routine.
- `menstrual_logs`.
- `athlete_fodmap_logs` — FODMAP reintro tracking. Cols: `id, athlete_id, group_key, food_key, portion_size enum (S/M/L), rating, note, logged_at, iso_week_start GENERATED, archived_at`. RPC `update_fodmap_log_with_cascade(log_id, new_rating, new_note)` for athlete edits with cascade-delete of later portions when rating becomes red.
- `athletes.fodmap_enabled` — boolean toggle (mirror posing). Default false.

### Notif & push
- `notifications` — `user_id` (athlete auth uid), `type, title, body, metadata jsonb`.
- `push_tokens` — `user_id, token` (Expo).

### Stripe / SaaS (sql/stripe_migration.sql)
- `athlete_payment_plans` (`coach_id, athlete_id, amount cents, frequency, is_free, payment_status, stripe_subscription_id`).
- `stripe_customers`, `payment_history`, `athlete_activity_log`, `platform_invoices`, `cancellation_requests` (col **`coach_note`**, NOT `reason` — see lessons), `stripe_audit_log`.

### Business / IG
- `leads`, `biz_clients`, `automations`, `automation_messages`, `coach_settings`, `project_config`.
- `ig_accounts`, `ig_snapshots`, `ig_goals`, `ig_reels`, `ig_stories`, `ig_conversations`, `ig_messages`, `ig_drafts`, `ig_hashtag_groups`, `ig_caption_templates`, `ig_content_pillars`.

### Formations
- `formations`, `formation_videos`, `formation_members`, `formation_video_progress`.

---

## 8. Auth + RLS + Storage

### Auth
- Browser: `lib/supabase/client.ts` — singleton, **no-op auth lock**, `createBrowserClient`.
- Server: `lib/supabase/server.ts` — `createServerClient` w/ Next cookie store.
- API routes: anon client in `lib/api/auth.ts:verifyAuth()` — Bearer header -> `auth.getUser(token)`. For mutations on other-user data: service-role admin client created inline.
- Tab visibility: `AuthContext` calls `stopAutoRefresh()`/`startAutoRefresh()` on hidden/visible (Safari fix).

### RLS pattern
- Coach-owned tables: `coach_id = auth.uid()` for ALL.
- Athlete-readable: `athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())`.
- Service role bypasses everything — used for: cross-user inserts (`/api/athlete-onboarding/init`), webhooks, cron, `/api/videos/save-retour` (path-validated).

### Storage buckets
| Bucket | Path convention | Access |
|---|---|---|
| `coach-video` | `${user.id}/${retourId}.{mp4|webm}` + `.jpg` thumb | Private. Signed URL via `/api/videos/retour-signed-url` (1h). |
| `coach-audio` | `${user.id}/retour_${athleteId}_${ts}.{mp4|webm}` | Used by `useAudioRecorder`. Signed URL 1y. |
| `athlete-photos` | `${user.id}/${date}_{front|side|back}.jpg` (athlete user_id) | Private. |
| `content-drafts` | IG drafts. **Public** (`getPublicUrl`). |

---

## 9. Patterns

### Send a "nouveau retour"
1. `<NouveauRetourButton athleteId={id} onCreated={refetch} />`
2. **Screen recording path**: button -> `useRecorder.startRecording()` (RecorderContext) -> `useScreenRecorder` -> on stop, `RetourFinalizeModal` shows -> `finalizeRecording()` uploads to `coach-video` bucket then POSTs `/api/videos/save-retour` -> server inserts `bilan_retours` + Expo push.
3. **Other (loom/audio/message)**: direct `supabase.from('bilan_retours').insert()` from button + `notifyAthlete()` from `lib/push.ts`.

### Push a notification
```ts
import { notifyAthlete } from '@/lib/push'
await notifyAthlete(athleteUserId, type, title, body, metadata, accessToken)
// inserts into `notifications` table + POSTs to /api/push -> Expo
```

### Get a signed URL for a private file
- Retour video/thumb: `GET /api/videos/retour-signed-url?id=<retourId>` with Bearer.
- Other server-side: `supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds)`.

### Cache pattern
- Module-level: SWR (e.g. `AthleteContext`).
- Page-level: **don't use** `getPageCache/setPageCache` — they are no-ops. For new code, prefer SWR or `useState(() => initFromMemory)`. The localStorage user/profile cache pattern lives in `AuthContext` if you need a precedent.

### Refetch on tab return
```ts
const load = useCallback(async () => { ... }, [...primitives])
useEffect(() => { load() }, [load])
useRefetchOnResume(load, loading)
```

### Optimistic auth gate (`(app)/layout.tsx`)
- Uses `settled` flag (`useEffect setSettled(true)`) to delay redirect by one render.
- 8-second `timedOut` safety.
- Skeleton shown while `!user && loading && !timedOut`.

---

## 10. Anti-patterns (golden rules) — from `tasks/lessons.md`

1. **Never use objects as hook deps**. `user`, `selectedAthlete`, `supabase` all change reference. Always destructure to primitives (`user?.id`, `selectedAthlete?.id`). Memoize all context values with `useMemo`.
2. **Always handle Supabase errors**. `await supabase.from(x).insert(y)` without `if (error)` is silent fail. Toast the real `error.message`, log `console.error('[ctx]', error, payload)`. For inserts touching another user's data, **go via API route + service role**.
3. **No SSR/client divergence**. Never read `localStorage`, `window`, `document`, `typeof window` during initial render. Read them in `useEffect`. Hydration mismatch (React #418) leaves UI stuck in skeleton forever.
4. **Verify column names against migrations**. `nom` vs `name`, `coach_note` vs `reason`. A bad column = silent 400, empty UI. Grep `sql/*.sql` before SELECTing.
5. **DB-first, then storage**. On delete: row first, then best-effort storage cleanup. On insert: upload first, then API route validates path + file existence and inserts metadata.
6. **No watchdog reloads, no fetch wrapping**. The Supabase client must stay vanilla. Tab-freeze is solved by `stopAutoRefresh/startAutoRefresh` already in `AuthContext`. Don't add timers that mask bugs.
7. **`npm run build` before push.** Pre-existing TS errors block prod.

---

## 11. "Where to look for X"

| Task | File(s) |
|---|---|
| Modify the "Nouveau retour" modal/UX | `components/recorder/NouveauRetourButton.tsx` |
| Change recording behavior (webcam, dimensions, codec, hard cap) | `hooks/useScreenRecorder.ts` (cap = `HARD_CAP_SECONDS`, bitrate = `VIDEO_BITS_PER_SECOND`) |
| Change post-stop finalize / upload logic | `contexts/RecorderContext.tsx` (`finalizeRecording`) |
| Change canvas compositor (webcam bubble) | `components/recorder/CanvasCompositor.ts` |
| Modify retour video player UI | `components/videos/RetourVideoPlayer.tsx` |
| Change retour signed-URL TTL or access rules | `app/api/videos/retour-signed-url/route.ts` |
| Change retour DB insert / push payload | `app/api/videos/save-retour/route.ts` |
| Change retour retention period | `app/api/videos/archive-old-retours/route.ts` (`RETENTION_DAYS`) |
| Add a new athlete sub-tab | Add `app/(app)/athletes/[id]/<slug>/page.tsx`, then add to `TABS` in `app/(app)/athletes/[id]/layout.tsx` |
| Modify the sidebar nav | `components/layout/Sidebar.tsx` (`navGroups`) |
| Add/modify a global recording UI element | `components/recorder/RecordingPill.tsx` (mounted in `(app)/layout.tsx`) |
| Add a new API endpoint | `app/api/<segment>/route.ts`, use `verifyAuth()` from `lib/api/auth.ts` |
| Add a new push notification | Use `notifyAthlete()` from `lib/push.ts` |
| Modify auth flow / token caching | `contexts/AuthContext.tsx` |
| Modify athletes list query | `contexts/AthleteContext.tsx` (`fetchAthletesData`) |
| Add a new toast call site | Import `useToast()` from `contexts/ToastContext.tsx` |
| Modify daily report photo upload | `app/api/bilan-photos/upload/route.ts` + `components/bilans/BilanPhotosUploadModal.tsx` |
| Modify weight chart | `components/charts/WeightChart.tsx` |
| Modify training program editor | `components/training/ProgramEditor.tsx` |
| Modify nutrition meal editor | `components/nutrition/MealEditor.tsx` |
| Modify food DB CRUD | `app/(app)/aliments/page.tsx` |
| Modify exercise DB CRUD | `app/(app)/exercices/page.tsx` |
| Modify the Templates page (4 sub-tabs) | `app/(app)/templates/page.tsx` (439 l) |
| Stripe Connect onboarding | `app/api/stripe/route.ts` (action `connect-start`/`connect-status`/`connect-complete`) |
| Stripe payment / cancel | `app/api/stripe/route.ts` (action `create-checkout`, `cancel`, `cancellation-request`) |
| Stripe webhook handlers | `app/api/stripe/webhook/route.ts` |
| Monthly platform invoicing | `app/api/stripe/cron/route.ts` |
| IG OAuth + token storage | `app/api/instagram/auth/route.ts` + `lib/api/crypto.ts` (encrypt) |
| IG inbox UI | `components/business/MessagesInbox.tsx` |
| IG content drafts (storage upload) | `components/business/ContentPlanner.tsx` (uses `content-drafts` bucket, public) |
| Roadmap phases (Seche/Reverse/Masse) | `components/roadmap/*` + `lib/constants.ts` (`PROG_PHASES`) |
| Onboarding workflow assignment | `app/api/athlete-onboarding/init/route.ts` (server-side insert) |
| Admin pages (sub-app at `/admin`) | `app/admin/{athletes,coaches,payments,metrics}/page.tsx` |
| Add a new RLS policy | `sql/rls_*.sql` patterns; remember coach_id = auth.uid() |
| Migrate DB | Add `sql/<descriptive>.sql`, run manually in Supabase SQL Editor |
| Modify FODMAP coach UI | `app/(app)/athletes/[id]/fodmap/page.tsx` |
| Modify FODMAP catalog (8 groups, 24 foods, 72 portions) | `lib/fodmapCatalog.ts` (mirror in ATHLETE/src/utils/fodmapCatalog.js) |
| Modify FODMAP status derivation / ISO week helpers | `lib/fodmap.ts` |

---

## Pour modifier ce document

**Tout agent Claude DOIT :**
1. **Lire ce fichier en début de session** (avant `tasks/lessons.md` et `tasks/todo.md`) pour s'orienter.
2. **Le mettre à jour à la fin de toute tâche** qui change l'architecture : nouvelle route, nouveau composant majeur, nouvelle table, nouveau hook, nouveau context, nouveau pattern récurrent, ou changement de contrat d'un endpoint.
3. **Ne pas le laisser dériver** : si une entrée du tableau "Where to look for X" devient fausse, la corriger immédiatement.
4. **Garder le format dense** : pas d'introduction longue, pas de blabla. Lignes ou tableaux.

Si une refonte casse plusieurs sections : ouvrir une PR `chore: refresh ARCHITECTURE.md` avant de merger la refonte.
