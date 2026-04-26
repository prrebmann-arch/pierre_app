-- ============================================================
-- Add audio_url column to posing_retours for voice messages
-- Date: 2026-04-24
-- ============================================================

ALTER TABLE public.posing_retours
  ADD COLUMN IF NOT EXISTS audio_url text;
