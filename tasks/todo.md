# Prochaine session — Priorites

## Perf audit follow-up (2026-04-30)

### Phase 1 — quick wins (low risk, additive, no UX change)
- [ ] COACH `contexts/RecorderContext.tsx` — useMemo le value object (eviter re-renders 1Hz pendant rec)
- [ ] COACH `components/videos/VideoCompare.tsx` — `loadTraining` deps: `[video]` -> primitives `[video.id, video.athlete_id, video.session_id, video.session_name, video.exercise_name, video.date]`. Cause: refire 3 queries par keystroke dans le formulaire de retour
- [ ] COACH `components/nutrition/MealEditor.tsx` — useMemo totals + skip aliments fetch si cache existe (sauf foodRefreshKey>0)
- [ ] ATHLETE `src/screens/EditWorkoutLogScreen.js` — remplacer JSON.stringify isDirty par flag ref (input lag sur sessions longues)
- [ ] ATHLETE `src/hooks/usePushNotifications.js` — defer registration via InteractionManager.runAfterInteractions
- [ ] ATHLETE `src/screens/DashboardScreen.js` loadSuppStatus — ajouter debounce 60s (meme pattern que loadNutrition)

Test: build COACH ok, typecheck ok, ouvrir un retour video -> formulaire sans lag, recording -> RecordingPill ticke. ATHLETE : EditWorkoutLog input fluide.

### Phase 2 — gains moyens (memos / consolidation)
- [ ] COACH `components/videos/VideoDetail.tsx` — `dynamic()` import de VideoCompare (chunk plus petit sur grille videos)
- [ ] ATHLETE `src/screens/NutritionScreen.js` — React.memo sur MealCardTracking + FoodStatusRow + planMeals stable
- [ ] ATHLETE `src/screens/DashboardScreen.js` — consolider loadNutrition dans useDashboard (eviter refetch storm sur focus)

Test: build COACH ok, /videos detail s'ouvre + edit panel render, NutritionScreen : edit reps food doit pas re-render tous les meals, Dashboard tab switch < 200ms.

### Phase 3 — skipped (UX-altering ou hors-scope)
- Gate edit column derriere bouton "Modifier" (UX change, demander avant)
- Cold start parallel queries optim (gros refactor, deferer)

## COACH — Templates unifies (2026-04-03)
- [x] Training templates: ProgramEditor avec templateMode=true (ExerciseLibrary, sets, supersets, dropsets)
- [x] Nutrition templates: MealEditor avec templateMode=true (FoodSearch, repas, macros)
- [x] ProgramEditor: ajout props templateMode, templateId, templateCategory, existingCategories
- [x] MealEditor: ajout props templateMode, templateId, templateCategory, existingCategories
- [x] NutritionTemplatesList: supprime editeur inline, delegue a MealEditor via onEdit/onCreate/onDelete
- [x] templates/page.tsx: utilise ProgramEditor et MealEditor au lieu de TrainingTemplateEditor et editeur inline
- [x] Build passe (0 erreurs dans les fichiers modifies, 51 routes)

## COACH — 3 niveaux de granularite templates nutrition (2026-04-03)
- [x] MealEditor: ajout prop templateType ('diete' | 'jour' | 'repas')
- [x] MealEditor: diete -> affiche onglets ON/OFF, sauvegarde training+rest dans meals_data JSON
- [x] MealEditor: jour -> un seul onglet (pas de tabs ON/OFF)
- [x] MealEditor: repas -> un seul repas (bouton "+ Repas" masque)
- [x] MealEditor: save template_type dans nutrition_templates
- [x] NutritionTemplatesList: sous-onglets Diete/Jour/Repas avec filtrage par template_type
- [x] NutritionTemplatesList: type badge + subtitle adapte par type
- [x] NutritionTemplatesList: onCreate passe le type au parent
- [x] templates/page.tsx: parseNutritionTemplate gere le format diete (training/rest) + legacy
- [x] templates/page.tsx: passe templateType + initialOtherTab a MealEditor
- [x] Build passe (0 erreurs dans les fichiers modifies)

---

## COACH — Supplements page fixes (2026-04-03)
- [x] calcWeekly: ajout apercu dose hebdo en temps reel dans le modal (se met a jour quand on change frequence/dosage/unite)
- [x] saveNewSupplement: wrap try/catch/finally — setSaving(false) garanti, erreurs loguees en console
- [x] saveEditSupplement: wrap try/catch/finally — meme fix
- [x] moment_prise: remplace input texte par dropdown (10 options predefinies + "Autre" avec input custom)
- [x] Bouton modal: affiche "Modifier" en mode edition au lieu de "Ajouter"
- [x] Fix pre-existant: .catch() sur PostgrestFilterBuilder remplace par check .error (TS2551)
- [x] TypeScript check passes (0 errors)

