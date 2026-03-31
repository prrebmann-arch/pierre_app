-- ============================================================
-- RLS POLICIES — execution_videos
-- Execute in Supabase SQL Editor
-- Date: 2026-03-29
-- ============================================================
-- Fix: Athletes could not UPDATE workout_log_id on their own
-- videos, so linkOrphanedVideos silently failed (0 rows updated).
-- ============================================================

ALTER TABLE execution_videos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "athlete_manage_own_videos" ON execution_videos;
DROP POLICY IF EXISTS "coach_read_athlete_videos" ON execution_videos;

-- Athletes can manage (insert, select, update, delete) their own videos
CREATE POLICY "athlete_manage_own_videos" ON execution_videos FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- Coaches can read videos of their athletes
CREATE POLICY "coach_read_athlete_videos" ON execution_videos FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- Coaches can update videos (for feedback)
DROP POLICY IF EXISTS "coach_update_athlete_videos" ON execution_videos;
CREATE POLICY "coach_update_athlete_videos" ON execution_videos FOR UPDATE
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );
