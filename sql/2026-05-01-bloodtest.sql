ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS bloodtest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloodtest_tracked_markers jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS coach_custom_markers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marker_key      text NOT NULL,
  label           text NOT NULL,
  unit_canonical  text NOT NULL,
  category        text NOT NULL,
  zones           jsonb NOT NULL,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, marker_key)
);

CREATE TABLE IF NOT EXISTS bloodtest_uploads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  uploaded_by         text NOT NULL CHECK (uploaded_by IN ('athlete','coach')),
  uploader_user_id    uuid NOT NULL,
  file_path           text NOT NULL,
  dated_at            date,
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  validated_at        timestamptz,
  validated_by        uuid,
  extracted_data      jsonb,
  validated_data      jsonb,
  ai_extraction_meta  jsonb,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloodtest_uploads_athlete
  ON bloodtest_uploads (athlete_id, dated_at DESC NULLS LAST)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bloodtest_uploads_pending
  ON bloodtest_uploads (athlete_id, uploaded_at DESC)
  WHERE archived_at IS NULL AND validated_at IS NULL;

ALTER TABLE bloodtest_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_custom_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY bloodtest_select_self ON bloodtest_uploads
  FOR SELECT USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

CREATE POLICY bloodtest_insert_self ON bloodtest_uploads
  FOR INSERT WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND uploaded_by = 'athlete'
    AND uploader_user_id = auth.uid()
    AND validated_at IS NULL
  );

CREATE POLICY bloodtest_delete_pre_validation ON bloodtest_uploads
  FOR DELETE USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    AND validated_at IS NULL
  );

CREATE POLICY bloodtest_coach_all ON bloodtest_uploads
  FOR ALL USING (
    athlete_id IN (SELECT id FROM athletes WHERE coach_id = auth.uid())
  );

CREATE POLICY ccm_coach_all ON coach_custom_markers
  FOR ALL USING (coach_id = auth.uid());
