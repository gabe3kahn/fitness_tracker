-- Quest system v2: code-driven quest definitions with DB-backed completion tracking.

-- 1. Puzzle accuracy on xp_events.
--    Stores Wordle guess count (1–6) or Connections mistake count (0+).
--    NULL for non-puzzle events and pre-migration puzzle events (accuracy was never captured before).
ALTER TABLE xp_events ADD COLUMN IF NOT EXISTS puzzle_accuracy INT;

-- 2. Quest completions — tracks per-period reward delivery for code-defined quests.
--    Replaces user_quests (which referenced quests by UUID from the old DB-driven system).
--    period_key format: 'YYYY-MM-DD' (daily) | 'YYYY-WNN' (weekly) | 'YYYY-MM' (monthly) | NULL (boss)
CREATE TABLE IF NOT EXISTS quest_completions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
    hero_id      TEXT,         -- NULL for player-wide quests
    quest_id     TEXT NOT NULL, -- matches QuestDef.id in constants/quests.ts
    period_key   TEXT,          -- NULL for boss battles (one-time)
    completed_at TIMESTAMPTZ DEFAULT now(),
    xp_awarded   INT,
    UNIQUE(user_id, quest_id, period_key)
);

-- Index for efficiently fetching all completions within a period (e.g. all done quests this week)
CREATE INDEX IF NOT EXISTS quest_completions_user_period
    ON quest_completions(user_id, period_key);

ALTER TABLE quest_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quest_completions_all_own"
    ON quest_completions FOR ALL USING (auth.uid() = user_id);
