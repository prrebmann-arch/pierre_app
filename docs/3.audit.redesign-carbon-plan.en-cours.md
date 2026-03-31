# Carbon Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Momentum Coach App's visual identity to the "Carbon" design direction — glassmorphism, background grid, red orbs, semi-transparent cards — while keeping all JS business logic untouched.

**Architecture:** CSS-first redesign. We update CSS custom properties, then restyle components section by section. Minimal HTML changes (adding decorative elements, adjusting some class structures). A tiny JS addition for animated counters on the dashboard.

**Tech Stack:** HTML/CSS/JS vanilla, Inter font, Font Awesome, Chart.js, Supabase (untouched)

---

## File Map

| File | Role | Action |
|------|------|--------|
| `css/styles.css` | Main design system (6101 lines) — variables, reset, auth, forms, buttons, sidebar, cards, components, landing page, responsive, animations | Modify in-place, section by section |
| `css/admin.css` | Admin dashboard styles (283 lines) | Modify — apply same Carbon glass treatment |
| `index.html` | Landing + Auth + Coach Dashboard (1291 lines) | Modify — add decorative grid/orb elements, adjust auth plan selection |
| `admin.html` | Admin dashboard (172 lines) | Modify — add decorative grid/orb elements |
| `js/dashboard.js` | Dashboard rendering logic | Modify — add animated counter function (~20 lines) |

---

### Task 1: CSS Variables & Design Tokens (Carbon Foundation)

**Files:**
- Modify: `css/styles.css:1-42` (`:root` variables)
- Modify: `css/styles.css:44-76` (`[data-theme="light"]`)

This task rewrites the CSS custom properties to match the Carbon spec. Every component in the app references these variables, so updating them propagates the new look globally.

- [ ] **Step 1: Replace `:root` variables block**

Replace lines 1-42 of `css/styles.css` with:

```css
/* ===== VARIABLES ===== */
:root {
  --primary: #B30808;
  --primary-dark: #8a0606;
  --primary-light: #d40a0a;
  --primary-glow: rgba(179, 8, 8, 0.06);
  --primary-border: rgba(179, 8, 8, 0.12);
  --primary-bg: rgba(179, 8, 8, 0.06);
  --bg: #09090b;
  --bg2: rgba(255,255,255,0.03);
  --bg3: rgba(255,255,255,0.05);
  --bg4: rgba(255,255,255,0.08);
  --text: #f5f5f7;
  --text2: rgba(255,255,255,0.5);
  --text3: rgba(255,255,255,0.35);
  --text4: rgba(255,255,255,0.25);
  --border: rgba(255,255,255,0.06);
  --border-subtle: rgba(255,255,255,0.04);
  --hover-bg: rgba(255,255,255,0.04);
  --hover-bg-strong: rgba(255,255,255,0.06);
  --hover-border: rgba(255,255,255,0.10);
  --hover-border-strong: rgba(255,255,255,0.15);
  --tint: rgba(255,255,255,0.02);
  --tint-strong: rgba(255,255,255,0.06);
  --tint-medium: rgba(255,255,255,0.08);
  --overlay: rgba(0,0,0,0.7);
  --scrollbar-thumb: rgba(255,255,255,0.08);
  --scrollbar-thumb-hover: rgba(255,255,255,0.14);
  --muted-icon: rgba(255,255,255,0.4);
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #3b82f6;
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15);
  --shadow-card: none;
  --shadow-card-hover: 0 4px 16px rgba(0,0,0,0.2);
  --shadow-elevated: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  --card-border: 1px solid var(--border);
  --sidebar-width: 220px;
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-smooth: 0.3s ease-out;
  --glass-bg: rgba(255,255,255,0.03);
  --glass-bg-hover: rgba(255,255,255,0.05);
  --glass-blur: blur(12px);
  --glass-border: rgba(255,255,255,0.06);
  --grid-pattern: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  --grid-size: 32px;
  --red-glow: 0 0 20px rgba(179,8,8,0.3);
}
```

- [ ] **Step 2: Replace `[data-theme="light"]` block**

Replace lines 44-76 with:

```css
/* ===== LIGHT THEME ===== */
[data-theme="light"] {
  --bg: #f4f4f6;
  --bg2: rgba(0,0,0,0.02);
  --bg3: rgba(0,0,0,0.04);
  --bg4: rgba(0,0,0,0.06);
  --text: #18181b;
  --text2: #52525b;
  --text3: #7e7e8a;
  --text4: #a1a1aa;
  --border: rgba(0,0,0,0.08);
  --border-subtle: rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05);
  --shadow-card: none;
  --shadow-card-hover: 0 4px 16px rgba(0,0,0,0.1);
  --shadow-elevated: 0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
  --card-border: 1px solid rgba(0,0,0,0.07);
  --primary-glow: rgba(179, 8, 8, 0.06);
  --primary-border: rgba(179, 8, 8, 0.1);
  --primary-bg: rgba(179, 8, 8, 0.04);
  --hover-bg: rgba(0,0,0,0.04);
  --hover-bg-strong: rgba(0,0,0,0.06);
  --hover-border: rgba(0,0,0,0.12);
  --hover-border-strong: rgba(0,0,0,0.18);
  --tint: rgba(0,0,0,0.02);
  --tint-strong: rgba(0,0,0,0.06);
  --tint-medium: rgba(0,0,0,0.08);
  --overlay: rgba(0,0,0,0.5);
  --scrollbar-thumb: rgba(0,0,0,0.12);
  --scrollbar-thumb-hover: rgba(0,0,0,0.2);
  --muted-icon: rgba(0,0,0,0.35);
  --glass-bg: rgba(0,0,0,0.02);
  --glass-bg-hover: rgba(0,0,0,0.04);
  --glass-blur: blur(12px);
  --glass-border: rgba(0,0,0,0.06);
  --grid-pattern: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
  --red-glow: 0 0 20px rgba(179,8,8,0.15);
}
[data-theme="light"] ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); }
[data-theme="light"] ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
[data-theme="light"] ::selection { background: rgba(179,8,8,0.15); }
[data-theme="light"] .sidebar { box-shadow: 1px 0 0 var(--border); }
```

