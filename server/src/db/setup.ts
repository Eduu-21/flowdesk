/* Creates the database (if needed), applies schema.sql and seed.sql.
 *   npm run db:setup           -> schema + demo data
 *   npm run db:schema          -> schema only (empty studio)
 */
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { config } from '../config';

async function ensureDatabaseExists(): Promise<void> {
  const client = new Client({ connectionString: config.databaseUrl });
  try {
    await client.connect();
    await client.end();
    return;
  } catch (err: any) {
    await client.end().catch(() => undefined);
    if (err?.code !== '3D000') throw err; // 3D000 = database does not exist
  }
  const url = new URL(config.databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  await admin.end();
  console.log(`Created database "${dbName}".`);
}

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and edit it first.');
  }
  const force = process.argv.includes('--force');
  if (config.nodeEnv === 'production' && !force) {
    throw new Error('Refusing to reset the database in production. Use --force if you are sure.');
  }
  const schemaOnly = process.argv.includes('--schema-only');
  const dir = path.resolve(__dirname, '../../../database');
  const schema = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8');

  await ensureDatabaseExists();
  const client = new Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    console.log('Applying schema...');
    await client.query(schema);
    if (!schemaOnly) {
      console.log('Loading demo data...');
      await client.query(seed);
    }
  } finally {
    await client.end();
  }
  console.log('\nDatabase ready.');
  if (!schemaOnly) {
    console.log('Demo admin:  demo@flowdesk.local / DemoPassword123!');
    console.log('Demo staff:  marta@flowdesk.local / DemoPassword123!');
  }
}

main().catch((err) => {
  console.error(`\nDatabase setup failed: ${err.message}`);
  process.exit(1);
});
