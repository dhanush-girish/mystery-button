// ═══════════════════════════════════════════════════════════════
// Anti-Cheat V2 Migration
// Run once: cd server && node migrate-anticheat-v2.js
// Safe to re-run (uses IF NOT EXISTS).
// ═══════════════════════════════════════════════════════════════
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('🔧 Anti-cheat v2 migration starting...\n');

    // ── Shadowban fields ──
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE`;
    console.log('  ✅ is_shadowbanned (BOOLEAN DEFAULT FALSE)');

    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS shadow_score INTEGER DEFAULT 0`;
    console.log('  ✅ shadow_score (INTEGER DEFAULT 0)');

    // ── Rolling rate cap (DB-backed for Vercel serverless) ──
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS click_windows JSONB DEFAULT '[]'`;
    console.log('  ✅ click_windows (JSONB DEFAULT [])');

    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS rate_violations INTEGER DEFAULT 0`;
    console.log('  ✅ rate_violations (INTEGER DEFAULT 0)');

    // ── CAPTCHA state ──
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS pending_captcha_id TEXT DEFAULT NULL`;
    console.log('  ✅ pending_captcha_id (TEXT)');

    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS pending_captcha_target TEXT DEFAULT NULL`;
    console.log('  ✅ pending_captcha_target (TEXT)');

    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS captcha_issued_at TIMESTAMPTZ DEFAULT NULL`;
    console.log('  ✅ captcha_issued_at (TIMESTAMPTZ)');

    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS captcha_failures INTEGER DEFAULT 0`;
    console.log('  ✅ captcha_failures (INTEGER DEFAULT 0)');

    console.log('\n🎉 Anti-cheat v2 migration complete!');
    console.log('   New columns added to `players` table.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
