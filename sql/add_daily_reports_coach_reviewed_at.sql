-- Add coach_reviewed_at column to daily_reports
-- Used by BilansOverview to mark a bilan as "traité" without re-sending a notification
-- (the actual feedback/retour is sent from the athlete-specific bilan page).

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS coach_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_daily_reports_coach_reviewed_at
  ON public.daily_reports (coach_reviewed_at)
  WHERE coach_reviewed_at IS NULL;
