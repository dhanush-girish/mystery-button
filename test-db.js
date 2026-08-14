import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { sql } from './api/_db.js';

async function main() {
  const allPlayers = await sql`SELECT name, is_shadowbanned, score, shadow_score, (COALESCE(score, 0) + COALESCE(shadow_score, 0)) as computed FROM players WHERE is_shadowbanned = true`;
  console.log(allPlayers);
}
main();
