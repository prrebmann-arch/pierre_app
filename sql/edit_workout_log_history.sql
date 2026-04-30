-- Migration: edit workout log history (7-day window)
-- Date: 2026-04-29
-- Adds edited_at + locked_at columns and RLS policies for athlete-side edits.
--
-- Note on locked_at: we use a regular column populated by a BEFORE INSERT
-- trigger rather than a GENERATED STORED column because `timestamptz + interval`
-- is not IMMUTABLE in Postgres (timezone-dependent), and STORED generated
-- columns require an immutable expression. The trigger approach also gives us
-- write-once semantics: locked_at is frozen at row creation and never recomputed,
-- so future backfills of started_at cannot silently shift the lock window.

BEGIN;

-- 1. Columns
ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 2. Trigger to set locked_at on insert
CREATE OR REPLACE FUNCTION set_workout_log_locked_at()
RETURNS TRIGGER AS $$
BEGIN
  -- COALESCE(started_at, created_at): if both null (should not happen because
  -- created_at has NOT NULL default = now()), locked_at stays NULL → row is
  -- permanently locked (defensive).
  NEW.locked_at := COALESCE(NEW.started_at, NEW.created_at, now()) + INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workout_logs_set_locked_at ON workout_logs;
CREATE TRIGGER trg_workout_logs_set_locked_at
  BEFORE INSERT ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_workout_log_locked_at();

-- 3. Backfill existing rows
UPDATE workout_logs
  SET locked_at = COALESCE(started_at, created_at, now()) + INTERVAL '7 days'
  WHERE locked_at IS NULL;

-- Assumption: workout_logs.athlete_id is the auth.users(id) of the athlete.
-- If the column is renamed (e.g. user_id), update the policies below.

-- 4. RLS policies — assume RLS already enabled on workout_logs
DROP POLICY IF EXISTS "athlete can edit own unlocked logs" ON workout_logs;
CREATE POLICY "athlete can edit own unlocked logs" ON workout_logs
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at)
  WITH CHECK (athlete_id = auth.uid() AND now() < locked_at);

DROP POLICY IF EXISTS "athlete can delete own unlocked logs" ON workout_logs;
CREATE POLICY "athlete can delete own unlocked logs" ON workout_logs
  FOR DELETE TO authenticated
  USING (athlete_id = auth.uid() AND now() < locked_at);

-- 5. Defensive: ensure execution_videos cascades on workout_log delete
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
