# Phase 6 - Business Pages & Formations

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