## ATHLETE — Bugs critiques
- [ ] Workout tracking : auto-save quand on quitte/revient en arrière sans cliquer Enregistrer
- [ ] Workout tracking : valider 1 série ne doit PAS supprimer les autres séries
- [ ] Supplements : vérifier calcul isDueDate "tous les 2 jours"

## COACH — Bugs
- [x] Login "Chargement" premiere connexion — fix: layout attend 1 render cycle (settled) avant redirect, skeleton au lieu de return null
- [x] Nutrition page lente (15s) — fix: meals_data exclue de loadPlans, viewDiet fetch on-demand, loadNutriLogs sans query sequentielle
- [ ] Video : tester navigation séances + dates comparatives

## COACH — Optimisation perf INP
- [x] /business — merged 2 sequential Promise.all into 1 (7 queries parallel instead of 4+3)
- [x] /athletes/[id]/training — fixed useEffect dep (was [] instead of [loadData]), data reloads on athlete change
- [x] /athletes/[id]/roadmap — removed supabase from useCallback deps (stable singleton)
- [x] /athletes/[id]/bilans — fixed blank page when selectedAthlete is null (shows skeleton instead of error)
- [x] /athletes/[id]/apercu — uses context athlete user_id to skip sequential query (all 5 queries parallel)
- [ ] Further INP reduction: consider debounce on input handlers in BusinessDashboard FieldRow

## COACH — Critical Perf Fixes (2026-04-03)
- [x] Fix 1: workout_logs .limit(500) -> .limit(100) in training + bilans pages
- [x] Fix 2: Lazy-load signed URLs photos — no longer fetched at mount, loaded on first photo click
- [x] Fix 3: Exclude heavy data from sessionStorage cache (logs in training, wlogs in bilans)
- [x] Fix 4: useMemo(() => getPageCache()) -> useState(() => getPageCache()) in all 12 athlete tab pages
- [x] Fix 5: 200 bilans x 3 photos = 600 createSignedUrl requests eliminated at mount (covered by Fix 2)
- [x] Build passes (0 errors in modified files)

## COACH — SessionStorage cache + instant tab switching (2026-04-03)
- [x] lib/utils.ts — added getPageCache/setPageCache helpers
- [x] training — sessionStorage cache (programs, cardio, logs) + skeleton loading
- [x] nutrition — sessionStorage cache (plans, diets)
- [x] bilans — sessionStorage cache + params.id fallback (was dependent on selectedAthlete only)
- [x] apercu — sessionStorage cache (athlete, reports, phase, prog, nutrition, tracking)
- [x] roadmap — sessionStorage cache (phases, programs, nutritions, reports)
- [x] infos — sessionStorage cache + parallelized all queries (6 in parallel instead of 3 sequential stages)
- [x] videos — sessionStorage cache
- [x] supplements — sessionStorage cache (assignments, unlocked)
- [x] retours — sessionStorage cache
- [x] posing — sessionStorage cache (enabled, videos, retours)
- [x] questionnaires — sessionStorage cache + parallelized assignments+templates fetch
- [x] menstrual — sessionStorage cache (enabled, entries)
- [x] All pages: loading=false when cache exists (instant display from cache, background refresh)
- [x] Build passes (0 errors in modified files)

## Features à faire
- [ ] Meal timing : notifications rappel à chaque repas (Expo local notifications)
- [ ] Calculateur repas : à tester sur téléphone

---

# Supabase Query Optimization (Full Codebase)

