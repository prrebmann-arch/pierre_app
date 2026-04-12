-- ============================================================
-- MOMENTUM — Seed Training Templates (Formation Antonin Ditte)
-- ============================================================
-- Run this SQL in Supabase SQL Editor (one-time)
-- Templates will appear in /templates for YOUR coach account only
--
-- IMPORTANT: Replace 'YOUR_COACH_ID' with your actual auth.uid()
-- To find it: SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL';
-- ============================================================

-- Helper: store coach_id once
DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  -- ============================================================
  -- CHANGE THIS to your email or hardcode your coach UUID
  -- ============================================================
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;

  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found. Update the email in this script.';
  END IF;

  -- Clean previous seed (optional — remove if you want to keep old ones)
  DELETE FROM training_templates
  WHERE coach_id = v_coach_id
    AND category IN (
      '4j Upper/Lower',
      '5j Split Homme',
      '5j Split Femme',
      '3j Full Body',
      '5j PPL',
      '6j PPL Rotation'
    );

  -- ============================================================
  -- 1. UPPER/LOWER — 4 JOURS
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Upper/Lower — Intermédiaire (4j)',
    v_coach_id,
    '4j Upper/Lower',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Upper A (Pecs focus)",
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
            "nom": "Rowing unilatéral poulie (ou T-bar)",
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
            "nom": "Élévation latérale machine (ou haltères)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl incliné haltères (ou poulie basse)",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde longue",
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
        "nom": "Lower A (Quads focus)",
        "jour": "Mardi",
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
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
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
            "nom": "Crunch poulie haute (ou machine abdos)",
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
        "nom": "Upper B (Dos focus)",
        "jour": "Jeudi",
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
            "nom": "Rowing barre (ou T-bar)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
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
            "nom": "Développé couché haltères (ou machine)",
            "muscle_principal": "Pectoraux",
            "sets": [
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
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
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
        "nom": "Lower B (Ischios/Fessiers focus)",
        "jour": "Vendredi",
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
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
            ]
          },
          {
            "nom": "Hip thrust machine (ou barre)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Fentes bulgares Smith (ou haltères)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
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
            "nom": "Mollets assis (ou debout)",
            "muscle_principal": "Mollets",
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
  -- 2. SPLIT 5 JOURS — HOMME
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j Homme — Intermédiaire+ (fréquence x2)',
    v_coach_id,
    '5j Split Homme',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Pectoraux + Triceps",
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
            "nom": "Développé incliné Smith (ou machine convergente)",
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
            "nom": "Pushdown corde longue (Vulcane)",
            "muscle_principal": "Triceps",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé (banc décliné -10°)",
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
        "nom": "Dos + Biceps",
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
            "nom": "Rowing T-bar (ou rowing unilatéral)",
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
            "nom": "Curl incliné haltères (ou poulie basse)",
            "muscle_principal": "Biceps",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Curl pupitre (poulie ou machine)",
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
        "nom": "Cuisses (Quads + Ischios)",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Soulevé de terre roumain haltères",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
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
        "nom": "Épaules + Rappel Pecs",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Élévation latérale machine (ou haltères)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé épaules haltères (assis, semi-neutre)",
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
            "nom": "Poulie vis-à-vis (ou pec deck) — rappel pecs",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Développé couché haltères — rappel pecs",
            "muscle_principal": "Pectoraux",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          }
        ]
      },
      {
        "nom": "Bras + Rappel Dos",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Curl incliné haltères",
            "muscle_principal": "Biceps",
            "superset_id": "A1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Pushdown corde longue",
            "muscle_principal": "Triceps",
            "superset_id": "A2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl pupitre poulie",
            "muscle_principal": "Biceps",
            "superset_id": "B1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension overhead poulie (corde)",
            "muscle_principal": "Triceps",
            "superset_id": "B2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Curl marteau haltères",
            "muscle_principal": "Biceps",
            "superset_id": "C1",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Extension triceps haltères allongé",
            "muscle_principal": "Triceps",
            "superset_id": "C2",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Rowing unilatéral poulie — rappel dos",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre — rappel dos",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          }
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 3. SPLIT 5 JOURS — FEMME (focus lower body)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j Femme — Intermédiaire+ (focus lower)',
    v_coach_id,
    '5j Split Femme',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Fessiers + Ischios",
        "jour": "Lundi",
        "exercices": [
          {
            "nom": "Hip thrust machine (ou barre)",
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
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Abduction machine (fessier moyen)",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"}
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
          }
        ]
      },
      {
        "nom": "Haut du corps (Dos + Épaules)",
        "jour": "Mardi",
        "exercices": [
          {
            "nom": "Rowing unilatéral poulie (ou haltère)",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Tirage vertical prise neutre",
            "muscle_principal": "Dos",
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
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
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
            "nom": "Curl poulie basse (ou haltères)",
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
        "nom": "Quadriceps + Abdos",
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
            "nom": "Squat Smith (ou presse à cuisses)",
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
            "nom": "Crunch poulie haute",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
          {
            "nom": "Relevé de jambes suspendu",
            "muscle_principal": "Abdominaux",
            "sets": [
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
            ]
          }
        ]
      },
      {
        "nom": "Rappel Fessiers + Haut du corps (Pecs)",
        "jour": "Jeudi",
        "exercices": [
          {
            "nom": "Hip thrust machine — rappel fessiers",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
              {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Abduction machine — rappel fessier moyen",
            "muscle_principal": "Fessiers",
            "sets": [
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
              {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
            ]
          },
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
            "nom": "Développé épaules haltères (semi-neutre)",
            "muscle_principal": "Épaules",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          }
        ]
      },
      {
        "nom": "Rappel Ischios + Rappel Dos",
        "jour": "Vendredi",
        "exercices": [
          {
            "nom": "Leg curl assis — rappel ischios",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
            ]
          },
          {
            "nom": "Soulevé de terre roumain barre — rappel ischios",
            "muscle_principal": "Ischio-jambiers",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Rowing T-bar (ou machine) — rappel dos",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
              {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
            ]
          },
          {
            "nom": "Tirage horizontal poulie — rappel dos",
            "muscle_principal": "Dos",
            "sets": [
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
              {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
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
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ 3 templates created for coach %', v_coach_id;

END $$;
