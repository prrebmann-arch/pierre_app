-- ============================================================
-- Link bilan_retours rows back to a specific execution_video
-- so the athlete's "Guide" tab on a workout exercise can surface
-- retours sent from the coach's video-detail page.
-- Date: 2026-05-01
-- Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE bilan_retours
  ADD COLUMN IF NOT EXISTS execution_video_id uuid
    REFERENCES execution_videos(id) ON DELETE SET NULL;

-- Hot-path index: per-athlete look-up filtered by exec video.
CREATE INDEX IF NOT EXISTS idx_bilan_retours_exec_video
  ON bilan_retours (execution_video_id)
  WHERE execution_video_id IS NOT NULL;

COMMENT ON COLUMN bilan_retours.execution_video_id IS
  'Set when the retour is created from a specific exercise video page. '
  'Lets the athlete app surface technique retours on the Guide tab while '
  'doing the same exercise in another session.';
