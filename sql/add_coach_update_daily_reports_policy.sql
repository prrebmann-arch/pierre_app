-- Allow coach to UPDATE coach_reviewed_at on athletes' daily_reports.
-- Without this policy, the UPDATE in BilansOverview "Marquer comme traité"
-- silently affects 0 rows (RLS-filtered).

DROP POLICY IF EXISTS "coach_update_athlete_reports" ON public.daily_reports;

CREATE POLICY "coach_update_athlete_reports" ON public.daily_reports
  FOR UPDATE
  USING (
    user_id IN (SELECT user_id FROM public.athletes WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT user_id FROM public.athletes WHERE coach_id = auth.uid())
  );
