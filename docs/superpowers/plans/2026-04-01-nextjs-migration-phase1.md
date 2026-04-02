# Phase 1 — Fondation Next.js | Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le projet Next.js avec config, auth, thème, lib partagées, et landing page — le socle pour toutes les phases suivantes.

**Architecture:** Next.js 15 App Router + TypeScript. Supabase pour auth/BDD. CSS existant migré en globals + modules. Le projet est créé comme sous-dossier de COACH ou remplace le contenu sur la branche develop.

**Tech Stack:** Next.js 15, React 19, TypeScript, @supabase/ssr, @stripe/react-stripe-js, next-themes, chart.js

**Source files reference:** Tout le code source actuel est dans `/Users/pierrerebmann/MOMENTUM/COACH/`

---

## Task 1: Init projet Next.js + dépendances

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.local`, `.gitignore`

- [ ] **Step 1: Créer le projet Next.js dans un nouveau dossier**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git checkout develop
# Créer le projet Next.js dans un dossier temporaire
npx create-next-app@latest coach-nextjs --typescript --app --no-tailwind --no-eslint --no-src-dir --import-alias "@/*"
```

- [ ] **Step 2: Installer les dépendances**

```bash
cd coach-nextjs
npm install @supabase/supabase-js@^2.49.1 @supabase/ssr@^0.5 stripe@^14.14.0 @stripe/stripe-js@^4 @stripe/react-stripe-js@^3 chart.js@^4.4.7 react-chartjs-2@^5 next-themes@^0.4
```

- [ ] **Step 3: Configurer .env.local**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://kczcqnasnjufkgbnrbvp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjemNxbmFzbmp1ZmtnYm5yYnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjEwOTAsImV4cCI6MjA4OTEzNzA5MH0.rRAuqUkU_6Ry7nUdnfHdz_7zvCLcxgNBPgE53j_nfQc

# Stripe
STRIPE_SECRET_KEY=<from current .env.local>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from current .env.local>
STRIPE_WEBHOOK_SECRET=<from current .env.local>
STRIPE_ENCRYPTION_KEY=<from current .env.local>

# Instagram
META_APP_ID=<from current .env.local>
META_APP_SECRET=<from current .env.local>
IG_VERIFY_TOKEN=<from current .env.local>

# Cron
CRON_SECRET=<from current .env.local>

# Admin
ADMIN_EMAIL=rebmannpierre1@gmail.com
```

- [ ] **Step 4: Configurer next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 5: Mettre à jour .gitignore**

```
node_modules/
.next/
.env
.env.local
.env*.local
.DS_Store
.vercel
```

- [ ] **Step 6: Vérifier que le projet compile**

```bash
npm run dev
# Doit démarrer sur localhost:3000 sans erreur
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: init Next.js 15 project with dependencies"
```

---

## Task 2: Lib partagées (Supabase, constants, utils, types)

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- Create: `lib/constants.ts`, `lib/utils.ts`, `lib/types.ts`

- [ ] **Step 1: Supabase browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Supabase server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Can be ignored in Server Components
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Supabase middleware helper**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Public routes — no auth required
  const publicPaths = ['/', '/login', '/privacy', '/api']
  const isPublic = publicPaths.some(p =>
    request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith('/api/')
  )

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
```

- [ ] **Step 4: Constants** — migrer depuis `config.js`

Create `lib/constants.ts`:
```typescript
export const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
export const MS_PER_DAY = 86400000
export const MAX_VIDEOS_LOAD = 200
export const VIDEO_RETENTION_MONTHS = 3
export const DEFAULT_STEPS_GOAL = 10000
export const DEFAULT_WATER_GOAL = 2500
export const DEFAULT_NOTIF_TIME = '08:00'

export const PROG_PHASES = {
  seche:          { label: 'SÈCHE',          short: 'SÈCHE', color: '#c0392b' },
  reverse:        { label: 'REVERSE',        short: 'REV',   color: '#2471a3' },
  prise_de_masse: { label: 'PRISE DE MASSE', short: 'MASS',  color: '#1e8449' },
  mini_cut:       { label: 'MINI CUT',       short: 'MCUT',  color: '#e67e22' },
} as const

export type ProgPhaseKey = keyof typeof PROG_PHASES
```

- [ ] **Step 5: Utils** — migrer depuis `utils.js`

