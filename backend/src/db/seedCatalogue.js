import { pool } from './pool.js';
import { seedCatalogue } from '../services/catalogue/index.js';

async function run() {
  console.log('[seed:catalogue] seeding archetypes…');
  const { version, count } = await seedCatalogue();
  console.log(`[seed:catalogue] done — ${count} archetypes/blueprints at catalogue version ${version}.`);
  await pool.end();
}

run().catch((err) => {
  console.error('[seed:catalogue] failed:', err.message);
  process.exit(1);
});
