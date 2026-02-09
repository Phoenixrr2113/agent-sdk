/**
 * Pre-migration script that ensures the drizzle schema exists
 * before running drizzle-kit migrate.
 *
 * PGLite's wire protocol silently fails on CREATE SCHEMA when
 * run through drizzle-kit's internal migrator, so we create it
 * explicitly first.
 */
import pg from 'pg';
import { execSync } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

async function run() {
  const client = new pg.Client(DATABASE_URL);
  try {
    await client.connect();
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    console.log('[db-migrate] drizzle schema ensured');
  } catch (err) {
    console.warn('[db-migrate] Warning: could not ensure drizzle schema:', err.message);
  } finally {
    await client.end();
  }

  // Now run the actual drizzle-kit migrate
  execSync('npx drizzle-kit migrate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL },
  });
}

run().catch((err) => {
  console.error('[db-migrate] Fatal error:', err.message);
  process.exit(1);
});
