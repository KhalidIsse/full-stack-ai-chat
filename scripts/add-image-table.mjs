// Optional helper: creates the "generated_image" table using DATABASE_URL.
// Usage:  npm run db:add-images
// (Alternative: paste migrations-manual/001_add_generated_image.sql into the Neon SQL Editor.)
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env first.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const statement = readFileSync(
  new URL('../migrations-manual/001_add_generated_image.sql', import.meta.url),
  'utf8'
);

try {
  await sql.query(statement);
  console.log('✓ generated_image table is ready.');
} catch (error) {
  console.error('Failed to create generated_image table:', error.message);
  process.exit(1);
}
