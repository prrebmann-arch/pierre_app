# Test FODMAP — Design

> Date: 2026-05-01
> Status: ready for plan
> Scope: ATHLETE app (mobile RN/Expo) + COACH app (Next.js web)

---

## 1. Context & motivation

Outil guidé de réintroduction des FODMAPs dans la diète d'un athlète. Aujourd'hui le coach utilise un Google Sheets manuel ; on internalise pour tracer les résultats par athlète et offrir un tableau de bord.

Pattern : feature **lockable** par athlète comme Posing. Désactivée par défaut, le coach active pour les athlètes pour qui c'est pertinent.

---

## 2. Scope MVP

**Inclus :**
- Toggle d'activation par athlète (coach)
- Catalogue figé de 8 groupes FODMAP × 3 aliments × 3 portions (croissantes Lun/Mer/Ven)
- Athlète : 1 semaine = 1 groupe + 1 aliment + 3 logs Lun/Mer/Ven
- Rating 🟢 / 🟡 / 🔴 + note libre par log
- Stop-loss médical : 🔴 sur la petite portion → semaine fermée
- Coach : vue par athlète des résultats + bouton "Ré-armer une semaine"
- Audit conservé (soft-delete via `archived_at`)
- Athlète peut éditer le rating de la semaine en cours (avec cascade) et la note de n'importe quelle semaine

**Exclus (Phase 2+) :**
- Notifications push Lun/Mer/Ven (rappel athlète) et "semaine complétée" (coach)
- Gestion du cycle menstruel féminin (CSV recommande de ne pas tester pré-règles)
- Note coach par semaine
- Aliment hors-catalogue / catalogue éditable
- Photo de symptômes
- Vue cross-athlètes pour le coach

---

## 3. Architecture

### 3.1. Catalogue (hardcodé, dupliqué)

Un fichier source de vérité pour chaque app, avec un test snapshot qui vérifie que les deux fichiers ont les mêmes clés/valeurs.

- ATHLETE : `src/utils/fodmapCatalog.js`
- COACH : `lib/fodmapCatalog.ts`

Structure :

```ts
export const GROUPS = [
  { key: 'fructanes_legumes', label: 'Fructanes (Légumes)' },
  { key: 'fructanes_fruits',  label: 'Fructanes (Fruits)' },
  { key: 'fructanes_pains',   label: 'Fructanes (Pains, céréales, grains)' },
  { key: 'gos',                label: 'GOS' },
  { key: 'fructose',           label: 'Fructose' },
  { key: 'lactose',            label: 'Lactose' },
  { key: 'polyols_sorbitol',   label: 'Polyols (sorbitol)' },
  { key: 'polyols_mannitol',   label: 'Polyols (mannitol)' },
] // 8 entrées

export const FOODS = [
  { key: 'ail',     group_key: 'fructanes_legumes', label: 'Ail',     emoji: '🧄' },
  // ...24 entrées au total (3 par groupe), dérivées du CSV de référence
]

export const PORTIONS = [
  { food_key: 'ail', size: 'S', label: '1/4 gousse' },
  { food_key: 'ail', size: 'M', label: '1/2 gousse' },
  { food_key: 'ail', size: 'L', label: '1 gousse entière' },
  // ...72 entrées au total (3 par aliment)
]
```

Source de la donnée : CSV de référence `RÉINTRODUCTION FODMAPS - RÉINTRODUCTION FODMAPS.csv`.

### 3.2. Base de données

#### Migration SQL

