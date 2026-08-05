import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export { sql };
