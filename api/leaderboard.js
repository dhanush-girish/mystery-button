import { sql } from './_db.js';

// ═══════════════════════════════════════════════════════════════
// GET /api/leaderboard — Ranked list with filters
//
// Anti-cheat:
//   - Excludes shadowbanned players from results for all users.
//   - Shadowbanned users are shown a cheating popup on the game
//     page and see only genuine players on the leaderboard.
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { course, batch } = req.query;

    let rows;

    // All users (including shadowbanned) see only genuine players
    if (course && batch) {
      rows = await sql`
        SELECT name, course, batch, score FROM players
        WHERE course = ${course} AND batch = ${batch} AND (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC LIMIT 100
      `;
    } else if (course) {
      rows = await sql`
        SELECT name, course, batch, score FROM players
        WHERE course = ${course} AND (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC LIMIT 100
      `;
    } else if (batch) {
      rows = await sql`
        SELECT name, course, batch, score FROM players
        WHERE batch = ${batch} AND (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC LIMIT 100
      `;
    } else {
      rows = await sql`
        SELECT name, course, batch, score FROM players
        WHERE (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC LIMIT 100
      `;
    }

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
