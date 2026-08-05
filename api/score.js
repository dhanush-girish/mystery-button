import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';

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

    if (!clicks || typeof clicks !== 'number' || clicks < 1) {
      return res.status(400).json({ error: 'Invalid clicks value' });
    }

    // Cap at 1000 clicks per batch to prevent abuse
    const safeClicks = Math.min(Math.floor(clicks), 1000);

    await sql`
      UPDATE players SET score = score + ${safeClicks} WHERE clerk_id = ${userId}
    `;

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/score error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
