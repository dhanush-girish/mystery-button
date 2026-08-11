import { sql } from './_db.js';
import { verifyAuth } from './_auth.js';
import {
  rejectIfEventEnded,
  computeRollingRate,
  checkClickVariance,
  shouldIssueCaptcha,
  generateCaptchaChallenge,
  storeCaptchaChallenge,
  formatCaptchaForClient,
} from './_anticheat.js';

// ═══════════════════════════════════════════════════════════════
// POST /api/score — Anti-cheat score sync (v2)
//
// Defense layers (all server-side, untamperable):
//   1. Event cutoff — 403 after Aug 14 16:00 IST
//   2. Auth — valid Clerk session required
//   3. Cooldown — min 2 s between batches
//   4. Timing clamp — max 15 CPS × elapsed time
//   5. Shadowban passthrough — increments shadow_score, not real score
//   6. Rolling rate cap — 20 CPS over 60 s, 3 consecutive → shadowban
//   7. Click variance — low stddev + high rate → shadowban
//   8. Random CAPTCHA — ~10% chance per batch
// ═══════════════════════════════════════════════════════════════
const MAX_CPS = 15;
const HARD_CAP_PER_BATCH = 45;
const MIN_BATCH_GAP_MS = 2000;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Event cutoff
  if (rejectIfEventEnded(res)) return;

  // 2. Auth
  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const { clicks, timestamps } = req.body;

    // 3. Basic validation
    if (!clicks || typeof clicks !== 'number' || clicks < 1) {
      return res.status(400).json({ error: 'Invalid clicks value' });
    }

    // 4. Fetch full player row
    const rows = await sql`
      SELECT last_click_sync, is_shadowbanned, shadow_score,
             click_windows, rate_violations, pending_captcha_id
      FROM players WHERE clerk_id = ${userId}
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = rows[0];
    const now = new Date();
    const lastSync = new Date(player.last_click_sync);
    const elapsedMs = now.getTime() - lastSync.getTime();

    // 5. Cooldown: reject if < 2 s since last sync
    if (elapsedMs < MIN_BATCH_GAP_MS) {
      return res.status(429).json({ error: 'Too fast. Wait a moment.' });
    }

    // 6. Timing-based clamp (carried forward from v1)
    const cappedElapsedMs = Math.min(elapsedMs, 30000);
    const maxByTiming = Math.floor((cappedElapsedMs / 1000) * MAX_CPS);
    const safeClicks = Math.min(Math.floor(clicks), maxByTiming, HARD_CAP_PER_BATCH);
    if (safeClicks < 1) {
      return res.json({ success: true, accepted: 0 });
    }

    // ── SHADOWBANNED player path ──────────────────────────────
    // Looks identical to the normal response so they don't notice.
    if (player.is_shadowbanned) {
      // Still compute rate window to keep data consistent
      const rate = computeRollingRate(
        player.click_windows, player.rate_violations, safeClicks
      );

      await sql`
        UPDATE players
        SET shadow_score     = shadow_score + ${safeClicks},
            last_click_sync  = NOW(),
            last_click_count = ${safeClicks},
            click_windows    = ${rate.updatedWindows},
            rate_violations  = ${rate.updatedViolations}
        WHERE clerk_id = ${userId}
      `;

      const response = { success: true, accepted: safeClicks };

      return res.json(response);
    }

    // ── ANTI-CHEAT CHECKS (legitimate player) ─────────────────
    // 7. Rolling rate cap
    const rate = computeRollingRate(
      player.click_windows, player.rate_violations, safeClicks
    );

    // 8. Click variance (secondary signal — never triggers alone)
    const variance = checkClickVariance(timestamps, rate.totalInWindow);

    // 9. Shadowban triggered?
    if (rate.shouldShadowban || variance.shouldShadowban) {
      // This batch's clicks go to shadow_score, not real score
      await sql`
        UPDATE players
        SET is_shadowbanned  = TRUE,
            shadow_score     = shadow_score + ${safeClicks},
            last_click_sync  = NOW(),
            last_click_count = ${safeClicks},
            click_windows    = ${rate.updatedWindows},
            rate_violations  = ${rate.updatedViolations}
        WHERE clerk_id = ${userId}
      `;
      // Normal-looking response — they must not know
      return res.json({ success: true, accepted: safeClicks });
    }

    // ── NORMAL PATH — increment real score ────────────────────
    await sql`
      UPDATE players
      SET score            = score + ${safeClicks},
          last_click_sync  = NOW(),
          last_click_count = ${safeClicks},
          click_windows    = ${rate.updatedWindows},
          rate_violations  = ${rate.updatedViolations}
      WHERE clerk_id = ${userId}
    `;

    const response = { success: true, accepted: safeClicks };

    // 10. Random CAPTCHA challenge (~10 %)
    if (shouldIssueCaptcha() && !player.pending_captcha_id) {
      const challenge = generateCaptchaChallenge();
      await storeCaptchaChallenge(sql, userId, challenge);
      response.captcha_required = true;
      response.captcha = formatCaptchaForClient(challenge);
    }

    return res.json(response);
  } catch (err) {
    console.error('POST /api/score error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
