-- Core user profile (extends Supabase Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hero selection and progression
CREATE TABLE user_heroes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    hero_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    total_xp BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    tier TEXT DEFAULT 'novice',
    streak_days INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_active_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, hero_id)
);

-- Granular XP activity log
CREATE TABLE xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    hero_id TEXT NOT NULL,
    source TEXT NOT NULL,
    raw_value NUMERIC,
    xp_earned INT NOT NULL,
    bonus_multiplier NUMERIC DEFAULT 1.0,
    event_date DATE NOT NULL,
    source_platform TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Quest definitions
CREATE TABLE quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    quest_type TEXT NOT NULL, -- 'daily', 'weekly', 'epic', 'boss'
    hero_id TEXT,             -- NULL = available to all heroes
    requirements JSONB NOT NULL,
    xp_reward INT NOT NULL,
    tier_required TEXT DEFAULT 'novice',
    sort_order INT DEFAULT 0
);

-- User quest progress
CREATE TABLE user_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    quest_id UUID REFERENCES quests(id),
    progress NUMERIC DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ DEFAULT now()
);

-- Connected health platforms
CREATE TABLE health_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'apple_health', 'garmin', 'health_connect'
    access_token TEXT,
    refresh_token TEXT,
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, platform)
);

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/write their own row
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- User heroes: own rows only
CREATE POLICY "user_heroes_all_own" ON user_heroes FOR ALL USING (auth.uid() = user_id);

-- XP events: own rows only
CREATE POLICY "xp_events_all_own" ON xp_events FOR ALL USING (auth.uid() = user_id);

-- User quests: own rows only
CREATE POLICY "user_quests_all_own" ON user_quests FOR ALL USING (auth.uid() = user_id);

-- Health connections: own rows only
CREATE POLICY "health_connections_all_own" ON health_connections FOR ALL USING (auth.uid() = user_id);

-- Quests: readable by all authenticated users
CREATE POLICY "quests_select_authenticated" ON quests FOR SELECT USING (auth.role() = 'authenticated');
