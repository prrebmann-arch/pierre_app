-- ============================================================
-- ATHLETE FOOD ITEMS — Favoris & Récents personnels par athlète
-- Date: 2026-04-28
-- Spec: docs/superpowers/specs/2026-04-28-nutrition-favorites-recents-design.md
-- Execute in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS athlete_food_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,

  nom             TEXT NOT NULL,
  nom_normalized  TEXT NOT NULL,
  barcode         TEXT,
  source          TEXT NOT NULL CHECK (source IN ('openfoodfacts','ciqual','aliments_db','manual')),

  calories        NUMERIC(10,4) NOT NULL DEFAULT 0,
  proteines       NUMERIC(10,4) NOT NULL DEFAULT 0,
  glucides        NUMERIC(10,4) NOT NULL DEFAULT 0,
  lipides         NUMERIC(10,4) NOT NULL DEFAULT 0,
  default_qte_g   NUMERIC(10,2) NOT NULL DEFAULT 100,

  is_favorite     BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  use_count       INT NOT NULL DEFAULT 1,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dédup: barcode quand présent, sinon nom_normalized
CREATE UNIQUE INDEX IF NOT EXISTS athlete_food_items_dedup_barcode_idx
  ON athlete_food_items (athlete_id, barcode)
  WHERE barcode IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS athlete_food_items_dedup_name_idx
  ON athlete_food_items (athlete_id, nom_normalized)
  WHERE barcode IS NULL;

CREATE INDEX IF NOT EXISTS athlete_food_items_search_idx
  ON athlete_food_items (athlete_id, nom_normalized);

CREATE INDEX IF NOT EXISTS athlete_food_items_recent_idx
  ON athlete_food_items (athlete_id, last_used_at DESC);

-- Auto updated_at
CREATE OR REPLACE FUNCTION set_athlete_food_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_athlete_food_items_updated_at ON athlete_food_items;
CREATE TRIGGER trg_athlete_food_items_updated_at
  BEFORE UPDATE ON athlete_food_items
  FOR EACH ROW EXECUTE FUNCTION set_athlete_food_items_updated_at();

-- RLS
ALTER TABLE athlete_food_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS athlete_food_items_athlete_all ON athlete_food_items;
CREATE POLICY athlete_food_items_athlete_all ON athlete_food_items
  FOR ALL
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS athlete_food_items_coach_read ON athlete_food_items;
CREATE POLICY athlete_food_items_coach_read ON athlete_food_items
  FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));
