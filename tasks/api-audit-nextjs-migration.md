# API Audit for Next.js App Router Migration

**Date:** 2026-03-31
**Scope:** All files in `/api/` directory
**Target:** Next.js App Router (`app/api/*/route.ts`)

---

## Table of Contents

1. [Shared Helpers](#shared-helpers)
2. [Endpoint Inventory](#endpoint-inventory)
3. [Detailed Endpoint Documentation](#detailed-endpoint-documentation)
4. [vercel.json Configuration](#verceljson-configuration)
5. [Environment Variables Summary](#environment-variables-summary)
6. [Migration Checklist & Gotchas](#migration-checklist--gotchas)

---

## Shared Helpers

### `_auth.js`
**Path:** `/api/_auth.js`
**Convention:** Underscore prefix prevents Vercel from deploying as a route.

| Export | Description |
|---|---|
| `verifyAuth(req)` | Validates JWT from `Authorization: Bearer <token>` header via Supabase `auth.getUser()`. Returns `{ user }` or throws `{ status, message }`. |
| `verifyCoach(req, bodyField)` | Calls `verifyAuth` then checks `user.id === req.body[bodyField]` (or `req.query[bodyField]`). Default field: `coachId`. |
| `verifyCronSecret(req)` | Validates `Authorization: Bearer <CRON_SECRET>` using `crypto.timingSafeEqual`. |
| `handleAuthError(res, err)` | Sends `res.status(err.status).json({ error: err.message })`. |

**Env vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `CRON_SECRET`

**Migration notes:**
- Uses `require()` (CommonJS). Must convert to ESM `import/export`.
- Accesses `req.headers`, `req.body`, `req.query` -- all change in App Router (use `request.headers.get()`, `await request.json()`, `URL.searchParams`).
- Singleton pattern `_supabaseAuth` may not behave identically in Edge runtime. Fine for Node.js runtime.

---

### `_cors.js`
**Path:** `/api/_cors.js`

| Export | Description |
|---|---|
| `cors(req, res)` | Sets CORS headers. Returns `true` if preflight (OPTIONS) -- caller should stop. |

**Allowed origins:**
- Production: `https://pierreapp.vercel.app`
- Dev (non-production): `localhost:3000`, `localhost:5500`, `127.0.0.1:5500`

**Migration notes:**
- Next.js App Router supports `middleware.ts` for CORS, or per-route handling.
- The return-boolean pattern (`if (cors(req, res)) return`) needs rethinking. In App Router, you'd return a `NextResponse` directly for OPTIONS.
- Consider using `next.config.js` headers or a shared `corsHeaders` object instead.
- `res.setHeader` / `res.status(204).end()` do not exist in App Router. Must use `new Response()` or `NextResponse`.

---

### `_crypto.js`
**Path:** `/api/_crypto.js`

| Export | Description |
|---|---|
| `encrypt(text)` | AES-256-GCM encryption. Returns `"iv:tag:ciphertext"` (all hex). |
| `decrypt(data)` | Reverse of encrypt. Has plaintext fallback (logs warning). |
| `isEncrypted(data)` | Heuristic check: 3 parts, iv=24 chars, tag=32 chars. |

**Env vars:** `STRIPE_ENCRYPTION_KEY` (64 hex chars = 32 bytes)

**Migration notes:**
- Uses Node.js `crypto` module. Not compatible with Edge runtime. Must declare `runtime = 'nodejs'` or keep as Node.js.
- Pure utility, no request/response coupling. Easy to migrate.

---

## Endpoint Inventory

| File | Route | Methods | Auth | External Services | Complexity |
|---|---|---|---|---|---|
| `fb-page-auth.js` | `/api/fb-page-auth` | POST | `verifyAuth` | Facebook Graph API v25.0 | Medium |
| `ig-auth.js` | `/api/ig-auth` | POST | `verifyAuth` | Instagram API, Graph API v25.0 | Medium |
| `ig-messages.js` | `/api/ig-messages` | POST | `verifyCoach(user_id)` | Facebook Graph API v25.0, Supabase | High |
| `ig-publish.js` | `/api/ig-publish` | POST | `verifyAuth` | Instagram Graph API v25.0 | Medium (polling loop) |
| `ig-sync-profile.js` | `/api/ig-sync-profile` | POST | `verifyAuth` | Instagram Graph API v25.0 | Low |
| `ig-sync-reels.js` | `/api/ig-sync-reels` | POST | `verifyCoach(user_id)` | Instagram Graph API v25.0, Supabase | Medium |
| `ig-sync-stories.js` | `/api/ig-sync-stories` | GET, POST | GET: `verifyCronSecret`, POST: `verifyCoach(user_id)` | Instagram Graph API v25.0, Supabase | Medium |
| `ig-webhook.js` | `/api/ig-webhook` | GET, POST | GET: verify_token check, POST: none (Meta calls it) | Facebook Graph API v25.0, Supabase | High |
| `push.js` | `/api/push` | POST | `verifyAuth` | Expo Push API | Low |
| `stripe.js` | `/api/stripe` | POST, GET | varies (coach: `verifyCoach`, athlete: `verifyAuth` + ownership check) | Stripe API, Supabase | Very High (14 actions) |
| `stripe-webhook.js` | `/api/stripe-webhook` | POST | Stripe signature verification | Stripe API, Supabase | Very High |
| `stripe-cron.js` | `/api/stripe-cron` | GET, POST | `verifyCronSecret` | Stripe API, Supabase | High |

---

## Detailed Endpoint Documentation

### 1. `fb-page-auth.js`

**Route:** `POST /api/fb-page-auth`
**Auth:** JWT via `verifyAuth`
**CORS:** Yes

**Request body:**
```json
{
  "code": "string (OAuth code from Facebook Login)",
  "redirect_uri": "string",
  "ig_user_id": "string (optional, used as fallback page_id)"
}
```

**Response 200:**
```json
{
  "page_id": "string",
  "page_name": "string",
  "page_access_token": "string",
  "ig_business_account_id": "string"
}
```

**Flow:** Code -> short-lived user token -> long-lived user token -> page access token

**Env vars:** `META_APP_ID_FB` (fallback `META_APP_ID`), `META_APP_SECRET_FB` (fallback `META_APP_SECRET`)

**Gotchas:**
- Always uses `pages[0]` (first page). If coach has multiple FB pages, this may pick the wrong one.
- Returns `page_access_token` in response body -- client stores this.
- 4 sequential Facebook API calls (token exchange, /me, /me/permissions, long-lived, /me/accounts).

**Next.js migration:**
```
app/api/fb-page-auth/route.ts -> export async function POST(request: Request)
```

---

### 2. `ig-auth.js`

**Route:** `POST /api/ig-auth`
**Auth:** JWT via `verifyAuth`
**CORS:** Yes

**Request body:**
```json
{
  "code": "string (OAuth code from Instagram Login)",
  "redirect_uri": "string"
}
```

**Response 200:**
```json
{
  "access_token": "string (long-lived, 60 days)",
  "expires_in": 5184000,
  "ig_user_id": "string",
  "ig_username": "string",
  "followers": 0,
  "media_count": 0,
  "profile_pic": "string"
}
```

**Flow:** Code -> short-lived token (Instagram API) -> long-lived token (60d) -> profile fetch

**Env vars:** `META_APP_ID`, `META_APP_SECRET`

**Gotchas:**
- Returns raw `access_token` in response. Client must store securely.
- Step 1 uses `application/x-www-form-urlencoded` (Instagram API requirement).
- Steps 2-3 use GET with query params (Graph API pattern).

**Next.js migration:**
```
app/api/ig-auth/route.ts -> export async function POST(request: Request)
```

---

### 3. `ig-messages.js`

**Route:** `POST /api/ig-messages`
**Auth:** JWT via `verifyCoach(req, 'user_id')` -- verifies `user.id === body.user_id`
**CORS:** Yes
**maxDuration:** 60s (vercel.json)

**Request body** (action-based router):

| Action | Extra fields | Description |
|---|---|---|
| `conversations` | `user_id` | Read all conversations from Supabase |
| `thread` | `user_id`, `thread_id` | Read messages for a conversation from Supabase |
| `send` | `user_id`, `recipient_id`, `message_text`, `access_token`, `ig_user_id`, `conversation_id` | Send message via Instagram API + save to Supabase |
| `sync` | `user_id`, `ig_user_id`, `page_access_token` | Refresh messages for existing conversations (up to 10 convos, 10 msgs each) |

**External services:** Facebook Graph API v25.0 (`/me/messages`, `/{thread_id}`), Supabase (ig_conversations, ig_messages)

**Env vars:** `SUPABASE_URL` (fallback `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_KEY`

**Gotchas:**
- `send` action passes `access_token` in the request body directly to Facebook API -- the token flows through the client.
- `sync` action does N+1 queries: for each conversation, fetches thread, then checks each message for duplicates individually.
- `sync` limited to 10 conversations, 10 messages each.
- Single POST route handles 4 very different actions. Consider splitting for App Router.

**Next.js migration:**
```
Option A: app/api/ig-messages/route.ts (keep action-based)
Option B: Split into app/api/ig-messages/conversations/route.ts, etc.
```

---

### 4. `ig-publish.js`

**Route:** `POST /api/ig-publish`
**Auth:** JWT via `verifyAuth`
**CORS:** Yes

**Request body:**
```json
{
  "access_token": "string",
  "ig_user_id": "string",
  "image_url": "string (for IMAGE)",
  "video_url": "string (for VIDEO/REELS)",
  "caption": "string (optional)",
  "media_type": "IMAGE | VIDEO | REELS"
}
```

**Response 200:**
```json
{
  "success": true,
  "ig_media_id": "string"
}
```

**Flow:**
1. Create media container (`/{ig_user_id}/media`)
2. For videos: poll status every 2s, up to 30 attempts (60s max)
3. Publish (`/{ig_user_id}/media_publish`)

**Gotchas:**
- Video polling can take up to 60 seconds. Default Vercel timeout is 10s. **No explicit maxDuration in vercel.json** for this endpoint -- will likely timeout for videos!
- Uses `application/x-www-form-urlencoded` for container creation.
- Returns 408 on timeout, but Vercel may kill the function first.

**Next.js migration:**
```
app/api/ig-publish/route.ts -> export async function POST(request: Request)
```
Must set `maxDuration` in route config or vercel.json.

---

### 5. `ig-sync-profile.js`

**Route:** `POST /api/ig-sync-profile`
**Auth:** JWT via `verifyAuth`
**CORS:** Yes

**Request body:**
```json
{
  "ig_user_id": "string",
  "access_token": "string"
}
```

**Response 200:**
```json
{
  "username": "string",
  "name": "string",
  "bio": "string",
  "followers": 0,
  "following": 0,
  "posts": 0,
  "profile_pic": "string"
}
```

**Simplest endpoint.** Single Graph API call, no Supabase writes.

**Next.js migration:**
```
app/api/ig-sync-profile/route.ts -> export async function POST(request: Request)
```

---

### 6. `ig-sync-reels.js`

**Route:** `POST /api/ig-sync-reels`
**Auth:** JWT via `verifyCoach(req, 'user_id')`
**CORS:** Yes

**Request body:**
```json
{
  "ig_user_id": "string",
  "access_token": "string",
  "user_id": "string"
}
```

**Response 200:**
```json
{
  "synced": 15,
  "total": 15
}
```

**Flow:** Fetch up to 50 media items -> filter VIDEO/REELS -> for each, fetch insights -> upsert into `ig_reels`.

**Env vars:** `SUPABASE_URL` (fallback `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_KEY`

**Gotchas:**
- N+1 API calls: 1 for media list + 1 per reel for insights. With 50 reels, that's 51 API calls.
- Sequential `await` in loop (no parallelism).
- Empty `catch {}` on insights fetch silently swallows errors.
- No explicit maxDuration -- could timeout with many reels.

**Next.js migration:**
```
app/api/ig-sync-reels/route.ts -> export async function POST(request: Request)
```

---

### 7. `ig-sync-stories.js`

**Route:** `GET /api/ig-sync-stories` (cron) | `POST /api/ig-sync-stories` (manual)
**Auth:** GET: `verifyCronSecret`, POST: `verifyCoach(req, 'user_id')`
**CORS:** POST only
**Cron:** `0 8 * * *` (daily at 8:00 UTC)

**GET (cron):** No body. Fetches all connected IG accounts from `ig_accounts` table, syncs stories for each.

**POST (manual) request body:**
```json
{
  "ig_user_id": "string",
  "access_token": "string",
  "user_id": "string"
}
```

**Response 200:**
```json
{
  "synced": 5
}
```

**Flow:** For each account: fetch `/me/stories` -> for each story, fetch insights -> upsert into `ig_stories`.

**Env vars:** `SUPABASE_URL` (fallback `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_KEY`, `CRON_SECRET` (for GET)

**Gotchas:**
- Dual-method handler (GET+POST). In App Router, export both `GET` and `POST`.
- CORS is only applied for POST, not GET (correct -- cron doesn't need CORS).
- OPTIONS handling is awkward (checked after POST block). In App Router, handle OPTIONS separately.
- Empty `catch {}` on insights.
- Stories expire after 24h, so the cron at 8 AM may miss stories posted late evening.

**Next.js migration:**
```
app/api/ig-sync-stories/route.ts -> export async function GET(...) and export async function POST(...)
```
Cron config moves to `vercel.json` (same format, still works with App Router).

---

### 8. `ig-webhook.js`

**Route:** `GET /api/ig-webhook` (verification) | `POST /api/ig-webhook` (events)
**Auth:** GET: `hub.verify_token` check. POST: **NONE** (Meta sends events directly).
**CORS:** None (Meta server-to-server).

**GET (webhook verification):**
- Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`
- Returns `challenge` as plaintext on success, 403 on failure.

**POST (event processing):**
- Body: Meta webhook payload with `object`, `entry[].messaging[]` events.
- Processes message events: finds coach by IG account, creates/updates conversations, saves messages.
- Handles echo messages (messages sent by the coach).
- Fetches participant name from Facebook Graph API.
- Deduplicates messages by `message.mid`.

**Env vars:** `IG_WEBHOOK_VERIFY_TOKEN`, `SUPABASE_URL` (fallback `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_KEY`

**Supabase tables touched:** `ig_accounts` (read), `ig_conversations` (read/write), `ig_messages` (read/write)

**Gotchas:**
- **No CORS** -- correct for webhooks, but must ensure App Router doesn't add CORS middleware globally.
- **No authentication on POST** -- Meta doesn't sign Instagram webhook payloads the same way Stripe does. This is normal but worth noting.
- Processes BEFORE responding 200. Meta recommends responding quickly (within 5s) to avoid retries. Heavy processing (multiple Supabase queries + Facebook API call per message) could cause timeouts.
- GET verification returns plaintext (`res.send(challenge)`) not JSON. In App Router: `new Response(challenge)`.
- The fallback lookup (`also try the other ID`) is unusual -- could match the wrong account.
- `maxDuration` not set. Complex processing could exceed default 10s.

**Next.js migration:**
```
app/api/ig-webhook/route.ts -> export async function GET(...) and export async function POST(...)
```
GET must return plain text, not JSON.

---

### 9. `push.js`

**Route:** `POST /api/push`
**Auth:** JWT via `verifyAuth`
**CORS:** None (no cors() call)

**Request body:** Passed directly to Expo Push API.
```json
{
  "to": "ExponentPushToken[...]",
  "title": "string",
  "body": "string"
}
```

**Response:** Proxied from Expo.

**Gotchas:**
- Uses low-level `https.request` instead of `fetch`. Wraps in `new Promise()` for the Vercel handler.
- No CORS -- intentional? If called from web frontend, will fail. Likely only called from mobile/server.
- Simple proxy pattern. Could use `fetch` instead of `https`.

**Next.js migration:**
```
app/api/push/route.ts -> export async function POST(request: Request)
```
Replace `https.request` with `fetch` (simpler, no Promise wrapper needed).

---

### 10. `stripe.js`

**Route:** `POST/GET /api/stripe?action=<action>`
**Auth:** Complex -- varies by action (see below).
**CORS:** Yes

**This is the most complex endpoint -- 14 actions in a single file.**

#### Auth model:
- **Coach actions** (default): `verifyCoach(req, 'coachId')` -- JWT + `body.coachId` must match user.
- **Athlete actions** (`cancellation-request`, `create-payment-sheet`, `confirm-payment`): `verifyAuth` + verify athlete belongs to user via Supabase lookup.

#### Rate limiting:
- In-memory `Map` -- `15 requests per IP per action per 60s`.
- **WARNING:** In-memory state is per-instance. Does not work across multiple serverless instances. Provides minimal protection.

#### Actions:

| Action | Method | Description |
|---|---|---|
| `connect-start` | POST | Create Stripe Connect Express account + return onboarding URL |
| `connect-complete` | POST/GET | Check Connect onboarding status after return |
| `connect-status` | POST/GET | Quick check if coach has active Connect account |
| `connect-dashboard` | POST | Generate Express dashboard login link |
| `save-key` | POST | Coach saves their own Stripe secret key (encrypted) |
| `verify-key` | POST/GET | Check if coach's saved key is still valid |
| `import-subscriptions` | POST | Import all active subscriptions from coach's Stripe |
| `create-checkout` | POST | Create Checkout Session on coach's Stripe (web) |
| `create-payment-sheet` | POST | Create PaymentIntent/Subscription for mobile native payment |
| `cancel` | POST | Cancel a subscription |
| `coach-setup` | POST | Create SetupIntent for coach's SaaS payment method (on platform Stripe) |
| `cancellation-request` | POST | Athlete requests cancellation |
| `cancellation-respond` | POST | Coach accepts/refuses cancellation |
| `confirm-payment` | POST | Mobile: verify payment went through |

#### Env vars:
- `STRIPE_SECRET_KEY` (platform/Pierre's account)
- `STRIPE_PUBLISHABLE_KEY` (returned to client for mobile payments)
- `STRIPE_ENCRYPTION_KEY` (for encrypting coach keys)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

#### Supabase tables touched:
- `coach_profiles` (read/write)
- `athlete_payment_plans` (read/write)
- `athletes` (read)
- `stripe_customers` (read/write)
- `stripe_audit_log` (write)
- `cancellation_requests` (read/write)
- `notifications` (write)
- `payment_history` (write)
- `athlete_activity_log` (write)

#### Gotchas:
- **Massive file** (796 lines). Should be split for App Router.
- `var customer` and `var ephemeralKey` in `createPaymentSheet` -- uses `var` for hoisting across try/catch blocks. Fragile.
- `getCoachStripe` duplicated between `stripe.js` and `stripe-webhook.js` (slightly different names: `getCoachStripe` vs `getCoachStripeInstance`).
- Rate limiter is per-instance (useless in serverless).
- `connect-complete` and `connect-status` accept `coachId` from both `req.query` and `req.body` -- but auth checks `req.body.coachId`. If `coachId` is only in query, auth may fail or mismatch.
- `create-payment-sheet` prorata logic is complex (50+ lines). Worth thorough testing.
- Hardcoded ephemeral key API version `'2023-10-16'`.
- `importSubscriptions` paginates through ALL subscriptions -- could be slow for large accounts.

**Next.js migration:**
```
Recommended: Split into multiple route files:
  app/api/stripe/connect/route.ts       (connect-start, connect-complete, connect-status, connect-dashboard)
  app/api/stripe/keys/route.ts          (save-key, verify-key)
  app/api/stripe/checkout/route.ts      (create-checkout, create-payment-sheet)
  app/api/stripe/subscriptions/route.ts (import-subscriptions, cancel)
  app/api/stripe/setup/route.ts         (coach-setup)
  app/api/stripe/cancellation/route.ts  (cancellation-request, cancellation-respond)
  app/api/stripe/confirm/route.ts       (confirm-payment)
```
Or keep as single file with action router if migration velocity is priority.

---

### 11. `stripe-webhook.js`

**Route:** `POST /api/stripe-webhook`
**Auth:** Stripe signature verification (`stripe.webhooks.constructEvent`)
**CORS:** None (Stripe server-to-server)
**maxDuration:** 30s (vercel.json)
**bodyParser:** `false` (raw body needed for signature)

**Config export:**
```js
module.exports.config = { api: { bodyParser: false } };
```

**Flow:**
1. Read raw body manually (`getRawBody`)
2. Try platform webhook secret (`STRIPE_WEBHOOK_SECRET`)
3. If fails, parse body to get `account` ID, lookup coach's webhook secret, re-verify
4. Replay protection via `stripe_audit_log.stripe_event_id`
5. Route to `handleCoachEvent` or `handlePlatformEvent`

**Coach events handled:**
- `checkout.session.completed` -- subscription or one-time payment
- `invoice.paid` -- recurring payment success + proration detection
- `invoice.payment_failed` -- mark as past_due
- `customer.subscription.deleted` -- mark as canceled
- `payment_intent.succeeded` -- one-time or first payment

**Platform events handled:**
- `invoice.paid` -- coach paid SaaS fee
- `invoice.payment_failed` -- coach SaaS payment failed
- `setup_intent.succeeded` -- coach saved payment method

**Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

**Supabase tables touched:** `stripe_audit_log`, `coach_profiles`, `stripe_customers`, `athlete_payment_plans`, `payment_history`, `platform_invoices`

**Gotchas:**
- **`bodyParser: false` config is critical.** In Next.js App Router, body parsing is not automatic -- `request.text()` or `request.arrayBuffer()` gives the raw body. This is actually simpler.
- `getRawBody` manually reads the request stream. Not needed in App Router.
- Coach webhook secret lookup requires parsing the raw body JSON AND then re-verifying signature -- double parsing.
- `getCoachStripeInstance` does a dynamic `require('./_crypto')` inside the function (lazy load). Will need import at top in ESM.
- The dual-signature verification (platform first, then coach) adds latency on coach events (platform verification fails first).
- `invoice.paid` handler for coach events has proration description logic.
- No error response on processing failure -- always returns 200 (correct for webhooks).

**Next.js migration:**
```
app/api/stripe-webhook/route.ts -> export async function POST(request: Request)
```
- Remove `getRawBody` function. Use `const rawBody = await request.text()` (or `Buffer.from(await request.arrayBuffer())`).
- Remove `module.exports.config = { api: { bodyParser: false } }` -- not needed in App Router.
- Signature verification uses `rawBody` as string, ensure Stripe SDK accepts it.

---

### 12. `stripe-cron.js`

**Route:** `GET/POST /api/stripe-cron`
**Auth:** `verifyCronSecret`
**CORS:** None
**maxDuration:** 120s (vercel.json)
**Cron:** `0 9 * * *` (daily at 9:00 UTC)

**Query params:**
- `?action=invoice` -- run monthly invoicing only
- `?action=retry` -- run payment retry only
- No action -- runs retry always + invoice on the 10th

**Invoice logic (runs on 10th of month):**
- Fetches all coaches
- Skips if already invoiced for that month, or if in trial
- Calculates per-athlete pro-rata billing based on `athlete_activity_log` events (added/removed dates)
- `PRICE_PER_ATHLETE_MONTH = 500` (5.00 EUR)
- `BUSINESS_FEE = 6000` (60.00 EUR)
- Creates Stripe invoice items + invoice, finalizes, attempts payment
- Records in `platform_invoices` and `stripe_audit_log`

**Retry logic (runs daily):**
- Fetches invoices with status `failed`, `retry_1`, `retry_2`, `retry_3` where `next_retry_at <= now`
- Retry schedule: 3 days, 4 days, 7 days
- After 3 retries + 30 days: blocks coach account
- On successful retry: unblocks coach, sends notification
- On failure: advances retry status, sends notification

**Env vars:** `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CRON_SECRET`

**Supabase tables touched:** `coach_profiles`, `athlete_activity_log`, `platform_invoices`, `stripe_audit_log`, `notifications`

**Gotchas:**
- 120s maxDuration is high. If there are many coaches, sequential processing could still timeout.
- Pro-rata calculation logic is complex (date math with added/removed events). Edge cases around month boundaries.
- `Stripe` is initialized at module level with `process.env.STRIPE_SECRET_KEY`. If env var is missing, the module fails to load.
- Business fee is hardcoded. No config table.
- Notification inserts have `.catch(() => {})` -- notification failures are silently ignored.

**Next.js migration:**
```
app/api/stripe-cron/route.ts -> export async function GET(request: Request)
```
POST can be removed (cron uses GET). Or keep both for manual triggers.

---

## vercel.json Configuration

```json
{
  "headers": [
    { "source": "/(.*\\.css|.*\\.js)", "headers": [{ "Cache-Control": "public, max-age=0, must-revalidate" }] },
    { "source": "/(.*)", "headers": [security headers: nosniff, DENY, XSS, referrer, permissions, HSTS] }
  ],
  "functions": {
    "api/ig-messages.js": { "maxDuration": 60 },
    "api/stripe-webhook.js": { "maxDuration": 30 },
    "api/stripe-cron.js": { "maxDuration": 120 }
  },
  "crons": [
    { "path": "/api/ig-sync-stories", "schedule": "0 8 * * *" },
    { "path": "/api/stripe-cron", "schedule": "0 9 * * *" }
  ]
}
```

**Migration notes:**
- `headers` config stays in `vercel.json` (compatible with App Router).
- `functions` config: In App Router, use route segment config `export const maxDuration = 60` in each route file, OR keep in vercel.json with updated paths (e.g., `app/api/ig-messages/route.ts`).
- `crons` config: Paths change to match App Router routes. Vercel cron is compatible with App Router.

---

## Environment Variables Summary

| Variable | Used by | Description |
|---|---|---|
| `SUPABASE_URL` | All endpoints with Supabase | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Fallback for SUPABASE_URL | Public Supabase URL |
| `SUPABASE_ANON_KEY` | `_auth.js` | For JWT verification |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `_auth.js` fallback | Public anon key |
| `SUPABASE_SERVICE_KEY` | Most endpoints | Service role key (bypasses RLS) |
| `CRON_SECRET` | `_auth.js`, cron endpoints | Vercel cron authentication |
| `META_APP_ID` | `ig-auth.js`, `fb-page-auth.js` | Instagram/Facebook app ID |
| `META_APP_SECRET` | `ig-auth.js`, `fb-page-auth.js` | Instagram/Facebook app secret |
| `META_APP_ID_FB` | `fb-page-auth.js` | Facebook-specific app ID (optional) |
| `META_APP_SECRET_FB` | `fb-page-auth.js` | Facebook-specific app secret (optional) |
| `IG_WEBHOOK_VERIFY_TOKEN` | `ig-webhook.js` | Meta webhook verification token |
| `STRIPE_SECRET_KEY` | `stripe.js`, `stripe-webhook.js`, `stripe-cron.js` | Platform Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | `stripe.js` | Returned to mobile clients |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook.js` | Platform webhook signing secret |
| `STRIPE_ENCRYPTION_KEY` | `_crypto.js` | AES-256 key for encrypting coach Stripe keys |
| `VERCEL_ENV` | `_cors.js` | Determines allowed CORS origins |

**Total: 16 env vars** (some with fallbacks)

---

## Migration Checklist & Gotchas

### Global Changes Required

1. **CommonJS to ESM**: All files use `require()`/`module.exports`. Must convert to `import`/`export`.

2. **Request/Response API change**:
   - `req.body` -> `await request.json()`
   - `req.query` -> `new URL(request.url).searchParams`
   - `req.headers.authorization` -> `request.headers.get('authorization')`
   - `req.method` -> `request.method` (same)
   - `res.status(200).json({...})` -> `NextResponse.json({...}, { status: 200 })`
   - `res.status(204).end()` -> `new Response(null, { status: 204 })`
   - `res.send(text)` -> `new Response(text)`
   - `res.setHeader(k, v)` -> set headers on Response object

3. **Handler signature**: `module.exports = async function handler(req, res)` -> `export async function POST(request: Request)`

4. **Body parser config**: `module.exports.config = { api: { bodyParser: false } }` (stripe-webhook) is not needed in App Router. Raw body is available via `request.text()`.

5. **CORS refactor**: The `cors()` helper returns boolean and mutates `res`. In App Router, return a `Response` with headers. Consider:
   - A shared `withCors(response)` wrapper that adds headers to a Response.
   - Handle OPTIONS in each route or via middleware.

6. **Helper file location**: `_auth.js`, `_cors.js`, `_crypto.js` should move to `lib/` or `utils/` since App Router doesn't use the `_` prefix convention for non-routes (all files in `app/api/*/` must be `route.ts`).

7. **TypeScript**: If migrating to TypeScript (recommended), add types for all request/response shapes.

### Per-Endpoint Flags

| Endpoint | Difficulty | Special considerations |
|---|---|---|
| `ig-sync-profile` | Easy | Simplest endpoint. Good starting point. |
| `push` | Easy | Replace `https.request` with `fetch`. Remove Promise wrapper. |
| `fb-page-auth` | Easy | Straightforward conversion. |
| `ig-auth` | Easy | Straightforward conversion. |
| `ig-publish` | Medium | Video polling loop needs `maxDuration` config. |
| `ig-sync-reels` | Medium | Standard conversion. Watch for timeout with many reels. |
| `ig-sync-stories` | Medium | Dual-method (GET/POST) with different auth per method. |
| `ig-messages` | Medium | Action-based router. Consider splitting into sub-routes. |
| `ig-webhook` | Medium | GET returns plain text. POST has no auth (intentional). No CORS (intentional). |
| `stripe-cron` | Medium | Complex business logic but straightforward handler. |
| `stripe-webhook` | Hard | Raw body handling, dual signature verification, `bodyParser: false` config. |
| `stripe.js` | Very Hard | 796 lines, 14 actions, 2 auth models, rate limiter, 10+ Supabase tables. Must split. |

### Recommended Migration Order

1. `ig-sync-profile` (validate the pattern)
2. `push`
3. `fb-page-auth`, `ig-auth`
4. `ig-publish`, `ig-sync-reels`
5. `ig-sync-stories` (dual method template)
6. `ig-messages`
7. `ig-webhook`
8. `stripe-cron`
9. `stripe-webhook`
10. `stripe.js` (split + migrate last)

### Structural Suggestions

```
app/
  api/
    fb-page-auth/route.ts
    ig-auth/route.ts
    ig-messages/route.ts          (or split into sub-routes)
    ig-publish/route.ts
    ig-sync-profile/route.ts
    ig-sync-reels/route.ts
    ig-sync-stories/route.ts
    ig-webhook/route.ts
    push/route.ts
    stripe/
      connect/route.ts
      keys/route.ts
      checkout/route.ts
      subscriptions/route.ts
      setup/route.ts
      cancellation/route.ts
      confirm/route.ts
    stripe-webhook/route.ts
    stripe-cron/route.ts
lib/
  auth.ts                          (was _auth.js)
  cors.ts                          (was _cors.js)
  crypto.ts                        (was _crypto.js)
  supabase.ts                      (shared client factory)
  stripe.ts                        (shared Stripe helpers, getCoachStripe)
```
