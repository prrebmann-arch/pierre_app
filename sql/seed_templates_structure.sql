-- ============================================================
-- MOMENTUM — Batch 5 : Variantes structurelles + Full Body 2j
-- Source : Cours 3 (pecs cage), Cours 7-8 (fémur, bikini/wellness)
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  DELETE FROM training_templates WHERE coach_id = v_coach_id AND category IN ('Structure', 'Femme Bikini/Wellness', 'Full Body 2j');

  -- ============================================================
  -- 1. FULL BODY 2J — DÉBUTANT
  -- (Antonin cours 1 : 2-3x/sem, patterns principaux)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Full Body 2j — Débutant',
    v_coach_id,
    'Full Body 2j',
    'fixed',
    '{"days": ["Lundi", "Jeudi"]}',
    '[
      {
        "nom": "Full Body A",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Développé couché haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Rowing machine (ou haltère)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Élévation latérale haltères", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Full Body B",
        "jour": "Jeudi",
        "exercices": [
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Développé incliné haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Presse à cuisses", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Hip thrust machine (ou barre)", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
          ]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. SPLIT 5J — CAGE ÉPAISSE
  -- (Cours 3 pecs : plus d'incliné, isolation en début,
  --  le plat recrute moins bien sur cage épaisse)
  -- Modif vs base : plus d'incliné, pas de plat, dips décliné
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Cage épaisse',
    v_coach_id,
    'Structure',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux (cage épaisse)",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Poulie vis-à-vis inclinée (isolation début)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Développé incliné Smith (+15/+30°)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Développé incliné haltères (angle différent)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
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
          ]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "sets": [
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
      },
      {
        "nom": "Épaules + Rappel Pecs (cage épaisse)",
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
          ]},
          {"nom": "Poulie vis-à-vis inclinée (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Développé incliné machine (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]}
        ]
      },
      {
        "nom": "Bras + Rappel Dos",
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
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Rowing unilatéral poulie (rappel dos)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Tirage vertical prise neutre (rappel dos)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
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
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 3. SPLIT 5J — CAGE ÉTROITE
  -- (Cours 3 : plat et décliné recrutent mieux, pecs plus faciles)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Cage étroite',
    v_coach_id,
    'Structure',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux (cage étroite)",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Pec Deck (isolation début)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Développé couché haltères (plat)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Dips (décliné — point fort cage étroite)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      },
      {
        "nom": "Dos",
        "jour": "Mardi",
        "exercices": [
          {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
        ]
      },
      {
        "nom": "Épaules + Rappel Pecs (cage étroite)",
        "jour": "Jeudi",
        "exercices": [
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
          {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Poulie vis-à-vis (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Développé couché machine (rappel pecs — plat)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
        ]
      },
      {
        "nom": "Bras + Rappel Dos",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Rowing unilatéral poulie (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Tirage vertical prise neutre (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
        ]
      },
      {
        "nom": "Jambes",
        "jour": "Samedi",
        "exercices": [
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 4. SPLIT 5J — FÉMUR LONG
  -- (Cours 7-8 : pas de squat libre, presse/hack squat privilégiés)
  -- Seule la séance jambes change vs base
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j — Fémur long',
    v_coach_id,
    'Structure',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Pectoraux",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Développé incliné Smith", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
        ]
      },
      {
        "nom": "Dos",
        "jour": "Mardi",
        "exercices": [
          {"nom": "Pullover poulie (corde)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Rowing T-bar", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
        ]
      },
      {
        "nom": "Épaules + Rappel Pecs",
        "jour": "Jeudi",
        "exercices": [
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m30"}]},
          {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Poulie vis-à-vis (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Développé couché machine (rappel pecs)", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
        ]
      },
      {
        "nom": "Bras + Rappel Dos",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Curl incliné haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Pushdown corde longue", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Curl pupitre poulie", "muscle_principal": "Biceps", "superset_id": "B1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Extension overhead poulie (corde)", "muscle_principal": "Triceps", "superset_id": "B2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Rowing unilatéral poulie (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Tirage vertical prise neutre (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]}
        ]
      },
      {
        "nom": "Jambes (fémur long — pas de squat libre)",
        "jour": "Samedi",
        "exercices": [
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Presse à cuisses (fémur long)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
          {"nom": "Hack squat (fémur long)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 5. SPLIT 5J FEMME — BIKINI
  -- (Cours 7-8 : ratio fessiers > quads, silhouette en V inversé)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j Femme — Bikini',
    v_coach_id,
    'Femme Bikini/Wellness',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Fessiers (séance principale)",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"}]},
          {"nom": "Fentes bulgares Smith", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Abduction machine (fessier moyen)", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"}]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
        ]
      },
      {
        "nom": "Haut du corps (Dos + Épaules)",
        "jour": "Mardi",
        "exercices": [
          {"nom": "Rowing unilatéral poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Reverse pec deck", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Curl poulie basse", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Pushdown corde", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
        ]
      },
      {
        "nom": "Quads (MV — bikini pas trop de quads) + Abdos",
        "jour": "Jeudi",
        "exercices": [
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Presse à cuisses", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Relevé de jambes suspendu", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}]}
        ]
      },
      {
        "nom": "Rappel Fessiers + Haut du corps",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Hip thrust machine (rappel)", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
          {"nom": "Abduction machine (rappel)", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Pec Deck", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Développé incliné machine", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
        ]
      },
      {
        "nom": "Rappel Ischios + Rappel Dos",
        "jour": "Samedi",
        "exercices": [
          {"nom": "Leg curl assis (rappel)", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Soulevé de terre roumain barre (rappel)", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Rowing T-bar (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Tirage horizontal poulie (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 6. SPLIT 5J FEMME — WELLNESS
  -- (Cours 7-8 : plus de quads + fessiers massifs, cuisses épaisses)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Split 5j Femme — Wellness',
    v_coach_id,
    'Femme Bikini/Wellness',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Vendredi", "Samedi"]}',
    '[
      {
        "nom": "Fessiers + Ischios",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "20X1", "repos": "2m"}]},
          {"nom": "Fentes bulgares Smith", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Abduction machine (fessier moyen)", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m30"}]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
        ]
      },
      {
        "nom": "Haut du corps (Dos + Épaules)",
        "jour": "Mardi",
        "exercices": [
          {"nom": "Rowing unilatéral poulie", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Reverse pec deck", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Curl poulie basse", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]},
          {"nom": "Pushdown corde", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}]}
        ]
      },
      {
        "nom": "Quadriceps (wellness = volume quads) + Abdos",
        "jour": "Jeudi",
        "exercices": [
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}]},
          {"nom": "Hack squat (ou fentes Smith)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Relevé de jambes suspendu", "muscle_principal": "Abdominaux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}]}
        ]
      },
      {
        "nom": "Rappel Fessiers + Haut du corps (Pecs)",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Hip thrust machine (rappel)", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},{"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}]},
          {"nom": "Abduction machine (rappel)", "muscle_principal": "Fessiers", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]},
          {"nom": "Pec Deck", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Développé incliné machine", "muscle_principal": "Pectoraux", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Développé épaules haltères (semi-neutre)", "muscle_principal": "Épaules", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]}
        ]
      },
      {
        "nom": "Rappel Ischios + Rappel Quads + Dos",
        "jour": "Samedi",
        "exercices": [
          {"nom": "Leg curl assis (rappel)", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Soulevé de terre roumain barre (rappel)", "muscle_principal": "Ischio-jambiers", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Leg extension (rappel quads)", "muscle_principal": "Quadriceps", "sets": [{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Rowing T-bar (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},{"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}]},
          {"nom": "Tirage horizontal poulie (rappel dos)", "muscle_principal": "Dos", "sets": [{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},{"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}]},
          {"nom": "Mollets assis", "muscle_principal": "Mollets", "sets": [{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},{"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}]}
        ]
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ 6 templates created (Full Body 2j, cage épaisse, cage étroite, fémur long, bikini, wellness)';

END $$;
