# Edit Workout Log History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'athlète de modifier le log d'une séance dans une fenêtre de 7 jours après la séance, avec un badge "Édité" visible côté coach.

**Architecture:**
- Mutation directe de `workout_logs.exercices_completes` + flag `edited_at` (Approche 1 du spec)
- Fenêtre de 7j gérée par colonne générée `locked_at` + RLS Postgres
- Édition dans un écran dédié `EditWorkoutLogScreen` côté ATHLETE (Expo/RN)
- Badge `Édité` ajouté à la vue history côté COACH (Next.js)

**Tech Stack:** Supabase (Postgres + RLS + Storage), React Native (Expo SDK 54), React Navigation, Next.js 16 App Router (COACH).

**Spec source:** `docs/superpowers/specs/2026-04-29-edit-workout-log-history-design.md`

**Repos affectés :**
- `/Users/pierrerebmann/MOMENTUM/ATHLETE` — édition mobile + API client
- `/Users/pierrerebmann/MOMENTUM/COACH` — SQL migration + badge coach
- Supabase (DB + RLS) — exécution manuelle de la migration

**Note testing :** ni ATHLETE ni COACH n'ont de framework de test JS configuré. La vérification est manuelle (run app, click, observe) + tests SQL pour les RLS policies. Si un futur framework est ajouté, les tests pourront être backportés.

**Note workflow Git :** créer une branche `feature/edit-workout-log-history` depuis `develop` dans **chacun** des deux repos avant de commencer (cf. CLAUDE.md). PR séparées vers `develop`.

---

## Phase 0 — Vérifications préalables

Cette phase résout les open questions du spec §11.

### Task 0.1: Vérifier le schéma `exercices_completes`

**Files:** None (lecture DB seulement)

- [ ] **Step 1: Récupérer un log récent en SQL**

Dans Supabase SQL Editor, run:
```sql
SELECT exercices_completes
FROM workout_logs
ORDER BY created_at DESC
LIMIT 3;
```

Documenter dans le commit message le schéma observé. Format attendu (déjà confirmé via `WorkoutDetailScreen.js:49-54`):
```json
[
  {
    "nom": "Squat",
    "exercice_id": "uuid|null",
    "series": [
      { "reps": 8, "kg": 60, "...": "..." }
    ]
  }
]
```

Identifier précisément les champs présents dans une `serie` (reps, kg, durée, RPE, completed, type, etc.).

- [ ] **Step 2: Documenter le schéma**

Créer `docs/superpowers/notes/exercices-completes-schema.md` (dans repo COACH) avec un échantillon réel + liste des champs observés.

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git checkout -b feature/edit-workout-log-history develop
git add docs/superpowers/notes/exercices-completes-schema.md
git commit -m "docs: document exercices_completes JSON schema"
```

---

### Task 0.2: Vérifier la cascade `execution_videos.workout_log_id`

**Files:** None (lecture DB)

- [ ] **Step 1: Inspecter la FK**

Dans Supabase SQL Editor:
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'execution_videos'
  AND tc.constraint_type = 'FOREIGN KEY';
```

- [ ] **Step 2: Noter le résultat**

Si `delete_rule = CASCADE` → ne rien faire dans la migration §1.
Si `delete_rule = NO ACTION` ou autre → ajouter le ALTER dans la Task 1.1.

Documenter dans `docs/superpowers/notes/exercices-completes-schema.md` (append).

---

### Task 0.3: Confirmer la table d'exos pour ajout

**Files:** None

- [ ] **Step 1: Confirmer**

Le code existant utilise déjà `exercices` (pas `exercises`) — voir `src/api/workouts.js:35`. Pas d'action additionnelle.

`searchExercises(query, athleteId)` (workouts.js:180) existe déjà et cherche dans les exos des programmes de l'athlète. Pour la modal d'ajout, on utilisera cette fonction OU on créera une recherche directe sur la table `exercices` selon ce qui rend des résultats utiles. Décision: à la Task 3.6, après essai.

---

## Phase 1 — Migration SQL & RLS

### Task 1.1: Écrire la migration

**Files:**
- Create: `/Users/pierrerebmann/MOMENTUM/COACH/sql/edit_workout_log_history.sql`

- [ ] **Step 1: Créer le fichier SQL**

```sql
-- Migration: edit workout log history (7-day window)
-- Date: 2026-04-29
-- Adds edited_at + locked_at columns and RLS policies for athlete-side edits.

BEGIN;

-- 1. Columns
ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ
  GENERATED ALWAYS AS (
    COALESCE(started_at, created_at) + INTERVAL '7 days'
  ) STORED;

-- 2. RLS policies — assume RLS already enabled on workout_logs
DROP POLICY IF EXISTS "athlete can edit own unlocked logs" ON workout_logs;
CREATE POLICY "athlete can edit own unlocked logs" ON workout_logs
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at)
  WITH CHECK (athlete_id = auth.uid() AND now() < locked_at);

DROP POLICY IF EXISTS "athlete can delete own unlocked logs" ON workout_logs;
CREATE POLICY "athlete can delete own unlocked logs" ON workout_logs
  FOR DELETE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at);

COMMIT;
```

Si Task 0.2 a montré que la cascade FK n'est pas en place, ajouter avant le `COMMIT;` :

```sql
-- Ensure execution_videos cascade on workout_log delete
ALTER TABLE execution_videos
  DROP CONSTRAINT IF EXISTS execution_videos_workout_log_id_fkey;

ALTER TABLE execution_videos
  ADD CONSTRAINT execution_videos_workout_log_id_fkey
  FOREIGN KEY (workout_log_id)
  REFERENCES workout_logs(id)
  ON DELETE CASCADE;
```

