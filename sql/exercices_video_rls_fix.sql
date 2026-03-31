-- ============================================================
-- FIX: Exercise demo videos not visible to athletes
-- Root cause: RLS policies on exercices excluded base exercises
--   (coach_id IS NULL) and exercice_overrides had no athlete policy
-- Execute in Supabase SQL Editor
-- Date: 2026-03-29
-- ============================================================

-- ============================================================
-- A) Fix exercices SELECT policies — include base exercises (coach_id IS NULL)
-- ============================================================

-- Drop the broken policies
DROP POLICY IF EXISTS "coach_manage_exercices" ON exercices;
DROP POLICY IF EXISTS "athlete_read_coach_exercices" ON exercices;

-- Coach can manage their own exercises + read base exercises
CREATE POLICY "coach_manage_exercices" ON exercices FOR ALL
  USING (coach_id = auth.uid() OR coach_id IS NULL)
  WITH CHECK (coach_id = auth.uid());

-- Athletes can read their coach's custom exercises + base exercises
CREATE POLICY "athlete_read_coach_exercices" ON exercices FOR SELECT
  USING (
    coach_id IN (SELECT coach_id FROM athletes WHERE user_id = auth.uid())
    OR coach_id IS NULL
  );

-- ============================================================
-- B) Add RLS for exercice_overrides — athletes need to read coach overrides
-- ============================================================

ALTER TABLE exercice_overrides ENABLE ROW LEVEL SECURITY;

-- Coach can manage their own overrides
DROP POLICY IF EXISTS "coach_manage_overrides" ON exercice_overrides;
CREATE POLICY "coach_manage_overrides" ON exercice_overrides FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Athletes can read their coach's overrides
DROP POLICY IF EXISTS "athlete_read_coach_overrides" ON exercice_overrides;
CREATE POLICY "athlete_read_coach_overrides" ON exercice_overrides FOR SELECT
  USING (
    coach_id IN (SELECT coach_id FROM athletes WHERE user_id = auth.uid())
  );

-- ============================================================
-- DONE — Verify with:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('exercices', 'exercice_overrides')
-- ORDER BY tablename, policyname;
-- ============================================================
