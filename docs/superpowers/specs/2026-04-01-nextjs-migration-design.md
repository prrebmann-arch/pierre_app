# Spec — Migration COACH vers Next.js

**Date**: 2026-04-01
**Status**: Draft
**Branche**: `develop`

---

## 1. Objectif

Migrer l'application COACH (SPA vanilla JS) vers Next.js App Router + TypeScript pour préparer le produit SaaS. Zéro changement visuel — même CSS, même design, même fonctionnalités.

## 2. Décisions techniques

| Sujet | Choix |
|---|---|
| Framework | Next.js 15 (App Router) |
| Langage | TypeScript |
| State management | React Context |
| CSS | Fichiers CSS existants (CSS Modules par feature) |
| Auth | Supabase Auth Helpers pour Next.js (`@supabase/ssr`) |
| Admin | Route `/admin` protégée dans le même projet |
| Déploiement | Vercel (identique) |

## 3. Architecture cible

### 3.1 Structure des dossiers

```
coach-nextjs/
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider, fonts, global CSS)
│   ├── page.tsx                # Landing page (/)
│   ├── login/page.tsx          # Auth (login/register)
│   ├── setup-payment/page.tsx  # Payment wall Stripe
│   ├── privacy/page.tsx        # Privacy policy
│   │
│   ├── (app)/                  # Route group — layout avec sidebar
│   │   ├── layout.tsx          # AppLayout (sidebar + main)
│   │   ├── dashboard/page.tsx
│   │   ├── athletes/
│   │   │   ├── page.tsx        # Liste des athlètes
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Redirect vers apercu
│   │   │       ├── apercu/page.tsx
│   │   │       ├── infos/page.tsx
│   │   │       ├── training/page.tsx
│   │   │       ├── nutrition/page.tsx
│   │   │       ├── roadmap/page.tsx
│   │   │       ├── bilans/page.tsx
│   │   │       ├── videos/page.tsx
│   │   │       ├── retours/page.tsx
│   │   │       ├── posing/page.tsx
│   │   │       ├── questionnaires/page.tsx
│   │   │       ├── supplements/page.tsx
│   │   │       └── menstrual/page.tsx
│   │   ├── bilans/page.tsx     # Bilans overview (tous athlètes)
│   │   ├── videos/page.tsx     # Vidéos globales
│   │   ├── templates/page.tsx
│   │   ├── aliments/page.tsx
│   │   ├── exercices/page.tsx
│   │   ├── formations/page.tsx
│   │   ├── business/
│   │   │   ├── page.tsx        # Dashboard business
│   │   │   ├── leads/page.tsx
│   │   │   ├── automations/page.tsx
│   │   │   ├── instagram/page.tsx
│   │   │   ├── messages/page.tsx
│   │   │   └── content/page.tsx
│   │   └── profile/page.tsx
│   │
│   ├── admin/                  # Route group admin
│   │   ├── layout.tsx          # AdminLayout (sidebar admin)
│   │   ├── page.tsx            # Overview
│   │   ├── coaches/page.tsx
│   │   ├── athletes/page.tsx
│   │   ├── payments/page.tsx
│   │   └── metrics/page.tsx
│   │
│   └── api/                    # API routes (serverless)
│       ├── stripe/
│       │   ├── route.ts        # Actions Stripe coach
│       │   ├── webhook/route.ts
│       │   └── cron/route.ts
│       ├── instagram/
│       │   ├── auth/route.ts
│       │   ├── messages/route.ts
│       │   ├── publish/route.ts
│       │   ├── webhook/route.ts
│       │   ├── sync-profile/route.ts
│       │   ├── sync-reels/route.ts
│       │   └── sync-stories/route.ts
│       ├── facebook/
│       │   └── page-auth/route.ts
│       └── push/route.ts
│
├── components/
│   ├── ui/                     # Composants réutilisables
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── Toggle.tsx
│   │   ├── Tabs.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx
│   │   └── FormGroup.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── AdminSidebar.tsx
│   │   ├── Navbar.tsx          # Landing navbar
│   │   └── Footer.tsx          # Landing footer
│   ├── landing/
│   │   ├── Hero.tsx
│   │   ├── HeroParticles.tsx
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Pricing.tsx
│   │   ├── SocialProof.tsx
│   │   └── FinalCTA.tsx
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   ├── StatsCards.tsx
│   │   └── ActivityFeed.tsx
│   ├── athletes/
│   │   ├── AthletesList.tsx
│   │   ├── AthleteDetail.tsx
│   │   ├── AthleteTabBar.tsx
│   │   ├── AddAthleteForm.tsx
│   │   └── PaymentCard.tsx
│   ├── training/
│   │   ├── ProgramList.tsx
│   │   ├── ProgramEditor.tsx
│   │   ├── SessionTab.tsx
│   │   ├── ExerciseRow.tsx
│   │   ├── SetRow.tsx
│   │   ├── ExerciseLibrary.tsx
│   │   └── CardioSection.tsx
│   ├── nutrition/
│   │   ├── NutritionTab.tsx
│   │   ├── MealEditor.tsx
│   │   ├── FoodSearch.tsx
│   │   ├── AlimentsPage.tsx
│   │   └── NutritionPlanForm.tsx
│   ├── bilans/
│   │   ├── BilanAccordion.tsx
│   │   ├── PhotoCompare.tsx
│   │   ├── MensurationCharts.tsx
│   │   └── BilansOverview.tsx
│   ├── videos/
│   │   ├── VideosGrid.tsx
│   │   ├── VideoDetail.tsx
│   │   └── VideoCompare.tsx
│   ├── business/
│   │   ├── BusinessDashboard.tsx
│   │   ├── LeadsPipeline.tsx
│   │   ├── AutomationWizard.tsx
│   │   ├── InstagramAnalytics.tsx
│   │   ├── MessagesInbox.tsx
│   │   └── ContentPlanner.tsx
│   └── admin/
│       ├── AdminOverview.tsx
│       ├── AdminCoaches.tsx
│       ├── AdminAthletes.tsx
│       ├── AdminPayments.tsx
│       └── AdminMetrics.tsx
│
├── contexts/
│   ├── AuthContext.tsx          # User session, coach profile
│   ├── AthleteContext.tsx       # Athlete sélectionné + données
│   └── ThemeContext.tsx         # Dark/light mode
│
├── hooks/
│   ├── useSupabase.ts          # Client Supabase
│   ├── useAuth.ts              # Session + auth helpers
│   ├── useAudioRecorder.ts     # MediaRecorder (bilans + vidéos)
│   └── useAthleteData.ts       # Fetch données athlète
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client
│   │   └── middleware.ts       # Auth middleware
│   ├── stripe/
│   │   ├── client.ts           # Stripe browser
│   │   └── server.ts           # Stripe server + crypto
│   ├── constants.ts            # PROG_PHASES, JOURS_SEMAINE, etc.
│   ├── utils.ts                # formatDate, getWeekNumber, etc.
│   └── types.ts                # Types TypeScript globaux
│
├── styles/
│   ├── globals.css             # Variables CSS, reset, thème
│   ├── landing.module.css
│   ├── sidebar.module.css
│   ├── dashboard.module.css
│   ├── athletes.module.css
│   ├── training.module.css
│   ├── nutrition.module.css
│   ├── bilans.module.css
│   ├── videos.module.css
│   ├── business.module.css
│   ├── admin.module.css
│   └── ... (un module par feature)
│
├── middleware.ts                # Auth guard global
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local
```