- [ ] **Step 2: Tests RLS (SQL)**

Créer `/Users/pierrerebmann/MOMENTUM/COACH/sql/test_edit_workout_log_history.sql` :

```sql
-- Manual RLS test scenarios — run as superuser, then with auth.uid() set to test users
-- Expected results documented inline.

-- Pre-req: 2 athletes (A and B), 2 workout_logs (one for each)
-- Set up a recent log (within 7d) and an old log (>7d).

-- Test 1: Athlete A can update own recent log
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "<athlete_a_uuid>"}';
UPDATE workout_logs
  SET exercices_completes = '[]', edited_at = now()
  WHERE id = '<athlete_a_recent_log_id>';
-- Expected: 1 row updated.

-- Test 2: Athlete A cannot update old log
UPDATE workout_logs
  SET exercices_completes = '[]', edited_at = now()
  WHERE id = '<athlete_a_old_log_id>';
-- Expected: 0 rows updated.

-- Test 3: Athlete A cannot update Athlete B's log
UPDATE workout_logs
  SET exercices_completes = '[]', edited_at = now()
  WHERE id = '<athlete_b_log_id>';
-- Expected: 0 rows updated.

-- Test 4: Same matrix for DELETE
DELETE FROM workout_logs WHERE id = '<athlete_a_old_log_id>';
-- Expected: 0 rows deleted.

DELETE FROM workout_logs WHERE id = '<athlete_a_recent_log_id>';
-- Expected: 1 row deleted (cascade execution_videos).
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git add sql/edit_workout_log_history.sql sql/test_edit_workout_log_history.sql
git commit -m "feat(sql): add workout_logs edit window + RLS policies"
```

- [ ] **Step 4: Run la migration en dev (Supabase project dev)**

