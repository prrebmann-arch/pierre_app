-- =============================================
-- Instagram General Tab — Schema changes
-- Date: 2026-03-25
-- =============================================

-- 1. ig_snapshots (historique mensuel pour Growth Trend)
CREATE TABLE IF NOT EXISTS ig_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_reach BIGINT DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ig_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own snapshots" ON ig_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ig_snapshots_user_date ON ig_snapshots(user_id, snapshot_date);

-- 2. ig_goals (objectifs trimestriels)
CREATE TABLE IF NOT EXISTS ig_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ig_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON ig_goals FOR ALL USING (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ig_goals_user_quarter_metric ON ig_goals(user_id, quarter, metric);

-- 3. ig_reels — ajouter colonne format
ALTER TABLE ig_reels ADD COLUMN IF NOT EXISTS format TEXT;

-- 4. ig_accounts — ajouter colonnes de reference
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS starting_followers INTEGER DEFAULT 0;
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS starting_date DATE;
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS starting_monthly_views BIGINT DEFAULT 0;
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS starting_engagement NUMERIC DEFAULT 0;
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS starting_best_reel BIGINT DEFAULT 0;
