import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return; // 401 already sent

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM players WHERE clerk_id = ${userId}`;
      if (rows.length === 0) {
        return res.json({ exists: false });
      }
      return res.json({ exists: true, player: rows[0] });
    } catch (err) {
      console.error('GET /api/player error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, course, batch, profile_image_url } = req.body;

      if (!name || !course || !batch) {
        return res.status(400).json({ error: 'Name, course, and batch are required' });
      }

      await sql`
        INSERT INTO players (clerk_id, name, course, batch, score, profile_image_url)
        VALUES (${userId}, ${name}, ${course}, ${batch}, 0, ${profile_image_url || null})
        ON CONFLICT (clerk_id)
        DO UPDATE SET name = ${name}, course = ${course}, batch = ${batch}, profile_image_url = COALESCE(${profile_image_url || null}, players.profile_image_url)
      `;

      return res.json({ success: true });
    } catch (err) {
      console.error('POST /api/player error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { profile_image_url } = req.body;
      if (profile_image_url) {
        await sql`
          UPDATE players SET profile_image_url = ${profile_image_url}
          WHERE clerk_id = ${userId} AND profile_image_url IS NULL
        `;
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('PATCH /api/player error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
