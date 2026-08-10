import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import express from 'express';
import cors from 'cors';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import { sql } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// --- Routes ---

// GET /api/player — fetch current player's data
app.get('/api/player', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;
    const rows = await sql`SELECT * FROM players WHERE clerk_id = ${userId}`;
    if (rows.length === 0) {
      return res.json({ exists: false });
    }
    return res.json({ exists: true, player: rows[0] });
  } catch (err) {
    console.error('GET /api/player error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/player — create or update player (onboarding)
app.post('/api/player', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;
    const { name, course, batch } = req.body;

    if (!name || !course || !batch) {
      return res.status(400).json({ error: 'Name, course, and batch are required' });
    }

    await sql`
      INSERT INTO players (clerk_id, name, course, batch, score)
      VALUES (${userId}, ${name}, ${course}, ${batch}, 0)
      ON CONFLICT (clerk_id)
      DO UPDATE SET name = ${name}, course = ${course}, batch = ${batch}
    `;

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/player error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/player/avatar — backfill profile image for existing players
// app.patch('/api/player/avatar', requireAuth(), async (req, res) => {
//   try {
//     const { userId } = req.auth;
//     const { profile_image_url } = req.body;

//     if (profile_image_url) {
//       await sql`
//         UPDATE players SET profile_image_url = ${profile_image_url}
//         WHERE clerk_id = ${userId} AND profile_image_url IS NULL
//       `;
//     }

//     return res.json({ success: true });
//   } catch (err) {
//     console.error('PATCH /api/player/avatar error:', err);
//     return res.status(500).json({ error: 'Internal server error' });
//   }
// });

// POST /api/score — anti-cheat rate-limited score sync
//
// Defense strategy (server-side, untamperable):
//   1. Query the player's last_click_sync timestamp from the DB
//   2. Calculate elapsed time since then — this is the TRUE window
//   3. Max allowed clicks = elapsed_seconds * 15 (15 CPS human cap)
//   4. Clamp submitted clicks to min(submitted, maxByTiming, 200)
//   5. Reject batches arriving faster than every 2 seconds
//
const MAX_CPS = 15;
const HARD_CAP_PER_BATCH = 200;
const MIN_BATCH_GAP_MS = 2000;

app.post('/api/score', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;
    const { clicks } = req.body;

    // Basic validation
    if (!clicks || typeof clicks !== 'number' || clicks < 1) {
      return res.status(400).json({ error: 'Invalid clicks value' });
    }

    // Fetch player's last sync timestamp
    const rows = await sql`
      SELECT last_click_sync FROM players WHERE clerk_id = ${userId}
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const now = new Date();
    const lastSync = new Date(rows[0].last_click_sync);
    const elapsedMs = now.getTime() - lastSync.getTime();

    // Cooldown: reject if less than 2 seconds since last sync
    if (elapsedMs < MIN_BATCH_GAP_MS) {
      return res.status(429).json({ error: 'Too fast. Wait a moment.' });
    }

    // Calculate maximum allowed clicks based on elapsed time
    // Cap the time window at 30 seconds to prevent first-load abuse
    const cappedElapsedMs = Math.min(elapsedMs, 30000);
    const maxByTiming = Math.floor((cappedElapsedMs / 1000) * MAX_CPS);

    // Take the minimum of: submitted clicks, timing-based max, hard cap
    const safeClicks = Math.min(Math.floor(clicks), maxByTiming, HARD_CAP_PER_BATCH);

    if (safeClicks < 1) {
      return res.json({ success: true, accepted: 0 });
    }

    // Atomically update score + rate-limiting metadata
    await sql`
      UPDATE players
      SET score = score + ${safeClicks},
          last_click_sync = NOW(),
          last_click_count = ${safeClicks}
      WHERE clerk_id = ${userId}
    `;

    return res.json({ success: true, accepted: safeClicks });
  } catch (err) {
    console.error('POST /api/score error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard — ranked list with optional course/batch filters
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { course, batch } = req.query;
    let rows;

    if (course && batch) {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        WHERE course = ${course} AND batch = ${batch}
        ORDER BY score DESC
        LIMIT 100
      `;
    } else if (course) {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        WHERE course = ${course}
        ORDER BY score DESC
        LIMIT 100
      `;
    } else if (batch) {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        WHERE batch = ${batch}
        ORDER BY score DESC
        LIMIT 100
      `;
    } else {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        ORDER BY score DESC
        LIMIT 100
      `;
    }

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rank — current player's rank
app.get('/api/rank', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;

    const rows = await sql`
      SELECT
        (SELECT COUNT(*) FROM players p2 WHERE p2.score > p1.score) + 1 AS rank,
        p1.score
      FROM players p1
      WHERE p1.clerk_id = ${userId}
    `;

    if (rows.length === 0) {
      return res.json({ rank: null, score: 0 });
    }

    return res.json({
      rank: Number(rows[0].rank),
      score: Number(rows[0].score),
    });
  } catch (err) {
    console.error('GET /api/rank error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Mystery Button API running on http://localhost:${PORT}`);
});
