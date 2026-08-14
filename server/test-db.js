import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function main() {
  const { sql } = await import('../api/_db.js');
  
  // Simulate the exact query from api/leaderboard.js
  const rows = await sql`
    SELECT name, course, batch, (score + COALESCE(shadow_score, 0)) as score FROM players
    ORDER BY (score + COALESCE(shadow_score, 0)) DESC LIMIT 100
  `;
  
  const h = rows.find(r => r.name === 'Harikrishnan.S.M');
  console.log('Harikrishnan in leaderboard query?', !!h);
  if (h) {
    console.log('His returned data:', h);
  } else {
    console.log('NOT FOUND in top 100. Let me check his raw score vs the 100th rank.');
    const rank100 = rows[rows.length - 1];
    console.log('Rank 100 score:', rank100.score);
  }
  process.exit(0);
}
main();
