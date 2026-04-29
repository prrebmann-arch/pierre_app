# Variantes de diète — Design

**Date** : 2026-04-29
**Statut** : Spec validée, prêt pour writing-plans
**Scope** : COACH (web Next.js) + ATHLETE (RN/Expo) + Supabase

## Contexte

Le coach veut pouvoir proposer des **variantes** dans une diète assignée à un athlète, à deux niveaux :

1. **Variantes de jour** — aujourd'hui une diète a deux modes (`training` / `rest`). Demain, chaque mode peut avoir plusieurs versions (ex. `training-Push`, `training-Pull`, `training-Legs`). L'athlète choisit chaque jour la variante qui correspond à sa séance.
2. **Variantes de repas** — à l'intérieur d'une variante de jour, un repas précis peut avoir 2-3 options (ex. `Solide` / `Shake` pour le repas du midi). L'athlète défile pour choisir.

**Objectif business** : variation, plaisir, adhérence — éviter que l'athlète sorte de la diète parce qu'il n'a pas envie du même repas tous les jours.

## Décisions clés

- Max **3 variantes** par niveau (validé utilisateur).
- Labels en **texte libre** (`Push`, `Solide`, `Shake`, etc.).
- **UUID stable** par variante de repas dans le JSON.
- **Soft delete** (`archived_at`), jamais de DELETE dur.
- **Choix athlète persisté immédiatement**, pas de bouton "valider".
- **Reset du log au changement de variante** après modal de confirmation. Pas de migration entre variantes.
- **Pas de recalcul rétroactif** sur les jours passés.
- Forcer le **choix explicite** sur la variante de jour (pas de défaut).
- Variante de repas : **default sur la première** (`variants[0]`) — bas enjeu, gain UX.

## Architecture

### Niveau 1 — Variantes de jour

Aujourd'hui : `nutrition_plans` a une row par `(athlete_id, meal_type)`. La logique active/désactive en flippant `actif`.

Demain : plusieurs rows actives autorisées par `(athlete_id, meal_type)`, distinguées par `variant_label` et triées par `variant_order`.

### Niveau 2 — Variantes de repas

Inline dans le JSON `meals_data`. Un repas peut être :
- **Mode simple** (existant) : `{ label, time, pre_workout, foods: [...] }`
- **Mode multi-variantes** (nouveau) : `{ label, time, pre_workout, variants: [{ id, label, foods }, ...] }`

`time` et `pre_workout` restent **au niveau du repas** (partagés entre variantes). Seuls `foods` (et le `label` de variante) diffèrent.

### Choix athlète

- Variante de jour active : référencée par `nutrition_logs.plan_id` (UUID stable, déjà en place).
- Variante de repas active : `nutrition_logs.meals_log[i].chosen_variant_id` (UUID stable de la variante).

## Modèle de données

### Migration SQL

`sql/meal_variants.sql` :

```sql
ALTER TABLE nutrition_plans
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS variant_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_active_group
  ON nutrition_plans(athlete_id, meal_type, variant_order)
  WHERE actif = true AND archived_at IS NULL;
```

Idempotente. Aucun backfill : les rows existantes deviennent des "groupes singletons" (label NULL, order 0).

### Shape JSON `nutrition_plans.meals_data`

**Repas sans variante (existant, inchangé) :**

```jsonc
{
  "label": "Repas 1",
  "time": "08:00",
  "pre_workout": false,
  "foods": [
    { "aliment": "Avoine", "qte": 80, "kcal": 304, "p": 11, "g": 54, "l": 6, "allow_conversion": false }
  ]
}
```

**Repas avec variantes (nouveau) :**

```jsonc
{
  "label": "Repas 4",
  "time": "13:00",
  "pre_workout": false,
  "variants": [
    {
      "id": "v_a3f9b2c1",
      "label": "Solide",
      "foods": [
        { "aliment": "Riz", "qte": 100, "kcal": 130, "p": 2.7, "g": 28, "l": 0.3, "allow_conversion": true },
        { "aliment": "Poulet", "qte": 150, "kcal": 195, "p": 30, "g": 0, "l": 4.5, "allow_conversion": false }
      ]
    },
    {
      "id": "v_b1e7d8f4",
      "label": "Shake",
      "foods": [
        { "aliment": "Whey", "qte": 30, "kcal": 120, "p": 25, "g": 2, "l": 1.5, "allow_conversion": false },
        { "aliment": "Banane", "qte": 120, "kcal": 107, "p": 1.3, "g": 27, "l": 0.4, "allow_conversion": false }
      ]
    }
  ]
}
```

### Shape JSON `nutrition_logs.meals_log`

**Repas sans variante (existant, inchangé) :**

