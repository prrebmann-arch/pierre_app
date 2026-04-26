-- ============================================================
-- Daily Actions — "3 actions à faire aujourd'hui"
-- Date: 2026-04-24
-- ============================================================
-- Date-specific todos (non récurrents), typiquement 3/jour,
-- ajoutés par l'athlète le matin pour prioriser sa journée.
-- Différent des routine_items qui sont des habitudes récurrentes.
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date          date NOT NULL DEFAULT current_date,
  text          text NOT NULL,
  emoji         text,
  display_order smallint NOT NULL DEFAULT 0,
  completed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_actions_athlete_date_idx
  ON daily_actions(athlete_id, date);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_daily_actions_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_actions_updated_at ON daily_actions;
CREATE TRIGGER daily_actions_updated_at
  BEFORE UPDATE ON daily_actions
  FOR EACH ROW EXECUTE FUNCTION set_daily_actions_updated_at();

-- RLS
ALTER TABLE daily_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_manage_own_daily_actions" ON daily_actions;
DROP POLICY IF EXISTS "coach_read_daily_actions" ON daily_actions;

CREATE POLICY "athlete_manage_own_daily_actions" ON daily_actions FOR ALL
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));

CREATE POLICY "coach_read_daily_actions" ON daily_actions FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));