Create `lib/utils.ts`:
```typescript
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDate(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function validateFile(file: File, type: 'image' | 'video'): string | null {
  const MAX_IMAGE = 10 * 1024 * 1024
  const MAX_VIDEO = 100 * 1024 * 1024
  const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const VID_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
  const maxSize = type === 'video' ? MAX_VIDEO : MAX_IMAGE
  const allowed = type === 'video' ? VID_TYPES : IMG_TYPES
  if (file.size > maxSize) return `Fichier trop volumineux (max ${Math.round(maxSize / 1024 / 1024)} MB)`
  if (!allowed.includes(file.type)) return 'Type de fichier non autorisé'
  return null
}

export async function validateFileMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 4).arrayBuffer()
    const hex = [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')
    const valid = ['ffd8ffe0', 'ffd8ffe1', '89504e47', '52494646', '00000018', '00000020', '0000001c', '1a45dfa3']
    return valid.some(sig => hex.startsWith(sig))
  } catch {
    return true
  }
}

export function generateSecurePassword(length = 12): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, b => charset[b % charset.length]).join('')
}

// Bilan scheduling — migré de config.js
export function isBilanDate(
  dateStr: string,
  frequency: string,
  interval: number,
  day: number | number[],
  anchorDate: string,
  monthDay?: number
): boolean {
  if (frequency === 'none') return false
  if (frequency === 'daily') return true

  const date = new Date(dateStr + 'T12:00:00')

  if (frequency === 'weekly') {
    return date.getDay() === (typeof day === 'number' ? day : (Array.isArray(day) ? day[0] : 1))
  }

  if (frequency === 'biweekly') {
    const days = Array.isArray(day) ? day : [day ?? 1]
    return days.includes(date.getDay())
  }

  if (frequency === 'monthly') {
    return date.getDate() === (monthDay || 1)
  }

  if (frequency === 'custom') {
    const anchor = new Date((anchorDate || dateStr) + 'T12:00:00')
    const diffDays = Math.round((date.getTime() - anchor.getTime()) / MS_PER_DAY)
    return diffDays >= 0 && diffDays % (interval || 1) === 0
  }

  return false
}

const MS_PER_DAY = 86400000

export function getNextBilanDate(
  frequency: string, interval: number, day: number | number[], anchorDate: string, monthDay?: number
): string | null {
  const today = new Date()
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const str = toDateStr(d)
    if (isBilanDate(str, frequency, interval, day, anchorDate, monthDay)) return str
  }
  return null
}
```

- [ ] **Step 6: Types de base**

Create `lib/types.ts`:
```typescript
export interface CoachProfile {
  id: string
  user_id: string
  email: string
  display_name: string
  plan: 'athlete' | 'business' | 'free'
  trial_ends_at: string | null
  has_payment_method: boolean
  stripe_account_id?: string
  stripe_secret_key_encrypted?: string
  stripe_publishable_key?: string
  stripe_webhook_secret_encrypted?: string
}

export interface Athlete {
  id: string
  user_id: string | null
  coach_id: string
  first_name: string
  last_name: string
  email: string
  avatar_url?: string
  bilan_frequency: string
  bilan_interval?: number
  bilan_day?: number | number[]
  bilan_anchor_date?: string
  bilan_month_day?: number
  created_at: string
}

export interface User {
  id: string
  email: string
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/
git commit -m "feat: add shared libs (supabase, constants, utils, types)"
```

---

## Task 3: Middleware auth + Root layout + ThemeProvider

**Files:**
- Create: `middleware.ts`, `app/layout.tsx`, `contexts/ThemeContext.tsx`

- [ ] **Step 1: Middleware auth**

Create `middleware.ts` à la racine:
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Globals CSS** — extraire les variables et reset de `styles.css`

Create `styles/globals.css` — copier les lignes 1-165 de `css/styles.css` (variables :root, [data-theme="light"], reset, typography, scrollbars). Ajouter les styles de notification et les classes utilitaires (lignes 1256-1370).

Le fichier doit contenir: variables CSS (:root + light theme), reset (*), body, scrollbars, .notification, .btn base styles, utility classes.

- [ ] **Step 3: Root layout**

