import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { createPool } from './index.ts';

const migrationsDir = path.resolve(process.cwd(), 'database', 'migrations');

function splitSqlStatements(sql: string) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function migrate() {
  console.log('Starting MySQL migrations...');
  const pool = createPool();

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [rows] = await pool.query('SELECT name FROM schema_migrations');
    const executed = new Set((rows as Array<{ name: string }>).map((row) => row.name));
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      if (executed.has(file)) {
        console.log(`Skipping already executed migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}`);
      const migrationSql = await readFile(path.join(migrationsDir, file), 'utf8');
      const statements = splitSqlStatements(migrationSql);
      const connection = await pool.getConnection();

      try {
        for (const statement of statements) {
          await connection.query(statement);
        }
        await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      } finally {
        connection.release();
      }
    }

    console.log('MySQL migrations completed successfully.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === import.meta.filename || process.argv[1]?.endsWith('migrate.ts')) {
  migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
