// ═══════════════════════════════════════════════════════════════
// _anticheat.js — Shared anti-cheat utilities
//
// All game-integrity logic lives here. Imported by both the
// Vercel serverless functions (api/*.js) and the local Express
// dev server (server/index.js).
//
// ZERO external dependencies — only built-in JS (Date, Math, JSON).
// Functions that touch the DB receive `sql` as a parameter.
// ═══════════════════════════════════════════════════════════════

// ─── EVENT CUTOFF ────────────────────────────────────────────
// August 14, 2026, 16:00:00 IST (UTC+5:30) = 10:30:00 UTC
// Hardcoded as a fixed UTC timestamp once. Server timezone
// config cannot shift this value.
export const EVENT_CUTOFF_UTC = new Date('2026-08-14T10:30:00.000Z');

export function isEventEnded() {
  return Date.now() >= EVENT_CUTOFF_UTC.getTime();
}

/**
 * If event has ended, sends 403 and returns true.
 * Caller should `return` immediately when this returns true.
 */
export function rejectIfEventEnded(res) {
  if (isEventEnded()) {
    res.status(403).json({ error: 'Event Ended', event_ended: true });
    return true;
  }
  return false;
}

// ─── ROLLING RATE CAP (DB-backed for serverless) ─────────────
// Deployment target is Vercel serverless — no shared memory.
// Click batch timestamps are stored in a JSONB column per user.
const RATE_WINDOW_MS = 60_000;         // 60-second rolling window
const MAX_CLICKS_PER_WINDOW = 1200;    // 20 CPS × 60 s
const VIOLATIONS_TO_BAN = 3;           // 3 consecutive over-threshold → shadowban

function parseWindows(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return raw || [];
}

/**
 * Computes updated rolling-rate state. Pure function — does NOT
 * write to DB. Returns values for the caller to include in its
 * single UPDATE query (minimises DB round-trips on Neon free tier).
 *
 * @param {*} currentWindows  - click_windows JSONB from DB
 * @param {number} currentViolations - rate_violations from DB
 * @param {number} newClicks - clicks accepted in this batch
 * @returns {{ shouldShadowban, totalInWindow, updatedWindows, updatedViolations }}
 */
export function computeRollingRate(currentWindows, currentViolations, newClicks) {
  const now = Date.now();
  let windows = parseWindows(currentWindows);
  let violations = Number(currentViolations) || 0;

  // Trim entries older than the window
  windows = windows.filter(w => (now - w.ts) < RATE_WINDOW_MS);

  // Append current batch
  windows.push({ ts: now, clicks: newClicks });

  // Sum clicks across the window
  const totalInWindow = windows.reduce((sum, w) => sum + w.clicks, 0);

  // Threshold check — must be *consecutive* violations
  if (totalInWindow > MAX_CLICKS_PER_WINDOW) {
    violations++;
  } else {
    violations = 0; // Reset on a clean window
  }

  return {
    shouldShadowban: violations >= VIOLATIONS_TO_BAN,
    totalInWindow,
    updatedWindows: JSON.stringify(windows),
    updatedViolations: violations,
  };
}

// ─── CLICK VARIANCE CHECK (secondary signal) ─────────────────
// Never triggers on its own — must combine with high rate.
// This prevents false positives from macro mice / key-repeat.
const VARIANCE_MIN_BATCH = 10;         // Need ≥ 10 timestamps to analyse
const STDDEV_THRESHOLD_MS = 5;         // < 5 ms stddev = suspiciously uniform
const RATE_PROXIMITY_FACTOR = 0.8;     // Must also be at 80 %+ of rate cap

/**
 * Checks click-timing variance. BOTH conditions must be true
 * to trigger a shadowban:
 *   1. Stddev of inter-click intervals is below threshold
 *   2. User's rolling rate is close to the cap
 *
 * @param {number[]} timestamps - array of Date.now() from client
 * @param {number} totalInWindow - from computeRollingRate()
 */
export function checkClickVariance(timestamps, totalInWindow) {
  if (!Array.isArray(timestamps) || timestamps.length < VARIANCE_MIN_BATCH) {
    return { shouldShadowban: false, stddev: null };
  }

  // Compute inter-click intervals
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }
  if (intervals.length === 0) return { shouldShadowban: false, stddev: null };

  // Mean & standard deviation
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance =
    intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
  const stddev = Math.sqrt(variance);

  // Both conditions required
  const isUniform = stddev < STDDEV_THRESHOLD_MS;
  const isHighRate = totalInWindow > MAX_CLICKS_PER_WINDOW * RATE_PROXIMITY_FACTOR;

  return { shouldShadowban: isUniform && isHighRate, stddev };
}

// ─── GAMIFIED CAPTCHA ────────────────────────────────────────
const CAPTCHA_PROBABILITY = 0.10;      // 10 % chance per score submission
const CAPTCHA_TIMEOUT_MS = 5000;       // 5 s to solve
const CAPTCHA_MAX_FAILURES = 2;        // 1 retry allowed, 2nd fail → shadowban

const SHAPES = ['circle', 'star', 'triangle', 'square', 'diamond'];

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Server-controlled probability — not client-predictable. */
export function shouldIssueCaptcha() {
  return Math.random() < CAPTCHA_PROBABILITY;
}