- [ ] **Step 3: Verify the page loads without errors**

Run: Open `index.html` in browser, check dev console for CSS parse errors. Both dark and light themes should render without broken layout.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "style: update CSS variables to Carbon design tokens"
```

---

### Task 2: Sidebar — Glassmorphism Treatment

**Files:**
- Modify: `css/styles.css:330-421` (sidebar section)

Restyle the sidebar with the Carbon glass effect: semi-transparent background, backdrop blur, refined nav items with red icon highlight on active.

- [ ] **Step 1: Replace sidebar styles**

Replace the `/* ===== SIDEBAR ===== */` section (lines 330-421) with:

```css
/* ===== SIDEBAR ===== */
.sidebar {
  width: var(--sidebar-width);
  background: rgba(12,12,15,0.8);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 100;
}
.sidebar-header {
  padding: 20px 16px 12px;
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon {
  width: 28px; height: 28px;
  background: var(--primary);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 12px; color: #fff;
  flex-shrink: 0;
}
.brand-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.3px;
}
.brand-plan {
  font-size: 9px;
  font-weight: 600;
  color: var(--text4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 1px;
}
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border);
}
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.user-avatar {
  width: 30px; height: 30px;
  background: var(--primary-bg);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 11px; color: var(--primary);
  flex-shrink: 0;
}
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 13px; font-weight: 500; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-nav { flex: 1; padding: 4px 8px; overflow-y: auto; }
.nav-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text4);
  padding: 16px 10px 6px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text3);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
  margin-bottom: 1px;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}
.nav-item i {
  width: 16px;
  text-align: center;
  font-size: 13px;
  opacity: 0.6;
}
.nav-item:hover { background: var(--hover-bg); color: var(--text2); }
.nav-item:hover i { opacity: 0.8; }
.nav-item.active {
  background: var(--glass-bg-hover);
  color: var(--text);
}
.nav-item.active i { opacity: 1; color: var(--primary); }
/* Notification badges */
.nav-badge {
  margin-left: auto;
  min-width: 18px; height: 18px;
  background: var(--primary);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  padding: 0 5px;
}
.nav-dot {
  margin-left: auto;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 6px rgba(179,8,8,0.4);
}
```

- [ ] **Step 2: Update sidebar width variable**

The `--sidebar-width` was already changed to `220px` in Task 1. Verify `.main-content` margin-left still references `var(--sidebar-width)`.

- [ ] **Step 3: Verify sidebar renders with glass effect**

Open the app, log in, verify:
- Sidebar has semi-transparent background with blur
- Active nav item has glass bg with red icon
- Hover states work
- Footer section visible

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "style: apply Carbon glass treatment to sidebar"
```

---

### Task 3: Main Content Area — Grid & Orb Decorations

**Files:**
- Modify: `css/styles.css:423-444` (main content + section transitions)
- Modify: `index.html` (add decorative elements to `#app-screen`)

Add the Carbon atmospheric effects: background grid pattern and red orb decoration.

- [ ] **Step 1: Update main content CSS**

Replace `/* ===== MAIN CONTENT ===== */` section (lines 423-444) with:

```css
/* ===== MAIN CONTENT ===== */
.main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  padding: 24px 32px;
  min-height: 100vh;
  max-width: calc(100vw - var(--sidebar-width));
  position: relative;
}
/* Carbon grid pattern */
.main-content::before {
  content: '';
  position: fixed;
  top: 0; left: var(--sidebar-width); right: 0; bottom: 0;
  background-image: var(--grid-pattern);
  background-size: var(--grid-size) var(--grid-size);
  pointer-events: none;
  z-index: 0;
}
/* Red orb decoration */
.main-content::after {
  content: '';
  position: fixed;
  top: -100px; right: -80px;
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(179,8,8,0.06) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.main-content > * { position: relative; z-index: 1; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
.section { display: none; }
.section.active { display: block; animation: fadeInUp 0.2s ease both; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Verify grid pattern and orb are visible**

Open the dashboard. You should see:
- Faint grid lines across the main content area
- Red glow in the top-right corner
- Content renders above the grid (z-index layering works)

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "style: add Carbon grid pattern and red orb to main content"
```

---

### Task 4: Cards, Forms, Buttons — Glass Treatment

**Files:**
- Modify: `css/styles.css:127-324` (auth, forms, buttons)
- Modify: `css/styles.css:446-461` (cards)

Apply Carbon glass styling to all core UI components.

- [ ] **Step 1: Update auth screen styles**

Replace `/* ===== AUTH ===== */` section (lines 127-185) with:

