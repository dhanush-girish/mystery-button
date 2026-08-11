import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';
import { rejectIfEventEnded, verifyCaptchaResponse } from './_anticheat.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Event cutoff
  if (rejectIfEventEnded(res)) return;

  // Auth — require valid session
  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const { captcha_id, selected_shape_type, timed_out, stray_clicks } = req.body;

    if (!captcha_id) {
      return res.status(400).json({ error: 'Missing captcha_id' });
    }

    const result = await verifyCaptchaResponse(sql, userId, {
      captchaId: captcha_id,
      selectedShapeType: selected_shape_type,
      timedOut: !!timed_out,
      strayClicks: Number(stray_clicks) || 0,
    });

    // Success (or silent shadowban — both return valid: true)
    if (result.valid) {
      return res.json({ success: true, valid: true });
    }

    // Retry — send new challenge
    if (result.retry) {
      return res.json({
        success: false,
        valid: false,
        retry: true,
        retries_left: result.retries_left,
        captcha: result.captcha,
      });
    }

    // Fallback — should not reach here, but don't softlock the client
    return res.json({ success: true, valid: true });
  } catch (err) {
    console.error('POST /api/verify-captcha error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