/**
 * Generates a CAPTCHA challenge: one target shape among 2–3 decoys.
 * Returns data for both client (shapes/positions) and server (answer).
 */
export function generateCaptchaChallenge() {
  const captchaId = generateId();

  // Pick target shape
  const targetShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

  // Pick 2–3 decoy shapes (different from target)
  const decoyCount = 2 + Math.floor(Math.random() * 2);
  const available = SHAPES.filter(s => s !== targetShape);
  const decoys = [];
  for (let i = 0; i < decoyCount && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    decoys.push(available.splice(idx, 1)[0]);
  }

  // Shuffle target + decoys
  const allShapes = [targetShape, ...decoys];
  for (let i = allShapes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allShapes[i], allShapes[j]] = [allShapes[j], allShapes[i]];
  }

  // Assign percentage-based positions (kept within safe bounds)
  const shapes = allShapes.map((shape, idx) => ({
    type: shape,
    x: 10 + Math.floor(Math.random() * 65),
    y: 20 + Math.floor(Math.random() * 50),
    id: idx,
  }));

  return { captchaId, targetShape, shapes, timeoutMs: CAPTCHA_TIMEOUT_MS };
}

/**
 * Stores a CAPTCHA challenge in the player's DB row.
 * Resets failure counter for a fresh challenge.
 */
export async function storeCaptchaChallenge(sql, userId, challenge) {
  await sql`
    UPDATE players
    SET pending_captcha_id    = ${challenge.captchaId},
        pending_captcha_target = ${challenge.targetShape},
        captcha_issued_at      = NOW(),
        captcha_failures       = 0
    WHERE clerk_id = ${userId}
  `;
}

/** Formats a challenge for the client-facing JSON response. */
export function formatCaptchaForClient(challenge) {
  return {
    captcha_id: challenge.captchaId,
    target_shape: challenge.targetShape,
    shapes: challenge.shapes,
    timeout_ms: challenge.timeoutMs,
  };
}

/**
 * Verifies a CAPTCHA response from the client.
 *
 * Returns one of:
 *   { valid: true }
 *   { valid: false, retry: true, retries_left, captcha }
 *   { valid: true, _shadowbanned: true }  ← looks like success to client
 *
 * @param {Function} sql
 * @param {string} userId
 * @param {{ captchaId, selectedShapeType, timedOut, strayClicks }} result
 */
export async function verifyCaptchaResponse(sql, userId, { captchaId, selectedShapeType, timedOut, strayClicks }) {
  const rows = await sql`
    SELECT pending_captcha_id, pending_captcha_target,
           captcha_issued_at, captcha_failures, is_shadowbanned
    FROM players
    WHERE clerk_id = ${userId}
  `;
  if (rows.length === 0) return { valid: false, reason: 'player_not_found' };

  const player = rows[0];

  // Already shadowbanned — silently accept so they don't notice
  if (player.is_shadowbanned) {
    await sql`
      UPDATE players
      SET pending_captcha_id = NULL, pending_captcha_target = NULL,
          captcha_issued_at = NULL
      WHERE clerk_id = ${userId}
    `;
    return { valid: true };
  }

  // Captcha ID mismatch (stale or tampered)
  if (player.pending_captcha_id !== captchaId) {
    return { valid: false, reason: 'captcha_id_mismatch' };
  }

  // Server-side timing check
  // NOTE: A laggy client could cause a false timeout. We give
  // 2 s network grace + 1 retry to mitigate this.
  const issuedAt = new Date(player.captcha_issued_at).getTime();
  const elapsed = Date.now() - issuedAt;
  const serverTimedOut = elapsed > (CAPTCHA_TIMEOUT_MS + 2000);

  // Determine failure
  const failed = timedOut || serverTimedOut || (strayClicks > 0);
  const wrongAnswer = !failed && selectedShapeType !== player.pending_captcha_target;
  const attemptFailed = failed || wrongAnswer;

  if (attemptFailed) {
    const failures = (Number(player.captcha_failures) || 0) + 1;

    if (failures >= CAPTCHA_MAX_FAILURES) {
      // Second failure → shadowban (return success so client doesn't know)
      await sql`
        UPDATE players
        SET is_shadowbanned       = TRUE,
            pending_captcha_id    = NULL,
            pending_captcha_target = NULL,
            captcha_issued_at      = NULL,
            captcha_failures       = ${failures}
        WHERE clerk_id = ${userId}
      `;
      return { valid: true, _shadowbanned: true };
    }

    // First failure → generate a new challenge for retry
    const newChallenge = generateCaptchaChallenge();
    await sql`
      UPDATE players
      SET pending_captcha_id    = ${newChallenge.captchaId},
          pending_captcha_target = ${newChallenge.targetShape},
          captcha_issued_at      = NOW(),
          captcha_failures       = ${failures}
      WHERE clerk_id = ${userId}
    `;
    return {
      valid: false,
      retry: true,
      retries_left: CAPTCHA_MAX_FAILURES - failures,
      captcha: formatCaptchaForClient(newChallenge),
    };
  }

  // ── Success — clear CAPTCHA state ──
  await sql`
    UPDATE players
    SET pending_captcha_id    = NULL,
        pending_captcha_target = NULL,
        captcha_issued_at      = NULL,
        captcha_failures       = 0
    WHERE clerk_id = ${userId}
  `;
  return { valid: true };
}
