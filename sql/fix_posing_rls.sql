-- ============================================================
-- Fix: posing_videos RLS missing → athlete never sees videos
-- Date: 2026-04-24
-- ============================================================
-- Bug: Coach uploads a posing video from ATHLETE app or web,
-- row lands in posing_videos with athlete_id set, BUT the table
-- has no RLS SELECT policy — athlete query returns [] silently.
-- ============================================================

ALTER TABLE posing_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_read_own_posing_videos" ON posing_videos;
DROP POLICY IF EXISTS "athlete_manage_own_posing_videos" ON posing_videos;
DROP POLICY IF EXISTS "coach_manage_athlete_posing_videos" ON posing_videos;

-- Athlete: full access to their own posing videos (they also UPLOAD from the app)
CREATE POLICY "athlete_manage_own_posing_videos" ON posing_videos FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- Coach: full access to their athletes' posing videos
CREATE POLICY "coach_manage_athlete_posing_videos" ON posing_videos FOR ALL
  USING (
    coach_id = auth.uid()
    OR athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    coach_id = auth.uid()
    OR athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- Verify with:
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'posing_videos';
