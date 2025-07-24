// scripts/init-db.ts
import 'dotenv/config';
import { execSync } from 'child_process';
import { Client } from 'pg';

const { DB_USER, DB_NAME, DB_PASSWORD } = process.env;

if (!DB_USER || !DB_NAME || !DB_PASSWORD) {
  throw new Error('Missing required environment variables for db config.');
}

const DB_CONFIG = {
  user: process.env.DB_USER!,
  host: process.env.DB_HOST!,
  database: process.env.DB_NAME!,
  password: process.env.DB_PASSWORD!,
  port: parseInt(process.env.DB_PORT! || '5432', 10),
};

async function waitForDatabase(): Promise<void> {
  const client = new Client(DB_CONFIG);

  console.log('⏳ Waiting for PostgreSQL to be ready...');

  let retries = 30;
  while (retries > 0) {
    try {
      await client.connect();
      await client.end();
      console.log('✅ PostgreSQL is ready.');
      return;
    } catch (err) {
      retries--;
      console.log(`Retrying... (${30 - retries}/30)`);
      await new Promise((res) => setTimeout(res, 2000));
    }
  }

  console.error('❌ Could not connect to the database. Exiting.');
  process.exit(1);
}

async function runMigrations(): Promise<void> {
  try {
     if (process.env.SKIP_DB_SETUP !== 'true') {
      console.log('🧩 Applying Prisma migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('✅ Migrations applied successfully.');
      console.log('🧩 Applying Prisma generate...');
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('✅ Prisma Generate successfull.');
    } else {
      console.log('⏭️ Skipping DB setup & DB gnerate as SKIP_DB_SETUP=true');
    }
  } catch (err) {
    console.error('❌ Failed to run Prisma migrations:', err);
    process.exit(1);
  }
}

async function main() {
  await waitForDatabase();
  await runMigrations();
}

main();