## select('*') -> select(specific columns)
- [x] AthleteContext: athletes select — 22 columns instead of *
- [x] AuthContext: coach_profiles select — 16 columns instead of *
- [x] DashboardPage: daily_reports + coach_settings selects
- [x] Apercu page: athletes, daily_reports, roadmap_phases, nutrition_plans selects
- [x] Infos page: athletes (full profile), athlete_payment_plans, payment_history, cancellation_requests, athlete_onboarding, onboarding_workflows
- [x] Bilans page: daily_reports (18 columns), programming_weeks, nutrition_plans, roadmap_phases
- [x] Retours page: bilan_retours select
- [x] Roadmap page: roadmap_phases select (both load + sync)
- [x] Questionnaires page: questionnaire_responses select
- [x] Videos pages (athlete + global): execution_videos select
- [x] Nutrition page: nutrition_plans, nutrition_logs selects
- [x] Supplements page: supplement_logs select
- [x] Menstrual page: menstrual_logs select
- [x] Training page: workout_programs + sessions, workout_logs selects
- [x] Posing page: posing_videos, posing_retours selects
- [x] Templates page: training_templates, nutrition_templates, onboarding_workflows, questionnaire_templates
- [x] Aliments page: aliments_db select
- [x] FoodSearch + MealEditor: aliments_db select
- [x] VideoDetail: execution_videos select
- [x] VideoCompare: workout_logs select
- [x] ProfilePage: platform_invoices select
- [x] BusinessDashboard: project_config, daily_entries, biz_clients, stripe_customers, athlete_payment_plans, payment_history, weekly_objectives
- [x] ContentPlanner: ig_drafts, ig_hashtag_groups, ig_caption_templates, ig_reels, ig_accounts
- [x] InstagramAnalytics: ig_accounts, ig_reels, ig_content_pillars, ig_snapshots, ig_goals, ig_stories
- [x] MessagesInbox: ig_accounts select
- [x] LeadsPipeline: leads select
- [x] FormationsPage: formations, formation_videos selects

## Pagination/limits added
- [x] DashboardPage: already had limits (500 reports, 50 videos)
- [x] Bilans: daily_reports .limit(200), workout_logs .limit(500), programming_weeks .limit(200), nutrition_plans .limit(50), roadmap_phases .limit(50)
- [x] Retours: bilan_retours .limit(100)
- [x] Posing: posing_videos .limit(100), posing_retours .limit(100)
- [x] Templates: all 4 tabs .limit(100)
- [x] Aliments: aliments_db .limit(1000)
- [x] Exercices: exercices .limit(500)
- [x] Nutrition: nutrition_plans .limit(50), nutrition_logs .limit(200)
- [x] Questionnaires: assignments .limit(100), templates .limit(100)
- [x] Roadmap: daily_reports .limit(500), workout_programs .limit(50), nutrition_plans .limit(50)
- [x] Supplements: supplement_logs .limit(500), nutrition_plans .limit(10)
- [x] BusinessDashboard: daily_entries .limit(500), biz_clients .limit(200), stripe_customers .limit(200), plans .limit(200), athletes .limit(200)
- [x] ContentPlanner: ig_drafts .limit(200), hashtag_groups .limit(50), caption_templates .limit(50), ig_reels .limit(200)
- [x] InstagramAnalytics: ig_reels .limit(200), pillars .limit(50), snapshots .limit(365), goals .limit(20), stories .limit(200)
- [x] LeadsPipeline: leads .limit(200)
- [x] AutomationsPage: automations .limit(50)
- [x] FormationsPage: formations .limit(100), members .limit(500), videos .limit(100), progress .limit(1000)
- [x] FoodSearch: aliments_db .limit(1000)
- [x] MealEditor: aliments_db .limit(1000)
- [x] ExerciseLibrary: exercices .limit(500)
- [x] VideoCompare: workout_programs .limit(20)

## Parallel queries (Promise.all)
- [x] DashboardPage: already uses Promise.all for 4 queries
- [x] Apercu: already uses Promise.all for 5 queries
- [x] Infos: already uses Promise.all for payment data (3 queries)
- [x] Bilans: already uses Promise.all for 5 queries
- [x] All other pages already batched where applicable

## Navigation refetch check
- [x] Athlete detail layout uses AthleteContext (shared, not refetched on tab change)
- [x] Each tab page loads its own data on mount (correct: tab-specific data)
- [x] No unnecessary refetching detected

## Build
- [x] TypeScript check passes (0 errors)
- [x] Build passes (51 routes)

## Safe Optimizations (2026-04-03)
- [x] next.config.ts: added experimental.optimizePackageImports (supabase, stripe, chart.js)
- [x] loading.tsx skeletons: templates, videos, exercices, aliments, bilans, formations, profile, business
- [x] Remaining .limit() added to all Supabase SELECT queries without limits (25+ queries)
- [x] Build passes

## Supabase Data Transfer Reduction (2026-04-03)
- [x] DashboardPage: daily_reports .limit(500) -> .limit(100)
- [x] Bilans page: daily_reports .limit(200) -> .limit(60), workout_logs .limit(100) -> .limit(50)
- [x] Nutrition page: nutrition_logs .limit(200) -> .limit(60) (both queries)
- [x] Training page: workout_logs .limit(100) -> .limit(50)
- [x] BusinessDashboard: daily_entries .limit(500) -> .limit(100)
- [x] AthleteContext: removed 6 bilan_* columns from select (bilan_frequency, bilan_interval, bilan_day, bilan_anchor_date, bilan_month_day, bilan_notif_time) — only used in infos page which has its own query
- [ ] Bilans page general_notes: KEPT — used in BilanAccordion render (line 588, 698)
- [ ] Nutrition meals_data: KEPT — used in viewDiet detail view (in-memory plans); removing would require new fetch code in viewDiet
- [x] TypeScript check passes (0 new errors)