```sql
-- 1. Toggle par athlète
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS fodmap_enabled boolean NOT NULL DEFAULT false;

-- 2. Enum ordonné pour comparaison des portions (S < M < L)
DO $$ BEGIN
  CREATE TYPE fodmap_portion_size AS ENUM ('S','M','L');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Logs Lun/Mer/Ven
CREATE TABLE IF NOT EXISTS athlete_fodmap_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  group_key       text NOT NULL,
  food_key        text NOT NULL,
  portion_size    fodmap_portion_size NOT NULL,
  rating          text NOT NULL CHECK (rating IN ('green','yellow','red')),
  note            text,
  logged_at       timestamptz NOT NULL DEFAULT now(),
  iso_week_start  date GENERATED ALWAYS AS (date_trunc('week', logged_at)::date) STORED,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, iso_week_start, portion_size)
);

CREATE INDEX IF NOT EXISTS idx_fodmap_logs_athlete_week
  ON athlete_fodmap_logs (athlete_id, iso_week_start DESC)
  WHERE archived_at IS NULL;

-- 4. RLS
ALTER TABLE athlete_fodmap_logs ENABLE ROW LEVEL SECURITY;

-- Athlète : INSERT/UPDATE/SELECT sur ses propres rows, sans set archived_at, sans DELETE
CREATE POLICY athlete_fodmap_logs_select_self ON athlete_fodmap_logs
  FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));

CREATE POLICY athlete_fodmap_logs_insert_self ON athlete_fodmap_logs
  FOR INSERT
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND archived_at IS NULL
  );

CREATE POLICY athlete_fodmap_logs_update_self ON athlete_fodmap_logs
  FOR UPDATE
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND archived_at IS NULL
  );

-- (DELETE non exposé à l'athlète — la cascade après edit red est faite par la RPC qui s'exécute en SECURITY INVOKER mais reste appelée dans le scope athlète. Voir RPC.)

-- Coach : SELECT et UPDATE sur les athlètes qu'il coache
CREATE POLICY athlete_fodmap_logs_coach_read ON athlete_fodmap_logs
  FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

CREATE POLICY athlete_fodmap_logs_coach_update ON athlete_fodmap_logs
  FOR UPDATE
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

-- 5. RPC pour l'edit avec cascade (atomique)
-- SECURITY INVOKER → respecte les RLS de l'appelant. Le DELETE des logs futurs est
-- autorisé pour l'athlète UNIQUEMENT via cette RPC (pas de POLICY DELETE directe).
-- → Pour permettre le DELETE en RPC sans politique DELETE athlète, on utilise
-- SECURITY DEFINER avec un check explicite que auth.uid() = athletes.user_id.
CREATE OR REPLACE FUNCTION update_fodmap_log_with_cascade(
  p_log_id uuid,
  p_new_rating text,
  p_new_note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_athlete_id uuid;
  v_iso_week_start date;
  v_portion_size fodmap_portion_size;
  v_caller_user_id uuid;
  v_owner_user_id uuid;
BEGIN
  v_caller_user_id := auth.uid();

  -- Charge le log à modifier
  SELECT athlete_id, iso_week_start, portion_size
    INTO v_athlete_id, v_iso_week_start, v_portion_size
  FROM athlete_fodmap_logs WHERE id = p_log_id AND archived_at IS NULL;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'log not found or archived';
  END IF;

  -- Vérification d'ownership : l'appelant doit être l'athlète propriétaire
  SELECT user_id INTO v_owner_user_id FROM athletes WHERE id = v_athlete_id;
  IF v_owner_user_id IS NULL OR v_owner_user_id <> v_caller_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Validation rating
  IF p_new_rating NOT IN ('green','yellow','red') THEN
    RAISE EXCEPTION 'invalid rating';
  END IF;

  -- Si nouveau rating = red ET portion modifiée n'est pas L, cascade-delete les portions ultérieures
  IF p_new_rating = 'red' THEN
    DELETE FROM athlete_fodmap_logs
    WHERE athlete_id = v_athlete_id
      AND iso_week_start = v_iso_week_start
      AND archived_at IS NULL
      AND portion_size > v_portion_size; -- enum ordonné : S < M < L
  END IF;

  UPDATE athlete_fodmap_logs
    SET rating = p_new_rating, note = p_new_note
  WHERE id = p_log_id;
END $$;

REVOKE ALL ON FUNCTION update_fodmap_log_with_cascade(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_fodmap_log_with_cascade(uuid, text, text) TO authenticated;
```

