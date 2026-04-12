-- ============================================================
-- MOMENTUM — Seed Training Templates BATCH 2
-- 3j Full Body, 5j PPL, 6j PPL Rotation
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  -- Clean previous batch 2
  DELETE FROM training_templates
  WHERE coach_id = v_coach_id
    AND category IN ('3j Full Body', '5j PPL', '6j PPL Rotation');

  -- ============================================================
  -- 1. FULL BODY — 3 JOURS (Débutant / Jeune intermédiaire)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Full Body 3j — Débutant / Jeune intermédiaire',
    v_coach_id,
    '3j Full Body',
    'fixed',
    '{"days": ["Lundi", "Mercredi", "Vendredi"]}',
    '[
      {
        "nom": "Full Body A",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith (ou machine)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Rowing unilatéral poulie",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Squat Smith (ou presse à cuisses)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Élévation latérale machine (ou haltères)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Full Body B",
        "jour": "Mercredi",
        "exercices": [
          {
            "nom": "Tirage horizontal poulie (prise neutre)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Pullover poulie (corde)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché haltères (ou machine)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Leg extension",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Reverse pec deck (delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl poulie basse",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Full Body C",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Presse à cuisses",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Développé incliné haltères",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Rowing barre (ou T-bar)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Élévation latérale haltères",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. PPL — 5 JOURS (rotation Push/Pull/Legs/Push/Pull)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'PPL 5j — Intermédiaire (rotation)',
    v_coach_id,
    '5j PPL',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Push A (Pecs focus)",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Pec Deck (ou poulie vis-à-vis)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Dips (ou développé décliné machine)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Élévation latérale machine",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Développé épaules haltères (semi-neutre)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      },
      {
        "nom": "Pull A (Dos focus)",
        "jour": "Mardi",
        "exercices": [
          {
            "nom": "Pullover poulie (corde)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Rowing T-bar",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie (prise neutre)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Reverse pec deck (delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Legs",
        "jour": "Mercredi",
        "exercices": [
          {
            "nom": "Leg extension",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Squat Smith (ou presse)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Hack squat (ou fentes Smith)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Hip thrust machine",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Push B (Épaules focus)",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Élévation latérale machine",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé épaules haltères (semi-neutre)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Reverse pec deck (delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Poulie vis-à-vis (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché haltères (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Extension overhead poulie (corde)",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Pull B (Dos + Biceps)",
        "jour": "Samedi",
        "exercices": [
          {
            "nom": "Rowing unilatéral poulie",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise large (ou neutre)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie (prise neutre)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Élévation latérale haltères (rappel épaules)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 3. PPL ROTATION — 6 JOURS (Avancé)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'PPL 6j Rotation — Avancé (x2/semaine)',
    v_coach_id,
    '6j PPL Rotation',
    'pattern',
    '{"pattern": "Push / Pull / Legs / Push / Pull / Legs"}',
    '[
      {
        "nom": "Push A (Pecs priorité)",
        "jour": "Jour 1",
        "exercices": [
          {
            "nom": "Poulie vis-à-vis (isolation pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé incliné Smith",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "6-10", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Dips (ou chest press déclinée)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Élévation latérale machine",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Extension overhead poulie (corde)",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      },
      {
        "nom": "Pull A (Grand dorsal priorité)",
        "jour": "Jour 2",
        "exercices": [
          {
            "nom": "Pullover poulie (corde)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Rowing T-bar (ou rowing barre)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "6-10", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie (prise neutre)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Reverse pec deck (delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Legs A (Quads priorité)",
        "jour": "Jour 3",
        "exercices": [
          {
            "nom": "Leg extension",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Squat Smith (ou presse)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "6-10", "tempo": "30X1", "repos": "3m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Hack squat",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Mollets assis",
            "muscle_principal": "Mollets",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Push B (Épaules priorité)",
        "jour": "Jour 4",
        "exercices": [
          {
            "nom": "Élévation latérale machine",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé épaules haltères (semi-neutre)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "6-10", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Reverse pec deck (delto post)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pec Deck (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché haltères (rappel pecs)",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      },
      {
        "nom": "Pull B (Trapèzes + Dos)",
        "jour": "Jour 5",
        "exercices": [
          {
            "nom": "Rowing unilatéral poulie",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage vertical prise large",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Rowing barre prise large (trapèzes)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Élévation latérale haltères (rappel épaules)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre machine",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Legs B (Ischios/Fessiers priorité)",
        "jour": "Jour 6",
        "exercices": [
          {
            "nom": "Leg curl assis",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain barre",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "6-10", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Hip thrust machine",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Fentes bulgares Smith",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Leg extension (rappel quads)",
            "muscle_principal": "Quadriceps",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ 3 templates (batch 2) created for coach %', v_coach_id;

END $$;
