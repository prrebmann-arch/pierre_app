# Prise de sang — Design

> Date: 2026-05-01
> Status: ready for plan
> Scope: ATHLETE (mobile RN/Expo) + COACH (Next.js web)

---

## 1. Context & motivation

Aujourd'hui les bilans sanguins athlètes sont gérés hors-app : PDF reçus par mail/WhatsApp, le coach lit + interprète à la main. On internalise pour : (a) historique structuré et graphé par marqueur, (b) flag automatique vert/jaune/rouge selon zones coach, (c) workflow de validation coach pour éviter les erreurs IA.

Pattern : feature **lockable** par athlète (`athletes.bloodtest_enabled`), comme FODMAP / Posing.

---

## 2. Scope MVP

**Inclus :**
- Toggle d'activation par athlète (coach)
- Choix de preset (basic / hormonal+ / total / custom) par athlète, modifiable
- Toggle on/off des marqueurs individuels au sein du panel actif
- Ajout de marqueurs custom par le coach (table dédiée, partagée entre ses athlètes)
- Upload PDF par athlète OU coach
- Extraction IA via Claude Haiku (PDF input natif Anthropic), retour JSON structuré
- Workflow de validation coach (split-view PDF / extraits éditables)
- Affichage côté athlète de ses graphs **après validation coach uniquement**
- Affichage côté coach : queue à valider + historique par athlète + graphs
- Flag par marqueur (moyen / bon / très bon) avec zones coach configurables (3 thresholds)
- Soft-delete via `archived_at` (audit conservé)
- Athlète peut supprimer son upload **avant validation coach** uniquement

**Exclus (Phase 2+) :**
- Synthèse texte IA (interprétation médicale par paragraphe)
- Recommandations supplémentation auto-générées
- Comparaison automatique vs PDF précédent ("Hb en baisse")
- Notification push athlète quand le coach valide
- Vue cross-athlètes coach (KPIs flotte)
- GDPR consentement explicite étape onboarding
- Audit trail des modifications post-validation
- Conversion automatique d'unités exotiques (ex : conventional vs SI)

---

## 3. Architecture

### 3.1. Pipeline IA

```
Athlète/Coach upload PDF
  └─► Storage bucket coach-bloodtest/{owner_user_id}/{ts}.pdf (privé)
       └─► API POST /api/bloodtest/extract { upload_id }
             └─► Server-side : signed URL → fetch PDF bytes
                   └─► Claude API (claude-haiku-4-5)
                         input: PDF (document type)
                         system prompt: extraction structurée
                         response_format: JSON schema strict
                   └─► UPDATE bloodtest_uploads SET extracted_data = $1, ai_extraction_meta = $2
```

Modèle : `claude-haiku-4-5` (PDF input natif, structured output). Budget tokens cible : ~25k input + ~3k output par PDF. Coût estimé ~$0.02-0.05 / PDF. Avec 30 athlètes × 4 PDFs/an = ~$5/an. Négligeable.

Clé API : `ANTHROPIC_API_KEY` côté Vercel COACH server-only. Jamais exposée au client. Athlète n'appelle pas Anthropic direct — il upload via `/api/bloodtest/upload` qui forward vers extract.

### 3.2. Catalogue marqueurs

Sources de vérité dupliquées (parité testée en CI, pattern FODMAP) :
- ATHLETE : `src/utils/bloodtestCatalog.js`
- COACH : `lib/bloodtestCatalog.ts`

#### 3.2.1. Framework de zones

**Vocabulaire de zone dépend du type de marqueur.** Le code partage la logique de classification (which zone for value X), mais les labels affichés varient par catégorie. Chaque marker définit ses zones explicitement dans le catalog.

**Vocabulaires par catégorie :**

| Catégorie | Vocabulaire de zones | Direction typique |
|---|---|---|
| `vitamin`, `mineral`, `iron` | `optimal` / `deficience` / `carence` / `avitaminose` | higher_is_better |
| `hormone_sex`, `thyroid` | `low` / `normal` / `high` | range_is_normal (avec phase du cycle pour hormones féminines) |
| `inflammation` (CRP us) | `optimal` / `leger` / `modere` / `severe` | lower_is_better |
| `metabolism` (créatinine, glycémie, HbA1c) | `bas` / `normal` / `eleve` / `tres_eleve` | range_is_normal ou lower_is_better selon |
| `liver` (ASAT, ALAT, GGT) | `optimal` / `leger` / `modere` / `severe` | lower_is_better |
| `lipid` (Chol, LDL, TG) | `optimal` / `borderline` / `eleve` / `tres_eleve` | lower_is_better (sauf HDL : higher_is_better) |
| `hema` (Hb, Ht) | `bas` / `normal` / `haut` | range_is_normal (sex-specific) |

Exemples concrets :

- **Vit D** (vitamin, higher_is_better) : optimal ≥ 30 ng/mL · deficience 20–30 · carence 10–20 · avitaminose < 10
- **CRP us** (inflammation, lower_is_better) : optimal ≤ 1 mg/L · leger 1–3 · modere 3–10 · severe > 10
- **Estradiol** (hormone_sex, range, F-folliculaire) : low < 30 pg/mL · normal 30–120 · high > 120
- **ASAT** (liver, lower_is_better) : optimal < 25 UI/L · leger 25–35 · modere 35–60 · severe > 60
- **HbA1c** (metabolism, lower_is_better) : optimal < 5.4% · leger 5.4–5.7 · modere 5.7–6.5 · severe > 6.5

