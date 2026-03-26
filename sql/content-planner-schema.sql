-- =====================================================
-- CONTENT PLANNER — Planificateur de contenu Instagram
-- =====================================================

-- 1. Table des brouillons / posts planifiés
CREATE TABLE IF NOT EXISTS ig_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_account_id UUID REFERENCES ig_accounts(id) ON DELETE SET NULL,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',
  media_type TEXT DEFAULT 'IMAGE' CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ig_media_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Groupes de hashtags réutilisables
CREATE TABLE IF NOT EXISTS ig_hashtag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Templates de captions réutilisables
CREATE TABLE IF NOT EXISTS ig_caption_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──
ALTER TABLE ig_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_hashtag_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_caption_templates ENABLE ROW LEVEL SECURITY;

-- ig_drafts : coach manages own drafts
CREATE POLICY "coach_manage_own_drafts" ON ig_drafts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ig_hashtag_groups : coach manages own groups
CREATE POLICY "coach_manage_own_hashtag_groups" ON ig_hashtag_groups FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ig_caption_templates : coach manages own templates
CREATE POLICY "coach_manage_own_caption_templates" ON ig_caption_templates FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Indexes ──
CREATE INDEX idx_ig_drafts_user_status ON ig_drafts(user_id, status);
CREATE INDEX idx_ig_drafts_scheduled ON ig_drafts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_ig_hashtag_groups_user ON ig_hashtag_groups(user_id);
CREATE INDEX idx_ig_caption_templates_user ON ig_caption_templates(user_id);

-- ── Trigger updated_at ──
CREATE TRIGGER set_ig_drafts_updated_at
  BEFORE UPDATE ON ig_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