Create `app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/contexts/ThemeContext'
import '@/styles/globals.css'
import '@fortawesome/fontawesome-free/css/all.min.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'MOMENTUM — Coaching Platform',
  description: 'Plateforme de coaching sportif professionnelle',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

Note: installer `@fortawesome/fontawesome-free` via npm au lieu du CDN.

```bash
npm install @fortawesome/fontawesome-free
```

- [ ] **Step 4: ThemeProvider**

Create `contexts/ThemeContext.tsx`:
```typescript
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      storageKey="prc-theme"
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  )
}
```

- [ ] **Step 5: Vérifier compilation**

```bash
npm run dev
# Page par défaut Next.js doit s'afficher avec le thème dark
```

- [ ] **Step 6: Commit**

```bash
git add middleware.ts app/layout.tsx contexts/ styles/
git commit -m "feat: add auth middleware, root layout, theme provider"
```

---

## Task 4: AuthContext + hook useAuth

**Files:**
- Create: `contexts/AuthContext.tsx`, `hooks/useAuth.ts`

- [ ] **Step 1: AuthContext**

Create `contexts/AuthContext.tsx`:
```typescript
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, CoachProfile } from '@/lib/types'

interface AuthContextType {
  user: User | null
  coach: CoachProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, plan: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshCoach: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [coach, setCoach] = useState<CoachProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function fetchCoachProfile(userId: string) {
    const { data } = await supabase
      .from('coach_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    setCoach(data)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email! })
        fetchCoachProfile(user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
        fetchCoachProfile(session.user.id)
      } else {
        setUser(null)
        setCoach(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    // Verify not an athlete account
    const { data: athleteCheck } = await supabase
      .from('athletes')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (athleteCheck) {
      await supabase.auth.signOut()
      return { error: 'Ce compte est un compte athlète. Utilisez l\'app athlète.' }
    }

    setUser({ id: data.user.id, email: data.user.email! })
    await fetchCoachProfile(data.user.id)
    return {}
  }

  async function signUp(email: string, password: string, plan: string) {
    if (password.length < 6) return { error: 'Le mot de passe doit contenir au moins 6 caractères' }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Erreur lors de l\'inscription' }

    await supabase.from('coach_profiles').upsert({
      user_id: data.user.id,
      email,
      display_name: email.split('@')[0],
      plan,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id' })

    setUser({ id: data.user.id, email: data.user.email! })
    await fetchCoachProfile(data.user.id)
    return {}
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setCoach(null)
  }

  async function refreshCoach() {
    if (user) await fetchCoachProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, coach, loading, signIn, signUp, signOut, refreshCoach }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Ajouter AuthProvider au layout**

Modifier `app/layout.tsx` pour wrapper children avec `<AuthProvider>` (à l'intérieur de ThemeProvider).

- [ ] **Step 3: Commit**

```bash
git add contexts/AuthContext.tsx app/layout.tsx
git commit -m "feat: add AuthContext with signIn/signUp/signOut"
```

---

## Task 5: Page Login

**Files:**
- Create: `app/login/page.tsx`, `styles/auth.module.css`

- [ ] **Step 1: Extraire le CSS auth** de `css/styles.css` lignes 166-234 vers `styles/auth.module.css`

- [ ] **Step 2: Page login**

Create `app/login/page.tsx` — convertir le HTML de `#auth-screen` en React. Inclure:
- Tabs login/register
- Formulaire email/password
- Choix du plan (radio athlete/business) visible en mode register
- Soumission via `useAuthContext().signIn` / `signUp`
- Redirect vers `/dashboard` après login, ou `/setup-payment` si `!has_payment_method`
- Redirect vers `/admin` si email === ADMIN_EMAIL

- [ ] **Step 3: Vérifier login fonctionnel**

```bash
npm run dev
# Aller sur localhost:3000/login
# Tester login avec un compte existant
```

- [ ] **Step 4: Commit**

```bash
git add app/login/ styles/auth.module.css
git commit -m "feat: add login/register page"
```

---

## Task 6: Page Setup Payment (Stripe)

**Files:**
- Create: `app/setup-payment/page.tsx`

- [ ] **Step 1: Page payment wall** — convertir `#payment-wall` en React avec `@stripe/react-stripe-js`. Utiliser `Elements`, `PaymentElement`, `useStripe`, `useElements`. Appeler `/api/stripe?action=coach-setup` pour obtenir le clientSecret. Après confirmation, update `has_payment_method` dans `coach_profiles` et redirect vers `/dashboard`.

- [ ] **Step 2: Commit**

```bash
git add app/setup-payment/
git commit -m "feat: add Stripe payment setup page"
```

---

## Task 7: Landing page (composants)

**Files:**
- Create: `app/page.tsx`, `components/landing/Hero.tsx`, `components/landing/Features.tsx`, `components/landing/HowItWorks.tsx`, `components/landing/Pricing.tsx`, `components/landing/SocialProof.tsx`, `components/landing/FinalCTA.tsx`, `components/landing/HeroParticles.tsx`
- Create: `components/layout/Navbar.tsx`, `components/layout/Footer.tsx`
- Create: `styles/landing.module.css`

- [ ] **Step 1: Extraire le CSS landing** de `css/styles.css` lignes 4627-6359 vers `styles/landing.module.css`. Supprimer le préfixe `#landing-screen` des sélecteurs.

- [ ] **Step 2: Navbar** — convertir la nav du `#landing-screen`. Inclure scroll effect, mobile menu toggle, liens vers sections (ancres), boutons login/register.

- [ ] **Step 3: Hero** — convertir `.hero` avec badge, titre `.highlight`, sous-titre, boutons CTA, stats. Inclure le canvas particles (composant séparé `HeroParticles.tsx` utilisant le code de `particles.js`).

- [ ] **Step 4: Features** — convertir la section `.bento` avec les bento-card (lg, md, sm, stack).

- [ ] **Step 5: HowItWorks** — convertir `.steps-container` avec les 3 step-cards.

- [ ] **Step 6: Pricing** — convertir `.pricing-grid` avec les 2 pricing-card (Athlete + Business featured).

- [ ] **Step 7: SocialProof + FinalCTA + Footer** — convertir les 3 dernières sections.

- [ ] **Step 8: Page d'accueil** — assembler tous les composants dans `app/page.tsx`.

- [ ] **Step 9: Vérifier le rendu**

```bash
npm run dev
# localhost:3000 doit afficher la landing page identique à l'actuelle
```

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx components/landing/ components/layout/ styles/landing.module.css
git commit -m "feat: add landing page with all sections"
```

---

## Task 8: Composants UI partagés

**Files:**
- Create: `components/ui/Toast.tsx`, `components/ui/Modal.tsx`, `components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Skeleton.tsx`, `components/ui/EmptyState.tsx`, `components/ui/Avatar.tsx`, `components/ui/Toggle.tsx`, `components/ui/Badge.tsx`, `components/ui/FormGroup.tsx`, `components/ui/Tabs.tsx`
- Create: `contexts/ToastContext.tsx`

- [ ] **Step 1: ToastContext** — système de notification React remplaçant `notify()`. Context + provider avec stack de toasts, auto-dismiss, types success/error.

- [ ] **Step 2: Modal** — composant générique avec overlay, animation `modalSlideIn`, close on escape/click outside. Utilise React portal.

- [ ] **Step 3: Autres composants UI** — Button (variants: primary, outline, red, icon, sm), Card (header + body), Skeleton, EmptyState, Avatar (initials-based), Toggle, Badge, FormGroup (label + input wrapper), Tabs (horizontal tab bar).

Chaque composant utilise les classes CSS existantes (pas de réécriture).

- [ ] **Step 4: Commit**

```bash
git add components/ui/ contexts/ToastContext.tsx
git commit -m "feat: add shared UI components (Modal, Toast, Button, Card, etc.)"
```

---

## Task 9: Vérification Phase 1

- [ ] **Step 1: Build de production**

```bash
npm run build
# Doit compiler sans erreur TypeScript
```

- [ ] **Step 2: Checklist fonctionnelle**

- Landing page s'affiche correctement (/)
- Login fonctionne (/login)
- Register crée un compte + coach_profiles
- Redirect vers /setup-payment si pas de carte
- Redirect vers /dashboard après login
- Thème dark/light toggle fonctionne
- Middleware bloque les routes protégées sans session
- Admin redirect fonctionne

- [ ] **Step 3: Commit final + push**

```bash
git add .
git commit -m "feat: Phase 1 complete — Next.js foundation, auth, landing, UI components"
git push origin develop
```