```css
/* ===== AUTH ===== */
#auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 20px;
  position: relative;
}
/* Grid background for auth */
#auth-screen::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--grid-pattern);
  background-size: var(--grid-size) var(--grid-size);
  pointer-events: none;
}
/* Red orb behind auth card */
#auth-screen::after {
  content: '';
  position: absolute;
  top: 30%; left: 50%;
  transform: translate(-50%, -50%);
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(179,8,8,0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.auth-box {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 48px 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-elevated);
  position: relative;
  z-index: 1;
}
.auth-logo { text-align: center; margin-bottom: 36px; }
.auth-logo-text {
  font-size: 24px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.5px;
}
.auth-subtitle { color: var(--text3); font-size: 13px; margin-top: 6px; }
.auth-tabs {
  display: flex;
  background: var(--glass-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 3px;
  margin-bottom: 28px;
}
.auth-tab {
  flex: 1;
  padding: 9px;
  text-align: center;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text3);
  transition: all var(--transition-fast);
  border: none;
  background: none;
}
.auth-tab:hover:not(.active) { color: var(--text2); }
.auth-tab.active { background: var(--glass-bg-hover); color: var(--text); }
```

- [ ] **Step 2: Update form styles**

Replace `/* ===== FORMS ===== */` section (lines 187-261). The key change is glass backgrounds on inputs and red focus glow:

```css
/* ===== FORMS ===== */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; font-weight: 500; color: var(--text3); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  background: var(--glass-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 10px 13px;
  color: var(--text);
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  outline: none;
  transition: all var(--transition-fast);
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus { border-color: rgba(179,8,8,0.4); box-shadow: 0 0 0 3px rgba(179,8,8,0.1); }
.form-group input::placeholder,
.form-group textarea::placeholder { color: var(--text4); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.form-control,
input.form-control,
select.form-control,
textarea.form-control {
  background: var(--glass-bg);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-control:focus { border-color: rgba(179,8,8,0.4); box-shadow: 0 0 0 3px rgba(179,8,8,0.1); }
.freq-btn {
  padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--glass-bg); color: var(--text2); font-size: 13px;
  cursor: pointer; transition: all 0.15s;
}
.freq-btn:hover { border-color: var(--text3); }
.freq-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.day-circle {
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid var(--border); background: var(--glass-bg);
  color: var(--text2); font-size: 12px; font-weight: 700;
  cursor: pointer; transition: all 0.15s;
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.day-circle:hover { border-color: var(--text3); }
.day-circle.active { background: var(--primary); color: #fff; border-color: var(--primary); }
```

- [ ] **Step 3: Update button styles**

Replace `/* ===== BUTTONS ===== */` section (lines 263-324) with:

```css
/* ===== BUTTONS ===== */
.btn-primary {
  width: 100%;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 11px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: 'Inter', sans-serif;
}
.btn-primary:hover { background: var(--primary-dark); box-shadow: var(--red-glow); }
.btn-primary:active { transform: scale(0.98); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
  font-family: 'Inter', sans-serif;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.btn:active { transform: scale(0.97); }
.btn-red { background: var(--primary); color: white; }
.btn-red:hover { background: var(--primary-dark); box-shadow: var(--red-glow); }
.btn-outline { background: transparent; color: var(--text2); border: 1px solid var(--border); }
.btn-outline:hover { border-color: var(--hover-border-strong); color: var(--text); background: var(--glass-bg); }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-danger { color: var(--danger); }
.btn-icon {
  background: none; border: none; color: var(--text3); cursor: pointer;
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast); font-size: 13px;
}
.btn-icon:hover { background: var(--hover-bg-strong); color: var(--text); }
.btn-logout {
  width: 100%; padding: 10px;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.12);
  color: var(--danger); border-radius: 10px;
  cursor: pointer; font-size: 13px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all var(--transition-fast);
}
.btn-logout:hover { background: rgba(239, 68, 68, 0.06); border-color: rgba(239, 68, 68, 0.25); }
```

- [ ] **Step 4: Update card base styles**

Replace `/* ===== CARDS ===== */` section (lines 446-461) with:

```css
/* ===== CARDS ===== */
.card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  transition: all var(--transition-fast);
}
.card:hover {
  border-color: var(--hover-border);
  box-shadow: var(--shadow-card-hover);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card-title { font-size: 14px; font-weight: 600; }
```

- [ ] **Step 5: Verify auth screen, forms, buttons, and cards**

Open the app and check:
- Auth screen has grid background, red orb, glass card
- Form inputs have glass backgrounds and red focus glow
- Buttons have red glow on hover
- Cards throughout the app use glass styling

- [ ] **Step 6: Commit**

```bash
git add css/styles.css
git commit -m "style: apply Carbon glass to auth, forms, buttons, cards"
```

---

### Task 5: Dashboard Cards & Welcome Banner

**Files:**
- Modify: `css/styles.css:1486-1663` (welcome banner + dashboard)

Restyle the dashboard with the Carbon glass treatment: glass cards, refined stats, glass welcome banner.

- [ ] **Step 1: Update welcome banner**

Replace `/* ===== WELCOME BANNER ===== */` section (lines 1486-1527) with:

```css
/* ===== WELCOME BANNER (shared coach + admin) ===== */
.prc-welcome {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--primary-border);
  border-radius: 16px;
  padding: 24px 28px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}
.prc-welcome::before {
  content: '';
  position: absolute;
  top: -50px; right: -30px;
  width: 180px; height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(179,8,8,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.prc-welcome-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.5px;
}
.prc-welcome-sub {
  font-size: 13px;
  color: var(--text2);
  margin-top: 3px;
}
.prc-welcome-date {
  font-size: 12px;
  color: var(--text3);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
```

- [ ] **Step 2: Update dashboard card styles**

Replace `/* ===== DASHBOARD ===== */` section (lines 1528-1663) with:

```css
/* ===== DASHBOARD ===== */

.dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
.dash-title { font-size: 24px; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.5px; }
.dash-subtitle { font-size: 13px; color: var(--text3); margin-top: 4px; }

.dash-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 18px;
  align-items: start;
}
.dash-main {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.dash-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.dash-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  overflow: hidden;
  transition: all var(--transition-fast);
}
.dash-card:hover {
  border-color: var(--hover-border);
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}
.dash-card-activity {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}
.dash-card-activity .dash-card-body {
  flex: 1;
  overflow-y: auto;
}

.dash-card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid var(--border-subtle);
}
.dash-card-title {
  font-size: 9px; font-weight: 600; color: var(--text3);
  display: flex; align-items: center; gap: 8px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.dash-card-title i { color: var(--primary); font-size: 12px; opacity: 0.7; }

.dash-badge {
  font-size: 11px; font-weight: 700; padding: 3px 10px;
  border-radius: 12px; background: var(--primary-bg); color: var(--primary);
  min-width: 24px; text-align: center;
}
.dash-badge-warn { background: rgba(245,158,11,0.08); color: var(--warning); }

.dash-card-body { padding: 8px; max-height: 300px; overflow-y: auto; }
.dash-activity-scroll { max-height: 500px; }

.dash-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer;
  transition: all var(--transition-fast);
}
.dash-item:hover { background: var(--hover-bg); transform: translateX(2px); }

.dash-avatar {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--glass-bg-hover); color: var(--text2);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
  border: 1px solid var(--border);
}
.dash-avatar-warn {
  background: rgba(245,158,11,0.08);
  color: var(--warning); border-color: rgba(245,158,11,0.15);
}

.dash-avatar-sm {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--glass-bg-hover); color: var(--text3);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; flex-shrink: 0;
  border: 1px solid var(--border);
}

.dash-item-info { min-width: 0; flex: 1; }
.dash-item-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dash-item-sub { font-size: 11.5px; color: var(--text2); margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.dash-bell-btn {
  background: none; border: none; cursor: pointer; color: var(--text3);
  font-size: 14px; padding: 8px 10px; border-radius: 8px;
  transition: all var(--transition-fast);
}
.dash-bell-btn:hover { background: rgba(245,158,11,0.08); color: var(--warning); }
.dash-bell-btn:disabled { cursor: default; opacity: 0.5; }

.dash-mini-phase {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 700; color: #fff;
}

.dash-phase-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}

.dash-activity-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 12px; border-radius: var(--radius-sm); cursor: pointer;
  transition: all var(--transition-fast);
}
.dash-activity-item:hover { background: var(--hover-bg); }

.dash-activity-content { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.dash-activity-name { font-size: 12.5px; font-weight: 600; color: var(--text); }
.dash-activity-tag { font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; }
.dash-activity-tag i { font-size: 10px; }
.dash-activity-time { font-size: 11px; color: var(--text3); margin-left: auto; white-space: nowrap; }

.dash-empty { padding: 32px; text-align: center; font-size: 13px; color: var(--text3); }

@media (max-width: 1100px) {
  .dash-layout { grid-template-columns: 1fr; }
  .dash-card-activity { max-height: 400px !important; }
}
@media (max-width: 700px) {
  .dash-row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Verify dashboard visual**

Log in to the coach dashboard. Verify:
- Welcome banner has glass effect with red orb
- Dashboard cards are glass with hover translateY(-2px)
- Card headers use smaller, uppercase labels
- Activity items and badges render correctly

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "style: apply Carbon glass to dashboard cards and welcome banner"
```

---

### Task 6: Modals & Notifications — Glass Treatment

**Files:**
- Modify: `css/styles.css:1054-1122` (modals, notifications)

- [ ] **Step 1: Update modal styles**

Replace `/* ===== MODALS ===== */` section (lines 1054-1099) with:

```css
/* ===== MODALS ===== */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal-overlay.open { display: flex; animation: fadeIn 0.15s ease; }
.modal {
  background: rgba(15,15,18,0.9);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-elevated);
  border-radius: var(--radius-lg);
  padding: 28px;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  animation: modalSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modalSlideIn {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.modal-lg { max-width: 700px; }
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.modal-title { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.modal-close {
  background: none; border: none; color: var(--text3);
  font-size: 18px; cursor: pointer;
  width: 32px; height: 32px;
  border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}
.modal-close:hover { background: var(--hover-bg-strong); color: var(--text); }
```

- [ ] **Step 2: Update notification styles**

Replace lines 1104-1122 with:

```css
/* ===== NOTIFICATION ===== */
.notification {
  position: fixed; bottom: 24px; right: 24px;
  background: rgba(15,15,18,0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-left: 3px solid var(--primary);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 13px;
  z-index: 9998;
  display: flex; align-items: center; gap: 10px;
  box-shadow: var(--shadow-elevated);
  transform: translateY(120%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-width: 360px;
}
.notification.show { transform: translateY(0); }
.notification.success { border-left-color: var(--success); }
.notification.error { border-left-color: var(--danger); }
```

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "style: apply Carbon glass to modals and notifications"
```

---

### Task 7: Admin Dashboard — Carbon Treatment

**Files:**
- Modify: `css/admin.css` (entire file)
- Modify: `admin.html` (add grid/orb decorative elements)

Apply the same Carbon glass treatment to the admin dashboard.

- [ ] **Step 1: Rewrite admin.css**

Replace the entire `css/admin.css` with:

```css
/* ===== ADMIN DASHBOARD — CARBON STYLES ===== */

/* ── Layout ── */
.admin-layout { display: flex; min-height: 100vh; }

.admin-sidebar {
  width: 240px; background: rgba(12,12,15,0.8);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border-right: 1px solid var(--glass-border);
  display: flex; flex-direction: column; position: fixed;
  top: 0; left: 0; bottom: 0; z-index: 100;
}
.admin-sidebar-header { padding: 20px 16px 16px; }
.admin-sidebar-brand { display: flex; align-items: center; gap: 10px; }
.admin-brand-icon {
  width: 34px; height: 34px;
  background: var(--primary);
  border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 13px; color: #fff; flex-shrink: 0;
}
.admin-brand-text { font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
.admin-brand-sub {
  font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase;
  letter-spacing: 0.8px; margin-top: 2px; background: var(--primary);
  padding: 1px 6px; border-radius: 4px; display: inline-block;
}

.admin-sidebar-nav { flex: 1; padding: 8px; overflow-y: auto; }
.admin-nav-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-radius: var(--radius-sm); cursor: pointer; color: var(--text3);
  font-size: 13px; font-weight: 500; transition: all var(--transition-fast);
  margin-bottom: 2px; border: none; background: none; width: 100%; text-align: left;
}
.admin-nav-item i { width: 18px; text-align: center; font-size: 13px; opacity: 0.6; }
.admin-nav-item:hover { background: var(--hover-bg); color: var(--text2); }
.admin-nav-item:hover i { opacity: 0.8; }
.admin-nav-item.active { background: var(--glass-bg-hover); color: var(--text); }
.admin-nav-item.active i { opacity: 1; color: var(--primary); }

.admin-sidebar-footer { padding: 12px; border-top: 1px solid var(--border); }

/* ── Main ── */
.admin-main {
  margin-left: 240px; flex: 1; padding: 28px 36px;
  min-height: 100vh; max-width: calc(100vw - 240px);
  background: var(--bg); position: relative;
}
.admin-main::before {
  content: ''; position: fixed;
  top: 0; left: 240px; right: 0; bottom: 0;
  background-image: var(--grid-pattern);
  background-size: var(--grid-size) var(--grid-size);
  pointer-events: none; z-index: 0;
}
.admin-main::after {
  content: ''; position: fixed;
  top: -100px; right: -80px;
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(179,8,8,0.06) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none; z-index: 0;
}
.admin-main > * { position: relative; z-index: 1; }

/* ── Welcome Banner ── */
.admin-welcome {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--primary-border); border-radius: var(--radius-lg);
  padding: 28px 32px; margin-bottom: 28px; position: relative; overflow: hidden;
}
.admin-welcome::before {
  content: ''; position: absolute; top: -60px; right: -40px;
  width: 200px; height: 200px; border-radius: 50%;
  background: radial-gradient(circle, rgba(179,8,8,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.admin-welcome-title {
  font-size: 24px; font-weight: 800; letter-spacing: -0.5px;
  color: var(--text); margin-bottom: 4px;
}
.admin-welcome-sub { font-size: 13px; color: var(--text2); }
.admin-welcome-date {
  position: absolute; right: 32px; top: 50%; transform: translateY(-50%);
  font-size: 12px; color: var(--text3); font-weight: 500;
  display: flex; align-items: center; gap: 6px;
}

/* ── Page Header ── */
.admin-page-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;
}
.admin-page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
.admin-page-subtitle { font-size: 13px; color: var(--text3); margin-top: 2px; }

/* ── Stats Grid ── */
.admin-stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px; margin-bottom: 24px;
}
.admin-stat-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border); border-radius: var(--radius);
  padding: 18px 20px; transition: all var(--transition-fast); position: relative; overflow: hidden;
}
.admin-stat-card:hover { border-color: var(--hover-border); transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }

.admin-stat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.admin-stat-icon {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.admin-stat-icon.red { background: rgba(179,8,8,0.08); color: var(--primary); }
.admin-stat-icon.green { background: rgba(34,197,94,0.08); color: var(--success); }
.admin-stat-icon.blue { background: rgba(59,130,246,0.08); color: var(--info); }
.admin-stat-icon.orange { background: rgba(245,158,11,0.08); color: var(--warning); }
.admin-stat-icon.purple { background: rgba(139,92,246,0.08); color: #8b5cf6; }

.admin-stat-value {
  font-size: 26px; font-weight: 800; letter-spacing: -1px;
  color: var(--text); line-height: 1.1;
}
.admin-stat-label { font-size: 9px; color: var(--text3); margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.admin-stat-sub { font-size: 11px; color: var(--text3); margin-top: 6px; display: flex; align-items: center; gap: 4px; }
.admin-stat-sub .up { color: var(--success); }
.admin-stat-sub .down { color: var(--danger); }

/* ── Cards ── */
.admin-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border); border-radius: var(--radius);
  margin-bottom: 20px; overflow: hidden;
}
.admin-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--border-subtle);
}
.admin-card-title {
  font-size: 13px; font-weight: 600; color: var(--text);
  display: flex; align-items: center; gap: 8px;
}
.admin-card-title i { color: var(--primary); font-size: 13px; opacity: 0.8; }
.admin-card-badge {
  font-size: 10px; font-weight: 700; background: var(--primary-bg);
  color: var(--primary); padding: 2px 8px; border-radius: 10px;
}
.admin-card-body { padding: 16px 20px; }
.admin-card-body.no-pad { padding: 0; }