Coller le contenu de `edit_workout_log_history.sql` dans Supabase SQL Editor. Vérifier que `BEGIN/COMMIT` est respecté (pas d'erreur). Lancer ensuite `test_edit_workout_log_history.sql` après avoir substitué les UUIDs par des valeurs réelles.

Si toutes les assertions passent → continuer à la Phase 2.

---

## Phase 2 — ATHLETE: helpers et API

### Task 2.1: Helper `isLogEditable`

**Files:**
- Create: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/utils/workoutLog.js`

- [ ] **Step 1: Créer le helper**

```js
// src/utils/workoutLog.js
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isLogEditable(log) {
  if (!log) return false;

  // Use locked_at from DB if present (authoritative)
  if (log.locked_at) {
    return new Date(log.locked_at).getTime() > Date.now();
  }

  // Fallback: compute from started_at or created_at (defensive — DB should always provide locked_at)
  const ref = log.started_at || log.created_at;
  if (!ref) return false;
  return new Date(ref).getTime() + SEVEN_DAYS_MS > Date.now();
}

export function lockedAtDisplay(log) {
  if (!log?.locked_at) return null;
  return new Date(log.locked_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
```

- [ ] **Step 2: Vérifier manuellement**

Ouvrir le REPL Node ou un test script ad-hoc :
```js
const { isLogEditable } = require('./src/utils/workoutLog.js');
console.log(isLogEditable({ started_at: new Date().toISOString() })); // true
console.log(isLogEditable({ started_at: new Date(Date.now() - 8*24*60*60*1000).toISOString() })); // false
console.log(isLogEditable(null)); // false
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git checkout -b feature/edit-workout-log-history develop
git add src/utils/workoutLog.js
git commit -m "feat(workouts): add isLogEditable helper"
```

---

### Task 2.2: API `updateWorkoutLog`

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/api/workouts.js`

- [ ] **Step 1: Ajouter la fonction à la fin du fichier**

```js
// Add at end of src/api/workouts.js

export async function updateWorkoutLog(logId, exercicesCompletes) {
  const { data, error } = await supabase
    .from('workout_logs')
    .update({
      exercices_completes: exercicesCompletes,
      edited_at: new Date().toISOString(),
    })
    .eq('id', logId)
    .select('id, edited_at')
    .single();

  if (error) {
    // RLS denial typically returns "0 rows" or a specific code
    throw new Error(error.message || 'Erreur mise à jour log');
  }
  return data;
}
```

- [ ] **Step 2: Récupération de `locked_at` dans `getWorkoutLogs`**

Modifier la fonction `getWorkoutLogs` (workouts.js:106-119) pour inclure `edited_at` et `locked_at` dans le select :

Old: `.select('id, athlete_id, session_id, date, exercices_completes, session_name, started_at, finished_at, type, titre, created_at, workout_sessions(nom), execution_videos(count)')`

New: `.select('id, athlete_id, session_id, date, exercices_completes, session_name, started_at, finished_at, type, titre, created_at, edited_at, locked_at, workout_sessions(nom), execution_videos(count)')`

- [ ] **Step 3: Vérifier manuellement**

Run app, ouvrir un log existant dans `WorkoutDetailScreen`, ajouter un `console.log(log.locked_at, log.edited_at)` temporaire — vérifier que les valeurs arrivent bien (locked_at non null, edited_at null pour un log non édité).

Retirer le console.log avant commit.

- [ ] **Step 4: Commit**

```bash
git add src/api/workouts.js
git commit -m "feat(api): add updateWorkoutLog + select edited_at/locked_at"
```

---

### Task 2.3: API `deleteWorkoutLogEntirely`

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/api/workouts.js`
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/api/executionVideos.js` (peut-être réutiliser une fonction existante, voir step 1)

- [ ] **Step 1: Vérifier les fonctions existantes**

Lire `src/api/executionVideos.js` — identifier si une fonction expose la suppression de fichiers storage. Si oui, on la réutilise. Sinon on inline le storage cleanup dans `deleteWorkoutLogEntirely`.

- [ ] **Step 2: Ajouter la fonction**

À la fin de `src/api/workouts.js` :

```js
import { supabase } from '../lib/supabase';

export async function deleteWorkoutLogEntirely(logId) {
  // 1. Récupérer storage_paths AVANT delete (cascade détruit les rows execution_videos)
  const { data: videos, error: vErr } = await supabase
    .from('execution_videos')
    .select('storage_path')
    .eq('workout_log_id', logId);

  if (vErr) {
    throw new Error('Erreur lecture vidéos: ' + vErr.message);
  }

  // 2. DELETE workout_log (cascade execution_videos rows via FK)
  const { error: delErr } = await supabase
    .from('workout_logs')
    .delete()
    .eq('id', logId);

  if (delErr) {
    throw new Error('Erreur suppression séance: ' + delErr.message);
  }

  // 3. Best-effort cleanup storage (non bloquant)
  if (videos && videos.length > 0) {
    const paths = videos.map((v) => v.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: storageErr } = await supabase
        .storage
        .from('execution-videos') // adjust bucket name if different
        .remove(paths);
      if (storageErr) {
        console.warn('[deleteWorkoutLogEntirely] storage cleanup failed:', storageErr.message);
      }
    }
  }
}
```

**Important:** vérifier le nom exact du bucket storage en lisant `src/api/executionVideos.js`. S'il s'appelle différemment, ajuster.

- [ ] **Step 3: Vérifier manuellement**

Créer un log de test, ajouter une vidéo dessus via le flow normal, puis appeler `deleteWorkoutLogEntirely(logId)` depuis un bouton temp ou la console. Vérifier en SQL :
```sql
SELECT * FROM workout_logs WHERE id = '<logId>'; -- 0 rows
SELECT * FROM execution_videos WHERE workout_log_id = '<logId>'; -- 0 rows
```
Et vérifier dans Supabase Storage que les fichiers sont bien supprimés.

- [ ] **Step 4: Commit**

```bash
git add src/api/workouts.js
git commit -m "feat(api): add deleteWorkoutLogEntirely with cascade + storage cleanup"
```

---

## Phase 3 — ATHLETE: écran d'édition

### Task 3.1: Squelette `EditWorkoutLogScreen`

**Files:**
- Create: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/EditWorkoutLogScreen.js`

- [ ] **Step 1: Créer le squelette**

```jsx
// src/screens/EditWorkoutLogScreen.js
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { updateWorkoutLog, deleteWorkoutLogEntirely } from '../api/workouts';
import { isLogEditable } from '../utils/workoutLog';
import { colors, spacing, radius, fonts } from '../theme';

export default function EditWorkoutLogScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { log } = route.params || {};

  const [exercices, setExercices] = useState(() => {
    return JSON.parse(JSON.stringify(log?.exercices_completes || []));
  });
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => {
    return JSON.stringify(exercices) !== JSON.stringify(log?.exercices_completes || []);
  }, [exercices, log]);

  if (!log) {
    navigation.goBack();
    return null;
  }

  if (!isLogEditable(log)) {
    return (
      <View style={styles.lockedContainer}>
        <Text style={styles.lockedText}>Cette séance est verrouillée (plus de 7 jours).</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const handleCancel = () => {
    if (!isDirty) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Abandonner les modifications ?',
      'Tes changements seront perdus.',
      [
        { text: 'Continuer édition', style: 'cancel' },
        { text: 'Abandonner', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const handleSave = async () => {
    if (saving || !isDirty) return;
    setSaving(true);
    try {
      await updateWorkoutLog(log.id, exercices);
      Alert.alert('Enregistré', 'La séance a été mise à jour.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Impossible d\'enregistrer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleCancel} hitSlop={10}>
          <Text style={styles.cancelBtn}>Annuler</Text>
        </Pressable>
        <Text style={styles.title}>Modifier la séance</Text>
        <Pressable onPress={handleSave} hitSlop={10} disabled={!isDirty || saving}>
          <Text style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}>
            {saving ? '...' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
        {exercices.map((ex, exIdx) => (
          <ExerciseEditCard
            key={exIdx}
            exercise={ex}
            onChange={(updated) => {
              const next = [...exercices];
              next[exIdx] = updated;
              setExercices(next);
            }}
            onDelete={() => {
              const next = exercices.filter((_, i) => i !== exIdx);
              setExercices(next);
            }}
            log={log}
          />
        ))}

        {/* Add exercise button — implemented in Task 3.6 */}
        <AddExerciseButton onAdd={(newEx) => setExercices([...exercices, newEx])} log={log} />

        {/* Delete entire session button */}
        <DeleteSessionButton logId={log.id} navigation={navigation} />
      </ScrollView>
    </View>
  );
}

// Stub components — implemented in following tasks
function ExerciseEditCard({ exercise, onChange, onDelete, log }) {
  return null; // implemented Task 3.3-3.5
}
function AddExerciseButton({ onAdd, log }) {
  return null; // implemented Task 3.6
}
function DeleteSessionButton({ logId, navigation }) {
  return null; // implemented Task 3.7
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#eee',
  },
  title: { fontFamily: fonts.bold, fontSize: 16 },
  cancelBtn: { color: colors.text, fontFamily: fonts.regular },
  saveBtn: { color: colors.primary, fontFamily: fonts.bold },
  saveBtnDisabled: { opacity: 0.4 },
  body: { flex: 1, padding: spacing.md },
  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  lockedText: { fontFamily: fonts.regular, color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  backBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md },
  backBtnText: { color: '#fff', fontFamily: fonts.bold },
});
```

- [ ] **Step 2: Enregistrer la route**

Modifier le navigator (probablement `src/navigation/AppNavigator.js` ou similar — chercher où `WorkoutDetailScreen` est enregistré). Ajouter :

```jsx
import EditWorkoutLogScreen from '../screens/EditWorkoutLogScreen';

// Dans le Stack.Navigator
<Stack.Screen name="EditWorkoutLog" component={EditWorkoutLogScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Vérifier manuellement**

Naviguer temporairement vers `EditWorkoutLog` depuis `WorkoutDetailScreen` (ajout d'un bouton temp). Vérifier que l'écran s'ouvre, montre le header, et que le bouton Annuler revient.

- [ ] **Step 4: Commit**

```bash
git add src/screens/EditWorkoutLogScreen.js src/navigation/<file>.js
git commit -m "feat(athlete): scaffold EditWorkoutLogScreen"
```

---

### Task 3.2: ExerciseEditCard (édition séries existantes)

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/EditWorkoutLogScreen.js`

- [ ] **Step 1: Implémenter `ExerciseEditCard`**

Remplacer le stub `function ExerciseEditCard` par une vraie implémentation. Lire le schéma documenté en Task 0.1 pour adapter les champs (typiquement `reps`, `kg`, peut-être `duree`, `rpe`, `completed`).

```jsx
function ExerciseEditCard({ exercise, onChange, onDelete, log }) {
  const updateSerie = (serieIdx, patch) => {
    const next = { ...exercise };
    next.series = exercise.series.map((s, i) => i === serieIdx ? { ...s, ...patch } : s);
    onChange(next);
  };

  const addSerie = () => {
    const last = exercise.series?.[exercise.series.length - 1] || {};
    const newSerie = {
      reps: last.reps ?? null,
      kg: last.kg ?? null,
      // adapt to actual schema fields from Task 0.1
    };
    onChange({ ...exercise, series: [...(exercise.series || []), newSerie] });
  };

  const deleteSerie = (serieIdx) => {
    // Will gain video-confirm logic in Task 3.4
    const next = { ...exercise };
    next.series = exercise.series.filter((_, i) => i !== serieIdx);
    onChange(next);
  };

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.headerRow}>
        <Text style={cardStyles.exName}>{exercise.nom}</Text>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color="#c00" />
        </Pressable>
      </View>
      {(exercise.series || []).map((serie, sIdx) => (
        <View key={sIdx} style={cardStyles.serieRow}>
          <Text style={cardStyles.serieIdx}>{sIdx + 1}.</Text>
          <NumberField
            label="reps"
            value={serie.reps}
            onChange={(v) => updateSerie(sIdx, { reps: v })}
          />
          <NumberField
            label="kg"
            value={serie.kg}
            onChange={(v) => updateSerie(sIdx, { kg: v })}
          />
          <Pressable onPress={() => deleteSerie(sIdx)} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={20} color="#888" />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addSerie} style={cardStyles.addBtn}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={cardStyles.addBtnText}>Ajouter une série</Text>
      </Pressable>
    </View>
  );
}

function NumberField({ label, value, onChange }) {
  // Inline numeric input. Adjust to your existing input components if you have a NumberInput primitive.
  return (
    <View style={cardStyles.field}>
      <Text style={cardStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={cardStyles.fieldInput}
        keyboardType="numeric"
        value={value != null ? String(value) : ''}
        onChangeText={(text) => {
          const parsed = text === '' ? null : Number(text.replace(',', '.'));
          if (text === '' || !isNaN(parsed)) onChange(parsed);
        }}
      />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border || '#eee',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  exName: { fontFamily: fonts.bold, fontSize: 14 },
  serieRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  serieIdx: { fontFamily: fonts.regular, color: '#888', minWidth: 20 },
  field: { flex: 1 },
  fieldLabel: { fontFamily: fonts.regular, fontSize: 10, color: '#888' },
  fieldInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#ddd',
    paddingVertical: 4,
    fontFamily: fonts.regular,
  },
  addBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 4 },
  addBtnText: { color: colors.primary, fontFamily: fonts.regular, fontSize: 13 },
});
```

Ajouter `TextInput` aux imports en haut du fichier.

- [ ] **Step 2: Vérifier manuellement**

Ouvrir l'écran via le bouton temp, modifier un champ reps, vérifier que le bouton "Enregistrer" devient actif (test du state `isDirty`). Cliquer "Enregistrer" → vérifier en DB que `exercices_completes` est mis à jour et `edited_at` est non-null.

- [ ] **Step 3: Commit**

```bash
git add src/screens/EditWorkoutLogScreen.js
git commit -m "feat(athlete): inline edit reps/kg + add/remove series"
```

---

### Task 3.3: Confirm vidéo lors de la suppression de série/exo

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/EditWorkoutLogScreen.js`

- [ ] **Step 1: Charger les vidéos liées au log**

Au début du composant `EditWorkoutLogScreen`, après `const [exercices, ...]` :

```jsx
import { useEffect } from 'react';
import { getVideosForLog } from '../api/executionVideos';

const [videos, setVideos] = useState([]);
useEffect(() => {
  if (!log?.id) return;
  getVideosForLog(log.id).then(setVideos).catch(() => setVideos([]));
}, [log?.id]);
```

- [ ] **Step 2: Helper de matching vidéo**

Au-dessus du composant principal :

```js
function videosForExercise(videos, exerciseName) {
  return (videos || []).filter((v) => v.exercise_name === exerciseName);
}

function videoForSerie(videos, exerciseName, serieNumber) {
  return (videos || []).find((v) =>
    v.exercise_name === exerciseName &&
    v.serie_number === serieNumber
  );
}
```

(Vérifier les noms exacts des champs en lisant `src/api/executionVideos.js`. Les noms ci-dessus sont une supposition raisonnable basée sur le contexte.)

- [ ] **Step 3: Adapter `ExerciseEditCard` et `EditWorkoutLogScreen`**

Passer `videos` à `ExerciseEditCard` et utiliser le helper :

```jsx
// Dans EditWorkoutLogScreen.map :
<ExerciseEditCard
  ...
  videos={videosForExercise(videos, ex.nom)}
  onDelete={() => requestDeleteExercise(exIdx)}
/>

// Dans EditWorkoutLogScreen :
const requestDeleteExercise = (exIdx) => {
  const exVideos = videosForExercise(videos, exercices[exIdx].nom);
  if (exVideos.length > 0) {
    Alert.alert(
      'Supprimer cet exercice ?',
      `${exVideos.length} vidéo(s) liée(s) seront supprimée(s) avec lui.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setExercices(exercices.filter((_, i) => i !== exIdx));
            // Note: les vidéos ne sont pas effacées tout de suite,
            // elles seront supprimées au save (cascade ou cleanup explicite).
            // Voir Task 3.5 pour la cohérence finale.
          },
        },
      ]
    );
  } else {
    setExercices(exercices.filter((_, i) => i !== exIdx));
  }
};

// Dans ExerciseEditCard, idem pour deleteSerie :
const requestDeleteSerie = (sIdx) => {
  const v = videoForSerie(videos, exercise.nom, sIdx + 1); // serie_number probablement 1-indexed
  if (v) {
    Alert.alert(
      'Supprimer cette série ?',
      'La vidéo associée sera également supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteSerie(sIdx),
        },
      ]
    );
  } else {
    deleteSerie(sIdx);
  }
};
```

- [ ] **Step 4: Cleanup vidéos au save**

Le save ne supprime pas automatiquement les vidéos orphelines (celles dont la série/exo a été retiré du log). Il faut les nettoyer explicitement :

Dans `handleSave`, avant l'appel `updateWorkoutLog` :

```jsx
const handleSave = async () => {
  if (saving || !isDirty) return;
  setSaving(true);
  try {
    // 1. Identifier vidéos orphelines (présentes en DB mais plus dans le state édité)
    const orphans = (videos || []).filter((v) => {
      const ex = exercices.find((e) => e.nom === v.exercise_name);
      if (!ex) return true;
      const seriesCount = ex.series?.length || 0;
      return v.serie_number > seriesCount; // série supprimée
    });

    // 2. Supprimer les orphelines (DB d'abord, puis storage — cf. lesson)
    for (const v of orphans) {
      try {
        await deleteExecutionVideo(v.id); // assume cette fonction existe et gère DB+storage
      } catch (e) {
        console.warn('[EditWorkoutLog] orphan video delete failed:', e?.message);
      }
    }

    // 3. Update workout_log
    await updateWorkoutLog(log.id, exercices);

    Alert.alert('Enregistré', 'La séance a été mise à jour.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  } catch (e) {
    Alert.alert('Erreur', e.message || 'Impossible d\'enregistrer');
  } finally {
    setSaving(false);
  }
};
```

Importer `deleteExecutionVideo` depuis `'../api/executionVideos'` (vérifier que cette fonction existe ; sinon l'écrire — elle doit DELETE row + remove storage path).

- [ ] **Step 5: Vérifier manuellement**

Avec un log qui a une vidéo, supprimer la série correspondante, sauvegarder. Vérifier en DB que la row `execution_videos` est partie ET que le fichier storage est supprimé.

- [ ] **Step 6: Commit**

```bash
git add src/screens/EditWorkoutLogScreen.js
git commit -m "feat(athlete): confirm + cleanup videos on series/exercise delete"
```

---

### Task 3.4: AddExerciseButton + AddExerciseModal

**Files:**
- Create: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/components/training/AddExerciseModal.js`
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/EditWorkoutLogScreen.js`

- [ ] **Step 1: Créer la modal**

```jsx
// src/components/training/AddExerciseModal.js
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, fonts } from '../../theme';

