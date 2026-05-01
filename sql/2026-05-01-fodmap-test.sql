-- Toggle par athlète
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS fodmap_enabled boolean NOT NULL DEFAULT false;

-- Enum ordonné (S < M < L) pour comparaison portions
DO $$ BEGIN
  CREATE TYPE fodmap_portion_size AS ENUM ('S','M','L');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table logs Lun/Mer/Ven
CREATE TABLE IF NOT EXISTS athlete_fodmap_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  group_key       text NOT NULL,
  food_key        text NOT NULL,
  portion_size    fodmap_portion_size NOT NULL,
  rating          text NOT NULL CHECK (rating IN ('green','yellow','red')),
  note            text,
  logged_at       timestamptz NOT NULL DEFAULT now(),
  iso_week_start  date GENERATED ALWAYS AS (date_trunc('week', logged_at)::date) STORED,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, iso_week_start, portion_size)
);

CREATE INDEX IF NOT EXISTS idx_fodmap_logs_athlete_week
  ON athlete_fodmap_logs (athlete_id, iso_week_start DESC)
  WHERE archived_at IS NULL;

ALTER TABLE athlete_fodmap_logs ENABLE ROW LEVEL SECURITY;

-- Athlete : SELECT/INSERT/UPDATE on own rows, no archived_at touch, no DELETE
CREATE POLICY athlete_fodmap_logs_select_self ON athlete_fodmap_logs
  FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()));

CREATE POLICY athlete_fodmap_logs_insert_self ON athlete_fodmap_logs
  FOR INSERT
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND archived_at IS NULL
  );

CREATE POLICY athlete_fodmap_logs_update_self ON athlete_fodmap_logs
  FOR UPDATE
  USING (athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND archived_at IS NULL
  );

-- Coach : SELECT and UPDATE on own athletes
CREATE POLICY athlete_fodmap_logs_coach_read ON athlete_fodmap_logs
  FOR SELECT
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

CREATE POLICY athlete_fodmap_logs_coach_update ON athlete_fodmap_logs
  FOR UPDATE
  USING (athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid()));

-- RPC for edit with cascade-delete of later portions
CREATE OR REPLACE FUNCTION update_fodmap_log_with_cascade(
  p_log_id uuid,
  p_new_rating text,
  p_new_note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_athlete_id uuid;
  v_iso_week_start date;
  v_portion_size fodmap_portion_size;
  v_caller_user_id uuid;
  v_owner_user_id uuid;
BEGIN
  v_caller_user_id := auth.uid();

  SELECT athlete_id, iso_week_start, portion_size
    INTO v_athlete_id, v_iso_week_start, v_portion_size
  FROM athlete_fodmap_logs WHERE id = p_log_id AND archived_at IS NULL;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'log not found or archived';
  END IF;

  SELECT user_id INTO v_owner_user_id FROM athletes WHERE id = v_athlete_id;
  IF v_owner_user_id IS NULL OR v_owner_user_id <> v_caller_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_new_rating NOT IN ('green','yellow','red') THEN
    RAISE EXCEPTION 'invalid rating';
  END IF;

  IF p_new_rating = 'red' THEN
    DELETE FROM athlete_fodmap_logs
    WHERE athlete_id = v_athlete_id
      AND iso_week_start = v_iso_week_start
      AND archived_at IS NULL
      AND portion_size > v_portion_size;
  END IF;

  UPDATE athlete_fodmap_logs
    SET rating = p_new_rating, note = p_new_note
  WHERE id = p_log_id;
END $$;

REVOKE ALL ON FUNCTION update_fodmap_log_with_cascade(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_fodmap_log_with_cascade(uuid, text, text) TO authenticated;