**Hormones féminines à phase variable** (Œstradiol, Progestérone, LH, FSH, 17-OH-prog) : zones définies par phase (`folliculaire | ovulatoire | luteale | menopause`). Le coach saisit la phase manuellement à la validation (pas d'auto-détection).

#### 3.2.2. Structure TypeScript

```ts
export type BloodtestPreset = 'basic' | 'hormonal_plus' | 'total'

export type BloodtestCategory =
  | 'hema' | 'iron' | 'vitamin' | 'mineral'
  | 'hormone_sex' | 'thyroid' | 'inflammation' | 'metabolism' | 'liver' | 'lipid'

export type ZoneSeverity = 1 | 2 | 3 | 4   // 1=best/optimal, 4=worst/critical

export type ZoneBand = {
  label: string                              // 'optimal' | 'deficience' | 'low' | 'normal' | 'high' | 'severe' | etc.
  severity: ZoneSeverity                     // for color mapping
  min?: number                               // inclusive lower bound (omit for "below all" band)
  max?: number                               // exclusive upper bound (omit for "above all" band)
}

export type ZoneConfig = {
  direction: 'higher_is_better' | 'lower_is_better' | 'range_is_normal'
  bands: ZoneBand[]                          // ordered, contiguous, cover the value space
}

export type SexSpecificZones = {
  male?: ZoneConfig
  female?: ZoneConfig
  female_by_phase?: Partial<Record<'folliculaire' | 'ovulatoire' | 'luteale' | 'menopause', ZoneConfig>>
}

export type BloodtestMarker = {
  key: string
  label: string
  unit_canonical: string
  unit_aliases: string[]
  category: BloodtestCategory
  zones: ZoneConfig | { sex_specific: SexSpecificZones }
  presets: BloodtestPreset[]
  supplementation?: {
    forms: string[]
    dosage_general: string
    timing: string
  }
  notes?: string
}
```

Exemples :

```ts
// Vit D : higher_is_better, vocab vitamine
{
  key: 'vitamine_d', label: 'Vitamine D', unit_canonical: 'ng/mL', /* ... */
  zones: {
    direction: 'higher_is_better',
    bands: [
      { label: 'optimal',     severity: 1, min: 30 },
      { label: 'deficience',  severity: 2, min: 20, max: 30 },
      { label: 'carence',     severity: 3, min: 10, max: 20 },
      { label: 'avitaminose', severity: 4,          max: 10 },
    ],
  },
}

// CRP us : lower_is_better, vocab inflammation
{
  key: 'crp_us', label: 'CRP ultrasensible', unit_canonical: 'mg/L', /* ... */
  zones: {
    direction: 'lower_is_better',
    bands: [
      { label: 'optimal', severity: 1,         max: 1 },
      { label: 'leger',   severity: 2, min: 1,  max: 3 },
      { label: 'modere',  severity: 3, min: 3,  max: 10 },
      { label: 'severe',  severity: 4, min: 10 },
    ],
  },
}

// Estradiol femme par phase : sex_specific avec female_by_phase
{
  key: 'estradiol_e2', label: 'Estradiol (E2)', unit_canonical: 'pg/mL', /* ... */
  zones: { sex_specific: {
    male: { direction: 'range_is_normal', bands: [
      { label: 'low',    severity: 3,        max: 10 },
      { label: 'normal', severity: 1, min: 10, max: 40 },
      { label: 'high',   severity: 3, min: 40 },
    ]},
    female_by_phase: {
      folliculaire: { direction: 'range_is_normal', bands: [
        { label: 'low',    severity: 3,         max: 30 },
        { label: 'normal', severity: 1, min: 30,  max: 120 },
        { label: 'high',   severity: 3, min: 120 },
      ]},
      ovulatoire:   { direction: 'range_is_normal', bands: [/* 130–370 */] },
      luteale:      { direction: 'range_is_normal', bands: [/* 70–250 */] },
      menopause:    { direction: 'range_is_normal', bands: [/* 5–30 */] },
    },
  }},
}
```

#### 3.2.3. Markers — preset `basic` (~10)

Athlète sans soucis particuliers, suivi de routine 2x/an :

| Key | Label | Unit | Zones (higher_is_better) | Presets |
|---|---|---|---|---|
| `hemoglobine` | Hémoglobine | g/L | déf < 130, car < 120, avit < 110 (homme : déf < 140, car < 130) | basic, h+, total |
| `ferritine` | Ferritine | µg/L | déf < 50, car < 30, avit < 15 | basic, h+, total |
| `fer_serique` | Fer sérique | µmol/L | déf < 12, car < 9, avit < 6 | basic, h+, total |
| `vitamine_d` | Vitamine D (25-OH-D) | ng/mL | déf < 30, car < 20, avit < 10 | basic, h+, total |
| `b12` | Vitamine B12 | pmol/L | déf < 250, car < 150, avit < 75 | basic, h+, total |
| `folates_b9` | Folates (B9) | nmol/L | déf < 1300, car < 800, avit < 300 | basic, h+, total |
| `magnesium_serique` | Magnésium sérique | mmol/L | déf < 0.75, car < 0.65, avit < 0.55 | basic, h+, total |
| `tsh_us` | TSH ultrasensible | mUI/L | range 0.4–4.0 | basic, h+, total |
| `crp_us` | CRP ultrasensible | mg/L | déf > 1, car > 3, avit > 10 (`lower_is_better`) | basic, h+, total |

#### 3.2.4. Markers — preset `hormonal+` ajoute (~15)

Femme avec irrégularités cycle / suspicion hormonale, sportive haute intensité :

| Key | Label | Unit | Zones | Presets |
|---|---|---|---|---|
| `estrone_e1` | Estrone (E1) | pg/mL | range 30–200 (femme) | h+, total |
| `estradiol_e2` | Estradiol (E2) | pg/mL | sex+phase: F-folliculaire 30–120, F-ovulatoire 130–370, F-lutéale 70–250, F-ménopause 5–30, M 10–40 | h+, total |
| `estriol_e3` | Estriol (E3) | ng/mL | range 0.5–10 (hors grossesse) | h+, total |
| `progesterone` | Progestérone | ng/mL | sex+phase: F-folliculaire < 1, F-lutéale 5–25, F-ménopause < 1 | h+, total (à doser jour ~21 du cycle) |
| `lh` | LH | UI/L | sex+phase: F-folliculaire 2–10, F-pic ovu 20–100, F-lutéale 1–10, F-ménopause 15–60, M 1.5–9 | h+, total |
| `fsh` | FSH | UI/L | sex+phase: F-folliculaire 3–10, F-ménopause > 25, M 1.5–12 | h+, total |
| `shbg` | SHBG | nmol/L | range F: 18–144, M: 13–71 | h+, total |
| `testosterone_totale` | Testostérone totale | ng/mL | range F: 0.1–0.7, M: 2.5–9 | h+, total |
| `testosterone_libre` | Testostérone libre | pg/mL | range F: 0.5–4.5, M: 50–200 | h+, total |
| `dhea_s` | DHEA-S | µg/dL | range F: 35–430, M: 80–560 (variable âge) | h+, total |
| `androstenedione` | Androstènedione | ng/mL | range F: 0.4–3.4, M: 0.5–3.0 | h+, total |
| `oh17_progesterone` | 17-OH-progestérone | ng/mL | range F-folliculaire < 1, F-lutéale < 4, M < 2 | h+, total |
| `prolactine` | Prolactine | µg/L | range F: 4–25, M: 4–15 | h+, total |
| `ft4` | T4 libre (FT4) | pmol/L | range 9–22 | h+, total |
| `ft3` | T3 libre (FT3) | pmol/L | range 3–7 | h+, total |
| `anti_tpo` | Anti-TPO | UI/mL | range < 35 (`lower_is_better`, four_zone : déf > 35, car > 100, avit > 500) | h+, total |
| `anti_tg` | Anti-thyroglobuline | UI/mL | range < 40 (idem) | h+, total |

#### 3.2.5. Markers — preset `total` ajoute (~10)

Bilan complet check-up annuel ou si hormonal+ pas concluant :

| Key | Label | Unit | Zones | Presets |
|---|---|---|---|---|
| `vitamine_e` | Vitamine E | µmol/L | déf < 20, car < 8, avit < 5 | total |
| `magnesium_erythrocytaire` | Magnésium érythrocytaire | mmol/L | déf < 1.7, car < 1.5, avit < 1.3 | total (préféré au sérique si dispo) |
| `zinc` | Zinc | µmol/L | déf < 11, car < 8, avit < 3 | total |
| `cuivre` | Cuivre | µmol/L | déf < 13, car < 8, avit < 5 | total |
| `selenium` | Sélénium | µg/L | déf < 80, car < 60, avit < 30 | total |
| `transferrine` | Transferrine | g/L | range 2.0–3.6 | total |
| `cft_tibc` | CFT / TIBC (capacité totale fixation fer) | µmol/L | range 45–80 | total |
| `coef_sat_transferrine` | Coefficient saturation transferrine | % | range 20–40 (déf < 20 = lower_is_better four_zone) | total |

> **Notes catalogue :**
> - Les zones ci-dessus sont un **draft initial** basé sur la pratique courante de médecine du sport et les standards labos courants. À valider/ajuster avec le coach avant freeze. Les valeurs féminines/masculines ont volontairement des plages distinctes (`sex_specific`).
> - Les phases du cycle pour les hormones féminines = `folliculaire | ovulatoire | luteale | menopause | postmenopause`. La sélection est manuelle côté coach lors de validation.
> - Iode (apport quotidien µg/jour), Vit A, Vit C, Omega 3 — **out of scope MVP**, ajoutables en custom marker.
> - Champ `supplementation` = info éducative pour le coach, surfacée dans la modale de validation marker. Données issues du référentiel coach (Notion). Phase 2 = recommandation auto post-validation.

#### 3.2.6. Helpers exposés par le catalog

```ts
export function getMarker(key: string): BloodtestMarker | undefined
export function getPresetMarkers(preset: BloodtestPreset): BloodtestMarker[]
export function classifyValue(marker: BloodtestMarker, value: number, ctx?: { sex?: 'M'|'F'; phase?: 'folliculaire'|'ovulatoire'|'luteale'|'menopause' }): { band: ZoneBand; zone_config: ZoneConfig } | { error: 'missing_phase' | 'missing_sex' | 'no_zones_for_context' }
export function severityColor(severity: ZoneSeverity): string  // 1=#22c55e, 2=#eab308, 3=#f97316, 4=#ef4444
```

### 3.3. Database

```sql
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS bloodtest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloodtest_tracked_markers jsonb NOT NULL DEFAULT '[]'::jsonb;
-- bloodtest_tracked_markers : array of marker_keys (built-in OR custom)

CREATE TABLE IF NOT EXISTS coach_custom_markers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marker_key      text NOT NULL,
  label           text NOT NULL,
  unit_canonical  text NOT NULL,
  category        text NOT NULL,
  default_zones   jsonb NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('higher_is_better','lower_is_better','range_is_better')),
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, marker_key)
);

CREATE TABLE IF NOT EXISTS bloodtest_uploads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  uploaded_by         text NOT NULL CHECK (uploaded_by IN ('athlete','coach')),
  uploader_user_id    uuid NOT NULL,
  file_path           text NOT NULL,
  dated_at            date,
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  validated_at        timestamptz,
  validated_by        uuid,
  extracted_data      jsonb,
  validated_data      jsonb,
  ai_extraction_meta  jsonb,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloodtest_uploads_athlete
  ON bloodtest_uploads (athlete_id, dated_at DESC NULLS LAST)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bloodtest_uploads_pending
  ON bloodtest_uploads (athlete_id, uploaded_at DESC)
  WHERE archived_at IS NULL AND validated_at IS NULL;
```

### 3.4. RLS

```sql
ALTER TABLE bloodtest_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_custom_markers ENABLE ROW LEVEL SECURITY;

-- bloodtest_uploads : athlète SELECT ses propres validés uniquement, INSERT, DELETE pré-validation
CREATE POLICY bloodtest_select_self ON bloodtest_uploads
  FOR SELECT USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

CREATE POLICY bloodtest_insert_self ON bloodtest_uploads
  FOR INSERT WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND uploaded_by = 'athlete'
    AND uploader_user_id = auth.uid()
    AND validated_at IS NULL
  );

CREATE POLICY bloodtest_delete_pre_validation ON bloodtest_uploads
  FOR DELETE USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND validated_at IS NULL
  );

-- bloodtest_uploads : coach SELECT/INSERT/UPDATE/DELETE sur ses athlètes
CREATE POLICY bloodtest_coach_all ON bloodtest_uploads
  FOR ALL USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- coach_custom_markers : coach own only
CREATE POLICY ccm_coach_all ON coach_custom_markers
  FOR ALL USING (coach_id = auth.uid());
```

### 3.5. Storage bucket

`coach-bloodtest` (privé). Path conventions :
- Athlète upload : `{athlete_user_id}/{ts}.pdf`
- Coach upload : `coach/{coach_user_id}/{athlete_id}/{ts}.pdf`

API routes valident côté serveur que le `file_path` envoyé matche le pattern + que l'objet existe (cf pattern `/api/videos/save-retour`).

### 3.6. Statuts dérivés

- `pending_validation` : `extracted_data IS NOT NULL AND validated_at IS NULL`
- `validated` : `validated_at IS NOT NULL`
- `extraction_failed` : `extracted_data IS NULL AND uploaded_at < now() - interval '5 minutes'` (timeout)

L'athlète ne voit dans ses graphs que les uploads `validated` (filtre `validated_at IS NOT NULL` côté query).

---

## 4. UI Athlète

### 4.1. Entrée

Dans `ProfilScreen.js`, MENU_ITEMS : "Prise de sang" (icône `water-outline`), gated par `athlete.bloodtest_enabled`. Tap → push `BloodtestScreen`.

### 4.2. Écran principal `BloodtestScreen`

États :

1. **Pas d'upload** : carte CTA "Upload ton bilan sanguin" + lecture du dernier état "Aucun bilan transmis". Bouton "+ Upload PDF".
2. **Au moins 1 upload validé** : grid des marqueurs trackés, chacun avec mini-graph (sparkline) + dernière valeur + couleur zone. Tap marqueur → fullscreen graph détaillé.
3. **Upload pending validation** : carte "En attente de validation coach" avec date upload, valeurs extraites en read-only (athlète peut voir ce que l'IA a trouvé). Bouton "Supprimer" si seul lui peut delete (validated_at IS NULL).

Composants :
- `BloodtestScreen.js` (~400 lignes attendues)
- `BloodtestMarkerChart.js` (chart.js wrapper RN, ou `react-native-svg-charts`) — fullscreen line chart par marqueur

### 4.3. Flow upload

- Tap "+ Upload PDF" → `expo-document-picker` ouvre le sélecteur PDF
- Athlète sélectionne le fichier → upload vers Supabase Storage `coach-bloodtest/{user_id}/{ts}.pdf`
- POST `/api/bloodtest/extract` (Bearer JWT athlète) → server-side extract via Claude
- Retour réussi → l'écran principal montre la nouvelle entrée "En attente de validation"
- Notification push optionnelle au coach (Phase 2)

### 4.4. Flow delete pré-validation

- Sur une carte "En attente de validation", bouton "Supprimer"
- Confirmation modale → DELETE row + cleanup storage best-effort (DB-first per lessons.md)

---

## 5. UI Coach

### 5.1. Route

`/athletes/[id]/bloodtest` (parallèle à posing/fodmap). Ajouter aux TABS du layout.

### 5.2. Composants

- `app/(app)/athletes/[id]/bloodtest/page.tsx`
- Sections :
  - Toggle `bloodtest_enabled` + sélecteur preset (radio: basic / hormonal_plus / total / custom)
  - Liste des marqueurs trackés avec checkboxes (toggle on/off)
  - Bouton "+ Ajouter un marqueur custom" → modal
  - Section "À valider" : queue des uploads `extracted_data IS NOT NULL AND validated_at IS NULL`, 1 card par upload
  - Section "Historique" : graphs des marqueurs trackés (line chart, X = dated_at, Y = valeur, bandes colorées zones)
  - Bouton "+ Upload PDF" (coach upload pour son athlète, ex : reçu par mail)

### 5.3. Validation queue (split-view)

Tap un upload "à valider" → page `/athletes/[id]/bloodtest/validate/[upload_id]` :

- Layout 2 colonnes (desktop) : PDF preview gauche (signed URL via API), JSON éditable droite
- JSON éditable : tableau des marqueurs extraits par l'IA, colonnes :
  - Marker key (dropdown : built-in markers + custom + "Ignorer cette ligne")
  - Valeur (input numérique éditable)
  - Unité (dropdown : unit_canonical + unit_aliases du marker sélectionné)
  - Plage de référence labo (texte read-only)
  - Action : "Conserver" (default) / "Ignorer"
- Date du bilan (`dated_at`) : input date, pré-rempli par l'IA si lue dans le PDF
- Bouton "Valider et publier" → POST `/api/bloodtest/validate` → écrit `validated_data`, `validated_at`, `validated_by` → redirect retour à `/athletes/[id]/bloodtest`
- Bouton "Refaire l'extraction" : ré-appelle Claude (rare, si l'IA a totalement raté)
- Bouton "Rejeter ce PDF" : `archived_at = now()` (ne sera plus dans la queue)

### 5.4. Custom markers modal

Modal avec form :
- key (slug auto-généré depuis label) : input read-only
- label : input texte
- unit_canonical : input texte
- category : dropdown (hema/iron/...)
- direction : radio
- default_zones : 2 inputs (moyen_max, bon_max)
- Submit → INSERT `coach_custom_markers`
- Le marker custom apparaît immédiatement dans la liste de toggle pour tous les athlètes du coach.

---

## 6. Data flow / lifecycle

```
Coach toggle ON ─► athletes.bloodtest_enabled = true
                  + athletes.bloodtest_tracked_markers = PRESETS.basic (par défaut)

Athlète upload PDF ─► storage.upload(coach-bloodtest/{user_id}/{ts}.pdf)
                  ─► INSERT bloodtest_uploads (uploaded_by='athlete', extracted_data=null)
                  ─► POST /api/bloodtest/extract { upload_id }
                       └─► API : signed URL → fetch PDF → Claude API
                       └─► UPDATE extracted_data, ai_extraction_meta
                  ─► côté athlète : carte "en attente de validation"

Coach valide ─► /athletes/[id]/bloodtest/validate/[upload_id]
            ─► review extracted_data, edit, set dated_at
            ─► POST /api/bloodtest/validate
                 └─► UPDATE validated_data, validated_at, validated_by
            ─► athlète refresh ─► nouveaux points sur les graphs

Coach modifie le panel ─► UPDATE athletes.bloodtest_tracked_markers
                      ─► athlète refresh ─► graphs filtrés selon le nouveau panel
                      ─► les anciennes valeurs validées restent dans validated_data,
                          juste plus affichées si marker retiré du panel

Coach ajoute custom marker ─► INSERT coach_custom_markers
                           ─► visible immédiatement dans la liste toggle de tous ses athlètes
```

---

## 7. Edge cases

| Cas | Comportement |
|---|---|
| Upload non-PDF | Refusé client-side (file picker filter) + server-side (mime check). |
| PDF corrompu / vide | Claude retourne `{ markers: [] }` → UI "Aucun marqueur trouvé" → bouton "Refaire" ou "Rejeter". |
| PDF non médical (CV, photo) | Idem cas vide. Coach rejette manuellement. |
| Marqueur extrait pas dans catalogue | IA peut soit le mapper à `other`, soit retourner `marker_key: null, raw_label: "..."`. UI permet au coach de mapper à un marker existant ou "Ignorer". |
| Unité différente de canonical | IA tente de convertir vers canonical (consigne dans le prompt). Si impossible, retourne raw unit + null value. Coach corrige manuellement. |
| Date non lue par l'IA | `dated_at = null`, l'UI valide demande au coach de la saisir avant publication. |
| Athlète change `dated_at` impossible | L'athlète ne peut pas définir `dated_at`. Seul le coach lors de validation. |
| 2 uploads même date | Pas de contrainte UNIQUE. Le graph affiche 2 points à la même date — acceptable. |
| Coach toggle OFF avec uploads | Uploads conservés, juste UI masquée. Re-ON → tout réapparaît. |
| Coach delete custom marker utilisé dans un panel | `archived_at = now()`. Le panel le garde dans tracked_markers (clé orpheline) → UI affiche "marker inconnu" + offre de retirer. |
| Taille PDF > 10 MB | Refus côté API (limite Claude API). Athlète notifié. |
| Athlète change d'app version pendant upload | Upload résiliable : si bloodtest_uploads INSERT OK mais extract pas encore appelé, un cron ou bouton "Re-extraire" peut récupérer. |
| Plusieurs uploads en parallèle (queue) | Pas de problème (UNIQUE pas requis sur upload_id). |
| Rate limit | API server-side : max 1 upload/heure/athlète + 5/heure/coach. |

---

## 8. Testing

### 8.1. Unit tests

- Catalogue : 30+ markers, tous présents dans au moins 1 preset, `unit_canonical` non vide, `default_zones.bon_max >= moyen_max` cohérent par direction
- Catalog snapshot : ATHLETE/`bloodtestCatalog.js` et COACH/`bloodtestCatalog.ts` parité (mêmes clés/valeurs)
- `deriveZone(marker, value)` → 'moyen' | 'bon' | 'tres_bon'
- `applyMarkerToggle(markers, key, on)` → updated array
- `formatPdfPath(userId, ts)` → string

### 8.2. RLS tests

- Athlète A SELECT bloodtest_uploads de athlète B → 0 rows
- Athlète tente DELETE après validation → bloqué par RLS
- Athlète tente INSERT avec `uploaded_by='coach'` → bloqué par WITH CHECK
- Coach C SELECT/UPDATE/DELETE sur ses athlètes → OK

### 8.3. API integration tests

- POST `/api/bloodtest/upload` non auth → 401
- POST `/api/bloodtest/extract` avec upload_id pas du coach/athlète → 403
- Mock Claude : retourner JSON valide → extracted_data écrit
- Mock Claude : retourner JSON invalide → erreur captée, `ai_extraction_meta.error` écrit, status conservé pour retry
- POST `/api/bloodtest/validate` non auth → 401
- POST `/api/bloodtest/validate` par un autre coach → 403

### 8.4. E2E manuel (preview)

- Activer bloodtest côté coach → écran apparaît côté athlète
- Athlète upload PDF test → vérifier extraction non vide après ~10s
- Coach ouvre validation queue → split-view OK, edit valeur → submit → vérifier `validated_data` en DB
- Athlète refresh → nouveau point sur graphs
- Coach toggle OFF un marker → graph correspondant disparaît
- Coach ajoute custom marker → apparaît dans liste, peut être assigné à un upload validé existant via re-edit
- Athlète tente de delete un upload validé → bloqué
- Athlète delete un upload pending → OK, storage cleanup

---

## 9. Migration & rollout

### 9.1. SQL migration

`sql/2026-05-XX-bloodtest.sql` :
- ALTER `athletes` ADD `bloodtest_enabled` + `bloodtest_tracked_markers`
- CREATE TABLE `coach_custom_markers`
- CREATE TABLE `bloodtest_uploads`
- INDEX
- ENABLE RLS + policies
- Storage bucket `coach-bloodtest` à créer manuellement dans Supabase Studio (privé, max file size 10 MB, allowed mime: `application/pdf`)

### 9.2. Env vars

- `ANTHROPIC_API_KEY` à ajouter à Vercel COACH (preview + production), via `vercel env add`. **JAMAIS commit, JAMAIS exposer côté client.**

### 9.3. Code rollout

- 1 PR par repo (ATHLETE + COACH), deux branches `feature/bloodtest`
- Test E2E preview avec un PDF test fourni par le coach
- Cascade preview → develop → main par le workflow habituel
- ATHLETE : si `expo-document-picker` pas déjà dans deps, c'est une **modif native** → eas build + submit, pas eas update simple. Vérifier en amont.

### 9.4. Pas de backfill

Toutes les données nouvelles. `bloodtest_enabled` default false → personne impacté.

---

## 10. Phase 2 hardening (hors MVP)

- Synthèse texte IA au lieu de juste flag (paragraph par upload, généré post-validation)
- Comparaison vs PDF précédent automatique
- Recommandations supplémentation (avec disclaimer médical)
- Notification push coach quand athlète upload (pré-validation queue alert)
- Notification push athlète quand coach valide
- GDPR consentement explicite à l'onboarding athlète + page export/suppression
- Audit trail des modifications post-validation (table `bloodtest_validation_history`)
- Conversion automatique d'unités exotiques (pmol/L vs ng/dL, etc.) — table de conversion par marker
- Export PDF récap des graphs pour partage avec médecin
- Import CSV de markers depuis app médicale tierce
- Vue cross-athlètes coach `/bloodtest` (KPIs flotte, alertes seuils)
- Photo de symptômes liés
- Rappels automatiques de prise de sang (chaque 6 mois)

---

## 11. Anti-patterns à éviter (lessons.md)

- **RLS** : tester chaque policy avec un compte athlète + coach explicite avant push
- **Catalog drift ATHLETE/COACH** : test snapshot CI dès le J1
- **`select('*')` sur bloodtest_uploads** : interdit, le `extracted_data` peut être lourd (5-30 KB) → liste avec colonnes minimales, fetch full row sur demande (validation page)
- **Storage cleanup** : DB-first, storage best-effort sur DELETE (per lessons.md)
- **API key Anthropic côté client** : interdit. Server-only env var.
- **Path-phishing** : valider que `file_path` matche `${user_id}/...` ou `coach/${coach_id}/${athlete_id}/...` AVANT d'écrire en DB.
- **Direct Anthropic call depuis l'app athlète** : interdit. Tout passe par `/api/bloodtest/extract`.
- **Pas de rate limit** : risque de spam → drain tokens Anthropic.

---

## 12. Risques

- **Adhésion** : la friction "uploader un PDF" est plus haute que "logger une portion FODMAP". Si l'athlète ne le fait pas, le coach upload pour lui (déjà prévu).
- **Hallucination IA sur valeurs** : Haiku est cheap mais peut se gourrer. Workflow validation coach mitige. Si trop d'erreurs, switch à Sonnet (5x plus cher mais plus précis).
- **Hétérogénéité PDF labos** : certains labos (étrangers, lab privés exotiques) peuvent avoir des layouts qui plantent l'extraction. Workflow rejet/re-extract gère.
- **Coût IA non monitoré** : si un athlète upload 100 PDFs malicieusement (ou un dev en test), peut coûter $5-10. Rate limit + log token usage par athlète/coach pour visibilité.
- **Données médicales sensibles** : RLS strict + path validation + retention 1 an. À documenter dans le CGU.
- **Catalogue marqueurs draft** : le draft section 3.2 est basé sur la pratique courante, pas sur ta liste exacte. À valider avant freeze.