export default function AddExerciseModal({ visible, onClose, onAdd }) {
  const { athlete } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (query.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('exercices')
      .select('id, nom, muscle_principal')
      .ilike('nom', `%${query}%`)
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) setResults(data || []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, visible]);

  const handleSelectFromLibrary = (exo) => {
    onAdd({
      nom: exo.nom,
      exercice_id: exo.id,
      muscle_principal: exo.muscle_principal,
      series: [],
    });
    onClose();
  };

  const handleFreeText = () => {
    if (!query.trim()) return;
    onAdd({
      nom: query.trim(),
      exercice_id: null,
      series: [],
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Ajouter un exercice</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtn}>Fermer</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Rechercher..."
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => handleSelectFromLibrary(item)}>
                <Text style={styles.rowName}>{item.nom}</Text>
                {item.muscle_principal && <Text style={styles.rowMuscle}>{item.muscle_principal}</Text>}
              </Pressable>
            )}
            ListEmptyComponent={() => (
              query.length >= 2 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Pas trouvé "{query}" ?</Text>
                  <Pressable onPress={handleFreeText} style={styles.freeTextBtn}>
                    <Text style={styles.freeTextBtnText}>Ajouter en texte libre</Text>
                  </Pressable>
                </View>
              ) : null
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, height: '80%', padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: 16 },
  closeBtn: { color: colors.primary, fontFamily: fonts.regular },
  search: { borderWidth: 1, borderColor: colors.border || '#ddd', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, fontFamily: fonts.regular },
  row: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border || '#eee' },
  rowName: { fontFamily: fonts.bold, fontSize: 14 },
  rowMuscle: { fontFamily: fonts.regular, fontSize: 12, color: '#888' },
  emptyContainer: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { fontFamily: fonts.regular, color: '#888', marginBottom: spacing.sm },
  freeTextBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  freeTextBtnText: { color: '#fff', fontFamily: fonts.bold },
});
```

- [ ] **Step 2: Implémenter `AddExerciseButton` dans EditWorkoutLogScreen**

```jsx
import AddExerciseModal from '../components/training/AddExerciseModal';

