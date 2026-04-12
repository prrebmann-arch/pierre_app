-- ============================================================
-- MOMENTUM — Batch 3 : Split 6 jours (7 variantes — Antonin)
-- Source : Notion Pierre + cours Antonin
-- Structure : Pecs / Dos / Legs 1 / Épaules / Bras / Legs 2 / OFF
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  DELETE FROM training_templates WHERE coach_id = v_coach_id AND category = 'Split 6 jours';

  -- ============================================================
  -- 1. BASE DU SPLIT 6 JOURS
  -- Lundi: Pecs | Mardi: Dos | Mercredi: Legs 1
  -- Jeudi: Épaules | Vendredi: Bras | Samedi: Legs 2 | Dimanche: OFF
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 6j — Base',
    v_coach_id,
    'Split 6 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]}
        ]
      },
      {
        "nom": "Dos",
        "jour": "Mardi",
        "exercices": [
          {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      },
      {
        "nom": "Legs 1 (Quads focus)",
        "jour": "Mercredi",
        "exercices": [
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Hack squat (ou fentes Smith)", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Épaules",
        "jour": "Jeudi",
        "exercices": [
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}
          ]},
          {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Bras",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Curl marteau haltères", "muscle_principal": "Biceps", "superset_id": "C1", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "superset_id": "C2", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Legs 2 (Ischios/Fessiers focus)",
        "jour": "Samedi",
        "exercices": [
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
          ]},
          {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. SPLIT 6J FOCUS ÉPAULES
  -- Pecs + Delto lat | Dos + Delto post | Legs 1
  -- Épaules | Bras | Legs 2
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 6j — Focus épaules',
    v_coach_id,
    'Split 6 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {"nom": "Pectoraux + Delto lat", "jour": "Lundi", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Élévation latérale machine (rappel delto lat)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Dos + Delto post", "jour": "Mardi", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Reverse pec deck (rappel delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 1 (Quads focus)", "jour": "Mercredi", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Hack squat (ou fentes Smith)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Épaules (séance principale)", "jour": "Jeudi", "exercices": [
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
        {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Élévation latérale haltères", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Bras", "jour": "Vendredi", "exercices": [
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 2 (Ischios/Fessiers)", "jour": "Samedi", "exercices": [
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  -- ============================================================
  -- 3. SPLIT 6J FOCUS PECTORAUX + ÉPAULES
  -- Pecs + Delto lat | Dos + Delto post | Legs 1
  -- Épaules + 2 pecs | Bras | Legs 2
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 6j — Focus pectoraux épaules',
    v_coach_id,
    'Split 6 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {"nom": "Pectoraux + Delto lat", "jour": "Lundi", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Élévation latérale machine (rappel delto lat)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Dos + Delto post", "jour": "Mardi", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Reverse pec deck (rappel delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 1 (Quads focus)", "jour": "Mercredi", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Hack squat", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Épaules + 2 pecs (rappel)", "jour": "Jeudi", "exercices": [
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
        {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
        {"nom": "Poulie vis-à-vis (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé couché machine (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
      ]},
      {"nom": "Bras", "jour": "Vendredi", "exercices": [
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 2 (Ischios/Fessiers)", "jour": "Samedi", "exercices": [
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  -- ============================================================
  -- 4. SPLIT 6J FOCUS DOS + ÉPAULES
  -- Pecs + Delto lat | Dos + Delto post | Legs 1
  -- Épaules | Bras + 2 dos | Legs 2
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 6j — Focus dos épaules',
    v_coach_id,
    'Split 6 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {"nom": "Pectoraux + Delto lat", "jour": "Lundi", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Élévation latérale machine (rappel delto lat)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Dos + Delto post", "jour": "Mardi", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Reverse pec deck (rappel delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 1 (Quads focus)", "jour": "Mercredi", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Épaules", "jour": "Jeudi", "exercices": [
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
        {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Bras + 2 dos (rappel)", "jour": "Vendredi", "exercices": [
        {"nom": "Rowing unilatéral poulie (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Tirage vertical prise neutre (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 2 (Ischios/Fessiers)", "jour": "Samedi", "exercices": [
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  -- ============================================================
  -- 5. SPLIT 6J FOCUS BRAS
  -- Pecs + Triceps | Dos + Biceps | Legs 1
  -- Épaules | Bras | Legs 2
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 6j — Focus bras',
    v_coach_id,
    'Split 6 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {"nom": "Pectoraux + Triceps", "jour": "Lundi", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Pushdown corde longue (rappel triceps)", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Extension triceps haltères allongé (rappel triceps)", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
      ]},
      {"nom": "Dos + Biceps", "jour": "Mardi", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Curl incliné haltères (rappel biceps)", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie (rappel biceps)", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 1 (Quads focus)", "jour": "Mercredi", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Épaules", "jour": "Jeudi", "exercices": [
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
        {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Bras (séance principale)", "jour": "Vendredi", "exercices": [
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl marteau haltères", "muscle_principal": "Biceps", "superset_id": "C1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "superset_id": "C2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 2 (Ischios/Fessiers)", "jour": "Samedi", "exercices": [
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  -- ============================================================
  -- 6. SPLIT 6J FOCUS PECTORAUX + BRAS
  -- Pecs + Triceps | Dos + Biceps | Legs 1
  -- Épaules + 2 pecs | Bras | Legs 2
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 6j — Focus pectoraux bras',
    v_coach_id,
    'Split 6 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {"nom": "Pectoraux + Triceps", "jour": "Lundi", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Pushdown corde longue (rappel triceps)", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Extension triceps haltères allongé (rappel triceps)", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
      ]},
      {"nom": "Dos + Biceps", "jour": "Mardi", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Curl incliné haltères (rappel biceps)", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie (rappel biceps)", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 1 (Quads focus)", "jour": "Mercredi", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Épaules + 2 pecs (rappel)", "jour": "Jeudi", "exercices": [
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
        {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
        {"nom": "Poulie vis-à-vis (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé couché machine (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
      ]},
      {"nom": "Bras (séance principale)", "jour": "Vendredi", "exercices": [
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl marteau haltères", "muscle_principal": "Biceps", "superset_id": "C1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "superset_id": "C2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 2 (Ischios/Fessiers)", "jour": "Samedi", "exercices": [
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  -- ============================================================
  -- 7. SPLIT 6J FOCUS DOS + BRAS
  -- Pecs + Triceps | Dos + Biceps | Legs 1
  -- Épaules | Bras + 2 dos | Legs 2
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 6j — Focus dos bras',
    v_coach_id,
    'Split 6 jours',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {"nom": "Pectoraux + Triceps", "jour": "Lundi", "exercices": [
        {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Pushdown corde longue (rappel triceps)", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Extension triceps haltères allongé (rappel triceps)", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
      ]},
      {"nom": "Dos + Biceps", "jour": "Mardi", "exercices": [
        {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Curl incliné haltères (rappel biceps)", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie (rappel biceps)", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 1 (Quads focus)", "jour": "Mercredi", "exercices": [
        {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Épaules", "jour": "Jeudi", "exercices": [
        {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
        {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]},
      {"nom": "Bras + 2 dos (rappel)", "jour": "Vendredi", "exercices": [
        {"nom": "Rowing unilatéral poulie (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Tirage vertical prise neutre (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
        {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
      ]},
      {"nom": "Legs 2 (Ischios/Fessiers)", "jour": "Samedi", "exercices": [
        {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
        {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
        {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
        {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
      ]}
    ]'::jsonb
  );

  RAISE NOTICE '✅ 7 Split 6j templates created (batch 3)';

END $$;
