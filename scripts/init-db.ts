// scripts/init-db.ts
import { execSync } from 'child_process';
import { Client } from 'pg';

const DB_CONFIG = {
  user: 'larisha',
  host: 'localhost',
  database: 'larisha_db',
  password: '123456',
  port: 5432,
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
    console.log('🧩 Running Prisma migrations...');
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } else {
      execSync('npx prisma migrate dev --name auto', { stdio: 'inherit' });
    }
    
    console.log('✅ Migrations applied successfully.');
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
