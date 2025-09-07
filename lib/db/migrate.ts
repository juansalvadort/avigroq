import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({
  path: '.env.local',
});

const runMigrate = async () => {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.log('↪️  Skipping migrations (no POSTGRES_URL).');
    process.exit(0);
  }

  const isLocal = /(^|@)(localhost|127\.0\.0\.1|::1)(:|$)/.test(url);
  if (isLocal) {
    console.log('↪️  Skipping migrations (local POSTGRES_URL).');
    process.exit(0);
  }

  const connection = postgres(url, { max: 1 });
  const db = drizzle(connection);

  console.log('⏳ Running migrations...');

  const start = Date.now();
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
