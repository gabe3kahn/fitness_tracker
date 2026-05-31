-- Stores which quests were randomly assigned for each period.
-- period_type: 'daily' | 'weekly' | 'monthly'
-- period_key:  'YYYY-MM-DD' (day for daily, Monday for weekly, 1st for monthly)
-- quest_ids:   array of QuestDef.id strings from constants/quests.ts
CREATE TABLE IF NOT EXISTS quest_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
    hero_id     TEXT NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_key  TEXT NOT NULL,
    quest_ids   TEXT[] NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, hero_id, period_type, period_key)
);

-- Fast lookup for current + history queries
CREATE INDEX IF NOT EXISTS quest_assignments_history
    ON quest_assignments(user_id, hero_id, period_type, period_key DESC);

ALTER TABLE quest_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_assignments_all_own"
    ON quest_assignments FOR ALL USING (auth.uid() = user_id);
