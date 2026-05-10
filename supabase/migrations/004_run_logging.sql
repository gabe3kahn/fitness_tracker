-- Add fields to xp_events to support timezone-aware logging and activity type differentiation
ALTER TABLE xp_events ADD COLUMN timezone TEXT;
ALTER TABLE xp_events ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'manual';
-- Groups all xp_events rows produced by a single log session (e.g. distance + duration + workout from one run)
ALTER TABLE xp_events ADD COLUMN session_id TEXT;
