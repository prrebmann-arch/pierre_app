-- ============================================================
-- RLS POLICIES — 9 tables critiques sans protection
-- Execute dans Supabase SQL Editor AVANT lancement
-- Date: 2026-03-29
-- ============================================================

-- ============================================================
-- 1. messages — conversations privées coach-athlète
-- ============================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_messages" ON messages;
CREATE POLICY "users_manage_own_messages" ON messages FOR ALL
  USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  )
  WITH CHECK (
    sender_id = auth.uid()
  );

-- ============================================================
-- 2. athletes — profils athlètes
-- ============================================================
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_read_own" ON athletes;
CREATE POLICY "athlete_read_own" ON athletes FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "athlete_update_own" ON athletes;
CREATE POLICY "athlete_update_own" ON athletes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "coach_manage_own_athletes" ON athletes;
CREATE POLICY "coach_manage_own_athletes" ON athletes FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ============================================================
-- 3. daily_reports — bilans (poids, photos, sommeil)
-- ============================================================
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_manage_own_reports" ON daily_reports;
CREATE POLICY "athlete_manage_own_reports" ON daily_reports FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "coach_read_athlete_reports" ON daily_reports;
CREATE POLICY "coach_read_athlete_reports" ON daily_reports FOR SELECT
  USING (
    user_id IN (SELECT user_id FROM athletes WHERE coach_id = auth.uid())
  );

-- ============================================================
-- 4. daily_tracking — suivi quotidien
-- ============================================================
ALTER TABLE daily_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_manage_own_tracking" ON daily_tracking;
CREATE POLICY "athlete_manage_own_tracking" ON daily_tracking FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "coach_read_athlete_tracking" ON daily_tracking;
CREATE POLICY "coach_read_athlete_tracking" ON daily_tracking FOR SELECT
  USING (
    user_id IN (SELECT user_id FROM athletes WHERE coach_id = auth.uid())
  );

-- ============================================================
-- 5. menstrual_logs — cycle menstruel (ultra sensible)
-- ============================================================
ALTER TABLE menstrual_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_manage_own_menstrual" ON menstrual_logs;
CREATE POLICY "athlete_manage_own_menstrual" ON menstrual_logs FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "coach_read_athlete_menstrual" ON menstrual_logs;
CREATE POLICY "coach_read_athlete_menstrual" ON menstrual_logs FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- ============================================================
-- 6. workout_logs — historique training
-- ============================================================
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_manage_own_logs" ON workout_logs;
CREATE POLICY "athlete_manage_own_logs" ON workout_logs FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "coach_read_athlete_logs" ON workout_logs;
CREATE POLICY "coach_read_athlete_logs" ON workout_logs FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- ============================================================
-- 7. notifications
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_manage_own_notifs" ON notifications;
CREATE POLICY "user_manage_own_notifs" ON notifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Coaches can insert notifications for their athletes
DROP POLICY IF EXISTS "coach_insert_athlete_notifs" ON notifications;
CREATE POLICY "coach_insert_athlete_notifs" ON notifications FOR INSERT
  WITH CHECK (
    user_id IN (SELECT user_id FROM athletes WHERE coach_id = auth.uid())
  );

-- ============================================================
-- 8. exercise_settings — réglages perso par exo
-- ============================================================
ALTER TABLE exercise_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_manage_own_settings" ON exercise_settings;
CREATE POLICY "user_manage_own_settings" ON exercise_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 9. questionnaire_responses — réponses santé
-- ============================================================
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_manage_own_responses" ON questionnaire_responses;
CREATE POLICY "athlete_manage_own_responses" ON questionnaire_responses FOR ALL
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  )
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "coach_read_athlete_responses" ON questionnaire_responses;
CREATE POLICY "coach_read_athlete_responses" ON questionnaire_responses FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

-- ============================================================
-- DONE — Vérifier avec :
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('messages','athletes','daily_reports','daily_tracking',
--   'menstrual_logs','workout_logs','notifications','exercise_settings',
--   'questionnaire_responses')
-- ORDER BY tablename, policyname;
-- ============================================================
