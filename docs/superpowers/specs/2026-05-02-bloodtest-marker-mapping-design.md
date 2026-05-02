# Bloodtest — Marker mapping IA + UX validation refondue

**Date** : 2026-05-02
**Repo** : COACH (mono-repo, ATHLETE non concerné)
**Statut** : Design validé, prêt pour plan

## 1. Problème

Aujourd'hui sur la page validation d'un bilan sanguin (`/athletes/[id]/bloodtest/validate/[upload_id]`), le coach reçoit ~60 lignes brutes extraites du PDF par Claude Haiku, sans aucune correspondance avec le catalogue Momentum. Pour chaque ligne, il doit :
- ouvrir un `<select>` de 34 markers standards + custom markers du coach
- choisir manuellement le bon marker_key
- répéter ~60 fois

C'est l'UX la plus chronophage de l'app côté coach. L'objectif est de la transformer en validation de quasi-confirmation.

## 2. Modèle mental cible

- Le coach a déjà défini en amont les markers qu'il suit pour cet athlète (via `athletes.bloodtest_tracked_markers`, infra existante).
- L'IA extrait le PDF ET fait elle-même le matching `raw_label → marker_key` en s'appuyant sur le catalogue.
- La page validation montre 3 sections : *attendus*, *extras détectés*, *non identifiés (replié)*.
- Les extras sont stockés one-shot dans le bilan, **pas** ajoutés au tracking permanent. S'ils reviennent au prochain bilan, leur graphe historique se construit naturellement via `union` sur tous les bilans validés.

## 3. Architecture des changements

### A. `/api/bloodtest/extract` — prompt enrichi + prompt caching

Le system prompt envoyé à Claude Haiku est étendu pour inclure :

- **Le catalogue complet** : pour chaque marker du `MARKERS` array de `lib/bloodtestCatalog.ts`, on injecte `(key, label, unit_canonical, unit_aliases)`. Idem pour les `coach_custom_markers` du coach concerné.
- **La liste `tracked_markers`** de l'athlète (les keys que le coach suit).

Le bloc catalogue est marqué `cache_control: { type: 'ephemeral' }` (Anthropic prompt caching). Comme le catalogue change rarement, ~95% des extractions hit le cache → coût réduit ~10× sur les input tokens.

Le shape de retour Claude évolue :

```jsonc
{
  "detected_dated_at": "2026-04-15",
  "markers": [
    {
      "raw_label": "Ferritine",
      "value": 45,
      "unit": "µg/L",
      "lab_reference_range": "30-300",

      // NOUVEAU — mapping IA
      "marker_key": "ferritine",          // null si pas matché
      "value_canonical": 45,               // valeur convertie dans unit_canonical (null si pas matché)
      "unit_canonical": "µg/L",            // copie du canonical du catalogue (null si pas matché)
      "matched_by_ai": true                // flag pour le badge UI
    }
  ]
}
```

Les champs `marker_key`, `value_canonical`, `unit_canonical`, `matched_by_ai` sont alimentés par Claude. Si Claude n'arrive pas à matcher (raw_label trop ambigu, marker hors catalogue), il met `marker_key: null` et le reste du mapping à `null`. Pas de migration DB : `extracted_data` est en jsonb, le shape évolue librement.

**Conversion d'unité** : Claude convertit la valeur dans l'unité canonique quand il connaît le mapping. Pour les conversions standard (µg/L ↔ ng/mL, mmol/L ↔ mg/dL), il a déjà la connaissance. Si l'unité est inconnue ou ambiguë, il garde `value_canonical = value` et flagge dans une note interne (pas exposée au coach v1).

### B. Page validation — 3 sections — `validate/[upload_id]/page.tsx`

Helper pur (`lib/bloodtest.ts`) :

```ts
export type MarkerSection = 'expected' | 'extra' | 'unidentified'

export function splitMarkers(
  markers: ExtractedMarker[],
  tracked: string[]
): {
  expected: { tracked_key: string; marker?: ExtractedMarker }[]   // taille = tracked.length, peut avoir marker undefined
  extras: ExtractedMarker[]                                        // marker_key set ET non dans tracked
  unidentified: ExtractedMarker[]                                  // marker_key null
}
```

UI :

```
┌─ Attendus (tracked_markers du coach)
│  ✓ Ferritine        45 µg/L         [auto-matché par IA]
│  ✓ Vitamine D       28 ng/mL        [auto-matché par IA]
│  ⚠ Testostérone     non trouvée dans le PDF
│  ...
├─ Extras détectés (markers du catalogue, hors tracked)
│  + B12              420 pg/mL       [auto-matché par IA]   [ valider ]
│  + CRP              0.4 mg/L        [auto-matché par IA]   [ valider ]
│  ...
└─ Non identifiés (12) ▶ déplier
   (replié par défaut, mapping manuel possible si ouvert)
```

Comportement détaillé :

- **Attendus** : la ligne s'affiche pour chaque entrée de `tracked_markers`. Si l'IA a trouvé une valeur → pré-rempli + badge "auto-matché par IA". Si non trouvé → affichage gris "non trouvé dans le PDF", aucune écriture en DB pour cette ligne.
- **Extras** : pré-remplis (valeur + unité canonique). Le coach doit cliquer "valider" pour qu'ils soient inclus dans `validated_data` — confirmation explicite obligatoire pour réduire le risque de mismatch silencieux. Aucun ajout à `tracked_markers`.
- **Non identifiés** : repliés derrière un compteur cliquable. Si déplié, chaque ligne a le `<select>` actuel pour mapping manuel + bouton "ignorer". Bouton bulk "Tout ignorer".
- **Persistance** : `validated_data.markers` ne contient QUE les markers avec un `marker_key` et une `value` non-null que le coach a confirmés (attendus auto-pré-validés + extras explicitement validés + non-identifiés mappés manuellement).

