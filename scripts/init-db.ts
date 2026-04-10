// scripts/init-db.ts
import 'dotenv/config';
import { execSync } from 'child_process';
import { Client } from 'pg';

const { DB_USER, DB_NAME, DB_PASSWORD, DB_TYPE } = process.env;
const dbType = (DB_TYPE || 'local').toLowerCase()

function localDBConfig() {
  if (!DB_USER || !DB_NAME || !DB_PASSWORD) {
    throw new Error('Missing required environment variables for local DB config.');
  }
  const DB_CONFIG = {
    user: process.env.DB_USER!,
    host: process.env.DB_HOST!,
    database: process.env.DB_NAME!,
    password: process.env.DB_PASSWORD!,
    port: parseInt(process.env.DB_PORT! || '5432', 10),
  };
  return new Client(DB_CONFIG);
}

async function waitForDatabase(): Promise<void> {
  if (dbType === 'cloud') {
    console.log('Skipping DB wait (cloud mode)...');
    return;
  }
 
  console.log('⏳ Waiting for PostgreSQL to be ready...');

  const MAX_RETRIES = 5;
  let retries = MAX_RETRIES;
  while (retries > 0) {
    const client = localDBConfig();
    try {
      await client.connect();
      await client.end();
      console.log('✅ PostgreSQL is ready.');
      return;
    } catch (err) {
      retries--;
      console.log(`Retrying... (${MAX_RETRIES - retries}/MAX_RETRIES)`);
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  console.error('❌ Could not connect to the database. Exiting.');
  process.exit(1);
}

async function runMigrations(): Promise<void> {
  try {
      console.log('🧩 Applying Prisma migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('✅ Migrations applied successfully.');
      console.log('🧩 Applying Prisma generate...');
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('✅ Prisma Generate successfull.');
  } catch (err) {
    console.error('❌ Failed to run Prisma migrations:', err);
    process.exit(1);
  }
}

async function main() {
   if (process.env.SKIP_DB_SETUP === 'true') {
    console.log('Skipping DB setup completely as SKIP_DB_SETUP=true...');
    return;
  }

  if (process.env.DB_TYPE === 'local') {
    await waitForDatabase();
  }

  await runMigrations();
}

main();
