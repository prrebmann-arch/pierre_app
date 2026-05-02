-- Allow coach to UPDATE and DELETE menstrual_logs of their athletes
-- (currently coach has only SELECT, so edits/deletes silently fail).

DROP POLICY IF EXISTS "coach_update_athlete_menstrual" ON menstrual_logs;
CREATE POLICY "coach_update_athlete_menstrual" ON menstrual_logs FOR UPDATE
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "coach_delete_athlete_menstrual" ON menstrual_logs;
CREATE POLICY "coach_delete_athlete_menstrual" ON menstrual_logs FOR DELETE
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );
