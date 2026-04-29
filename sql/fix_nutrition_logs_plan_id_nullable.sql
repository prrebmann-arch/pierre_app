-- Fix: allow nutrition_logs.plan_id to be NULL so we can delete a nutrition_plan
-- without losing the athlete's tracking history.
-- The FK already exists in Supabase with ON DELETE SET NULL, but the column is
-- NOT NULL, which causes "null value in column plan_id violates not-null constraint"
-- when a referenced nutrition_plans row is deleted.

ALTER TABLE nutrition_logs ALTER COLUMN plan_id DROP NOT NULL;
