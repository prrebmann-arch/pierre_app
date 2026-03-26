-- Tables pour stocker les messages Instagram localement
-- Exécuter dans Supabase SQL Editor

-- Conversations
CREATE TABLE IF NOT EXISTS ig_conversations (
  id TEXT PRIMARY KEY,                -- Instagram conversation ID
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  participant_id TEXT,                -- Instagram user ID de l'autre personne
  participant_name TEXT DEFAULT 'Inconnu',
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages individuels
CREATE TABLE IF NOT EXISTS ig_messages (
  id TEXT PRIMARY KEY,                -- Instagram message ID
  conversation_id TEXT NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  from_id TEXT,
  from_name TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_ig_conversations_coach ON ig_conversations(coach_id);
CREATE INDEX IF NOT EXISTS idx_ig_messages_convo ON ig_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ig_messages_coach ON ig_messages(coach_id);

-- RLS
ALTER TABLE ig_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_own_conversations" ON ig_conversations
  FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "coach_own_messages" ON ig_messages
  FOR ALL USING (coach_id = auth.uid());