function AddExerciseButton({ onAdd, log }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={addStyles.btn} onPress={() => setOpen(true)}>
        <Ionicons name="add-circle" size={20} color={colors.primary} />
        <Text style={addStyles.btnText}>Ajouter un exercice</Text>
      </Pressable>
      <AddExerciseModal
        visible={open}
        onClose={() => setOpen(false)}
        onAdd={onAdd}
      />
    </>
  );
}

const addStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
    gap: 6,
  },
  btnText: { color: colors.primary, fontFamily: fonts.bold },
});
```

- [ ] **Step 3: Vérifier manuellement**

Cliquer "Ajouter un exercice", taper "squat", sélectionner depuis la liste → vérifier que l'exo apparaît dans la liste avec 0 séries. Cliquer + Série → vérifier qu'on peut remplir reps/kg. Sauvegarder, vérifier en DB.

Tester aussi le fallback texte libre : taper un nom inexistant, cliquer "Ajouter en texte libre".

- [ ] **Step 4: Commit**

```bash
git add src/screens/EditWorkoutLogScreen.js src/components/training/AddExerciseModal.js
git commit -m "feat(athlete): add exercise via library or free text"
```

---

### Task 3.5: Bouton "Supprimer cette séance"

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/EditWorkoutLogScreen.js`

