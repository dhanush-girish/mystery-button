import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';

// ═══════════════════════════════════════════════════════════════
// GET /api/rank — Current player's rank
//
// Anti-cheat:
//   - Excludes shadowbanned players from rank calculation
//   - If requesting user is shadowbanned, computes rank using
//     shadow_score against real (non-banned) scores
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

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    // Fetch player's status
    const playerRows = await sql`
      SELECT score, shadow_score, is_shadowbanned
      FROM players
      WHERE clerk_id = ${userId}
    `;

    if (playerRows.length === 0) {
      return res.json({ rank: null, score: 0 });
    }

    const player = playerRows[0];
    const isBanned = player.is_shadowbanned === true;

    // Use real score + shadow_score if banned, real score otherwise
    const effectiveScore = isBanned
      ? Number(player.score) + Number(player.shadow_score || 0)
      : Number(player.score);

    let rankRows;
    if (isBanned) {
      rankRows = await sql`
        SELECT COUNT(*) AS above
        FROM players
        WHERE (score + COALESCE(shadow_score, 0)) > ${effectiveScore}
      `;
    } else {
      rankRows = await sql`
        SELECT COUNT(*) AS above
        FROM players
        WHERE score > ${effectiveScore}
          AND (is_shadowbanned IS NOT TRUE)
      `;
    }

    const rank = Number(rankRows[0].above) + 1;

    return res.json({ rank, score: effectiveScore });
  } catch (err) {
    console.error('GET /api/rank error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
