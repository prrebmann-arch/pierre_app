-- ============================================================
-- MOMENTUM — Batch 8 : Upper/Upper/Lower 3j
-- Source : FAQ 2 Antonin — cas client Hyrox 3 séances
-- 2 uppers (fréquence x2 haut du corps) + 1 lower
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
  -- UPPER/UPPER/LOWER 3J
  -- (FAQ 2 : 2 upper + 1 lower, pour clients avec peu de séances
  --  ou sport complémentaire type Hyrox/course)
  -- Upper : polys push → iso push (épaules, triceps) → polys pull → biceps
  -- Volume : 4-6 séries/muscle/séance = 8-12/sem sur le haut
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Upper/Upper/Lower 3j — Intermédiaire',
    v_coach_id,
    'Upper/Lower 3j',
    'fixed',
    '{"days": ["Lundi", "Mercredi", "Vendredi"]}',
    '[
      {
        "nom": "Upper A",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Développé incliné Smith (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}
          ]},
          {"nom": "Extensions triceps double corde", "muscle_principal": "Triceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Rowing unilatéral poulie", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Lower",
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
          {"nom": "Hip thrust machine (ou barre)", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
          ]},
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Upper B",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Rowing T-bar (ou rowing barre)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Tirage horizontal poulie (prise neutre)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Développé couché haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]}
        ]
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ 1 template created (Upper/Upper/Lower 3j)';

END $$;
