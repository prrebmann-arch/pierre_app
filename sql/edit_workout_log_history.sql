-- Migration: edit workout log history (7-day window)
-- Date: 2026-04-29
-- Adds edited_at + locked_at columns and RLS policies for athlete-side edits.

BEGIN;

-- 1. Columns
ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ
  GENERATED ALWAYS AS (
    -- COALESCE(started_at, created_at): if both are null (should not happen
    -- since created_at has a NOT NULL default), locked_at becomes NULL and
    -- the row is permanently locked — defensive lockout.
    COALESCE(started_at, created_at) + INTERVAL '7 days'
  ) STORED;
-- Note: locked_at is derived from started_at/created_at and will silently
-- update if started_at is backfilled later. We assume started_at is set
-- once at session start and never modified. If a future feature mutates
-- started_at on existing rows, replace this with a trigger that freezes
-- locked_at on first INSERT.

-- Assumption: workout_logs.athlete_id is the auth.users(id) of the athlete.
-- If the column is renamed (e.g. user_id), update the policies below.

-- 2. RLS policies — assume RLS already enabled on workout_logs
DROP POLICY IF EXISTS "athlete can edit own unlocked logs" ON workout_logs;
CREATE POLICY "athlete can edit own unlocked logs" ON workout_logs
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at)
  WITH CHECK (athlete_id = auth.uid() AND now() < locked_at);

DROP POLICY IF EXISTS "athlete can delete own unlocked logs" ON workout_logs;
CREATE POLICY "athlete can delete own unlocked logs" ON workout_logs
  FOR DELETE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at);

-- 3. Defensive: ensure execution_videos cascades on workout_log delete
-- (Idempotent: drop if exists, recreate. Skip if FK constraint name differs.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'execution_videos_workout_log_id_fkey'
      AND table_name = 'execution_videos'
  ) THEN
    ALTER TABLE execution_videos
      DROP CONSTRAINT execution_videos_workout_log_id_fkey;
  END IF;

  ALTER TABLE execution_videos
    ADD CONSTRAINT execution_videos_workout_log_id_fkey
    FOREIGN KEY (workout_log_id)
    REFERENCES workout_logs(id)
    ON DELETE CASCADE;
END $$;

COMMIT;
