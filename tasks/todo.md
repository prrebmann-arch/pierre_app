# Prochaine session — Priorités

## ATHLETE — Bugs critiques
- [ ] Workout tracking : auto-save quand on quitte/revient en arrière sans cliquer Enregistrer
- [ ] Workout tracking : valider 1 série ne doit PAS supprimer les autres séries
- [ ] Supplements : vérifier calcul isDueDate "tous les 2 jours"

## COACH — Bugs
- [ ] Login "Chargement" première connexion — vérifier après déploiement
- [ ] Video : tester navigation séances + dates comparatives

## COACH — Optimisation perf INP
- [ ] /business (2232ms), /athletes/[id]/training (1856ms), /athletes/[id]/roadmap (2376ms)
- [ ] Lazy-load composants lourds, debounce handlers, useMemo/useCallback

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
- [x] Bilans: daily_reports .limit(200), workout_logs .limit(500)
- [x] Retours: bilan_retours .limit(100)
- [x] Posing: posing_videos .limit(100), posing_retours .limit(100)
- [x] Templates: all 4 tabs .limit(100)

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
