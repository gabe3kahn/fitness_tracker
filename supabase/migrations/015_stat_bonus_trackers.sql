-- Tracks how many stat bonus claims each user has made per (hero, stat).
-- total_sp_generated is derived live from hero_stat_events; only claims_made persists here.
CREATE TABLE IF NOT EXISTS stat_bonus_trackers (
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hero_id    TEXT    NOT NULL,
  stat       TEXT    NOT NULL,
  claims_made INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, hero_id, stat)
);

ALTER TABLE stat_bonus_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bonus trackers"
  ON stat_bonus_trackers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stat_bonus_trackers_user_hero
  ON stat_bonus_trackers (user_id, hero_id);
