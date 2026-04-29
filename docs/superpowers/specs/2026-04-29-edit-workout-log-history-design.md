# Edit Workout Log History — Design Spec

**Date:** 2026-04-29
**Author:** Pierre Rebmann (with Claude)
**Status:** Approved, awaiting implementation plan
**Primary repo affected:** ATHLETE (`/Users/pierrerebmann/MOMENTUM/ATHLETE`)
**Secondary repo affected:** COACH (`/Users/pierrerebmann/MOMENTUM/COACH`) — coach-side edited badge only
**Shared infra affected:** Supabase (`workout_logs` schema + RLS policies)

## 1. Problem & Goal

L'athlète n'a actuellement aucun moyen de corriger un log de séance après avoir cliqué "Terminer séance". Cas d'usage légitimes :

- Erreur de saisie (reps/kg mal tapés)
- Série oubliée pendant la séance
- Exercice fait mais non loggué
- Clic accidentel sur "Terminer" alors que la séance n'a pas eu lieu

**But :** Permettre à l'athlète de corriger le log d'une séance dans une fenêtre de **7 jours** après la séance, alignée sur le cycle bilan hebdo (au-delà, le bilan a tranché → données figées).

## 2. Scope

### In scope
- Modifier les valeurs saisies sur exos existants : reps, kg, durée, RPE
- Ajouter / supprimer des **séries** dans un exo existant
- Ajouter / supprimer des **exercices entiers** dans un log
  - Ajout via bibliothèque d'exos existante, fallback texte libre si exo non trouvé
  - L'exo ajouté reste **dans le log uniquement**, pas propagé au programme
- Supprimer un **log de séance complet** (hard delete + cascade videos)
- Confirm explicite avant suppression d'un exo/série qui a une vidéo associée (`execution_videos`)
- Badge "Édité" visible côté coach sur l'historique

### Out of scope (features distinctes à prévoir séparément)
- Substitution d'exo (swap) — couplée au flow in-session, traitement séparé
- "Reprendre une séance" (state machine `finished_at` → null) — feature à part
- Édition après J+7 — verrouillé par construction
- Audit trail détaillé / diff côté coach — badge simple suffit

## 3. Decisions log

| Q | Decision | Reason |
|---|----------|--------|
| Qui édite ? | Athlète seulement, sur ses propres logs | Cas d'usage explicite |
| Fenêtre temporelle | 7 jours hard cutoff | Aligné cycle bilan hebdo |
| Périmètre verbes | Edit / add / remove series + exos. **Pas** de swap. | Cohérence avec saisie in-session |
| Vidéos liées à un exo supprimé | Confirm explicite (D) | Évite perte silencieuse de contenu utilisateur |
| Signal côté coach | Badge "édité" (B), pas de diff | Édition légitime par construction (fenêtre 7j) |
| Choix exo ajouté | Hybride bibliothèque + texte libre (C) | Bibliothèque pas exhaustive |
| Suppression log entier | Hard delete + cascade videos (A) | Cas légitime (clic erroné), simple |
| Architecture data | Mutation directe + flag `edited_at` (Approche 1) | Minimaliste, future-compatible |

## 4. Data model

### Migration `workout_logs`

```sql
ALTER TABLE workout_logs
  ADD COLUMN edited_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE workout_logs
  ADD COLUMN locked_at TIMESTAMPTZ GENERATED ALWAYS AS (
    COALESCE(started_at, created_at) + INTERVAL '7 days'
  ) STORED;
```

- `edited_at` : null si jamais modifié, sinon timestamp dernière édition. Drive le badge coach.
- `locked_at` : calculé auto à `started_at + 7j` (fallback `created_at`). Drive le verrou édition.

### RLS policies

```sql
CREATE POLICY "athlete can edit own unlocked logs" ON workout_logs
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at)
  WITH CHECK (athlete_id = auth.uid() AND now() < locked_at);

CREATE POLICY "athlete can delete own unlocked logs" ON workout_logs
  FOR DELETE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at);
```

Sécurité au niveau DB, pas seulement applicatif. Bypass UI = refus DB.

### `execution_videos` cascade

Vérifier que la FK `workout_log_id` a bien `ON DELETE CASCADE` côté DB. Sinon ajouter dans la même migration. Storage Supabase n'est **pas** supprimé automatiquement par la cascade DB → cleanup applicatif requis (cf. §6).

## 5. UX flow — ATHLETE

### Entry point — `WorkoutDetailScreen.js`

Quand l'athlète consulte un log dans son historique :

- **Si `now() < locked_at`** : bouton "Modifier" visible
- **Sinon** : texte discret "Verrouillé depuis le {locked_at}", pas de bouton

Helper unique `isLogEditable(log): boolean` à exposer pour la UI.

### Edit screen — `EditWorkoutLogScreen.js` (nouveau)

Écran dédié (pas de toggle inline sur `WorkoutDetailScreen`). Évite édition accidentelle, simplifie test.

