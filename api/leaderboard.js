import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';

// ═══════════════════════════════════════════════════════════════
// GET /api/leaderboard — Ranked list with filters
//
// Anti-cheat:
//   - Excludes shadowbanned players from results for all users.
//   - Shadowbanned users are shown a cheating popup on the game
//     page and see only genuine players on the leaderboard.
//
// Demo mode (admin only):
//   - When include_shadowbanned=true, returns ALL players with
//     is_shadowbanned flag. Only works for the admin clerk ID.
// ═══════════════════════════════════════════════════════════════

const DEMO_ADMIN_CLERK_ID = 'user_3Hp0nQfdFbIfH3TUEqwJ4pDDckW';

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
    const { course, batch, include_shadowbanned } = req.query;

    // Check if the caller is the admin requesting shadowbanned players
    let isAdminRequest = false;
    if (include_shadowbanned === 'true') {
      const userId = await verifyAuth(req, res, true); // silent mode — don't send 401
      if (userId === DEMO_ADMIN_CLERK_ID) {
        isAdminRequest = true;
      }
    }

    let rows;

    if (isAdminRequest) {
      // Admin demo mode: return ALL players with is_shadowbanned flag
      if (course && batch) {
        rows = await sql`
          SELECT name, course, batch, score, is_shadowbanned FROM players
          WHERE course = ${course} AND batch = ${batch}
          ORDER BY score DESC LIMIT 100
        `;
      } else if (course) {
        rows = await sql`
          SELECT name, course, batch, score, is_shadowbanned FROM players
          WHERE course = ${course}
          ORDER BY score DESC LIMIT 100
        `;
      } else if (batch) {
        rows = await sql`
          SELECT name, course, batch, score, is_shadowbanned FROM players
          WHERE batch = ${batch}
          ORDER BY score DESC LIMIT 100
        `;
      } else {
        rows = await sql`
          SELECT name, course, batch, score, is_shadowbanned FROM players
          ORDER BY score DESC LIMIT 100
        `;
      }
    } else {
      // Normal mode: only genuine players
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
    }

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
