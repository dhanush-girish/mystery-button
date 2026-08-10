import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';

// Anti-cheat constants (must match server/index.js)
const MAX_CPS = 15;
const HARD_CAP_PER_BATCH = 45;
const MIN_BATCH_GAP_MS = 2000;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
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
}
