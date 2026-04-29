-- Manual RLS test scenarios for edit_workout_log_history.sql
-- Run in Supabase SQL Editor after executing the migration.
-- Substitute UUIDs with real values from your dev environment.

-- Pre-req: 2 athletes (A and B), 2 workout_logs (one for each)
-- Set up a recent log (within 7d) and an old log (>7d) for athlete A.

-- Test 1: Athlete A can update own recent log (expected: 1 row updated)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "<athlete_a_uuid>"}';
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

-- Test 4: Same matrix for DELETE
DELETE FROM workout_logs WHERE id = '<athlete_a_old_log_id>';   -- expected: 0
DELETE FROM workout_logs WHERE id = '<athlete_a_recent_log_id>'; -- expected: 1 (cascade execution_videos)