```jsonc
{
  "meal_index": 0,
  "meal_label": "Repas 1",
  "foods": [
    { "food_index": 0, "status": "followed", "original": {...}, "replacement": null }
  ],
  "validated_all": true
}
```

**Repas avec variante (nouveau) :**

```jsonc
{
  "meal_index": 3,
  "meal_label": "Repas 4",
  "chosen_variant_id": "v_a3f9b2c1",
  "foods": [
    { "food_index": 0, "status": "followed", "original": {...}, "replacement": null }
  ],
  "validated_all": false
}
```

`chosen_variant_id` absent ou null = repas pas encore choisi (ou repas sans variantes).

`nutrition_logs.plan_id` continue de pointer sur le `nutrition_plans.id` de la variante de jour active.

## UX coach

### Page nutrition athlète (`app/(app)/athletes/[id]/nutrition/page.tsx`)

Chaque `meal_type` est un **groupe** affiché avec ses variantes en tabs :

```
┌─ Diète d'entraînement ─────────────────────┐
│ [Push] [Pull] [Legs] [+ Ajouter variante]   │
│                                             │
│ (contenu de la variante active)             │
└─────────────────────────────────────────────┘
```

Actions sur le groupe :
- `+ Ajouter variante` : INSERT row même `meal_type`, prompt label, `variant_order = MAX+1`.
- Renommer onglet : `UPDATE variant_label`.
- Supprimer onglet : `UPDATE archived_at = now()`. Confirmation. Désactivé si dernière variante non archivée.
- Réordonner par drag : `UPDATE variant_order`.

### MealEditor (`components/nutrition/MealEditor.tsx`)

**Bouton `+ Ajouter une option`** au niveau de chaque repas. Désactivé si :
- Le plan a `macro_only = true`
- Le repas a déjà 3 variantes

Quand le repas a ≥2 variantes, header :

```
Repas 4 — 13:00 □ pré-workout    [+ Ajouter une option] [Comparer]

[Solide] [Shake] [+]
```

Tabs internes pour éditer chaque variante. Actions par tab :
- `Dupliquer` : copie `foods` de la variante active dans une nouvelle (label + UUID régénérés).
- `Renommer` : édite le label.
- `Supprimer` : confirmation, désactivé si 1 seule variante.
- `Convertir en repas simple` : transforme `{ variants: [...] }` en `{ foods: variants[0].foods }`. Action explicite, pas auto.

Tableau comparatif (collapse) sous le repas :

```
┌──────────┬──────┬─────┬─────┬─────┐
│ Variante │ kcal │  P  │  G  │  L  │
├──────────┼──────┼─────┼─────┼─────┤
│ Solide   │ 612  │ 45  │ 60  │ 18  │
│ Shake    │ 605  │ 44  │ 65  │ 16  │
│ Δ Shake  │  -7  │ -1  │ +5  │ -2  │
└──────────┴──────┴─────┴─────┴─────┘
```

`time` et `pre_workout` édités au-dessus des tabs (au niveau du repas).

### Total journée affiché en haut

Pour les repas à variantes, on prend la **variante d'ordre 0** pour le calcul du total prévu. Indicateur sous le total : *"Total basé sur la 1re option de chaque repas à variantes."*

### Templates (`nutrition_templates`)

Aucun changement de schéma. Le shape `meals_data` est identique entre `nutrition_plans` et `nutrition_templates`. Les variantes sont importées telles quelles, les UUID des variantes de repas sont **régénérés à l'import** sur un athlète.

## UX athlète

### NutritionScreen (`ATHLETE/src/screens/NutritionScreen.js`)

**Étape 1 — Choix training/rest** (existant, inchangé)

**Étape 2 — Picker variante de jour** (conditionnel)

Affiché uniquement si le `meal_type` choisi a ≥2 plans actifs non archivés.

```
┌─ Choisis ta journée ──────────────┐
│  ○ Push    ○ Pull    ○ Legs        │
└────────────────────────────────────┘
```

