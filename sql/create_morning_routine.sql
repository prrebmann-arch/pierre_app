-- ============================================================
-- Morning Routine — Tables + RLS
-- Date: 2026-04-24
-- ============================================================
-- Feature: daily checklist ("morning routine") with 3 pinned
-- priority items ("top 3 du jour"). Coach-assigned template +
-- athlete overrides. Logs reset daily.
-- RLS pattern mirrors athlete_supplements / supplement_logs.
-- ============================================================

-- ============================================================
-- 1. routine_items — template (coach-created) + overrides (athlete-created)
-- ============================================================

CREATE TABLE IF NOT EXISTS routine_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title           text NOT NULL,
  emoji           text,
  is_priority     boolean NOT NULL DEFAULT false,
  priority_order  smallint,
  display_order   smallint NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_by      text NOT NULL CHECK (created_by IN ('coach','athlete')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT routine_items_priority_order_check
    CHECK (is_priority = false OR (priority_order IS NOT NULL AND priority_order BETWEEN 0 AND 2))
);

CREATE INDEX IF NOT EXISTS routine_items_athlete_active_idx
  ON routine_items(athlete_id) WHERE active = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_routine_items_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS routine_items_updated_at ON routine_items;
CREATE TRIGGER routine_items_updated_at
  BEFORE UPDATE ON routine_items
  FOR EACH ROW EXECUTE FUNCTION set_routine_items_updated_at();


-- ============================================================
-- 2. routine_logs — one row per (item, date) when checked
-- ============================================================

CREATE TABLE IF NOT EXISTS routine_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_item_id  uuid NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  athlete_id       uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date             date NOT NULL DEFAULT current_date,
  completed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routine_item_id, date)
);

CREATE INDEX IF NOT EXISTS routine_logs_athlete_date_idx
  ON routine_logs(athlete_id, date);


-- ============================================================
-- 3. RLS — routine_items
-- ============================================================

ALTER TABLE routine_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_manage_routine_items" ON routine_items;
DROP POLICY IF EXISTS "athlete_manage_own_routine_items" ON routine_items;

-- Coach: full access to items of their athletes
CREATE POLICY "coach_manage_routine_items" ON routine_items FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- Athlete: full access to their own items (read, add, edit, delete)
CREATE POLICY "athlete_manage_own_routine_items" ON routine_items FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );


-- ============================================================
-- 4. RLS — routine_logs
-- ============================================================

ALTER TABLE routine_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_read_routine_logs" ON routine_logs;
DROP POLICY IF EXISTS "athlete_manage_own_routine_logs" ON routine_logs;

-- Coach: read-only access to logs of their athletes (engagement widget)
CREATE POLICY "coach_read_routine_logs" ON routine_logs FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- Athlete: manage their own logs
CREATE POLICY "athlete_manage_own_routine_logs" ON routine_logs FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );


-- ============================================================
-- DONE — Verify with:
--   SELECT tablename, policyname, cmd FROM pg_policies
--     WHERE schemaname='public' AND tablename IN ('routine_items','routine_logs')
--     ORDER BY tablename, policyname;
--   \d routine_items
--   \d routine_logs
-- ============================================================
