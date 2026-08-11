-- Run this in the Neon SQL Editor to initialize the database

CREATE TABLE IF NOT EXISTS players (
    clerk_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    course TEXT NOT NULL,
    batch TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    last_click_sync TIMESTAMPTZ DEFAULT NOW(),
    last_click_count INTEGER DEFAULT 0,

    -- Anti-cheat v2: Shadowban
    is_shadowbanned BOOLEAN DEFAULT FALSE,
    shadow_score INTEGER DEFAULT 0,

    -- Anti-cheat v2: Rolling rate cap (DB-backed for serverless)
    click_windows JSONB DEFAULT '[]',
    rate_violations INTEGER DEFAULT 0,

    -- Anti-cheat v2: CAPTCHA state
    pending_captcha_id TEXT DEFAULT NULL,
    pending_captcha_target TEXT DEFAULT NULL,
    captcha_issued_at TIMESTAMPTZ DEFAULT NULL,
    captcha_failures INTEGER DEFAULT 0
);

-- Indexes for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_players_course ON players(course);
CREATE INDEX IF NOT EXISTS idx_players_batch ON players(batch);
CREATE INDEX IF NOT EXISTS idx_players_score ON players(score DESC);
