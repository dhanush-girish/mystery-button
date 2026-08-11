import { sql } from './_db.js';
import { verifyToken } from '@clerk/backend';
import { rejectIfEventEnded } from './_anticheat.js';

// ═══════════════════════════════════════════════════════════════
// GET /api/leaderboard — Ranked list with filters
//
// Anti-cheat:
//   - Excludes shadowbanned players from results
//   - Leaderboard ghosting: if requesting user is shadowbanned,
//     splices their row (using shadow_score) into the response
//     at the rank it would occupy among real scores.
// ═══════════════════════════════════════════════════════════════

/**
 * Optional auth — extracts userId if a valid Bearer token is
 * present, returns null otherwise. Never sends a 401.
 */
async function optionalAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload.sub;
  } catch {
    return null;
  }
}

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

    // ── Real leaderboard (excludes shadowbanned) ──
    if (course && batch) {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        WHERE course = ${course} AND batch = ${batch}
          AND (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC
        LIMIT 100
      `;
    } else if (course) {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        WHERE course = ${course}
          AND (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC
        LIMIT 100
      `;
    } else if (batch) {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        WHERE batch = ${batch}
          AND (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC
        LIMIT 100
      `;
    } else {
      rows = await sql`
        SELECT name, course, batch, score
        FROM players
        WHERE (is_shadowbanned IS NOT TRUE)
        ORDER BY score DESC
        LIMIT 100
      `;
    }

    // ── Leaderboard ghosting (stretch goal) ──
    // If the requesting user is shadowbanned, splice their row
    // into the results at the rank their shadow_score would occupy.
    const userId = await optionalAuth(req);
    if (userId) {
      const playerRows = await sql`
        SELECT name, course, batch, score, shadow_score, is_shadowbanned
        FROM players
        WHERE clerk_id = ${userId}
      `;

      if (playerRows.length > 0 && playerRows[0].is_shadowbanned) {
        const p = playerRows[0];
        const ghostScore = Number(p.score) + Number(p.shadow_score || 0);

        // Find insertion index (descending order)
        let insertIdx = rows.length; // default: end
        for (let i = 0; i < rows.length; i++) {
          if (ghostScore >= Number(rows[i].score)) {
            insertIdx = i;
            break;
          }
        }

        // Splice ghost row in (using shadow_score as displayed score)
        const ghostRow = {
          name: p.name,
          course: p.course,
          batch: p.batch,
          score: ghostScore,
        };
        rows = [...rows]; // shallow copy (rows may be frozen)
        rows.splice(insertIdx, 0, ghostRow);
      }
    }

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
