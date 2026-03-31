# Momentum Coach App — Visual Redesign "Carbon"

## Overview

Complete visual redesign of the Momentum Coach App (web) with direction "Carbon": futuristic, airy, refined. Glassmorphism, background grid pattern, luminous red orbs, semi-transparent cards. High-tech cockpit feel for sports coaching.

**Scope:** Visual only (CSS, HTML structure adjustments). All JS business logic stays untouched. No Supabase/backend changes.

**Pages:** Landing (index.html), Auth, Dashboard, Athlete profile, Programs, Nutrition, Bilans, Videos, Business/IG, Profile, Admin (admin.html).

---

## 1. Design System

### 1.1 Color Palette

```
Backgrounds:
  --bg:             #09090b          (base)
  --bg2:            rgba(255,255,255,0.03)  (cards, glass)
  --bg3:            rgba(255,255,255,0.05)  (hover states, active nav)
  --bg4:            rgba(255,255,255,0.08)  (elevated elements)

Borders:
  --border:         rgba(255,255,255,0.06)
  --border-subtle:  rgba(255,255,255,0.04)
  --border-hover:   rgba(255,255,255,0.10)
  --border-strong:  rgba(255,255,255,0.15)

Accent (red):
  --primary:        #B30808
  --primary-dark:   #8a0606
  --primary-glow:   rgba(179,8,8,0.06)
  --primary-border: rgba(179,8,8,0.12)
  --primary-bg:     rgba(179,8,8,0.06)

Text:
  --text:           #f5f5f7
  --text2:          rgba(255,255,255,0.5)
  --text3:          rgba(255,255,255,0.35)
  --text4:          rgba(255,255,255,0.25)

Semantic:
  --success:        #22c55e
  --warning:        #f59e0b
  --danger:         #ef4444
  --info:           #3b82f6
```

### 1.2 Typography

- Font: Inter (unchanged)
- Headings: weight 700-800, letter-spacing -0.5px to -1px
- Labels: uppercase, letter-spacing 0.3-0.5px, font-size 8-9px, --text3 color
- Big numbers: weight 800, font-size 22px+, high contrast --text
- Body: 14px, weight 400, line-height 1.55

### 1.3 Atmospheric Effects (Carbon signature)

- **Background grid:** CSS background-image with 1px lines at 1.5% opacity, 32px grid spacing. Applied to main content area.
- **Red orbs:** radial-gradient circles (rgba(179,8,8,0.06)), positioned at corners or behind key sections. Decorative, pointer-events:none.
- **Glassmorphism:** `backdrop-filter: blur(8-12px)` on cards, sidebar, modals. Semi-transparent backgrounds instead of solid colors.
- **Light theme:** Keep data-theme="light" support. Glass effects become `rgba(0,0,0,0.02-0.03)`, grid becomes `rgba(0,0,0,0.03)`, orbs become `rgba(179,8,8,0.04)`.

### 1.4 Spacing & Radius

- Border-radius: 12px (cards), 10px (buttons, inputs), 8px (small elements), 16px (modals)
- Padding: 14px (compact cards), 24-32px (main content area)
- Gaps: 8px (tight grid), 14px (standard grid), 20px (section spacing)

### 1.5 Shadows

- Cards: none by default, `0 4px 16px rgba(0,0,0,0.2)` on hover
- Elevated (modals): `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`
- Red glow (buttons, highlights): `0 0 20px rgba(179,8,8,0.3)`

### 1.6 Transitions

- Fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1) — hover, focus
- Base: 0.2s same easing — section changes, opacity
- Smooth: 0.3s ease-out — parallax, page transitions

---

## 2. Layout & Navigation

### 2.1 Sidebar (Classic Premium, ~220px)

- Background: `rgba(12,12,15,0.8)` + `backdrop-filter: blur(12px)`
- Border-right: `rgba(255,255,255,0.06)`
- Top: Logo icon (28px square, red, "M") + "Momentum" text + plan label ("PRO") underneath
- Nav groups with uppercase separator labels:
  - Main: Accueil, Athletes
  - Suivi: Bilans, Videos
  - Outils: Templates, Aliments, Exercices, Formations
  - Business: Business
- Active item: fond `rgba(255,255,255,0.05)`, icon colored red
- Notification badges: red dot on Bilans/Videos when items pending. Count badge on Athletes.
- Footer: avatar circle + name + theme toggle + logout button

### 2.2 Main Content Area

- Background: `#09090b` with grid pattern overlay (pseudo-element)
- Red orb top-right corner (decorative)
- Padding: 24px 32px
- Page header: date in --text4 above, greeting title "Bonjour, [Prenom]" in bold

### 2.3 Landing Page (Evolution of existing)

Same structure: hero -> features (bento) -> how it works -> pricing -> social proof -> CTA -> footer.

