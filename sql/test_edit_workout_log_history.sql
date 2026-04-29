-- Manual RLS test scenarios for edit_workout_log_history.sql
-- Run in Supabase SQL Editor after executing the migration.
-- Substitute UUIDs with real values from your dev environment.

-- Pre-req: 2 athletes (A and B), 2 workout_logs (one for each)
-- Set up a recent log (within 7d) and an old log (>7d) for athlete A.

-- Wrap in a transaction so SET LOCAL applies and the test mutations roll back.
BEGIN;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "<athlete_a_uuid>"}';

-- Test 1: Athlete A can update own recent log (expected: 1 row updated)
UPDATE workout_logs
  SET exercices_completes = '[]'::jsonb, edited_at = now()
  WHERE id = '<athlete_a_recent_log_id>';

-- Test 2: Athlete A cannot update old log (expected: 0 rows)
UPDATE workout_logs
  SET exercices_completes = '[]'::jsonb, edited_at = now()
  WHERE id = '<athlete_a_old_log_id>';

-- Test 3: Athlete A cannot update Athlete B's log (expected: 0 rows)
UPDATE workout_logs
  SET exercices_completes = '[]'::jsonb, edited_at = now()
  WHERE id = '<athlete_b_log_id>';

-- Test 4a: Athlete A cannot DELETE old log (expected: 0 rows)
DELETE FROM workout_logs WHERE id = '<athlete_a_old_log_id>';

-- Test 4b: Athlete A can DELETE own recent log (expected: 1 row, cascades execution_videos)
DELETE FROM workout_logs WHERE id = '<athlete_a_recent_log_id>';

-- Roll back so this script can be re-run.
ROLLBACK;
