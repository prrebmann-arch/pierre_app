-- ============================================================
-- RLS POLICIES — Supplements tables
-- Execute in Supabase SQL Editor
-- Date: 2026-03-29
-- ============================================================
-- Fix: Athletes could not read supplements/athlete_supplements
-- due to missing RLS policies. Queries returned empty data,
-- causing "Aucune supplementation" in the athlete app.
-- ============================================================

-- ============================================================
-- 1. athlete_supplements — athletes read/update their own rows
-- ============================================================

ALTER TABLE athlete_supplements ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "coach_manage_athlete_supplements" ON athlete_supplements;
DROP POLICY IF EXISTS "athlete_read_own_supplements" ON athlete_supplements;

-- Coach can manage all assignments for their athletes
CREATE POLICY "coach_manage_athlete_supplements" ON athlete_supplements FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- Athletes can read their own supplement assignments
CREATE POLICY "athlete_read_own_supplements" ON athlete_supplements FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );


-- ============================================================
-- 2. supplements — athletes can read supplements assigned to them
-- ============================================================

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "coach_manage_supplements" ON supplements;
DROP POLICY IF EXISTS "athlete_read_assigned_supplements" ON supplements;

-- Coach can manage their own supplements
CREATE POLICY "coach_manage_supplements" ON supplements FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Athletes can read supplements that are assigned to them
CREATE POLICY "athlete_read_assigned_supplements" ON supplements FOR SELECT
  USING (
    id IN (
      SELECT supplement_id FROM athlete_supplements
      WHERE athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    )
  );


-- ============================================================
-- 3. supplement_logs — athletes manage their own logs
-- ============================================================

ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "coach_read_athlete_supplement_logs" ON supplement_logs;
DROP POLICY IF EXISTS "athlete_manage_own_supplement_logs" ON supplement_logs;

-- Coach can read logs for their athletes
CREATE POLICY "coach_read_athlete_supplement_logs" ON supplement_logs FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- Athletes can manage (read/insert/update) their own logs
CREATE POLICY "athlete_manage_own_supplement_logs" ON supplement_logs FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );


-- ============================================================
-- 4. supplement_dosage_history — read access for athletes
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supplement_dosage_history') THEN
    ALTER TABLE supplement_dosage_history ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "coach_manage_dosage_history" ON supplement_dosage_history;
    CREATE POLICY "coach_manage_dosage_history" ON supplement_dosage_history FOR ALL
      USING (
        athlete_supplement_id IN (
          SELECT id FROM athlete_supplements
          WHERE athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
        )
      )
      WITH CHECK (
        athlete_supplement_id IN (
          SELECT id FROM athlete_supplements
          WHERE athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
        )
      );

    DROP POLICY IF EXISTS "athlete_read_own_dosage_history" ON supplement_dosage_history;
    CREATE POLICY "athlete_read_own_dosage_history" ON supplement_dosage_history FOR SELECT
      USING (
        athlete_supplement_id IN (
          SELECT id FROM athlete_supplements
          WHERE athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
        )
      );
  END IF;
END $$;


-- ============================================================
-- 5. Ensure start_date column exists (from BUG-5)
-- ============================================================

ALTER TABLE athlete_supplements ADD COLUMN IF NOT EXISTS start_date DATE;


-- ============================================================
-- DONE — Verify with:
-- SELECT tablename, policyname, permissive, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('supplements', 'athlete_supplements', 'supplement_logs', 'supplement_dosage_history')
-- ORDER BY tablename, policyname;
-- ============================================================
