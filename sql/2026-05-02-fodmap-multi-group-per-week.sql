-- 2026-05-02 — Allow multiple FODMAP groups per ISO week
--
-- Context: original constraint UNIQUE (athlete_id, iso_week_start, portion_size)
-- blocked starting a new group same week if a previous group failed (red on S).
-- User feedback: when first group fails Monday, athlete should be able to
-- start another group same week without waiting Monday next week.
--
-- Fix: include group_key in the unique constraint so each (group, portion_size)
-- combo is independent across the same week.

ALTER TABLE athlete_fodmap_logs
  DROP CONSTRAINT IF EXISTS athlete_fodmap_logs_athlete_id_iso_week_start_portion_size_key;

ALTER TABLE athlete_fodmap_logs
  ADD CONSTRAINT athlete_fodmap_logs_unique_v2
  UNIQUE (athlete_id, iso_week_start, group_key, portion_size);
