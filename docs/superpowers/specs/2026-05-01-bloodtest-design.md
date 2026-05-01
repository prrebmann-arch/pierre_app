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

Table seed côté code (pas DB), mêmes raisons que FODMAP catalog :
- ATHLETE : `src/utils/bloodtestCatalog.js`
- COACH : `lib/bloodtestCatalog.ts`
- Test snapshot CI vérifie parité.

Structure :

```ts
export type BloodtestPreset = 'basic' | 'hormonal_plus' | 'total'

export type BloodtestMarker = {
  key: string                  // e.g. 'hemoglobine'
  label: string                // 'Hémoglobine'
  unit_canonical: string       // 'g/L'
  unit_aliases: string[]       // ['g/dL', 'g/dl'] — IA mapping
  category: 'hema' | 'iron' | 'hormone' | 'vitamin' | 'metabolic' | 'liver' | 'lipid' | 'mineral' | 'other'
  default_zones: { moyen_max: number; bon_max: number }
  // moyen = below moyen_max, bon = below bon_max, tres_bon = above bon_max
  // ou inverse selon le marqueur (cf direction)
  direction: 'higher_is_better' | 'lower_is_better' | 'range_is_better'
  presets: BloodtestPreset[]   // dans quels presets ce marqueur apparait par défaut
}

export const MARKERS: BloodtestMarker[] = [
  // basic
  { key: 'hemoglobine', label: 'Hémoglobine', unit_canonical: 'g/L', unit_aliases: ['g/dL'], category: 'hema', default_zones: { moyen_max: 130, bon_max: 145 }, direction: 'higher_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'hematocrite', label: 'Hématocrite', unit_canonical: '%', unit_aliases: [], category: 'hema', default_zones: { moyen_max: 38, bon_max: 45 }, direction: 'range_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'ferritine', label: 'Ferritine', unit_canonical: 'µg/L', unit_aliases: ['ng/mL','µg/l'], category: 'iron', default_zones: { moyen_max: 30, bon_max: 100 }, direction: 'higher_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'fer_serique', label: 'Fer sérique', unit_canonical: 'µmol/L', unit_aliases: [], category: 'iron', default_zones: { moyen_max: 12, bon_max: 25 }, direction: 'higher_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'vitamine_d', label: 'Vitamine D (25-OH-D)', unit_canonical: 'ng/mL', unit_aliases: ['nmol/L'], category: 'vitamin', default_zones: { moyen_max: 30, bon_max: 60 }, direction: 'higher_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'tsh', label: 'TSH', unit_canonical: 'mUI/L', unit_aliases: ['mIU/L'], category: 'hormone', default_zones: { moyen_max: 1.5, bon_max: 3.0 }, direction: 'range_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'crp', label: 'CRP', unit_canonical: 'mg/L', unit_aliases: [], category: 'metabolic', default_zones: { moyen_max: 3, bon_max: 1 }, direction: 'lower_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'creatinine', label: 'Créatinine', unit_canonical: 'µmol/L', unit_aliases: ['mg/L'], category: 'metabolic', default_zones: { moyen_max: 90, bon_max: 110 }, direction: 'range_is_better', presets: ['basic','hormonal_plus','total'] },
  { key: 'glycemie', label: 'Glycémie à jeun', unit_canonical: 'g/L', unit_aliases: ['mmol/L'], category: 'metabolic', default_zones: { moyen_max: 1.0, bon_max: 0.95 }, direction: 'lower_is_better', presets: ['basic','hormonal_plus','total'] },
  // hormonal+ (en plus du basic)
  { key: 'testosterone_totale', label: 'Testostérone totale', unit_canonical: 'ng/mL', unit_aliases: ['nmol/L'], category: 'hormone', default_zones: { moyen_max: 4, bon_max: 6 }, direction: 'higher_is_better', presets: ['hormonal_plus','total'] },
  { key: 'cortisol', label: 'Cortisol matinal', unit_canonical: 'µg/dL', unit_aliases: ['nmol/L'], category: 'hormone', default_zones: { moyen_max: 10, bon_max: 18 }, direction: 'range_is_better', presets: ['hormonal_plus','total'] },
  { key: 'oestradiol', label: 'Œstradiol', unit_canonical: 'pg/mL', unit_aliases: ['pmol/L'], category: 'hormone', default_zones: { moyen_max: 50, bon_max: 200 }, direction: 'range_is_better', presets: ['hormonal_plus','total'] },
  { key: 'igf1', label: 'IGF-1', unit_canonical: 'ng/mL', unit_aliases: [], category: 'hormone', default_zones: { moyen_max: 150, bon_max: 250 }, direction: 'higher_is_better', presets: ['hormonal_plus','total'] },
  { key: 'lh', label: 'LH', unit_canonical: 'UI/L', unit_aliases: ['IU/L'], category: 'hormone', default_zones: { moyen_max: 4, bon_max: 8 }, direction: 'range_is_better', presets: ['hormonal_plus','total'] },
  { key: 'fsh', label: 'FSH', unit_canonical: 'UI/L', unit_aliases: ['IU/L'], category: 'hormone', default_zones: { moyen_max: 5, bon_max: 10 }, direction: 'range_is_better', presets: ['hormonal_plus','total'] },
  { key: 't3_libre', label: 'T3 libre', unit_canonical: 'pg/mL', unit_aliases: ['pmol/L'], category: 'hormone', default_zones: { moyen_max: 3, bon_max: 4.5 }, direction: 'range_is_better', presets: ['hormonal_plus','total'] },
  { key: 't4_libre', label: 'T4 libre', unit_canonical: 'ng/dL', unit_aliases: ['pmol/L'], category: 'hormone', default_zones: { moyen_max: 1.0, bon_max: 1.6 }, direction: 'range_is_better', presets: ['hormonal_plus','total'] },
  // total (en plus de hormonal+)
  { key: 'magnesium', label: 'Magnésium', unit_canonical: 'mmol/L', unit_aliases: ['mg/L'], category: 'mineral', default_zones: { moyen_max: 0.75, bon_max: 0.95 }, direction: 'higher_is_better', presets: ['total'] },
  { key: 'zinc', label: 'Zinc', unit_canonical: 'µmol/L', unit_aliases: ['µg/dL'], category: 'mineral', default_zones: { moyen_max: 11, bon_max: 16 }, direction: 'higher_is_better', presets: ['total'] },
  { key: 'b12', label: 'Vitamine B12', unit_canonical: 'pg/mL', unit_aliases: ['pmol/L'], category: 'vitamin', default_zones: { moyen_max: 300, bon_max: 600 }, direction: 'higher_is_better', presets: ['total'] },
  { key: 'folates', label: 'Folates', unit_canonical: 'ng/mL', unit_aliases: [], category: 'vitamin', default_zones: { moyen_max: 5, bon_max: 12 }, direction: 'higher_is_better', presets: ['total'] },
  { key: 'transferrine', label: 'Transferrine', unit_canonical: 'g/L', unit_aliases: [], category: 'iron', default_zones: { moyen_max: 2.0, bon_max: 3.5 }, direction: 'range_is_better', presets: ['total'] },
  { key: 'saturation_transferrine', label: 'Saturation transferrine', unit_canonical: '%', unit_aliases: [], category: 'iron', default_zones: { moyen_max: 20, bon_max: 35 }, direction: 'range_is_better', presets: ['total'] },
  { key: 'asat', label: 'ASAT', unit_canonical: 'UI/L', unit_aliases: [], category: 'liver', default_zones: { moyen_max: 35, bon_max: 25 }, direction: 'lower_is_better', presets: ['total'] },
  { key: 'alat', label: 'ALAT', unit_canonical: 'UI/L', unit_aliases: [], category: 'liver', default_zones: { moyen_max: 45, bon_max: 30 }, direction: 'lower_is_better', presets: ['total'] },
  { key: 'gamma_gt', label: 'Gamma-GT', unit_canonical: 'UI/L', unit_aliases: [], category: 'liver', default_zones: { moyen_max: 60, bon_max: 35 }, direction: 'lower_is_better', presets: ['total'] },
  { key: 'cholesterol_total', label: 'Cholestérol total', unit_canonical: 'g/L', unit_aliases: ['mmol/L'], category: 'lipid', default_zones: { moyen_max: 2.0, bon_max: 1.8 }, direction: 'lower_is_better', presets: ['total'] },
  { key: 'hdl', label: 'HDL', unit_canonical: 'g/L', unit_aliases: ['mmol/L'], category: 'lipid', default_zones: { moyen_max: 0.4, bon_max: 0.6 }, direction: 'higher_is_better', presets: ['total'] },
  { key: 'ldl', label: 'LDL', unit_canonical: 'g/L', unit_aliases: ['mmol/L'], category: 'lipid', default_zones: { moyen_max: 1.6, bon_max: 1.0 }, direction: 'lower_is_better', presets: ['total'] },
  { key: 'triglycerides', label: 'Triglycérides', unit_canonical: 'g/L', unit_aliases: ['mmol/L'], category: 'lipid', default_zones: { moyen_max: 1.5, bon_max: 1.0 }, direction: 'lower_is_better', presets: ['total'] },
  { key: 'hba1c', label: 'HbA1c', unit_canonical: '%', unit_aliases: ['mmol/mol'], category: 'metabolic', default_zones: { moyen_max: 5.7, bon_max: 5.4 }, direction: 'lower_is_better', presets: ['total'] },
]

export const PRESETS: Record<BloodtestPreset, string[]> = {
  basic:         MARKERS.filter((m) => m.presets.includes('basic')).map((m) => m.key),
  hormonal_plus: MARKERS.filter((m) => m.presets.includes('hormonal_plus')).map((m) => m.key),
  total:         MARKERS.filter((m) => m.presets.includes('total')).map((m) => m.key),
}
```

> Le catalogue ci-dessus est un **draft** basé sur les marqueurs courants en médecine du sport. À valider/ajuster avec le coach avant freeze.

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
