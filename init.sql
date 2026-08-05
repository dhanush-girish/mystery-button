-- Run this in the Neon SQL Editor to initialize the database

CREATE TABLE IF NOT EXISTS players (
    clerk_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    course TEXT NOT NULL,
    batch TEXT NOT NULL,
    score INTEGER DEFAULT 0
);

-- Indexes for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_players_course ON players(course);
CREATE INDEX IF NOT EXISTS idx_players_batch ON players(batch);
CREATE INDEX IF NOT EXISTS idx_players_score ON players(score DESC);