Changes per section:
- **Hero:** Keep particles canvas. Add grid background. Glass effect on hero-badge and hero-stats. Red orb behind content.
- **Bento features:** Glass cards instead of solid backgrounds. Borders glow on hover. Visual demos inside cards stay but get glass treatment.
- **How it works (steps):** Glass step cards, red numbered circles.
- **Pricing:** Glass cards. Featured plan gets red border glow (`box-shadow: 0 0 30px rgba(179,8,8,0.15)`). Business highlights section gets glass treatment.
- **Social proof:** Glass container, subtle grid background.
- **CTA:** Red orb behind, glass buttons.
- **Footer:** Minimal, same structure, subtler styling.

### 2.4 Auth Screen

- Centered glass card (max-width ~400px)
- Red orb behind the card (decorative)
- Grid background visible
- Login/Register tabs: glass tab buttons, active has fond `rgba(255,255,255,0.05)`
- Plan selection (register): glass cards instead of inline radio buttons, red border on selected

### 2.5 Responsive

- Desktop (>1024px): sidebar visible, full layout
- Tablet (768-1024px): sidebar collapsible, overlay with backdrop blur
- Mobile (<768px): sidebar as drawer, hamburger menu in top bar

---

## 3. Components

### 3.1 Stat Cards

- Glass: `rgba(255,255,255,0.03)`, border `rgba(255,255,255,0.06)`, radius 12px
- Label uppercase top, big value (22px w800), variation text beside value
- Highlighted card (e.g. bilans pending): tinted `rgba(179,8,8,0.06)`, border `rgba(179,8,8,0.12)`
- Hover: translateY(-2px), border brightens, subtle shadow

### 3.2 Lists (bilans, athletes, activity)

- Glass container with uppercase label header
- Rows with `rgba(255,255,255,0.03)` separators
- Avatar circle (colored initial) + name + secondary info + timestamp/badge right-aligned
- Row hover: fond `rgba(255,255,255,0.03)`

### 3.3 Todo / Action Items

- Custom checkboxes: rounded square (4px radius), red semi-transparent border, red check on checked
- "Urgent" badge: fond `rgba(179,8,8,0.1)`, text `#B30808`
- "Nouveau" badge: fond `rgba(59,130,246,0.1)`, text `#3b82f6`

### 3.4 Forms

- Inputs: fond `rgba(255,255,255,0.03)`, border `rgba(255,255,255,0.08)`, radius 10px
- Focus: border `rgba(179,8,8,0.4)`, glow `box-shadow: 0 0 0 3px rgba(179,8,8,0.1)`
- Labels above, 13px, color --text2

### 3.5 Modals / Overlays

- Backdrop: `rgba(0,0,0,0.7)` + `backdrop-filter: blur(4px)`
- Modal: glass effect, subtle border, radius 16px
- Header: title + close button

### 3.6 Tables (aliments, exercices, athletes)

- Header: uppercase, low opacity, no distinct background
- Rows: near-invisible separators, hover glass fond
- No vertical borders

### 3.7 Charts (Chart.js)

- Colors: `#B30808` primary data, `rgba(179,8,8,0.15)` bar backgrounds
- Grid lines: `rgba(255,255,255,0.04)`
- Tooltip: glass black fond, subtle border
- Bar style: rounded top (borderRadius)

---

## 4. Animations

### 4.1 Page Load

- Staggered fade-in + translateY(10px) on elements (50ms delay between items)
- CSS `@keyframes fadeInUp` with animation-fill-mode: both

### 4.2 Dashboard

- Animated counters on stat cards (0 -> final value, ~800ms, ease-out)
- Skeleton loaders (glass shimmer effect) during data fetch
- Section transitions: fade 150ms when switching sidebar sections

### 4.3 Landing Page

- Parallax scroll: sections shift slightly on scroll (CSS transform, throttled)
- Particles canvas on hero (existing, kept as-is)
- Fade-in on scroll (IntersectionObserver, already present)
- Bento cards: staggered entrance on scroll

### 4.4 Micro-interactions

- Buttons: scale(0.98) on active, glow on hover for primary
- Cards: smooth translateY + border illumination on hover
- Nav items: smooth background/color transition
- Inputs: smooth border-color + glow transition on focus

---

## 5. Files to Modify

### CSS files:
- `css/styles.css` — Main design system, all CSS variables, landing page styles, auth, app layout, sidebar, cards, forms, buttons, tables, modals, responsive, animations
- `css/admin.css` — Admin-specific layout and components (same Carbon treatment)

### HTML files:
- `index.html` — Landing page structure (add grid overlay elements, adjust some class structures), auth screen (plan selection cards), dashboard sidebar (badges, groups), main content (grid/orb decorative elements)
- `admin.html` — Same Carbon treatment for admin dashboard

### JS files (minimal, animation-only):
- Animated counters for stat cards (small addition to dashboard.js or inline)
- Skeleton loader show/hide (CSS-driven, minimal JS)
- No business logic changes

---

## 6. What Does NOT Change

- All JS business logic (Supabase queries, form handlers, section switching, data processing)
- Supabase backend / RLS policies
- File structure (no new HTML pages)
- URL routing / Vercel config
- Font Awesome icons
- Chart.js library
- Inter font family
- Dark mode as default behavior
- Light theme support (adapted to Carbon style)
