# Audit Fixes — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les vrais problèmes de sécurité et robustesse identifiés dans l'audit du 28 mars 2026, sans casser aucune fonctionnalité existante.

**Architecture:** Coach App = frontend vanilla JS + API serverless Vercel + Supabase. Les fixes touchent les API serverless (Node.js), le frontend JS, et la config. Aucun changement de structure, uniquement des corrections chirurgicales.

**Tech Stack:** Node.js (Vercel serverless), Supabase, Stripe, vanilla JS frontend.

---

## Phase 1 — Sécurité

### Task 1: Fix cancellationRespond ownership ✅ DONE

**Déjà corrigé** — Ajout de `if (request.coach_id !== req.body.coachId) return 403` dans `api/stripe.js:683`.

---

### Task 2: Gitignore .env.check ✅ DONE

**Déjà corrigé** — Ajout de `.env.check` dans `.gitignore`.

---

### Task 3: Supprimer le push-secret du HTML

Le push-secret est en clair dans une meta tag HTML visible par tous. Le déplacer vers un header injecté côté serveur.

**Files:**
- Modify: `index.html:6` — supprimer la meta tag push-secret
- Modify: `js/config.js:17` — charger le secret depuis une API au lieu du DOM

- [ ] **Step 1: Vérifier comment PUSH_SECRET est utilisé côté frontend**

Chercher tous les usages de `PUSH_SECRET` dans le JS frontend pour comprendre le flux.

```bash
grep -rn "PUSH_SECRET\|push-secret\|X-Push-Secret" "COACH APP/js/" "COACH APP/index.html"
```

- [ ] **Step 2: Supprimer la meta tag du HTML**

Dans `index.html`, supprimer la ligne :
```html
<meta name="push-secret" content="prc-push-2026-secret">
```

- [ ] **Step 3: Injecter le secret via authFetch au lieu du DOM**

Dans `js/config.js`, modifier la constante :
```javascript
// Avant :
const PUSH_SECRET = document.querySelector('meta[name="push-secret"]')?.content || '';

// Après :
const PUSH_SECRET = ''; // Loaded server-side — frontend calls go through authFetch
```

Puis chercher où `PUSH_SECRET` est utilisé dans les headers. Si c'est dans un `authFetch` call, le secret peut être injecté côté API (le serveur a accès à `process.env.PUSH_SECRET`). Si c'est un fetch direct, il faudra créer un petit proxy.

**IMPORTANT:** Vérifier que les push notifications fonctionnent toujours après ce changement. Le flux actuel est : frontend → `/api/push` avec header `X-Push-Secret`. Si le frontend envoie directement à Expo, le secret n'est pas nécessaire côté client. Si le frontend passe par `/api/push`, il faut que le header soit envoyé — soit via un proxy API qui l'ajoute, soit en gardant le secret côté client (mais pas dans le HTML public).

- [ ] **Step 4: Tester l'envoi de push notification**

Vérifier dans l'app que l'envoi de notification push fonctionne toujours (ex: notification à un athlète).

- [ ] **Step 5: Commit**

```bash
git add index.html js/config.js
git commit -m "sec: remove push-secret from public HTML meta tag"
```

---

### Task 4: Forcer le chiffrement Stripe (plus de fallback plaintext)

Le décryptage dans `_crypto.js:40` retourne le texte brut si le format n'est pas chiffré. Et `stripe.js:43` contourne le chiffrement si `STRIPE_ENCRYPTION_KEY` n'est pas set. Pour un SaaS multi-coach, on ne veut pas de clés Stripe en clair en BDD.

**Files:**
- Modify: `api/_crypto.js:39-43` — ajouter un warning log au lieu de retourner silencieusement le plaintext
- Modify: `api/stripe.js:43, 235, 303, 393, 491` — tous les endroits qui font le check ternaire

- [ ] **Step 1: Ajouter un warning dans decrypt() pour le fallback plaintext**

Dans `api/_crypto.js`, modifier la fonction `decrypt` :
```javascript
function decrypt(data) {
  if (!data || !data.includes(':')) {
    // Plaintext fallback — log warning for monitoring
    console.warn('[crypto] decrypt called on non-encrypted data — migration needed');
    return data;
  }
  // ... reste inchangé
}
```

On garde le fallback (pour ne pas casser les clés existantes non migrées) mais on ajoute un warning visible dans les logs Vercel.

- [ ] **Step 2: Ajouter un warning dans getCoachStripe quand STRIPE_ENCRYPTION_KEY manque**

Dans `api/stripe.js`, modifier `getCoachStripe` (ligne 36-45) :
```javascript
async function getCoachStripe(supabase, coachId) {
  const { data } = await supabase
    .from('coach_profiles')
    .select('stripe_secret_key')
    .eq('user_id', coachId)
    .single();
  if (!data?.stripe_secret_key) return null;
  if (!process.env.STRIPE_ENCRYPTION_KEY) {
    console.warn('[stripe] STRIPE_ENCRYPTION_KEY missing — keys may be stored in plaintext');
  }
  const key = decrypt(data.stripe_secret_key);
  return Stripe(key);
}
```