- [ ] **Step 1: Implémenter `DeleteSessionButton`**

```jsx
function DeleteSessionButton({ logId, navigation }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Supprimer cette séance ?',
      'Cette action est irréversible. Toutes les données (séries, vidéos) seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            // Double-confirm
            Alert.alert(
              'Es-tu sûr ?',
              'Vraiment supprimer cette séance ?',
              [
                { text: 'Non', style: 'cancel' },
                {
                  text: 'Oui, supprimer',
                  style: 'destructive',
                  onPress: confirmDelete,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteWorkoutLogEntirely(logId);
      Alert.alert('Supprimé', 'La séance a été supprimée.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Impossible de supprimer');
      setDeleting(false);
    }
  };

  return (
    <Pressable style={delStyles.btn} onPress={handleDelete} disabled={deleting}>
      <Ionicons name="trash" size={18} color="#c00" />
      <Text style={delStyles.btnText}>{deleting ? 'Suppression...' : 'Supprimer cette séance'}</Text>
    </Pressable>
  );
}

const delStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    gap: 6,
  },
  btnText: { color: '#c00', fontFamily: fonts.regular },
});
```

- [ ] **Step 2: Vérifier manuellement**

Créer un log de test (avec vidéo idéalement), cliquer "Supprimer cette séance", confirmer 2x. Vérifier en DB que `workout_logs`, `execution_videos` sont vidés et que les fichiers storage sont supprimés.

- [ ] **Step 3: Commit**

```bash
git add src/screens/EditWorkoutLogScreen.js
git commit -m "feat(athlete): delete entire workout log with double-confirm"
```

---

## Phase 4 — ATHLETE: point d'entrée

### Task 4.1: Bouton "Modifier" sur WorkoutDetailScreen

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/ATHLETE/src/screens/WorkoutDetailScreen.js`

- [ ] **Step 1: Ajouter le bouton conditionnel**

Importer en haut :
```js
import { isLogEditable, lockedAtDisplay } from '../utils/workoutLog';
```

Dans le JSX (chercher l'endroit juste sous le header de la séance — après le titre/date) :

```jsx
{isLogEditable(log) ? (
  <Pressable
    onPress={() => navigation.navigate('EditWorkoutLog', { log })}
    style={styles.editBtn}
  >
    <Ionicons name="create-outline" size={16} color={colors.primary} />
    <Text style={styles.editBtnText}>Modifier</Text>
  </Pressable>
) : (
  <Text style={styles.lockedHint}>
    Verrouillé depuis le {lockedAtDisplay(log)}
  </Text>
)}
```

Ajouter les styles :
```js
editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
editBtnText: { color: colors.primary, fontFamily: fonts.regular },
lockedHint: { color: '#888', fontFamily: fonts.regular, fontSize: 12, fontStyle: 'italic' },
```

- [ ] **Step 2: Retirer le bouton temp de la Task 3.1**

Si un bouton de navigation temporaire avait été ajouté pendant les phases 3.x, le retirer.

- [ ] **Step 3: Vérifier manuellement**

- Ouvrir un log récent → bouton "Modifier" visible
- Ouvrir un log >7j → texte "Verrouillé" visible, pas de bouton
- Cliquer "Modifier" → navigue vers EditWorkoutLogScreen avec le log

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkoutDetailScreen.js
git commit -m "feat(athlete): expose Modifier button on editable logs"
```

