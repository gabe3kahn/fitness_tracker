-- Stores enriched workout metadata once per session (hero-agnostic).
-- XP crediting per hero remains in xp_events. This table is for display and history.
CREATE TABLE workout_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL,
  activity_type   TEXT,
  activity_name   TEXT,
  distance_km     NUMERIC,
  duration_minutes INT,
  elevation_ft    NUMERIC,
  pace_min_per_km NUMERIC,
  calories        INT,
  workout_date    DATE NOT NULL,
  source_platform TEXT NOT NULL DEFAULT 'apple_health',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, session_id)
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout_sessions"
  ON workout_sessions FOR ALL
  USING (auth.uid() = user_id);