---

# Performance Optimization - Server Components & Lazy Loading

## Landing Page (/)
- [x] Remove 'use client' from Pricing (static content, only uses Link)
- [x] HowItWorks, SocialProof, FinalCTA, Footer were already server components
- [x] Lazy load HeroParticles with dynamic import (ssr: false) — heavy canvas animation
- [x] Features kept as client (IntersectionObserver), Hero kept as client (parallax/scroll)

## Lazy Loading Heavy Components
- [x] VideoDetail — dynamic import in athletes/[id]/videos and /videos pages
- [x] BilansOverview — dynamic import in /bilans page
- [x] InstagramAnalytics — dynamic import in /business/instagram page (Chart.js + react-chartjs-2)
- [x] WeightChart — extracted Chart.js into separate component, dynamic import in apercu page

## Other Pages
- [x] Privacy page — already a server component (no 'use client')
- [x] Login page — must stay client (form state, useAuth), already minimal
- [x] Admin pages — must stay client (client-side Supabase + useState/search)

## Query Optimization
- [x] BusinessDashboard — optimized select() to fetch only needed columns
- [x] ProfilePage — optimized select() to fetch only needed columns

## Build
- [x] Build passes (0 errors, 40+ pages)
- [x] Pushed to main

---

# Phase 6 - Business Pages & Formations

## Payment Status Visibility Fix
- [x] AthleteContext fetches athlete_payment_plans and attaches `_payment` to each Athlete
- [x] Athlete list cards show payment status badge (Actif/En attente/Gratuit)
- [x] Dashboard shows MRR stat card with monthly revenue and active subscriptions count
- [x] Infos page shows "Gratuit / Aucun plan" when no payment plan exists (was hidden)
- [x] Build passes, pushed to main

## Completed
- [x] `app/(app)/business/page.tsx` -> BusinessDashboard
- [x] `app/(app)/business/leads/page.tsx` -> LeadsPipeline
- [x] `app/(app)/business/automations/page.tsx` -> AutomationsPage
- [x] `app/(app)/business/instagram/page.tsx` -> InstagramAnalytics
- [x] `app/(app)/business/messages/page.tsx` -> new MessagesInbox component
- [x] `app/(app)/business/content/page.tsx` -> new ContentPlanner component
- [x] `app/(app)/formations/page.tsx` -> new FormationsPage component
- [x] All CSS modules committed (business, messages, content-planner, instagram, formations)
- [x] TypeScript check passes (zero errors)
- [x] Build passes successfully

## Final Audit - supabase deps cleanup
- [x] Removed `supabase` from ALL useCallback/useEffect dependency arrays across 27 occurrences
- [x] Files fixed: nutrition, formations, MealEditor, ProfilePage, InstagramAnalytics, VideoDetail, ContentPlanner, MessagesInbox, FoodSearch, BilansOverview, VideoCompare, aliments, videos, templates, retours, supplements, questionnaires, roadmap, menstrual, training, bilans, posing, infos
- [x] Build passes, pushed to main

## Final Checkup - Bug Fixes
- [x] Removed all `stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret` references from DB queries
- [x] Converted all coach Stripe operations to use Stripe Connect (platform key + stripeAccount)
- [x] Fixed `/api/ig-auth` -> `/api/instagram/auth` in InstagramAnalytics component
- [x] Added try/finally blocks for setLoading in DashboardPage, VideoCompare, VideoDetail
- [x] TypeScript check passes (zero errors)
- [x] Toast context verified: ToastProvider in root layout, useToast works everywhere
- [x] authFetch verified: properly defined in ProfilePage and setup-payment
- [x] window.location usage verified: all external redirects (Stripe, Instagram) are correct
- [x] confirm() usage: kept as-is (works in all modern browsers, acceptable UX pattern)

