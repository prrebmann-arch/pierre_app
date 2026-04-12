-- ============================================================
-- MOMENTUM — Batch 6 : PPL Focus (4 variantes)
-- Mêmes principes Antonin appliqués au format PPL rotation
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  -- ============================================================
  -- 1. PPL FOCUS ÉPAULES
  -- Push + delto lat | Pull + delto post | Legs | Off
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'PPL Rotation — Focus épaules',
    v_coach_id,
    'PPL Rotation',
    'pattern',
    '{"pattern": "Push / Pull / Legs / Repos"}',
    '[
      {"nom": "Push + Delto lat", "jour": "Jour 1", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
        {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
      ]},
      {"nom": "Pull + Delto post", "jour": "Jour 2", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
        {"nom": "Face pull poulie", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs", "jour": "Jour 3", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Hack squat", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  -- ============================================================
  -- 2. PPL FOCUS BRAS
  -- Push + Triceps | Pull + Biceps | Legs | Off
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'PPL Rotation — Focus bras',
    v_coach_id,
    'PPL Rotation',
    'pattern',
    '{"pattern": "Push / Pull / Legs / Repos"}',
    '[
      {"nom": "Push + Triceps", "jour": "Jour 1", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
      ]},
      {"nom": "Pull + Biceps", "jour": "Jour 2", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl marteau haltères", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs", "jour": "Jour 3", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Hack squat", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  RAISE NOTICE '✅ 2 PPL focus templates created (épaules, bras)';

END $$;