/* ── Grids ── */
.admin-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.admin-grid-3 { display: grid; grid-template-columns: 1.6fr 1fr; gap: 20px; }
.admin-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }

/* ── Tables ── */
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th {
  text-align: left; font-size: 9px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text3); padding: 10px 16px;
  border-bottom: 1px solid var(--border); background: transparent;
}
.admin-table td {
  padding: 11px 16px; font-size: 13px; color: var(--text);
  border-bottom: 1px solid var(--border-subtle); vertical-align: middle;
}
.admin-table tr { transition: background var(--transition-fast); }
.admin-table tr:hover td { background: var(--hover-bg); }
.admin-table tr:last-child td { border-bottom: none; }

/* ── Badges ── */
.admin-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
}
.admin-badge.active { background: rgba(34,197,94,0.08); color: var(--success); }
.admin-badge.canceled { background: rgba(239,68,68,0.08); color: var(--danger); }
.admin-badge.past_due { background: rgba(245,158,11,0.08); color: var(--warning); }
.admin-badge.inactive { background: var(--glass-bg-hover); color: var(--text3); }

/* ── Coach/data styling ── */
.admin-coach-email { font-weight: 500; color: var(--text); }
.admin-coach-date { font-size: 12px; color: var(--text3); }
.admin-coach-mrr { font-weight: 700; color: var(--success); }