Note : on appelle toujours `decrypt()` car elle gère déjà le fallback plaintext. On simplifie le ternaire.

- [ ] **Step 3: Simplifier tous les ternaires encryption dans stripe.js**

Remplacer le pattern répété `process.env.STRIPE_ENCRYPTION_KEY ? decrypt(x) : x` par juste `decrypt(x)` partout. La fonction `decrypt` gère déjà le cas plaintext.

Lignes concernées dans `api/stripe.js` :
- Ligne 43 : `getCoachStripe` (déjà fait step 2)
- Ligne 235 : `saveStripeKey` — chiffrement à l'écriture
- Ligne 303 : `importSubscriptions`
- Ligne 393 : `createCheckout`
- Ligne 491 : `createPaymentSheet`

Pour la ligne 235 (écriture), garder le ternaire car `encrypt()` ne doit être appelé QUE si la clé existe :
```javascript
// Ligne 235 — GARDER le ternaire ici (écriture)
stripe_secret_key: process.env.STRIPE_ENCRYPTION_KEY ? encrypt(stripeKey) : stripeKey,
```

Pour les lignes de lecture (303, 393, 491), simplifier :
```javascript
// Avant :
const k = process.env.STRIPE_ENCRYPTION_KEY ? decrypt(profile.stripe_secret_key) : profile.stripe_secret_key;
// Après :
const k = decrypt(profile.stripe_secret_key);
```

- [ ] **Step 4: Vérifier que les endpoints Stripe fonctionnent**

Tester en local (ou via Vercel preview) :
- `verify-key` — doit retourner le status du compte
- `import-subscriptions` — doit lister les abos
- `create-checkout` — doit créer un checkout

- [ ] **Step 5: Commit**

```bash
git add api/_crypto.js api/stripe.js
git commit -m "sec: add warnings for unencrypted Stripe keys, simplify decrypt calls"
```

---

### Task 5: CORS conditionnel — retirer localhost en prod

**Files:**
- Modify: `api/_cors.js:6-11`

- [ ] **Step 1: Rendre les origines localhost conditionnelles**

```javascript
const ALLOWED_ORIGINS = [
  'https://pierreapp.vercel.app',
];

// Dev origins — only in non-production
if (process.env.VERCEL_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500');
}
```

Note : sur Vercel, `VERCEL_ENV` est automatiquement défini à `'production'`, `'preview'`, ou `'development'`. Pas besoin d'ajouter d'env var.

- [ ] **Step 2: Vérifier que l'app fonctionne en prod**

L'app en prod sur `pierreapp.vercel.app` doit toujours fonctionner (origin dans la whitelist). Tester en local que les requêtes passent aussi (`VERCEL_ENV` n'est pas défini en local → localhost autorisé).

- [ ] **Step 3: Commit**

```bash
git add api/_cors.js
git commit -m "sec: restrict CORS localhost origins to non-production environments"
```

---

## Phase 2 — Robustesse

### Task 6: Logger les catch vides critiques

15 `catch {}` ou `catch { }` dans le JS frontend. La plupart sont légitimes (JSON.parse fallback), mais certains avalent des erreurs réseau ou DB qu'on devrait voir.

**Files:**
- Modify: `js/profile.js:340`
- Modify: `js/nutrition.js:986, 995`
- Modify: `js/business-ig.js:142, 187, 224, 302, 346`

**Catégories de catch :**
- **JSON.parse fallback** (training.js:1483, athletes.js:675, bilans.js:4, videos.js:773, nutrition.js:986, 995) → **garder vides** — c'est un pattern valide, le fallback est le comportement voulu
- **Réseau / API** (nutrition.js:213, business-ig.js:142, 187, 224, 302) → **ajouter devError**
- **Supabase** (profile.js:340, business-ig.js:346) → **ajouter devError**
- **Validation** (utils.js:133, nutrition.js:1898) → **garder** — fallback intentionnel

- [ ] **Step 1: Ajouter devError aux catch réseau/API dans business-ig.js**

```javascript
// Ligne 142 — après fetch insights d'un reel
} catch (e) { devError('[biz-ig] reel insights fetch failed', e); }

// Ligne 187 — après fetch insights d'une story
} catch (e) { devError('[biz-ig] story insights fetch failed', e); }

// Ligne 224 — après sync stories global
} catch (e) { devError('[biz-ig] stories sync failed', e); }

// Ligne 302 — après fetch insights détaillé
} catch (e) { devError('[biz-ig] detailed insights failed', e); }
```

- [ ] **Step 2: Ajouter devError au catch Supabase dans business-ig.js et profile.js**