---

## Phase 5 — COACH: badge "Édité"

Cette phase se fait dans le repo COACH sur la branche `feature/edit-workout-log-history` (ou peut être faite en parallèle d'ATHLETE).

### Task 5.1: Inclure `edited_at` dans la query history

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/COACH/app/(app)/athletes/[id]/training/page.tsx`

- [ ] **Step 1: Identifier la query**

Chercher la query Supabase qui charge les `workout_logs` côté COACH (probablement dans le composant `history` view, autour de L500-600). Vérifier que `edited_at` est dans le `select`.

Exemple typique (à adapter à la query réelle) :
```ts
const { data: logs } = await supabase
  .from('workout_logs')
  .select('id, date, exercices_completes, started_at, finished_at, session_name, edited_at')
  .eq('athlete_id', athleteId)
  .order('date', { ascending: false });
```

- [ ] **Step 2: Ajouter `edited_at` au type WorkoutLog**

Trouver l'interface `WorkoutLog` (page.tsx:147-157 selon audit). Ajouter :
```ts
interface WorkoutLog {
  // ... existing fields
  edited_at: string | null;
}
```

- [ ] **Step 3: Vérifier manuellement**

Run le dev server COACH (`npm run dev`), ouvrir l'historique d'un athlète. Inspecter la console / network pour confirmer que `edited_at` est dans les rows retournées.

- [ ] **Step 4: Commit**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git checkout -b feature/edit-workout-log-history develop  # si pas déjà créée
git add app/\(app\)/athletes/\[id\]/training/page.tsx
git commit -m "feat(coach): include edited_at in workout_logs query"
```

---

### Task 5.2: Composant EditedBadge

**Files:**
- Create: `/Users/pierrerebmann/MOMENTUM/COACH/components/training/EditedBadge.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/training/EditedBadge.tsx
"use client";

import { Pencil } from "lucide-react"; // ou autre icon set utilisé dans le projet

interface EditedBadgeProps {
  editedAt: string | null;
}

export default function EditedBadge({ editedAt }: EditedBadgeProps) {
  if (!editedAt) return null;

  const formatted = new Date(editedAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span
      title={`Modifié le ${formatted}`}
      className="inline-flex items-center gap-1 text-xs text-gray-500 ml-2"
    >
      <Pencil className="w-3 h-3" />
      Édité
    </span>
  );
}
```

Ajuster l'import d'icône selon ce qui est déjà utilisé ailleurs dans le repo (cf. autres composants `components/training/`).

- [ ] **Step 2: Commit**

```bash
git add components/training/EditedBadge.tsx
git commit -m "feat(coach): add EditedBadge component"
```

---

### Task 5.3: Wire le badge dans la history view

**Files:**
- Modify: `/Users/pierrerebmann/MOMENTUM/COACH/app/(app)/athletes/[id]/training/page.tsx`

- [ ] **Step 1: Importer + afficher**

Importer en haut :
```ts
import EditedBadge from "@/components/training/EditedBadge";
```

Dans le rendu de chaque log (history view, autour de L542-806 — chercher l'endroit où le titre de session est affiché) :

```tsx
<h3 className="...">
  {log.session_name ?? log.workout_sessions?.nom ?? "Séance"}
  <EditedBadge editedAt={log.edited_at} />
</h3>
```

- [ ] **Step 2: Vérifier manuellement**

Run dev server. Éditer un log côté ATHLETE (ou setter manuellement `edited_at = now()` en SQL). Recharger COACH history → badge "Édité" visible avec tooltip date.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/athletes/\[id\]/training/page.tsx
git commit -m "feat(coach): show Édité badge in history view"
```

---

## Phase 6 — QA & déploiement

### Task 6.1: Test E2E manuel

**Files:** None

- [ ] **Step 1: Scénario golden path**

Sur un device / simulateur ATHLETE :
1. Lancer une séance, logger 2 exos avec 3 séries chacun, terminer.
2. Aller dans l'historique, ouvrir le log.
3. Cliquer "Modifier" → écran d'édition s'ouvre.
4. Modifier reps de l'exo 1, série 1.
5. Ajouter une 4e série à l'exo 2.
6. Ajouter un nouvel exo "Mollets" via bibliothèque, lui ajouter 2 séries.
7. Supprimer une série de l'exo 1.
8. Cliquer "Enregistrer".
9. Vérifier en DB :
   ```sql
   SELECT exercices_completes, edited_at FROM workout_logs WHERE id = '<id>';
   ```

- [ ] **Step 2: Scénario verrou**

1. En SQL, manipuler `created_at` d'un log pour simuler >7j :
   ```sql
   UPDATE workout_logs SET created_at = now() - interval '8 days' WHERE id = '<id>';
   ```
2. Côté ATHLETE, ouvrir ce log → texte "Verrouillé" affiché, pas de bouton Modifier.

- [ ] **Step 3: Scénario suppression entière**

1. Créer un log de test avec une vidéo.
2. Cliquer "Supprimer cette séance", confirmer 2x.
3. Vérifier que le log + execution_videos rows + storage files sont absents.

- [ ] **Step 4: Scénario badge coach**

1. Après édition côté ATHLETE, recharger COACH `/athletes/<id>/training` → badge "Édité" visible.
2. Hover (desktop) → tooltip avec date.

- [ ] **Step 5: Documenter le résultat**

Ajouter à `tasks/lessons.md` (COACH) toute leçon apprise pendant le QA.

---

### Task 6.2: Préparer le PR

**Files:** None

- [ ] **Step 1: Push ATHLETE branch**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git push -u origin feature/edit-workout-log-history
gh pr create --base develop --title "feat: edit workout log history (7-day window)" --body "$(cat <<'EOF'
## Summary
- Adds an EditWorkoutLogScreen allowing athletes to correct/add/remove series and exercises within 7 days of a workout
- Adds Modifier entry point on WorkoutDetailScreen
- Adds delete-entire-session flow with cascade videos cleanup
- New API helpers: updateWorkoutLog, deleteWorkoutLogEntirely

## Spec
docs/superpowers/specs/2026-04-29-edit-workout-log-history-design.md (in COACH repo)

## Plan
docs/superpowers/plans/2026-04-29-edit-workout-log-history.md (in COACH repo)

## Test plan
- [ ] Edit reps/kg + add/remove series, save, verify in DB
- [ ] Add exercise via library, save, verify
- [ ] Add exercise via free text fallback, save, verify
- [ ] Delete series with linked video → confirm modal → DB+storage cleanup
- [ ] Delete entire session (double-confirm) → cascade verify
- [ ] Open log >7d → button hidden, "Verrouillé" shown
- [ ] Coach side: Édité badge appears after athlete edit
EOF
)"
```

- [ ] **Step 2: Push COACH branch**

```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
git push -u origin feature/edit-workout-log-history
gh pr create --base develop --title "feat: edited badge + workout_logs migration" --body "$(cat <<'EOF'
## Summary
- SQL migration: workout_logs.edited_at + locked_at + RLS policies for 7-day edit window
- Coach UI: Édité badge in athlete training history view

## Spec
docs/superpowers/specs/2026-04-29-edit-workout-log-history-design.md

## Plan
docs/superpowers/plans/2026-04-29-edit-workout-log-history.md

## Migration order
1. Run sql/edit_workout_log_history.sql in Supabase prod (backward-compatible: nullable + generated columns)
2. Merge this PR (badge invisible until first athlete edit)
3. Then merge ATHLETE PR + ship via eas update

## Test plan
- [ ] SQL migration applied locally without error
- [ ] RLS test scenarios pass (sql/test_edit_workout_log_history.sql)
- [ ] Édité badge shows after athlete edit
- [ ] Tooltip displays correct French date format
EOF
)"
```

---

### Task 6.3: Déploiement

**Files:** None

- [ ] **Step 1: Migration prod Supabase**

Une fois COACH PR mergée et préview validée :
1. Aller dans Supabase prod project SQL Editor.
2. Coller `sql/edit_workout_log_history.sql`.
3. Exécuter.
4. Vérifier les colonnes :
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'workout_logs'
   AND column_name IN ('edited_at', 'locked_at');
   ```

- [ ] **Step 2: Promotion COACH develop → main**

Quand develop est stable :
```bash
cd /Users/pierrerebmann/MOMENTUM/COACH
gh pr create --base main --head develop --title "release: edit workout log history (coach side)"
```

Vercel auto-deploy à la merge sur `main`.

- [ ] **Step 3: Déploiement ATHLETE**

```bash
cd /Users/pierrerebmann/MOMENTUM/ATHLETE
git checkout develop && git pull
eas update --branch production --message "feat: edit workout log history (7-day window)"
```

(Pas besoin de full build : aucun changement natif. Tous les changements sont JS/JSX.)

- [ ] **Step 4: Smoke test prod**

- Ouvrir l'app prod (Expo Go ou build prod selon l'utilisateur).
- Sur un compte athlète test, modifier un log récent.
- Vérifier que l'édition se sauve et apparaît côté COACH avec le badge.

---

## Annexe: récap fichiers touchés

| Repo | Type | Path |
|------|------|------|
| COACH | Create | `sql/edit_workout_log_history.sql` |
| COACH | Create | `sql/test_edit_workout_log_history.sql` |
| COACH | Create | `docs/superpowers/notes/exercices-completes-schema.md` |
| COACH | Create | `components/training/EditedBadge.tsx` |
| COACH | Modify | `app/(app)/athletes/[id]/training/page.tsx` |
| ATHLETE | Create | `src/utils/workoutLog.js` |
| ATHLETE | Create | `src/screens/EditWorkoutLogScreen.js` |
| ATHLETE | Create | `src/components/training/AddExerciseModal.js` |
| ATHLETE | Modify | `src/api/workouts.js` |
| ATHLETE | Modify | `src/screens/WorkoutDetailScreen.js` |
| ATHLETE | Modify | `src/navigation/<file>.js` (registration of new screen) |

## Annexe: ordre de merge recommandé

1. Migration SQL (Task 1.1, exécution prod) — backward-compatible, peut être faite avant tout merge.
2. COACH PR (badge) — peut être mergée seule, badge invisible jusqu'à 1ère édition.
3. ATHLETE PR + `eas update` — déploie la fonctionnalité utilisateur.

Ordre alternatif: tout en parallèle, mais alors le badge COACH peut briefly montrer du "Édité" pour des logs édités via une autre source (peu probable).
