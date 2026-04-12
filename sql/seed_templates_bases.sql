-- ============================================================
-- MOMENTUM — Batch 4 : Formats de base (Antonin cours 1)
-- Full Body 3j, Upper/Lower 4j, Femme Lower 3j, PPL rotation
-- ============================================================

DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  SELECT id INTO v_coach_id FROM auth.users WHERE email = 'pr.rebmann@gmail.com' LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach not found.';
  END IF;

  DELETE FROM training_templates WHERE coach_id = v_coach_id AND category IN ('Full Body 3j', 'Upper/Lower 4j', 'Femme Lower 3j', 'PPL Rotation');

  -- ============================================================
  -- 1. FULL BODY 3J — DÉBUTANT
  -- (Antonin cours 1 : patterns principaux, pas de surcharge,
  --  apprentissage technique, 2-3x/sem)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Full Body 3j — Débutant',
    v_coach_id,
    'Full Body 3j',
    'fixed',
    '{"days": ["Lundi", "Mercredi", "Vendredi"]}',
    '[
      {
        "nom": "Full Body A",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Développé couché haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Rowing machine (ou haltère)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
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
          {"nom": "Élévation latérale haltères", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Full Body B",
        "jour": "Mercredi",
        "exercices": [
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Développé incliné haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Presse à cuisses", "muscle_principal": "Quadriceps", "sets": [
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
      },
      {
        "nom": "Full Body C",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Dips (ou développé décliné machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Rowing barre (ou T-bar)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Élévation latérale haltères", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. FEMME LOWER 3J — DÉBUTANTE
  -- (Antonin cours 1 : Lower/Lower/Lower avec delto lat ou dos en début)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Femme Lower 3j — Débutante',
    v_coach_id,
    'Femme Lower 3j',
    'fixed',
    '{"days": ["Lundi", "Mercredi", "Vendredi"]}',
    '[
      {
        "nom": "Lower A + Dos",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Rowing machine (ou haltère)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Squat Smith (ou presse)", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Hip thrust machine (ou barre)", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
          ]},
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      },
      {
        "nom": "Lower B + Delto lat",
        "jour": "Mercredi",
        "exercices": [
          {"nom": "Élévation latérale haltères", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Presse à cuisses", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Fentes statiques Smith", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Soulevé de terre roumain haltères", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Abduction machine", "muscle_principal": "Fessiers", "superset_id": "A1", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Adduction machine", "muscle_principal": "Adducteurs", "superset_id": "A2", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Lower C + Dos",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 3. UPPER/LOWER 4J — JEUNE INTERMÉDIAIRE
  -- (Antonin cours 1 : phase 2, 4x/sem, apprentissage de l'effort)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Upper/Lower 4j — Jeune intermédiaire',
    v_coach_id,
    'Upper/Lower 4j',
    'fixed',
    '{"days": ["Lundi", "Mardi", "Jeudi", "Vendredi"]}',
    '[
      {
        "nom": "Upper A",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Développé incliné Smith (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
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
          {"nom": "Élévation latérale machine", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "10-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Curl poulie basse", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Pushdown corde", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Lower A",
        "jour": "Mardi",
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
          {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [
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
        "jour": "Jeudi",
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
          {"nom": "Tirage horizontal poulie", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Développé couché haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Reverse pec deck (delto post)", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]},
          {"nom": "Curl marteau haltères", "muscle_principal": "Biceps", "superset_id": "A1", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]},
          {"nom": "Extension triceps haltères allongé", "muscle_principal": "Triceps", "superset_id": "A2", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Lower B",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Soulevé de terre roumain barre", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
          ]},
          {"nom": "Presse à cuisses", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
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
  -- 4. PPL ROTATION — INTERMÉDIAIRE+
  -- (Antonin cours 1 : Push/Pull/Legs/Off en rotation,
  --  jambes 2x sur le bloc, pour quand split 5j ne suffit plus)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'PPL Rotation — Intermédiaire+',
    v_coach_id,
    'PPL Rotation',
    'pattern',
    '{"pattern": "Push / Pull / Legs / Repos"}',
    '[
      {
        "nom": "Push",
        "jour": "Jour 1",
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
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      },
      {
        "nom": "Pull",
        "jour": "Jour 2",
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
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Legs",
        "jour": "Jour 3",
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
          {"nom": "Crunch poulie haute", "muscle_principal": "Abdominaux", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ 4 base templates created (Full Body, Femme Lower, Upper/Lower, PPL)';

END $$;