```javascript
// business-ig.js ligne 346 — après load ig_account
} catch (e) { window._bizIgAccount = null; devError('[biz-ig] ig_account load failed', e); }

// profile.js ligne 340 — après connect-complete
} catch (e) { devError('[profile] connect-complete check failed', e); }
```

- [ ] **Step 3: Ajouter un commentaire explicite au catch réseau dans nutrition.js**

```javascript
// nutrition.js ligne 213 — déjà commenté mais catch vide
} catch (e) { devError('[nutrition] OFF search failed', e); }
```

- [ ] **Step 4: Commit**

```bash
git add js/business-ig.js js/profile.js js/nutrition.js
git commit -m "fix: add error logging to silent catch blocks"
```

---

### Task 7: Nettoyer les console.log sensibles dans ig-webhook

Le webhook IG logge le texte des messages utilisateurs et des IDs. Ça pose un souci RGPD.

**Files:**
- Modify: `api/ig-webhook.js`

- [ ] **Step 1: Réduire les logs aux infos non-sensibles**

Remplacer dans `api/ig-webhook.js` :

```javascript
// Ligne 19 — réduire à l'essentiel
console.log('[ig-webhook] Event received, entries:', (body.entry || []).length);

// Ligne 42 — supprimer le texte du message
console.log('[ig-webhook] Message from:', senderId, 'to:', recipientId, 'echo:', isEcho);

// Ligne 101 — supprimer le nom
// (supprimer cette ligne entièrement)

// Ligne 162 — réduire
console.log('[ig-webhook] Message saved');
```

Les lignes d'erreur (console.error) avec `.message` sont OK — elles ne contiennent pas de données utilisateur.

- [ ] **Step 2: Vérifier que le webhook traite toujours les messages**

Le comportement fonctionnel ne change pas — on modifie uniquement les logs. Tester en envoyant un DM IG et vérifier dans les logs Vercel que l'event est bien traité.

- [ ] **Step 3: Commit**

```bash
git add api/ig-webhook.js
git commit -m "fix: reduce IG webhook logs to non-sensitive data (GDPR)"
```

---

### Task 8: Facebook App ID — clarifier l'inconsistance

Deux App IDs différents dans le code : `index.html:7` a `1250460660609661`, `fb-page-auth.js:14` a `1305972064754138`.

**Files:**
- Modify: `api/fb-page-auth.js:14`

- [ ] **Step 1: Vérifier quel App ID est le bon**

Demander au user ou vérifier dans la console Meta Developer quelle app est utilisée pour :
- Instagram Login API → devrait utiliser `META_APP_ID` de l'env var
- Facebook Page Auth (DMs) → hardcodé dans `fb-page-auth.js`

Si c'est bien 2 apps distinctes → ajouter un commentaire explicatif. Si c'est une erreur → corriger.

- [ ] **Step 2: Migrer le hardcoded vers env var**

```javascript
// Avant (fb-page-auth.js:14) :
const appId = '1305972064754138';
// Après :
const appId = process.env.META_APP_ID_FB || process.env.META_APP_ID;
```

Ajouter `META_APP_ID_FB` dans les env vars Vercel si c'est une app différente.

- [ ] **Step 3: Même chose pour le meta tag dans index.html**

```html
<!-- Avant : -->
<meta name="meta-app-id" content="1250460660609661">
```

Vérifier si cette meta tag est réellement utilisée dans le JS. Si oui, s'assurer qu'elle correspond à la bonne app. Si non, la supprimer.

- [ ] **Step 4: Commit**

```bash
git add api/fb-page-auth.js index.html
git commit -m "fix: move Facebook App IDs to env vars, clarify dual-app setup"
```

---

## Phase 3 — Préparation SaaS (à planifier séparément)

Ces tâches sont documentées ici pour référence mais ne font PAS partie de l'exécution immédiate :

- **Admin via table `admin_roles`** au lieu d'email hardcodé dans `auth.js:56` et SQL
- **Factoriser les 3 `escHtml()` dupliqués** (admin-inline.js, admin.js, nutrition.js) vers `utils.js`
- **Split des gros fichiers** (nutrition.js 2524 lignes, training.js 1811 lignes, business-ig.js 1701 lignes)
- **Ajouter ESLint** avec config minimale

---

## Résumé des tâches

| # | Tâche | Phase | Status |
|---|-------|-------|--------|
| 1 | Fix cancellationRespond ownership | Sécu | ✅ DONE |
| 2 | Gitignore .env.check | Sécu | ✅ DONE |
| 3 | Supprimer push-secret du HTML | Sécu | TODO |
| 4 | Forcer chiffrement Stripe + warnings | Sécu | TODO |
| 5 | CORS conditionnel | Sécu | TODO |
| 6 | Logger les catch vides critiques | Robustesse | TODO |
| 7 | Nettoyer console.log IG webhook | Robustesse | TODO |
| 8 | Clarifier Facebook App IDs | Robustesse | TODO |