**Layout :**
- Header : titre séance + date + bouton "Annuler" (gauche) + "Enregistrer" (droite, désactivé tant qu'aucun changement)
- Body : liste des exos en mode édition
  - Tap sur reps/kg/durée/RPE → clavier inline
  - Bouton "+ Série" sur chaque exo → ajoute série préremplie avec valeurs de la dernière série
  - Swipe-to-delete série (avec confirm si vidéo associée)
  - Header exo : bouton "× Supprimer cet exercice" (avec confirm si une série a une vidéo)
- Footer :
  - Bouton "+ Ajouter un exercice" → modal sélection bibliothèque + champ texte libre fallback
  - Bouton "Supprimer cette séance" (rouge, double-confirm)

**Sauvegarde :**
- Bouton "Enregistrer" → un seul UPDATE atomique : `exercices_completes` + `edited_at = now()`
- Optimistic update local, rollback si erreur API
- Suppression de vidéos cascade : DELETE row DB **avant** storage (cf. lesson `DB-before-storage delete order`)

**Annulation :**
- Bouton "Annuler" → confirm modal si modifs en cours

### Add exercise modal

- Champ recherche → query bibliothèque d'exos
- Liste résultats triée par pertinence
- Tap sur exo → ajout au log avec une série vide (à remplir par l'athlète)
- Section "Pas trouvé ?" en bas → input texte libre + bouton "Ajouter en texte libre"

## 6. Cleanup storage (vidéos)

Lors de toute suppression (séance entière, exo, série) qui implique des `execution_videos` :

```js
// 1. Récupérer storage_paths AVANT delete DB
const videos = await fetchVideosForDeletion(...);
// 2. DELETE row(s) DB (cascade ou explicite)
await deleteWorkoutLogOrExercise(...);
// 3. Supprimer fichiers storage (best-effort, non bloquant)
await Promise.allSettled(videos.map(v => storage.remove(v.storage_path)));
// 4. Si erreur storage : log applicatif, pas d'erreur UI (fichiers orphelins toléré)
```

**Décision :** pas de cron de cleanup pour les orphelins dans cette V1 (YAGNI). À ajouter si on voit des fichiers orphelins s'accumuler.

## 7. UX coach — Badge "Édité"

**Vue concernée :** `app/(app)/athletes/[id]/training/page.tsx`, view `history`.

**Changements :**
- Sélectionner `edited_at` dans la query historique (vérifier select `*` ou liste explicite)
- Pour chaque log : si `edited_at !== null`, afficher pictogramme crayon + label "Édité" en gris à côté du titre
- Tooltip hover (desktop) : `Modifié le {format(edited_at, "DD/MM/YYYY HH:mm")}`
- Pas de filtre/tri "édité" pour l'instant
- Pas de notification push au coach (badge suffit)

## 8. Edge cases & mitigations

| Cas | Mitigation |
|-----|-----------|
| Bilan coach déjà fait à J+5, athlète édite à J+6 | Acceptable. Badge alerte le coach. |
| Vidéos orphelines en storage | Cleanup applicatif après cascade DB, best-effort. Cron futur si besoin. |
| Coach lit pendant que l'athlète édite | Acceptable, refresh manuel. Pas de realtime. |
| Athlète édite pendant nouvelle séance en cours | Aucun conflit (entités distinctes). |
| Réseau coupé pendant save | Rollback optimistic local, message d'erreur. Pas de queue offline. |
| Push "bilan créé" déjà partie | Acceptable, badge rattrape côté UI coach. |
| Athlète bypasse UI et tente UPDATE après J+7 | RLS bloque côté DB. |

## 9. Testing strategy

- **Unit** : `isLogEditable(log)` (frontière exacte de `locked_at`, fallback `created_at` si `started_at` null)
- **Integration ATHLETE** :
  - Edit valeurs → `exercices_completes` mis à jour, `edited_at` set
  - Add exo via bibliothèque → ajout dans le log uniquement
  - Add exo texte libre → ajout avec exo_id null + nom string
  - Remove exo avec vidéo → confirm modal, cascade DB + storage cleanup
  - Delete log entier → cascade videos OK, storage cleanup OK
- **RLS** :
  - Athlète A ne peut pas UPDATE un log d'athlète B → 403
  - Athlète ne peut pas UPDATE après `locked_at` → 403
  - Athlète ne peut pas DELETE après `locked_at` → 403
- **Coach (COACH repo)** :
  - Badge "Édité" affiché si `edited_at !== null`
  - Tooltip affiche la date correctement

## 10. Migration & rollout

1. Migration SQL (`workout_logs` columns + RLS policies + `ON DELETE CASCADE` check sur `execution_videos`)
2. Backend : pas d'API à créer — Supabase client direct depuis ATHLETE et COACH
3. ATHLETE : nouvel écran `EditWorkoutLogScreen` + helper `isLogEditable` + bouton "Modifier" sur `WorkoutDetailScreen`
4. COACH : badge "Édité" sur `training/page.tsx` history view
5. Rollout :
   - Push migration en prod (compatible : nouvelles colonnes nullable / generated)
   - Ship COACH en prod (badge invisible tant qu'aucun `edited_at` non-null)
   - Ship ATHLETE via `eas update` (JS only, pas de native)

## 11. Open questions

- Vérifier que la FK `execution_videos.workout_log_id` a déjà `ON DELETE CASCADE` (sinon ajouter dans migration)
- Vérifier que la bibliothèque d'exos existante côté ATHLETE (table `exercises` ?) a bien les champs nécessaires pour la modal d'ajout
- Confirmer le format exact de `exercices_completes` JSON pour modélisation correcte du state d'édition

→ Ces points sont à résoudre dans le **plan d'implémentation**, pas dans ce design.
