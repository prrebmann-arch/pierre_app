-- ============================================================
-- MOMENTUM — Batch 7 : Templates issus de la FAQ 1 + cours 1
-- Full Body 5/4/3 (débutant) + PPL/Off/Upper/Off
-- Source : FAQ 1 Antonin + Cours 1 (ligne 193)
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
  -- 1. FULL BODY 3J — DÉBUTANT (volume 5/4/3)
  -- (FAQ 1 : 1er exo 5 séries, 2e exo 4 séries, 3e exo 3 séries)
  -- 3 exos par séance, sets décroissants
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Full Body 3j — Débutant (5/4/3)',
    v_coach_id,
    'Full Body 3j',
    'fixed',
    '{"days": ["Lundi", "Mercredi", "Vendredi"]}',
    '[
      {
        "nom": "Full Body A (5/4/3)",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Développé couché haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
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
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]}
        ]
      },
      {
        "nom": "Full Body B (5/4/3)",
        "jour": "Mercredi",
        "exercices": [
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Hip thrust machine (ou barre)", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
          ]},
          {"nom": "Élévation latérale haltères", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Full Body C (5/4/3)",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Presse à cuisses", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Développé incliné haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 2. FEMME LOWER 3J — DÉBUTANTE (volume 5/4/3)
  -- (FAQ 1 : hip thrust 5 séries, squat 4 séries, leg curl 3 séries)
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'Femme Lower 3j — Débutante (5/4/3)',
    v_coach_id,
    'Femme Lower 3j',
    'fixed',
    '{"days": ["Lundi", "Mercredi", "Vendredi"]}',
    '[
      {
        "nom": "Lower A — Fessiers focus (5/4/3)",
        "jour": "Lundi",
        "exercices": [
          {"nom": "Hip thrust machine (ou barre)", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
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
          ]}
        ]
      },
      {
        "nom": "Lower B — Quads focus (5/4/3)",
        "jour": "Mercredi",
        "exercices": [
          {"nom": "Leg extension", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Presse à cuisses", "muscle_principal": "Quadriceps", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m30"}
          ]},
          {"nom": "Élévation latérale haltères", "muscle_principal": "Épaules", "sets": [
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"},
            {"type": "normal", "reps": "12-15", "tempo": "20X1", "repos": "1m"}
          ]}
        ]
      },
      {
        "nom": "Lower C — Ischios focus (5/4/3)",
        "jour": "Vendredi",
        "exercices": [
          {"nom": "Hip thrust machine", "muscle_principal": "Fessiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"},
            {"type": "normal", "reps": "10-12", "tempo": "20X1", "repos": "2m"}
          ]},
          {"nom": "Leg curl assis", "muscle_principal": "Ischio-jambiers", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Rowing machine (ou haltère)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m30"}
          ]}
        ]
      }
    ]'::jsonb
  );

  -- ============================================================
  -- 3. PPL / OFF / UPPER / OFF — INTERMÉDIAIRE
  -- (Cours 1 ligne 193 : format intermédiaire avant le split)
  -- Push : 3 exos pecs (3 séries) + triceps + delto lat
  -- Pull : Dos + biceps + delto post
  -- Legs : Quads + ischios
  -- Upper : 2 exos pecs + 2 exos dos + 1 delto lat + 1 biceps
  -- ============================================================
  INSERT INTO training_templates (nom, coach_id, category, pattern_type, pattern_data, sessions_data)
  VALUES (
    'PPL/Off/Upper/Off — Intermédiaire',
    v_coach_id,
    'PPL + Upper',
    'pattern',
    '{"pattern": "Push / Pull / Legs / Repos / Upper / Repos"}',
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
          {"nom": "Développé incliné Smith (ou machine)", "muscle_principal": "Pectoraux", "sets": [
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
          {"nom": "Extensions triceps double corde", "muscle_principal": "Triceps", "sets": [
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
          {"nom": "Rowing T-bar (ou rowing unilatéral)", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "2m"}
          ]},
          {"nom": "Tirage vertical prise neutre", "muscle_principal": "Dos", "sets": [
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "8-12", "tempo": "30X1", "repos": "1m30"}
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
        "nom": "Upper (rappel pecs + dos + delto lat + biceps)",
        "jour": "Jour 5",
        "exercices": [
          {"nom": "Pec Deck (ou poulie vis-à-vis)", "muscle_principal": "Pectoraux", "sets": [
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"},
            {"type": "normal", "reps": "10-15", "tempo": "30X1", "repos": "1m30"}
          ]},
          {"nom": "Développé couché haltères (ou machine)", "muscle_principal": "Pectoraux", "sets": [
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
          {"nom": "Curl marteau haltères", "muscle_principal": "Biceps", "sets": [
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"},
            {"type": "normal", "reps": "10-12", "tempo": "30X1", "repos": "1m"}
          ]}
        ]
      }
    ]'::jsonb
  );

  RAISE NOTICE '✅ 3 templates created (Full Body 5/4/3, Femme Lower 5/4/3, PPL/Off/Upper/Off)';

END $$;