/* ── Coach Cards ── */
.admin-coach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.admin-coach-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border); border-radius: var(--radius);
  padding: 20px; transition: all var(--transition-fast); cursor: default;
}
.admin-coach-card:hover { border-color: var(--hover-border); box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
.admin-coach-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.admin-coach-avatar {
  width: 40px; height: 40px; border-radius: 10px; background: var(--glass-bg-hover);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: var(--text2); flex-shrink: 0;
}
.admin-coach-card-name { font-size: 14px; font-weight: 600; color: var(--text); }
.admin-coach-card-sub { font-size: 11px; color: var(--text3); margin-top: 1px; }
.admin-coach-card-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.admin-coach-card-stat {
  background: var(--glass-bg); border-radius: var(--radius-sm); padding: 10px;
  text-align: center; border: 1px solid var(--border-subtle);
}
.admin-coach-card-stat-val { font-size: 16px; font-weight: 800; color: var(--text); letter-spacing: -0.5px; }
.admin-coach-card-stat-lbl { font-size: 9px; color: var(--text3); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

/* ── Charts ── */
.admin-chart-container { position: relative; height: 280px; padding: 8px 0; }
.admin-chart-small { height: 180px; }

/* ── Metric Cards ── */
.admin-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.admin-metric-item {
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  border-radius: var(--radius); padding: 20px 16px; text-align: center;
  transition: all var(--transition-fast); position: relative; overflow: hidden;
}
.admin-metric-item:hover { border-color: var(--hover-border); background: var(--glass-bg-hover); transform: translateY(-2px); }
.admin-metric-icon { font-size: 22px; color: var(--primary); margin-bottom: 10px; opacity: 0.8; }
.admin-metric-value { font-size: 28px; font-weight: 800; color: var(--text); letter-spacing: -1px; }
.admin-metric-label {
  font-size: 9px; color: var(--text3); margin-top: 4px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.admin-metric-bar {
  height: 3px; background: var(--glass-bg-hover); border-radius: 2px; margin-top: 12px; overflow: hidden;
}
.admin-metric-bar-fill {
  height: 100%; background: linear-gradient(90deg, var(--primary), #d41a1a);
  border-radius: 2px; transition: width 0.6s ease;
}

/* ── Activity Feed ── */
.admin-activity-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0; border-bottom: 1px solid var(--border-subtle);
  transition: background var(--transition-fast);
}
.admin-activity-item:last-child { border-bottom: none; }
.admin-activity-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.admin-activity-dot.payment { background: var(--success); box-shadow: 0 0 6px rgba(34,197,94,0.4); }
.admin-activity-dot.signup { background: var(--info); box-shadow: 0 0 6px rgba(59,130,246,0.4); }
.admin-activity-dot.cancel { background: var(--danger); box-shadow: 0 0 6px rgba(239,68,68,0.4); }
.admin-activity-text { flex: 1; font-size: 13px; color: var(--text); }
.admin-activity-text strong { font-weight: 600; }
.admin-activity-time { font-size: 11px; color: var(--text3); white-space: nowrap; }

/* ── Donut Legend ── */
.admin-donut-wrap { display: flex; align-items: center; gap: 24px; padding: 8px 0; }
.admin-donut-legend { display: flex; flex-direction: column; gap: 10px; }
.admin-donut-item { display: flex; align-items: center; gap: 8px; }
.admin-donut-color { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.admin-donut-label { font-size: 12px; color: var(--text2); }
.admin-donut-val { font-size: 13px; font-weight: 700; color: var(--text); margin-left: auto; }

/* ── Empty State ── */
.admin-empty {
  text-align: center; padding: 48px 20px; color: var(--text3); font-size: 13px;
}
.admin-empty i { font-size: 36px; margin-bottom: 12px; display: block; opacity: 0.3; }

/* ── Search ── */
.admin-search {
  background: var(--glass-bg); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  padding: 8px 12px 8px 34px; font-size: 13px; color: var(--text);
  font-family: 'Inter', sans-serif; outline: none;
  transition: all var(--transition-fast); width: 260px;
}
.admin-search:focus { border-color: rgba(179,8,8,0.4); box-shadow: 0 0 0 3px rgba(179,8,8,0.1); }
.admin-search-wrap { position: relative; }
.admin-search-wrap i {
  position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
  color: var(--text3); font-size: 13px;
}

/* ── Sections ── */
.admin-section { display: none; }
.admin-section.active { display: block; animation: adminFadeIn 0.2s ease; }

@keyframes adminFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .admin-grid-2, .admin-grid-3 { grid-template-columns: 1fr; }
  .admin-stats { grid-template-columns: repeat(2, 1fr); }
  .admin-coach-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .admin-sidebar { display: none; }
  .admin-main { margin-left: 0; padding: 20px 16px; max-width: 100vw; }
  .admin-main::before { left: 0; }
  .admin-stats { grid-template-columns: 1fr 1fr; }
  .admin-welcome-date { display: none; }
}
```

- [ ] **Step 2: Verify admin dashboard**

Open `admin.html`, log in. Verify:
- Glass sidebar with blur
- Grid pattern visible in main area
- Stat cards are glass with hover effects
- Tables have no background headers

- [ ] **Step 3: Commit**

```bash
git add css/admin.css
git commit -m "style: apply Carbon glass treatment to admin dashboard"
```

---

### Task 8: Landing Page — Carbon Evolution

**Files:**
- Modify: `css/styles.css:4412-6101` (landing page sections)

This is the largest task. We restyle every landing page section with Carbon glass treatment while keeping the existing structure.

- [ ] **Step 1: Update landing page base + navbar**

Replace lines 4412-4580 (landing base + navbar). Key changes: glass navbar already exists, we refine it. Landing buttons get glass treatment on secondary.

```css
/* ===== LANDING PAGE ===== */
#landing-screen { display: none; }
#landing-screen.active { display: block; }
#landing-screen .section { display: block !important; }
#landing-screen .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: var(--primary); color: white; text-decoration: none; border-radius: 10px; font-size: 0.9rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 12px rgba(179,8,8,0.3); width: auto; }
#landing-screen .btn-primary:hover { background: #d41a1a; box-shadow: var(--red-glow); transform: translateY(-1px); }
#landing-screen .btn-primary:active { transform: translateY(0); }
#landing-screen .btn-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: var(--glass-bg); color: var(--text); text-decoration: none; border-radius: 10px; font-size: 0.9rem; font-weight: 600; border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.2s ease; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
#landing-screen .btn-secondary:hover { background: var(--glass-bg-hover); border-color: var(--hover-border); transform: translateY(-1px); }
#landing-screen .btn-lg { padding: 14px 32px; font-size: 1rem; border-radius: 12px; }
#landing-screen .form-group { margin-bottom: 0; }
```

Keep the navbar CSS as-is (it already uses `backdrop-filter: blur(20px)` which fits Carbon). Only change line 4434 background:

In the existing navbar block, change `background: rgba(9, 9, 11, 0.8);` to `background: rgba(9, 9, 11, 0.7);` — slightly more transparent for the glass effect.

- [ ] **Step 2: Update hero section**

In the hero CSS section (~line 4581+), add grid overlay. The existing hero already has gradient, orbs, and particles — we add the grid pattern:

After the existing `.hero-grid` rule (if present) or after the `.hero-gradient` block, add:

```css
#landing-screen .hero-grid {
  position: absolute;
  inset: 0;
  background-image: var(--grid-pattern);
  background-size: var(--grid-size) var(--grid-size);
  pointer-events: none;
  z-index: 1;
}
```

Update hero-badge and hero-stats to use glass:

```css
#landing-screen .hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: 30px;
  font-size: 0.85rem; font-weight: 500; color: var(--text2);
  margin-bottom: 24px;
}
```

```css
#landing-screen .hero-stats {
  display: flex; gap: 32px; margin-top: 48px;
}
#landing-screen .hero-stat {
  text-align: center;
  background: var(--glass-bg);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px 24px;
}
```

- [ ] **Step 3: Update bento grid cards to glass**

Find the bento card rules (around line 5843+) and update backgrounds to glass:

Replace `.bento-card` background:
```css
.bento-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 28px;
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}
.bento-card:hover {
  border-color: var(--hover-border);
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}
```

- [ ] **Step 4: Update pricing cards to glass**

In the pricing section (~line 4925+), update `.pricing-card` and `.pricing-card.featured`:

```css
.pricing-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  /* ... keep rest of existing padding/layout ... */
}
.pricing-card.featured {
  border-color: var(--primary-border);
  box-shadow: 0 0 30px rgba(179,8,8,0.15);
}
```

- [ ] **Step 5: Update social proof and CTA sections to glass**

Social proof (~line 5246+):
```css
.social-proof {
  background: var(--glass-bg);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}
