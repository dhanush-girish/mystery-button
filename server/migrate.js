import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('Adding profile_image_url column...');
    await sql`ALTER TABLE players ADD COLUMN profile_image_url TEXT;`;
    console.log('Migration successful.');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Column already exists.');
    } else {
      console.error('Migration failed:', err);
    }
  }
}

migrate();