> Notes :
> - L'enum `fodmap_portion_size` rend `portion_size > v_portion_size` valide (ordre déclaré : S < M < L).
> - L'athlète n'a **pas** de policy DELETE. La cascade après edit→red passe exclusivement par la RPC `SECURITY DEFINER` qui re-vérifie que l'appelant est bien le propriétaire. Sans la RPC, l'athlète ne peut pas supprimer ses propres logs (par design — préserve l'audit).
> - Coach n'utilise pas cette RPC. Le re-arme coach se fait via `UPDATE archived_at = now()` direct (RLS coach UPDATE).

### 3.3. Statuts dérivés (lecture seule, pas stockés)

Calculés côté app à partir des logs (filtrés `archived_at IS NULL`) :

- **Active week** : ISO week courante a au moins 1 log → group_key/food_key dérivés du premier log de la semaine
- **Group complété** : un (athlete_id, group_key) avec les 3 portions S/M/L, OU une ligne S=red (early stop)
- **Group status** : `done_all_green` / `done_yellow` (au moins un yellow, pas de red) / `done_red` (au moins un red) / `in_progress` / `not_started`
- **Progression** : count(distinct group_key où complété) / 8
- **All done** : 8 groupes complétés → écran read-only "Réintroduction terminée"

---

## 4. UI Athlète

### 4.1. Entrée

Dans `ProfilScreen.js`, ligne dans la section settings : **"Test FODMAP"** (icône) avec ➜. N'apparaît que si `athletes.fodmap_enabled = true`. Tap → push de la stack vers `FodmapScreen`.

### 4.2. Écran principal `FodmapScreen`

États possibles :

1. **Pas de semaine active, < 8 complétés** : carte CTA "Choisis ton groupe pour cette semaine" + grid 8 groupes (fait/à faire). Tap "À faire" → flow **start-week**.
2. **Semaine active, jour pas Lundi** (impossible vu (b) "pas de pré-sélection", car la semaine est active = 1+ log existant) — couvre Lun-après-S-loggé / Mer-pas-encore-loggé etc.
3. **Semaine active** : grosse carte rouge avec groupe + aliment + timeline 3 colonnes Lun/Mer/Ven. Bouton CTA "Logger ma portion {courante}". Grid en dessous avec le groupe en cours marqué EN COURS.
4. **All 8 done** : header "Réintroduction terminée 🎉" + grid des 8 groupes en read-only (cliquables pour voir détails).

Composants : tout dans `src/screens/FodmapScreen.js` (~400-500 lignes attendues), pas de design system séparé (pattern de l'app).

### 4.3. Flow start-week (Lun seulement)

Un seul flow combiné, **pas de pré-sélection persistée en DB** :

- Athlète tap groupe "À faire"
- **Si jour-semaine actuel = Lundi** (référence : timezone du device, vérification client-side via date-fns `getDay() === 1`) : ouvre modal "Sélectionne 1 aliment" (3 cards). Tap aliment → confirme → modal log immédiate de la portion S (rating + note) → submit → INSERT (athlete_id, group_key, food_key, portion_size='S', rating, note). À partir de ce moment, la "semaine active" est dérivée de cette ligne.
- **Si jour ≠ Lundi** : message bloquant "Tu pourras démarrer ce groupe lundi prochain". Pas d'écriture en DB.

> Décision : pas de pré-sélection stockée. La sélection groupe+aliment est éphémère côté UI Lundi, persistée seulement au moment du log S. Élimine 1 table, 0 état intermédiaire à synchroniser. Inconvénient mineur : l'athlète doit revenir Lundi pour s'engager — acceptable car de toute façon il logge Lundi.

> Le check "est-ce Lundi ?" est UI-side (timezone du device de l'athlète, pas du serveur). Si l'athlète change l'heure système, il peut bypass — pas un risque réel pour cette feature (pas de leaderboard ni d'enjeu de tricherie).

### 4.4. Flow log Mer/Ven

- L'écran principal montre le bouton CTA "Logger ma portion moyenne" (Mer) ou "Logger ma portion grande" (Ven), seulement le jour correspondant
- Tap → modal log : 3 boutons rating verticaux + note → submit
- Après submit : si 🔴 → semaine fermée, retour à l'écran principal avec le groupe marqué `done_red`. Si 🟢/🟡 → portion suivante débloquée pour le prochain jour, ou semaine complète si Ven.

### 4.5. Flow edit

- **Edit note** (toujours autorisé, semaine courante ou passée) : tap sur la note dans la timeline ou dans une carte d'historique → modal "Modifier la note" → texte → submit
- **Edit rating** (semaine courante uniquement) : tap sur le badge rating d'un jour loggé → modal "Modifier mon rating" identique au modal log. Submit appelle la RPC `update_fodmap_log_with_cascade`. Si nouveau rating = 🔴 et portions ultérieures existent : confirmation "Cela invalidera Mer/Ven, confirmer ?".
- **Edit rating semaine passée** : badge non-tappable, hint "Demande à ton coach pour ré-armer".

### 4.6. Edge cases UI athlète

- App rechargée pendant la semaine : derive l'état depuis la DB. Pas de cache à invalider.
- Coach re-arme la semaine pendant que l'athlète est dessus : le pull-to-refresh / refocus reload détecte 0 logs courants → écran retombe en "pas de semaine active".

---

## 5. UI Coach

Nouvelle route Next.js `/athletes/[id]/fodmap` (parallèle à `/posing`). Ajouter dans `app/(app)/athletes/[id]/layout.tsx` aux `TABS`.

### 5.1. Composants

- `app/(app)/athletes/[id]/fodmap/page.tsx` (`'use client'`)
- Toggle `athletes.fodmap_enabled` en haut (mirror posing)
- Si OFF : empty state "Test FODMAP désactivé" + Toggle
- Si ON :
  - Barre de progression X/8
  - Carte "Semaine en cours" (si une semaine active) : groupe + aliment + 3 colonnes Lun/Mer/Ven (rating + note inline si loggé, "En attente" sinon) + bouton **Ré-armer**
  - Section "Historique" : 1 card par groupe complété (chronologique desc), couleur de bordure selon résultat (vert/jaune/rouge), 3 ratings inline + notes, bouton **Ré-armer** par card
  - Section "Pas encore testé" : tags des groupes restants (read-only)

### 5.2. Re-arme

- Bouton "↻ Ré-armer" → confirmation modale "Cette semaine sera invalidée pour {groupe}. L'athlète pourra la refaire lundi prochain. Confirmer ?"
- Action : `UPDATE athlete_fodmap_logs SET archived_at = now() WHERE athlete_id = $1 AND iso_week_start = $2 AND archived_at IS NULL`
- Reload des données après succès. Pas de notification push à l'athlète.

### 5.3. Hors scope MVP côté coach

- Pas de note coach par semaine (Phase 2)
- Pas de vue cross-athlètes (Phase 2)
- Pas de notification "athlète a complété une semaine" (Phase 2)

---

## 6. Data flow / lifecycle

```
Coach toggle ON ─► athletes.fodmap_enabled = true
                  └─► athlète voit entrée Profil

Athlète Lundi ─► tap groupe "À faire"
              ─► modal sélection aliment (3 cards)
              ─► tap aliment ─► modal log S (rating + note)
              ─► submit ─► INSERT log (S, rating, note)
                ├─► rating = green/yellow ─► écran principal, bouton "Logger ma moyenne (Mer)" en attente
                └─► rating = red ─► semaine fermée, groupe = done_red

Athlète Mercredi ─► tap "Logger ma portion moyenne"
                 ─► modal log M ─► submit ─► INSERT log (M, rating, note)
                   ├─► rating = green/yellow ─► écran principal, bouton "Logger ma grande (Ven)"
                   └─► rating = red ─► semaine fermée, groupe = done_red à 2 portions

Athlète Vendredi ─► idem ─► dernière INSERT ─► groupe = done_all_green ou done_yellow

After 8 groupes complétés ─► écran read-only "Réintroduction terminée"

Coach ─► /athletes/[id]/fodmap
       ├─► voit tout ce qui précède en lecture
       └─► tap "Ré-armer" sur une semaine ─► UPDATE archived_at = now() ─► athlète peut refaire
```

---

## 7. Edge cases

| Cas | Comportement |
|---|---|
| Athlète logue à 23h59 dim Europe/Paris | `now()` UTC = 22h59 dim → `iso_week_start` reste la semaine précédente. Acceptable (pas Lundi de toute façon). |
| Année charnière (2026-W01 = lundi 29 déc 2025) | Géré par `date_trunc('week', logged_at)` Postgres = ISO week. Tests unitaires sur dates de jonction. |
| Coach toggle OFF avec logs existants | Logs conservés en DB. UI athlète masque l'entrée. Re-ON → tout réapparaît. |
| Athlète edit Mon 🟢→🔴 avec Mer/Ven existants | RPC `update_fodmap_log_with_cascade` : DELETE Mer/Ven + UPDATE Mon en transaction. |
| Edit échoue mid-cascade | RPC est en transaction → rollback complet, état cohérent. |
| Concurrence athlète/coach (athlète logue Mer pendant que coach re-arme) | Last-write-wins. Si re-arme passe en premier, l'INSERT athlète viole UNIQUE → erreur captée → reload écran. |
| Coach re-arme une semaine déjà archived | UPDATE n'affecte aucune ligne (filtré par `archived_at IS NULL`) → noop silencieux. |
| Athlète change `food_key` au sein d'une semaine | UI bloque (1 aliment/semaine). DB ne contraint pas, mais UNIQUE sur (athlete_id, iso_week_start, portion_size) garantit cohérence. |
| Catalogue : food_key invalide | App-level validation. Test snapshot CI vérifie que tous les food_key utilisés dans fixtures existent. |
| Rate limit coach toggle ON/OFF rapide | Pas de rate limit. UPDATE idempotent. |
| Athlète sans `fodmap_enabled` essaie d'INSERT | RLS check passe (own logs), pas de filtre sur enabled. **À durcir** : check trigger côté DB, ou RLS additionnelle `fodmap_enabled = true`. |

---

## 8. Testing

### 8.1. Unit tests

- **Catalogue** : 8 groupes, 24 aliments (3 par groupe), 72 portions (3 par aliment), tous les food_key dans PORTIONS existent dans FOODS, tous les group_key dans FOODS existent dans GROUPS
- **Catalog snapshot** : ATHLETE/`fodmapCatalog.js` et COACH/`fodmapCatalog.ts` ont les mêmes clés/valeurs (test JSON.stringify identical)
- **`getISOWeekStart(date)` helper** (uses date-fns) : Lundi 4 mai 2026 → 2026-05-04 ; Dimanche 10 mai 2026 → 2026-05-04 ; Lundi 29 déc 2025 → 2025-12-29 ; etc.
- **Group status derivation** : (3 logs S/M/L all green) → `done_all_green` ; (S=red, no M, no L) → `done_red` ; (S=green, M=yellow) → `in_progress` ; (no logs) → `not_started`

### 8.2. Integration / RLS tests

- Athlète A ne peut pas SELECT/INSERT sur logs de athlète B (RLS)
- Coach C ne peut pas SELECT logs d'un athlète qu'il ne coache pas
- Coach C peut UPDATE archived_at sur logs de ses athlètes, mais ses UPDATE sont visibles via un audit
- Athlète UPDATE avec `archived_at = now()` rejeté (WITH CHECK)
- INSERT 3 logs (S/M/L all green) → status group dérivé = `done_all_green`
- INSERT 1 log (S=red) → tentative INSERT M même semaine → app-side bloque, DB-side accepte (UNIQUE différent portion)

### 8.3. RPC test

- `update_fodmap_log_with_cascade(log_S, 'red', 'note')` quand M et L existent → après l'appel, M et L deleted, S a rating='red', note='note'
- Erreur mid-cascade simulée → rollback complet (S inchangé)

### 8.4. E2E manuel

- Activer FODMAP coach → écran apparaît côté athlète
- Démarrer un groupe Lundi → log S → vérifier écran principal mis à jour
- Tenter de démarrer mardi → message bloquant
- Compléter 1 semaine green/green/green → vérifier card "FAIT 🟢🟢🟢" + groupe pas en cours
- Compléter 1 semaine S=red → vérifier card "FAIT 🚫"
- Edit rating Mon green→red avec Mer existant → confirmation cascade → Mer disparaît
- Edit note semaine passée → autorisé
- Tenter edit rating semaine passée → bloqué
- Coach re-arme semaine → athlète recharge → semaine vide, re-démarrable lundi prochain
- Compléter les 8 groupes → écran "Réintroduction terminée"

---

## 9. Migration & rollout

### 9.1. SQL migration (run dans Supabase Studio)

1. `sql/2026-05-01-fodmap-test.sql` :
   - ALTER `athletes` ADD `fodmap_enabled`
   - CREATE TYPE enum `fodmap_portion_size`
   - CREATE TABLE `athlete_fodmap_logs`
   - CREATE INDEX
   - ENABLE RLS + 3 policies
   - CREATE FUNCTION `update_fodmap_log_with_cascade`

### 9.2. Code rollout

- 1 PR par repo (ATHLETE, COACH), tous deux mergés en preview
- Test E2E manuel sur preview avec 1 athlète test
- Cascade preview → develop → main par les workflows habituels
- ATHLETE : le code est JS-only (pas de native lib ajoutée) → `eas update --branch preview` puis `--branch production` après validation, pas besoin de build natif

### 9.3. Pas de backfill

Toutes les données nouvelles. `fodmap_enabled` default false → personne n'est impacté.

---

## 10. Hardening Phase 2 (hors MVP)

Listé pour mémoire :

- RPC SECURITY DEFINER `archive_fodmap_week(athlete_id, iso_week_start)` côté coach → restreindre l'UPDATE coach au seul champ `archived_at`
- RLS additionnelle : `fodmap_enabled = true` requis pour INSERT athlète (sécurise contre toggle OFF + INSERT)
- Notifications push :
  - Athlète : Lun/Mer/Ven 9h "N'oublie pas de logger ta portion FODMAP"
  - Coach : push "athlète X a complété une semaine FODMAP"
- Note coach par semaine (table `athlete_fodmap_coach_notes` ou colonne JSON sur logs)
- Gestion cycle féminin (lookup `menstrual_logs` au moment de start-week, warning "tu es en pré-règles, on conseille d'attendre")
- Catalogue éditable en DB (table `fodmap_catalog` seed) si besoin d'ajouter/modifier des aliments sans release
- Vue cross-athlètes coach `/fodmap` : liste des athlètes activés avec leur progression
- Photo de symptômes (champ optionnel sur le log)

---

## 11. Anti-patterns à éviter (lessons.md applicables)

- **RLS** : tester chaque policy avec un compte athlète + un compte coach explicitement. Ne pas se fier à `auth.uid()` dans le navigateur sans verif.
- **Comparaison portion_size** : enum Postgres obligatoire (`'S' < 'M' < 'L'` lexicographique = vrai mais fragile à la moindre rename). Use enum.
- **Catalog drift ATHLETE/COACH** : test snapshot en CI dès l'init.
- **Logs error silencieux** : tous les `from('athlete_fodmap_logs').*` doivent loger `error.message` en cas d'échec.
- **iso_week_start côté client** : INTERDIT. Colonne générée serveur uniquement.
- **`UPDATE archived_at` côté athlète** : bloqué par RLS WITH CHECK.

---

## 12. Risques

- **Adhésion faible sans rappels** : sans notifications push Lun/Mer/Ven, l'athlète peut oublier. Risque accepté pour MVP, à monitorer (qq athlètes cobayes pendant 2 semaines avant de promouvoir feature).
- **Drift de catalogue** : ajouter un aliment nécessite OTA des deux apps. Acceptable car la liste de référence est figée par le coach.
- **Femmes en règles** : on n'avertit pas, l'athlète peut tester un FODMAP en pleine sensibilité digestive et obtenir un faux positif. Le coach doit alerter manuellement en attendant Phase 2.
