import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — using default localhost connection');
}

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://specgen:specgen@localhost:5544/specgen',
});

pool.on('error', (err) => {
  console.error('[db] unexpected pool error', err);
});

/** Convenience query helper. */
export const query = (text, params) => pool.query(text, params);
