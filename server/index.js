import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import express from 'express';
import cors from 'cors';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import { sql } from './db.js';
import {
  rejectIfEventEnded,
  isEventEnded,
  EVENT_CUTOFF_UTC,
  computeRollingRate,
  checkClickVariance,
  shouldIssueCaptcha,
  generateCaptchaChallenge,
  storeCaptchaChallenge,
  formatCaptchaForClient,
  verifyCaptchaResponse,
} from '../api/_anticheat.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// --- Anti-cheat constants (timing-based clamping from v1) ---
const MAX_CPS = 15;
const HARD_CAP_PER_BATCH = 45;
const MIN_BATCH_GAP_MS = 2000;

// --- Routes ---

// GET /api/player — fetch current player's data
app.get('/api/player', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;
    const rows = await sql`
      SELECT name, course, batch, score, shadow_score, is_shadowbanned
      FROM players WHERE clerk_id = ${userId}
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
    const displayScore = isBanned ? Number(p.score) + Number(p.shadow_score || 0) : Number(p.score);

    return res.json({
      exists: true,
      player: {
        name: p.name,
        course: p.course,
        batch: p.batch,
        score: displayScore,
      },
      event_ended: isEventEnded(),
      event_cutoff_utc: EVENT_CUTOFF_UTC.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/player error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/player — create or update player (onboarding)
app.post('/api/player', requireAuth(), async (req, res) => {
  if (rejectIfEventEnded(res)) return;

  try {
    const { userId } = req.auth;
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
});

// POST /api/score — anti-cheat rate-limited score sync (v2)
app.post('/api/score', requireAuth(), async (req, res) => {
  if (rejectIfEventEnded(res)) return;

  try {
    const { userId } = req.auth;
    const { clicks, timestamps } = req.body;

    if (!clicks || typeof clicks !== 'number' || clicks < 1) {
      return res.status(400).json({ error: 'Invalid clicks value' });
    }

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

    if (elapsedMs < MIN_BATCH_GAP_MS) {
      return res.status(429).json({ error: 'Too fast. Wait a moment.' });
    }

    const cappedElapsedMs = Math.min(elapsedMs, 30000);
    const maxByTiming = Math.floor((cappedElapsedMs / 1000) * MAX_CPS);
    const safeClicks = Math.min(Math.floor(clicks), maxByTiming, HARD_CAP_PER_BATCH);
    if (safeClicks < 1) return res.json({ success: true, accepted: 0 });

    // Shadowbanned path
    if (player.is_shadowbanned) {
      const rate = computeRollingRate(player.click_windows, player.rate_violations, safeClicks);
      await sql`
        UPDATE players
        SET shadow_score = shadow_score + ${safeClicks},
            last_click_sync = NOW(), last_click_count = ${safeClicks},
            click_windows = ${rate.updatedWindows},
            rate_violations = ${rate.updatedViolations}
        WHERE clerk_id = ${userId}
      `;
      const response = { success: true, accepted: safeClicks };
      return res.json(response);
    }

    // Anti-cheat checks
    const rate = computeRollingRate(player.click_windows, player.rate_violations, safeClicks);
    const variance = checkClickVariance(timestamps, rate.totalInWindow);

    if (rate.shouldShadowban || variance.shouldShadowban) {
      await sql`
        UPDATE players
        SET is_shadowbanned = TRUE, shadow_score = shadow_score + ${safeClicks},
            last_click_sync = NOW(), last_click_count = ${safeClicks},
            click_windows = ${rate.updatedWindows}, rate_violations = ${rate.updatedViolations}
        WHERE clerk_id = ${userId}
      `;
      return res.json({ success: true, accepted: safeClicks });
    }

    // Normal path
    await sql`
      UPDATE players
      SET score = score + ${safeClicks},
          last_click_sync = NOW(), last_click_count = ${safeClicks},
          click_windows = ${rate.updatedWindows}, rate_violations = ${rate.updatedViolations}
      WHERE clerk_id = ${userId}
    `;

    const response = { success: true, accepted: safeClicks };
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
});

// POST /api/verify-captcha — CAPTCHA verification
app.post('/api/verify-captcha', requireAuth(), async (req, res) => {
  if (rejectIfEventEnded(res)) return;

  try {
    const { userId } = req.auth;
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

    if (result.valid) return res.json({ success: true, valid: true });
    if (result.retry) {
      return res.json({
        success: false, valid: false, retry: true,
        retries_left: result.retries_left, captcha: result.captcha,
      });
    }
    return res.json({ success: true, valid: true });
  } catch (err) {
    console.error('POST /api/verify-captcha error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard — ranked list with optional course/batch filters
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { course, batch } = req.query;
    let rows;

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

    // Leaderboard ghosting — optional auth via header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyToken } = await import('@clerk/backend');
        const token = authHeader.split(' ')[1];
        const payload = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        const requestingUserId = payload.sub;

        const playerRows = await sql`
          SELECT name, course, batch, score, shadow_score, is_shadowbanned
          FROM players WHERE clerk_id = ${requestingUserId}
        `;
        if (playerRows.length > 0 && playerRows[0].is_shadowbanned) {
          const p = playerRows[0];
          const ghostScore = Number(p.score) + Number(p.shadow_score || 0);
          let insertIdx = rows.length;
          for (let i = 0; i < rows.length; i++) {
            if (ghostScore >= Number(rows[i].score)) { insertIdx = i; break; }
          }
          rows = [...rows];
          rows.splice(insertIdx, 0, {
            name: p.name, course: p.course, batch: p.batch, score: ghostScore,
          });
        }
      } catch {
        // Auth failed — continue without ghosting
      }
    }

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rank — current player's rank
app.get('/api/rank', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;

    const playerRows = await sql`
      SELECT score, shadow_score, is_shadowbanned
      FROM players WHERE clerk_id = ${userId}
    `;

    if (playerRows.length === 0) {
      return res.json({ rank: null, score: 0 });
    }

    const player = playerRows[0];
    const isBanned = player.is_shadowbanned === true;
    const effectiveScore = isBanned ? Number(player.score) + Number(player.shadow_score || 0) : Number(player.score);

    const rankRows = await sql`
      SELECT COUNT(*) AS above FROM players
      WHERE score > ${effectiveScore} AND (is_shadowbanned IS NOT TRUE)
    `;

    return res.json({
      rank: Number(rankRows[0].above) + 1,
      score: effectiveScore,
    });
  } catch (err) {
    console.error('GET /api/rank error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 Mystery Button API running on http://localhost:${PORT}`);
});