```

Step cards (~line 4863+):
```css
.step-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  /* ... keep padding/layout ... */
}
```

- [ ] **Step 6: Verify all landing page sections**

Open the landing page. Check each section:
- Navbar: slightly more transparent glass
- Hero: grid pattern visible, glass badges/stats, particles still work
- Features (bento): glass cards with hover effects
- How it works: glass step cards
- Pricing: glass cards, featured card has red glow border
- Social proof: glass container
- CTA and footer: clean and consistent

- [ ] **Step 7: Commit**

```bash
git add css/styles.css
git commit -m "style: apply Carbon glass treatment to entire landing page"
```

---

### Task 9: Staggered Animations & Micro-interactions

**Files:**
- Modify: `css/styles.css` (animations section, ~line 5418)

Add Carbon animation refinements: staggered fade-in, button micro-interactions, card hover illumination.

- [ ] **Step 1: Add staggered animation utilities**

Find the `/* ===== ANIMATIONS ===== */` section (~line 5418) and add/update:

```css
/* Staggered fade-in for page elements */
.stagger-1 { animation-delay: 0ms; }
.stagger-2 { animation-delay: 50ms; }
.stagger-3 { animation-delay: 100ms; }
.stagger-4 { animation-delay: 150ms; }
.stagger-5 { animation-delay: 200ms; }
.stagger-6 { animation-delay: 250ms; }

/* Skeleton loader shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--glass-bg) 25%, var(--glass-bg-hover) 50%, var(--glass-bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/styles.css
git commit -m "style: add Carbon staggered animations and skeleton loader"
```

---

### Task 10: Animated Counters (Dashboard)

**Files:**
- Modify: `js/dashboard.js` (add counter animation function)

Add a small JS function that animates dashboard stat numbers from 0 to their final value.

- [ ] **Step 1: Read current dashboard.js to find where stats are rendered**

Read `js/dashboard.js` to locate where stat values are inserted into the DOM (look for `innerHTML` or `textContent` assignments for stat numbers).

- [ ] **Step 2: Add animateCounter function**

At the top of `js/dashboard.js`, add:

```javascript
/* ── Carbon: animated counter ── */
function animateCounter(el, target, duration = 800) {
  if (!el || isNaN(target)) return;
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```

- [ ] **Step 3: Apply animateCounter to stat elements**

Find where dashboard stat values are set (e.g., where athlete count, bilan count, video count are rendered) and wrap them:

Instead of:
```javascript
el.textContent = value;
```

Use:
```javascript
animateCounter(el, value);
```

Only apply this to the top-level stat number elements on the dashboard, not to every number in the app.

- [ ] **Step 4: Verify counters animate**

Open the dashboard. Stat numbers should animate from 0 to their final value over ~800ms with an ease-out curve.

- [ ] **Step 5: Commit**

```bash
git add js/dashboard.js
git commit -m "feat: add animated counters for dashboard stats"
```

---

### Task 11: Responsive Polish

**Files:**
- Modify: `css/styles.css:1202-1210` (responsive breakpoints)

Ensure the Carbon design works at tablet and mobile sizes.

- [ ] **Step 1: Update responsive breakpoints**

Replace lines 1202-1210 with:

```css
/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: 4px 0 24px rgba(0,0,0,0.3);
  }
  .sidebar.open { transform: translateX(0); }
  .main-content { margin-left: 0; padding: 20px; max-width: 100vw; }
  .main-content::before { left: 0; }
}
@media (max-width: 768px) {
  .main-content { padding: 16px; }
  .form-row { grid-template-columns: 1fr; }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-5 { grid-template-columns: repeat(2, 1fr); }
  .athlete-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
```

- [ ] **Step 2: Verify tablet/mobile layout**

Resize the browser to 768px and 1024px. Verify:
- Sidebar collapses at 1024px
- Grid pattern still visible
- Cards stack properly
- No horizontal overflow

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "style: polish Carbon responsive breakpoints"
```

---

### Task 12: Final Visual QA & Cleanup

**Files:**
- All modified files

Final pass to catch any visual inconsistencies.

- [ ] **Step 1: Check all pages in dark mode**

Walk through every page in the sidebar:
- Dashboard
- Athletes list
- Athlete detail (programs, nutrition, bilans)
- Videos
- Templates
- Aliments
- Exercices
- Formations
- Business
- Profile

Verify glass styling is consistent, no solid `#111113` or `#19191c` backgrounds leak through.

- [ ] **Step 2: Check light mode**

Toggle light theme. Verify:
- Glass effects invert properly (light glass backgrounds)
- Grid pattern uses dark lines
- Text is readable
- No contrast issues

- [ ] **Step 3: Check landing page end-to-end**

Open landing page, scroll through all sections:
- Hero with particles + grid
- Features bento grid
- Pricing cards
- Social proof
- CTA
- Footer
- Auth screen (login + register views)

- [ ] **Step 4: Fix any issues found**

If any visual issues are spotted, fix them in the relevant CSS file.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "style: Carbon visual redesign — final QA polish"
```
