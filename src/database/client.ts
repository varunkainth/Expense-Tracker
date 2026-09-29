import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

export const DATABASE_NAME = 'payment.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Initializes SQLite configuration (foreign keys, WAL mode) and runs pending migrations.
 */
export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  // Enable foreign keys and WAL mode
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);

  // Run migrations
  await runMigrations(db);
}

/**
 * Returns a singleton database instance, ensuring initialization and migrations are completed.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    try {
      await initDatabase(db);
      dbInstance = db;
    } catch (err) {
      // Ensure a failed init doesn't leave a half-open handle cached.
      await db.closeAsync().catch(() => {});
      dbInstance = null;
      throw err;
    }
  }
  return dbInstance;
}

/**
 * Closes the database connection if open.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}
