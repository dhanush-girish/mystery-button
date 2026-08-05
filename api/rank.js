import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
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
}
