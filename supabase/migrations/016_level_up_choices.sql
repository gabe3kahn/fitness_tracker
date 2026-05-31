-- Stores the player's chosen bonus stat per hero level-up.
-- One row per (user, hero, level); recalculate replays these as level_up SP events.
CREATE TABLE level_up_choices (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hero_id     TEXT NOT NULL,
  level       INT  NOT NULL,
  chosen_stat TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, hero_id, level)
);

ALTER TABLE level_up_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own level_up_choices"
  ON level_up_choices FOR ALL
  USING (auth.uid() = user_id);