## Critical Performance Fix
- [x] AuthContext: added try/catch/finally to init() — prevents permanent loading screen if getSession/fetchCoach throws
- [x] AuthContext: memoized context value with useMemo — prevents ALL consumers re-rendering on every provider render
- [x] AuthContext: added signingInRef to prevent onAuthStateChange from racing with signIn/signUp — fixes login not working on first click
- [x] AuthContext: wrapped fetchCoach in try/catch — prevents uncaught errors from bubbling
- [x] AuthContext: wrapped signIn/signUp/signOut in useCallback — stable references for memoized value
- [x] App layout: added 8s safety timeout on loading state — prevents permanent black screen
- [x] ProfilePage: added try/finally to load function — prevents stuck loading state
- [x] vercel.json: fixed buildCommand to use --webpack flag — prevents Turbopack ENOENT build failures on Vercel
- [x] Build passes (0 errors, 40+ pages)

## CSS & Loading Performance
- [x] Font loading: added `display: 'swap'` to Inter font config — prevents render blocking
- [x] App layout skeleton: replaced "Chargement..." with sidebar + content card skeletons
- [x] Dashboard loading.tsx: stat card + chart area skeletons
- [x] Athletes list loading.tsx: header + card grid skeletons
- [x] Athlete detail loading.tsx: tab content skeletons
- [x] Fade-in animation: added pageIn animation to mainContent children
- [x] globals.css: 588 lines — kept as-is (all shared: variables, reset, buttons, forms, cards, modals, utilities — no feature bloat)
- [x] Build passes (0 errors, 40+ pages)

## Notes
- `styles/business.module.css` already existed with all biz-* styles converted to camelCase
- `styles/formations.module.css` already existed with all fm-* styles
- Modal component uses `isOpen` prop (not conditional rendering)
- Supabase join returns nested objects, need `as unknown as` for type assertions
- Build ENOENT error is a Turbopack race condition (Next.js 16.2.1 bug), fixed by using `--webpack` flag
- All env vars verified against Vercel: all present (META_APP_ID_FB has fallback to META_APP_ID)

## API Routes Audit (complete)
- [x] `stripe-webhook/route.ts` — re-exports POST from `stripe/webhook/route.ts` (+ redirect in next.config.ts)
- [x] `stripe/webhook/route.ts` — POST, verifies Stripe signature, routes Connect events via `account` field
- [x] `stripe/route.ts` — POST + GET, uses verifyAuth/verifyCoach
- [x] `stripe/cron/route.ts` — GET + POST, uses verifyCronSecret
- [x] `instagram/*` — all 7 routes export POST (+ OPTIONS for CORS), auth verified
- [x] `facebook/page-auth/route.ts` — POST + OPTIONS
- [x] `push/route.ts` — POST, uses verifyAuth
- [x] `authFetch` — defined inline in ProfilePage + setup-payment, adds Bearer JWT token
- [x] Build passes with `--webpack` flag (40 pages, 0 errors)

## Bundle Optimization
- [x] Extracted WeightChart into `components/charts/WeightChart.tsx` with chart.js registration
- [x] Apercu page: dynamic import of WeightChart with `ssr: false` (chart.js no longer in main bundle)
- [x] InstagramAnalytics: dynamic import with `ssr: false` + loading skeleton (chart.js + react-chartjs-2 lazy loaded)
- [x] Verified: Font Awesome (122 icons used) — all.min.css is the pragmatic choice, no lighter alternative
- [x] Verified: Stripe libs already route-level code-split (setup-payment, profile pages only)
- [x] Verified: No moment/lodash/date-fns bloat — only lightweight custom utils
- [x] Verified: All createClient() calls use singleton from `@/lib/supabase/client`
- [x] Skipped: `<img>` to `next/image` — images are external URLs (Instagram, Supabase storage), would need remotePatterns config and risk breakage
- [x] Build passes (0 errors, 51 routes)

---

# Optimistic Updates - ProfilePage

## AuthContext
- [x] Added `updateCoach(partial)` to AuthContext — merges partial updates into coach state + localStorage cache
- [x] Exposed in context interface, value, and useMemo deps

## ProfilePage — refreshCoach() replaced with updateCoach()
- [x] handleEditName: `updateCoach({ display_name: name })`
- [x] handleDisconnectStripe: `updateCoach({ stripe_onboarding_complete, stripe_charges_enabled, stripe_account_id })`
- [x] handleChangePlan: `updateCoach({ plan: newPlan })`
- [x] handleToggleProrata: `updateCoach({ allow_prorata: enabled })`
- [x] handleUpdateCurrency: `updateCoach({ currency })`
- [x] CardForm onSuccess: `updateCoach({ has_payment_method: true })`
- [x] setup=success URL param: `updateCoach({ has_payment_method: true })`

## Kept refreshCoach() (correct)
- [x] connect=complete URL param — Stripe Connect external callback, server determines actual state

## Verification
- [x] TypeScript check passes (0 errors in modified files)