- **Pas de défaut.** L'athlète doit cliquer pour voir ses repas.
- Sélection persistée dans `nutrition_logs.plan_id` via UPSERT (avec `meals_log = []` initial si row n'existe pas).
- Le lendemain, pas de pré-sélection.

**Étape 3 — Affichage repas avec variantes**

```
┌─ Repas 4 · 13:00 ──────────────────────┐
│  ◀  Solide (1/2)  ▶                     │
│                                         │
│  • Riz blanc — 100g       (validé ✓)    │
│  • Poulet — 150g          (à valider)   │
│  • Brocoli — 200g         (à valider)   │
│                                         │
│  [ Tout valider ]                       │
│  Total : 612 kcal · P 45 · G 60 · L 18  │
└─────────────────────────────────────────┘
```

- Flèches ◀ ▶ cyclent entre variantes (pas de swipe gesture).
- Default = première variante (`variants[0].id`).
- Choix persisté instantanément dans `meals_log[i].chosen_variant_id`.

**Étape 4 — Modal de confirmation au changement après log**

Si l'athlète change de variante alors que `meals_log[i].foods` contient ≥1 entry avec `status` non vide :

```
┌─ Changer d'option ? ─────────────────────┐
│ Tu as commencé à logger ce repas.         │
│ Changer remet à zéro ce qui a été validé. │
│        [ Annuler ]   [ Confirmer ]        │
└───────────────────────────────────────────┘
```

Au confirm : `meals_log[i].foods = []`, `meals_log[i].chosen_variant_id = nouveau`. Foods de la nouvelle variante hydratés à neuf.

**Étape 5 — Modal au changement de variante de jour**

Même règle, niveau jour. Au confirm : `meals_log = []`, `plan_id` updated.

**Étape 6 — Conversion glucides + remplacement** (existant, préservé)

Marchent dans la variante active. Orthogonaux aux variantes.

### Helpers à introduire

Pour éviter les régressions sur le code qui lit `meals_data[i].foods` directement :

```ts
// COACH (TS)
function getMealFoods(meal, chosenVariantId?: string) {
  if (!meal.variants) return meal.foods;
  const v = meal.variants.find(v => v.id === chosenVariantId) ?? meal.variants[0];
  return v.foods;
}
```

```js
// ATHLETE (JS)
export function getMealFoods(meal, chosenVariantId) {
  if (!meal.variants) return meal.foods;
  const v = meal.variants.find(v => v.id === chosenVariantId) ?? meal.variants[0];
  return v.foods;
}
```

À utiliser **partout** où on lit les aliments d'un repas (totaux journée, render meals, calcul macros, dashboard, bilans).

## Règles d'accès

### Lecture coach (page nutrition athlète)

```sql
SELECT * FROM nutrition_plans
WHERE athlete_id = $1
  AND actif = true
  AND archived_at IS NULL
ORDER BY meal_type, variant_order;
```

Code regroupe par `meal_type` côté JS pour render les tabs.

### Lecture coach (historique / bilans)

Pas de filtre `archived_at` — l'historique reste lisible même si la variante a été archivée depuis.

### Lecture athlète (écran du jour)

1. Charge tous les plans actifs non archivés : `WHERE athlete_id = $1 AND actif = true AND archived_at IS NULL`.
2. Charge `nutrition_logs` du jour si existe.
3. Si log existe → `plan_id` = variante de jour active. Sinon → afficher picker (si plusieurs plans pour le `meal_type` choisi).
4. Render meals depuis le `meals_data` du plan actif. Pour chaque meal avec `variants`, utilise `chosen_variant_id` ou fallback sur `variants[0].id`.

### Lecture athlète (jour passé)

Charge le plan référencé par `nutrition_logs.plan_id` **sans filtre `archived_at`** (le plan peut avoir été archivé entre temps).

### RLS

Inchangée. Les policies actuelles (`coach_manage_nutrition_plans`, `athlete_read_own_plans`, `Athletes can manage their own nutrition logs`, `Coaches can read their athletes nutrition logs`) couvrent toutes les rows. Le filtre `archived_at` est appliqué côté requête, pas côté policy.

### Index

```sql
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_active_group
  ON nutrition_plans(athlete_id, meal_type, variant_order)
  WHERE actif = true AND archived_at IS NULL;
```

L'index existant `idx_nutrition_plans_athlete_id_actif` reste en place pour les autres usages.

## Edge cases

| # | Cas | Comportement |
|---|---|---|
| E1 | Coach archive la variante actuellement choisie aujourd'hui par l'athlète | Fallback sur `variants[0]` non archivée. Modal subtil "Cette option n'est plus dispo". Log d'aujourd'hui pas reset (cas rare en pratique). |
| E2 | Coach archive le plan actif d'un log historique | Lecture sans filtre `archived_at` sur l'historique pour afficher correctement. |
| E3 | Coach ajoute une variante en cours de journée | Pas de re-prompt aujourd'hui. Le picker apparaît demain. |
| E4 | Athlète change de variante de jour à 23h | Modal de confirmation, reset complet, accepté. |
| E5 | Coach saisit deux variantes avec le même label | Warning visuel non bloquant. Les UUID restent distincts. |
| E6 | Suppression de la dernière variante d'un repas | Bouton désactivé. Action explicite "Convertir en repas simple" pour repasser en mode `foods`. |
| E7 | Conversion glucides faites avant changement de variante | Wipe au reset. Athlète refait si voulu. |
| E8 | Import template avec variantes | Régénérer UUID des variantes de repas. |
| E9 | Offline pendant changement de variante | Hors scope V1. Comportement aligné sur l'existant. |
| E10 | RLS coach lit logs avec plan archivé | Lecture sans filtre archived côté requête. |

## Tests

### Aucune infra de tests automatisés sur cette feature

Conforme au reste de la codebase. On valide par checklist manuelle.

### Checklist coach (manuel)

1. Créer une diète training avec 1 plan, sans variantes → comportement identique aujourd'hui.
2. Ajouter une 2e variante de jour à un athlète existant → 2 rows actives, tabs visibles côté athlète.
3. Ajouter variante repas (Solide/Shake) sur le repas 4 → JSON `meals_data[3].variants` avec UUID.
4. Tableau comparatif kcal/macros affiché correct.
5. Renommer variante → label updated, choix athlète préservé.
6. Réordonner par drag → `variant_order` updated, choix athlète préservé.
7. Supprimer variante → `archived_at` set, disparaît côté athlète, logs lisibles.
8. Charger template avec variantes → import réussi.
9. Plan `macro_only=true` → bouton "+ Ajouter une option" caché.

### Checklist athlète (manuel)

10. 1 seule variante de jour → picker skippé.
11. 2+ variantes de jour → picker affiché, choix persisté.
12. Repas avec 2 variantes → flèches cyclent, choix persisté.
13. Cycler sans avoir loggé → pas de modal.
14. Logger puis cycler → modal, reset au confirm, no-op au cancel.
15. Conversion glucides dans variante active → marche.
16. Remplacement aliment dans variante active → marche.

### Critère "done"

- [ ] Migration `sql/meal_variants.sql` jouée en preview Vercel, schéma confirmé.
- [ ] Build COACH passe (`npm run build` + `npm run lint`).
- [ ] Build ATHLETE passe (`npx expo prebuild` smoke test).
- [ ] Cas nominaux 1-9 (coach) et 10-16 (athlète) validés sur preview.
- [ ] Edge cases E1, E3, E4, E6, E8 testés manuellement.
- [ ] Aucune régression sur un athlète sans variante (= 100% des athlètes existants).

## Fichiers à modifier

| Fichier | Modif |
|---|---|
| `sql/meal_variants.sql` | nouveau |
| `app/(app)/athletes/[id]/nutrition/page.tsx` | regroupement par meal_type, tabs UI, CRUD variante de jour, soft delete |
| `components/nutrition/MealEditor.tsx` | bouton "+ Ajouter une option", tabs internes, tableau comparatif, génération UUID, désactivation si `macro_only`, action "Convertir en repas simple" |
| `components/nutrition/FoodSearch.tsx` | aucune modif |
| `lib/nutrition.ts` | nouveau helper `getMealFoods` (côté COACH) |
| `ATHLETE/src/screens/NutritionScreen.js` | picker variante jour, picker flèches variante repas, modals reset, lecture `chosen_variant_id`, helper `getMealFoods` |
| `ATHLETE/src/api/nutrition.js` (ou équivalent) | UPSERT log avec plan_id seul, reset `meals_log[i].foods` au change variante |

Audit grep `meals_data` côté coach et athlète à faire au moment du dev pour traquer les lectures directes de `meals_data[i].foods` qui doivent passer par `getMealFoods`.

## Hors scope V1

Notés dans `tasks/todo.md` ou différés en V2 :

1. **Adhérence calculée** (remplacer la saisie manuelle `daily_reports.adherence` par le tracking aliments). Déjà ajouté à `tasks/todo.md`.
2. **Indicateur "nouvelles options dispo"** côté athlète quand le coach ajoute une variante après coup.
3. **Tags de couplage entre variantes** (Modèle 3 du brainstorm).
4. **Auto-suggestion macros** pour calibrer iso-macros à la création.
5. **Stats par variante** côté coach (fréquence de choix athlète).
6. **Import/export d'une variante seule** entre athlètes.
7. **Variante de jour calquée sur le programme d'entraînement** (auto-tag séance prévue).

## Alternatives écartées (rappel)

- Table dédiée `meal_variants` → trop de jointures, gain académique.
- Scénarios couplés (basculer en bloc) → trop rigide, refusé par l'utilisateur.
- Index numérique des variantes → bug critique au reorder/rename.
- Auto-default variante de jour → cache un choix structurant.

## Risques résiduels

| # | Risque | Mitigation |
|---|---|---|
| R1 | Charge mentale coach à la création (calibrage iso-macros) | "Dupliquer comme variante" + tableau comparatif avec deltas. |
| R2 | Friction athlète quand variantes ajoutées après coup | Acceptée V1, polish UX en V2. |
| R3 | Confusion variante / remplacement / conversion | UX visuellement distincte + doc utilisateur. |
| R4 | Migration silencieuse du shape JSON casse les lectures directes | Helper `getMealFoods` + audit grep. |
| R5 | Pas de tests automatiques | Checklist manuelle exhaustive + démo sur preview. |
