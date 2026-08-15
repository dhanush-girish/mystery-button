import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';
import { isEventEnded, EVENT_CUTOFF_UTC, rejectIfEventEnded } from './_anticheat.js';

// ═══════════════════════════════════════════════════════════════
// /api/player — GET (fetch) and POST (create/update)
//
// Anti-cheat:
//   - GET: Returns shadow_score as "score" for banned users,
//     never leaks anti-cheat columns to the client.
//   - POST: Blocked after event cutoff (no late registrations).
//   - Both: Include event metadata for frontend timer.
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await verifyAuth(req, res);
  if (!userId) return; // 401 already sent

  // ── GET /api/player ──
  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT name, course, batch, score, shadow_score, is_shadowbanned
        FROM players
        WHERE clerk_id = ${userId}
      `;

      if (rows.length === 0) {
        return res.json({
          exists: false,
          event_ended: isEventEnded(),
          event_cutoff_utc: EVENT_CUTOFF_UTC.toISOString(),
        });
      }

      const p = rows[0];
      const isBanned = p.is_shadowbanned === true;

      // Banned users see real score (frozen at ban time) + shadow_score
      // (post-ban clicks). This prevents a visible score drop at ban time.
      const displayScore = isBanned
        ? Number(p.score) + Number(p.shadow_score || 0)
        : Number(p.score);

      return res.json({
        exists: true,
        player: {
          name: p.name,
          course: p.course,
          batch: p.batch,
          score: displayScore,
          is_shadowbanned: isBanned,
        },
        event_ended: isEventEnded(),
        event_cutoff_utc: EVENT_CUTOFF_UTC.toISOString(),
      });
    } catch (err) {
      console.error('GET /api/player error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── POST /api/player (onboarding) ──
  if (req.method === 'POST') {
    // Block new registrations after event ends
    if (rejectIfEventEnded(res)) return;

    try {
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
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