**Badge "auto-matché par IA"** : petit pill visuel (background bleu clair, texte 11px), placé à droite du nom. Au clic sur la ligne, le coach peut éditer le `marker_key` (le `<select>` réapparaît). Cliquer "Confirmer" sur la ligne enlève le badge.

### C. Page historique — `bloodtest/page.tsx`

Pour la liste des markers à grapher : **union de tous les `marker_key` apparaissant dans n'importe quel bilan validé de l'athlète** (pas juste `tracked_markers`).

```ts
const graphedKeys = new Set<string>()
for (const u of validatedUploads) {
  for (const m of u.validated_data.markers) {
    if (m.marker_key) graphedKeys.add(m.marker_key)
  }
}
```

Un marker avec 1 seul point apparaît avec un point isolé. C'est OK : un signal pour le coach qu'il a fait un test ponctuel. Pas de seuil minimum.

### D. Renommage bouton

`"Lancer extraction"` → `"Analyse IA"` partout (page bloodtest, toast d'auto-trigger après upload, validation page si applicable). Icône `fa-wand-magic-sparkles` au lieu de `fa-play`.

### E. Barre de chargement animée

Pendant l'appel `/api/bloodtest/extract` :

- **ETA initial** : moyenne des `ai_extraction_meta.duration_ms` des 10 derniers extracts du coach. Fallback 12_000 ms si pas d'historique. Calcul côté client au montage.
- **Animation** : barre progresse linéairement de 0% à 90% sur la durée ETA. À la réponse → 100% + checkmark. Si timeout (>60s) → barre rouge + bouton "Réessayer l'analyse IA".
- **Step labels** rotatifs toutes les 3s : *"Lecture du PDF" → "Extraction des marqueurs" → "Mapping vers le catalogue" → "Finalisation"*. Si la barre est à 90% sans réponse → label *"Toujours en cours, ça arrive…"*.
- **États dégradés** :
  - Erreur 502 (extraction failed) → toast erreur + label rouge "Échec de l'analyse" + bouton réessayer.
  - Timeout côté client (65s) → idem.
  - Réponse OK mais `markers.length === 0` → toast warning "Aucun marker détecté" + redirect validation.
- **Composant** : nouveau composant `<BloodtestAnalysisProgress eta={ms} onDone={() => …} />` dans `components/bloodtest/`.

## 4. Fichiers touchés

| Fichier | Changement |
|---|---|
| `app/api/bloodtest/extract/route.ts` | Nouveau system prompt avec catalogue + tracked_markers, `cache_control: ephemeral`, shape retour étendu |
| `app/(app)/athletes/[id]/bloodtest/page.tsx` | Bouton renommé "Analyse IA" + intégration `<BloodtestAnalysisProgress>` |
| `app/(app)/athletes/[id]/bloodtest/validate/[upload_id]/page.tsx` | UI 3 sections, badges, bouton "valider" pour extras, repli non-identifiés |
| `lib/bloodtest.ts` | Helper `splitMarkers(markers, tracked)`, types étendus |
| `components/bloodtest/BloodtestAnalysisProgress.tsx` | Nouveau composant barre + steps + états dégradés |
| `ARCHITECTURE.md` | Mise à jour des entrées bloodtest (nouveaux fichiers, nouveau shape) |

Hors scope :
- Pas de migration DB (`extracted_data` en jsonb absorbe le nouveau shape)
- Pas de changement côté ATHLETE (l'extraction est triggée server-side, l'athlète ne voit pas le bouton)
- Pas de re-analyse forcée des anciens uploads (à ajouter plus tard si besoin via `?force=true`)

## 5. Risques et mitigations

| Risque | Mitigation |
|---|---|
| Claude mismatche un marker (ex: cholestérol total → HDL) | Badge "auto-matché par IA" visible + obligation de "valider" explicite pour les extras |
| Coût input tokens élevé (catalogue ~3-4k tokens) | `cache_control: ephemeral` sur le bloc catalogue → ~95% hit rate |
| Conversion d'unités fausse | Si Claude ne sait pas convertir, il garde `value_canonical = value`. Le coach peut éditer la ligne (le `<select>` réapparaît). Anciens bilans gardent leurs unités raw — dette acceptée. |
| Anciens bilans cassent la nouvelle UI | `splitMarkers` traite `marker_key: null` → tout en "non identifiés". `matched_by_ai: undefined` → pas de badge. Pas de crash. |
| Barre de chargement bloquée à 90% | Label "Toujours en cours" + timeout 65s → erreur explicite + retry |
| Coach valide vite des extras erronés | Confirmation explicite par extra (pas d'auto-pré-validation comme les attendus) |

## 6. Tests manuels à faire

1. Upload PDF avec 60 markers, lancer "Analyse IA" → barre progresse, redirige vers validation
2. Sur validation : vérifier que les attendus sont pré-remplis, extras visibles, non-identifiés repliés
3. Cliquer un badge "auto-matché par IA" → select réapparaît, choisir un autre marker → confirmer
4. Valider un extra → présent dans `validated_data` après publication
5. Refuser tous les non-identifiés en bloc → DB ne contient pas ces lignes
6. Soumettre un bilan où une marker tracked est absente du PDF → "non trouvé" affiché, pas écrit en DB
7. Ouvrir un ancien bilan validé (avant migration) → s'affiche en mode legacy sans crash
8. Couper le réseau pendant l'analyse → barre rouge + bouton retry
9. Re-faire un bilan avec un extra du précédent → graphe avec 2 points visible sur la page historique
