import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('Adding anti-cheat columns...');

    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS last_click_sync TIMESTAMPTZ DEFAULT NOW()`;
    console.log('  ✅ last_click_sync column added');

    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS last_click_count INTEGER DEFAULT 0`;
    console.log('  ✅ last_click_count column added');

    console.log('Anti-cheat migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

migrate();