### 3.2 Auth flow

```
Middleware (middleware.ts)
  │
  ├── Route publique (/, /login, /privacy, /api/*)
  │   → passe
  │
  ├── Route protégée (/dashboard, /athletes, etc.)
  │   → check session Supabase
  │   → pas de session → redirect /login
  │   → session OK → continue
  │
  └── Route admin (/admin/*)
      → check session + check email === ADMIN_EMAIL
      → pas admin → redirect /dashboard
```

### 3.3 Migration des API

Les API endpoints actuels (`/api/*.js`) migrent vers App Router (`/app/api/*/route.ts`).

Changements principaux :
- CommonJS → ESM (`import/export`)
- `req.body` → `await request.json()`
- `req.query` → `new URL(request.url).searchParams`
- `res.status(200).json()` → `NextResponse.json()`
- `cors()` helper → middleware CORS ou headers dans `next.config.ts`
- `bodyParser: false` (webhook) → `request.text()` natif

Le fichier `stripe.js` (796 lignes, 14 actions) sera splitté en routes séparées :
- `/api/stripe/route.ts` — actions coach (save-key, verify-key, import-subs, etc.)
- `/api/stripe/webhook/route.ts` — webhook
- `/api/stripe/cron/route.ts` — cron job

### 3.4 Migration du state global

| Avant (window.xxx) | Après (React) |
|---|---|
| `currentUser`, `currentCoachProfile` | `AuthContext` |
| `athletesList`, `currentAthleteId`, `currentAthleteObj` | `AthleteContext` |
| `exercicesDB`, `alimentsDB` | Fetch dans les composants qui en ont besoin |
| `_tpSessions`, `_tpActiveSession` | State local du composant `ProgramEditor` |
| `bizTab`, `bizConfig`, `bizAllEntries` | State local des composants Business |
| Tous les `_xxxFilter`, `_xxxData` | `useState` dans chaque composant |

