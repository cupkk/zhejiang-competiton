import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client } from 'pg';

const tableOrder = [
  'admin_users',
  'admin_sessions',
  'admin_audit_logs',
  'users',
  'sessions',
  'competitions',
  'resource_assets',
  'resources',
  'resource_competitions',
  'teams',
  'posts',
  'notifications',
  'search_suggestions',
  'favorites',
  'competition_enrollments',
  'team_applications',
  'owned_resources',
  'orders',
  'comments',
  'post_likes',
  'comment_likes',
  'reports',
  'moderation_tasks',
  'resource_download_grants',
  'refunds',
  'payment_events',
  'home_feed_configs',
] as const;

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  const matched = process.argv.find((item) => item.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : '';
}

function getBooleanArg(name: string) {
  const value = getArg(name);
  return value === '1' || value === 'true' || value === 'yes';
}

async function ensureTargetSchema(postgresUrl: string) {
  process.env.DB_PROVIDER = 'postgres';
  process.env.POSTGRES_URL = postgresUrl;
  process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
  await import('../server/db.ts');
}

async function main() {
  const sqlitePath = resolve(getArg('sqlite') || process.env.SQLITE_PATH || 'server/data/campus-growth.db');
  const postgresUrl = getArg('postgres-url') || process.env.POSTGRES_URL || '';
  const skipInit = getBooleanArg('skip-init');

  if (!existsSync(sqlitePath)) {
    throw new Error(`sqlite_source_missing:${sqlitePath}`);
  }

  if (!postgresUrl) {
    throw new Error('postgres_url_missing');
  }

  if (!skipInit) {
    await ensureTargetSchema(postgresUrl);
  }

  const sqlite = new DatabaseSync(sqlitePath);
  const postgres = new Client({ connectionString: postgresUrl });

  try {
    await postgres.connect();

    const truncateSql = tableOrder.map((table) => quoteIdentifier(table)).join(', ');
    await postgres.query(`TRUNCATE TABLE ${truncateSql} RESTART IDENTITY CASCADE`);

    for (const table of tableOrder) {
      const columns = sqlite
        .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
        .all() as Array<{ name: string }>;
      const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as Array<Record<string, unknown>>;

      if (rows.length === 0 || columns.length === 0) {
        console.log(`${table}: 0`);
        continue;
      }

      const columnNames = columns.map((column) => column.name);
      const quotedColumns = columnNames.map((column) => quoteIdentifier(column)).join(', ');

      for (const row of rows) {
        const values = columnNames.map((column) => row[column] ?? null);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        await postgres.query(
          `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`,
          values,
        );
      }

      console.log(`${table}: ${rows.length}`);
    }
  } finally {
    await postgres.end().catch(() => undefined);
    sqlite.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
