# TODO — Coach App Audit Fixes

## Phase 1 — Securite
- [x] Fix cancellationRespond ownership (stripe.js:683)
- [x] Gitignore .env.check
- [x] Supprimer push-secret du HTML public → remplace par JWT auth
- [x] Forcer chiffrement Stripe + warnings plaintext
- [x] CORS conditionnel (localhost seulement hors prod)

## Phase 2 — Robustesse
- [x] Logger les catch vides critiques (business-ig, profile, nutrition)
- [x] Nettoyer console.log sensibles dans ig-webhook (RGPD)
- [x] Clarifier inconsistance Facebook App IDs → migre vers env var

## Phase 3 — Preparation SaaS (futur)
- [ ] Admin via table admin_roles au lieu d'email hardcode
- [ ] Factoriser les escHtml() dupliques
- [ ] Split des gros fichiers (nutrition.js, training.js, business-ig.js)
- [ ] Ajouter ESLint