### 3.5 Migration du CSS

1. Variables CSS (`:root`, `[data-theme="light"]`) → `globals.css`
2. Chaque feature → CSS Module (`training.module.css`, etc.)
3. Le mécanisme show/hide (`.section.active`) disparaît — remplacé par le routing
4. Les modales restent en CSS mais déclenchées via React state au lieu de `openModal()`

### 3.6 Packages à installer

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "@supabase/supabase-js": "^2.49.1",
    "@supabase/ssr": "^0.5",
    "@stripe/stripe-js": "^4",
    "@stripe/react-stripe-js": "^3",
    "stripe": "^14.14.0",
    "chart.js": "^4.4.7",
    "react-chartjs-2": "^5",
    "next-themes": "^0.4"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^22",
    "@types/react": "^19"
  }
}
```

Pas de librairies supplémentaires inutiles. On garde le minimum.

## 4. Phases de migration

### Phase 1 — Fondation (priorité max)
Créer le projet Next.js, config, layout, thème, auth, landing page.
- Init Next.js + TypeScript + config
- `globals.css` avec variables
- `ThemeProvider` (next-themes)
- Supabase client/server
- Middleware auth
- Landing page (composants Hero, Features, Pricing, etc.)
- Page `/login` + auth flow
- Page `/setup-payment` (Stripe Elements)

### Phase 2 — Shell applicatif
Layout avec sidebar, navigation, dashboard.
- `(app)/layout.tsx` avec Sidebar
- `AuthContext` + `AthleteContext`
- Dashboard page
- Composants UI partagés (Button, Card, Modal, Toast, etc.)

### Phase 3 — Athlètes (coeur du produit)
- Liste athlètes + ajout/suppression
- Détail athlète avec TabBar
- Tabs simples : infos, aperçu, retours, posing, menstrual, supplements, questionnaires
- Upload avatar

### Phase 4 — Training + Nutrition (le plus complexe)
- Programme d'entraînement : éditeur, sessions, exercices, sets
- Bibliothèque d'exercices
- Plans nutrition : éditeur, repas, recherche aliments
- Base de données aliments
- Templates (training + nutrition)
- Cardio config

### Phase 5 — Bilans + Vidéos
- Bilans athlète (accordion, photos, mensurations)
- Bilans overview (tous athlètes)
- Photo compare viewer
- Vidéos (grille, détail, comparaison)
- Audio recording (hook partagé)
- Roadmap / programming weeks

### Phase 6 — Business
- Dashboard MRR / KPIs
- Leads pipeline
- Automations
- Instagram (OAuth, analytics, reels, stories)
- Messages Instagram (inbox)
- Content planner
- Formations

### Phase 7 — Admin + API + Finition
- Routes admin (overview, coaches, athlètes, paiements, metrics)
- Migration complète des API endpoints
- Profile coach (Stripe Connect)
- Cron jobs (vercel.json)
- Tests de bout en bout
- Nettoyage et vérification

## 5. Ce qui NE change PAS

- **Supabase** : BDD, auth, RLS, storage — identique
- **Stripe** : Connect, webhooks, paiements — identique
- **Instagram API** : OAuth, messages, publish — identique
- **Design** : même CSS, même look, même UX
- **Vercel** : même hébergeur, même domaine
- **Variables d'environnement** : identiques (juste dans `.env.local`)

## 6. Risques et mitigations

| Risque | Mitigation |
|---|---|
| Régression fonctionnelle | Checklist de test par feature avant merge |
| Training/Nutrition trop complexe | Phase dédiée, composants granulaires |
| Perte de l'état global | Mapping exhaustif window.xxx → Context/state |
| API qui cassent | Tests endpoint par endpoint |
| CSS qui casse | CSS Modules isolent les conflits |
| Prod impactée | Tout sur `develop`, `main` intact |

## 7. Estimation

~7 phases, projet conséquent. Chaque phase sera exécutée sur `develop` avec vérification complète avant passage à la suivante.

## 8. Checklist de validation finale

Avant merge `develop` → `main` :
- [ ] Toutes les pages accessibles et fonctionnelles
- [ ] Auth (login, register, logout, session persistence)
- [ ] Thème dark/light toggle
- [ ] Toutes les 12 tabs athlète fonctionnelles
- [ ] CRUD complet : athlètes, programmes, nutrition, bilans
- [ ] Stripe : paiements, webhooks, Connect
- [ ] Instagram : OAuth, messages, publish
- [ ] Cron jobs configurés
- [ ] Admin accessible uniquement pour admin
- [ ] Responsive (mobile, tablette, desktop)
- [ ] Variables d'environnement configurées sur Vercel
- [ ] Performance : pas de régression de chargement
- [ ] Aucune erreur console
