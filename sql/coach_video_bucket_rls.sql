-- ============================================================
-- RLS policies for storage.objects on coach-video bucket
-- Date: 2026-04-28
-- Run AFTER creating the bucket via Supabase Dashboard
-- ============================================================

-- Coach can INSERT files only under their own user_id folder
DROP POLICY IF EXISTS "coach_write_own_videos" ON storage.objects;
CREATE POLICY "coach_write_own_videos" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coach can DELETE their own files (used by archival route via service role too)
DROP POLICY IF EXISTS "coach_delete_own_videos" ON storage.objects;
CREATE POLICY "coach_delete_own_videos" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Coach can SELECT their own files (used by signed URL generation when called as coach)
DROP POLICY IF EXISTS "coach_read_own_videos" ON storage.objects;
CREATE POLICY "coach_read_own_videos" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- NOTE: athlete reads pass through service-role signed URLs from the API route
-- (athletes do not have direct storage access to coach-video).

-- Coach can UPDATE own files (needed if upsert mode is ever used)
DROP POLICY IF EXISTS "coach_update_own_videos" ON storage.objects;
CREATE POLICY "coach_update_own_videos" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'coach-video'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
