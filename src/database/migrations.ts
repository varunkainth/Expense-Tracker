import * as SQLite from 'expo-sqlite';
import { Migration } from '../types/database';
import { seedDefaultCategories } from './seed';
import { generateUUID } from '../utils/uuid';
import { getCurrentTimestamp } from '../utils/date';

export const CURRENT_SCHEMA_VERSION = 7;

export const MIGRATION_1_SQL = `
  -- 1. categories
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  -- 2. personal_expenses
  CREATE TABLE IF NOT EXISTS personal_expenses (
    id TEXT PRIMARY KEY NOT NULL,
    amount INTEGER NOT NULL,
    category_id TEXT NOT NULL,
    description TEXT,
    payment_method TEXT NOT NULL,
    expense_date INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (category_id)
      REFERENCES categories(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_personal_expenses_category_id
    ON personal_expenses(category_id);

  CREATE INDEX IF NOT EXISTS idx_personal_expenses_expense_date
    ON personal_expenses(expense_date);

  -- 3. employee_details
  CREATE TABLE IF NOT EXISTS employee_details (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    employee_code TEXT NOT NULL,
    grade TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_details_employee_code
    ON employee_details(employee_code);

  -- 4. local_conveyance
  CREATE TABLE IF NOT EXISTS local_conveyance (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    particulars TEXT NOT NULL,
    mode TEXT NOT NULL,
    complaint_no TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (employee_id)
      REFERENCES employee_details(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_local_conveyance_employee_id
    ON local_conveyance(employee_id);

  CREATE INDEX IF NOT EXISTS idx_local_conveyance_date
    ON local_conveyance(date);

  -- 5. outstation_conveyance
  CREATE TABLE IF NOT EXISTS outstation_conveyance (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    from_location TEXT NOT NULL,
    departure_time INTEGER,
    to_location TEXT NOT NULL,
    arrival_time INTEGER,
    mode TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (employee_id)
      REFERENCES employee_details(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_outstation_conveyance_employee_id
    ON outstation_conveyance(employee_id);

  CREATE INDEX IF NOT EXISTS idx_outstation_conveyance_date
    ON outstation_conveyance(date);

  -- 6. hotel
  CREATE TABLE IF NOT EXISTS hotel (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    hotel_name TEXT NOT NULL,
    bill_no TEXT,
    start_date INTEGER NOT NULL,
    end_date INTEGER NOT NULL,
    no_of_days INTEGER NOT NULL,
    rate_per_day INTEGER NOT NULL,
    food_amount INTEGER,
    amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (employee_id)
      REFERENCES employee_details(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_hotel_employee_id
    ON hotel(employee_id);

  CREATE INDEX IF NOT EXISTS idx_hotel_start_date
    ON hotel(start_date);

  -- 7. tour_conveyance
  CREATE TABLE IF NOT EXISTS tour_conveyance (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    mode TEXT NOT NULL,
    fare INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (employee_id)
      REFERENCES employee_details(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tour_conveyance_employee_id
    ON tour_conveyance(employee_id);

  CREATE INDEX IF NOT EXISTS idx_tour_conveyance_date
    ON tour_conveyance(date);

  -- 8. phone_expense
  CREATE TABLE IF NOT EXISTS phone_expense (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    particulars TEXT NOT NULL,
    tel_fax_no TEXT NOT NULL,
    bill_no TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (employee_id)
      REFERENCES employee_details(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_phone_expense_employee_id
    ON phone_expense(employee_id);

  CREATE INDEX IF NOT EXISTS idx_phone_expense_date
    ON phone_expense(date);

  -- 9. miscellaneous_expense
  CREATE TABLE IF NOT EXISTS miscellaneous_expense (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    particulars TEXT NOT NULL,
    bill_no TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (employee_id)
      REFERENCES employee_details(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_miscellaneous_expense_employee_id
    ON miscellaneous_expense(employee_id);

  CREATE INDEX IF NOT EXISTS idx_miscellaneous_expense_date
    ON miscellaneous_expense(date);

  -- 10. daily_allowance
  CREATE TABLE IF NOT EXISTS daily_allowance (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    travel_allowance INTEGER NOT NULL,
    food_allowance INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (employee_id)
      REFERENCES employee_details(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_daily_allowance_employee_id
    ON daily_allowance(employee_id);

  CREATE INDEX IF NOT EXISTS idx_daily_allowance_date
    ON daily_allowance(date);
`;

export const MIGRATION_2_SQL = `
  -- Drop the index that references the old "date" column
  DROP INDEX IF EXISTS idx_daily_allowance_date;

  -- Add new columns for manual days + date range
  ALTER TABLE daily_allowance ADD COLUMN no_of_days INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE daily_allowance ADD COLUMN start_date INTEGER;
  ALTER TABLE daily_allowance ADD COLUMN end_date INTEGER;

  -- Backfill existing rows from the old "date" column
  UPDATE daily_allowance SET start_date = date, end_date = date WHERE start_date IS NULL;

  -- Drop the old single-date column
  ALTER TABLE daily_allowance DROP COLUMN date;

  -- Recreate the index on the new date column
  CREATE INDEX IF NOT EXISTS idx_daily_allowance_start_date
    ON daily_allowance(start_date);
`;

export const MIGRATION_3_SQL = `
  ALTER TABLE employee_details ADD COLUMN mobile_no TEXT;
`;

export const MIGRATION_4_SQL = `
  CREATE TABLE company_expense_attachments (
    id TEXT PRIMARY KEY NOT NULL,
    expense_type TEXT NOT NULL CHECK (expense_type IN (
      'outstation_conveyance',
      'hotel',
      'tour_conveyance',
      'miscellaneous_expense'
    )),
    expense_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'application/pdf')),
    storage_name TEXT NOT NULL UNIQUE,
    size_bytes INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX idx_company_expense_attachments_expense
    ON company_expense_attachments(expense_type, expense_id, created_at);
`;

export const MIGRATION_5_SQL = `
  ALTER TABLE outstation_conveyance ADD COLUMN complaint_no TEXT NOT NULL DEFAULT '';
  ALTER TABLE hotel ADD COLUMN complaint_no TEXT NOT NULL DEFAULT '';
  ALTER TABLE tour_conveyance ADD COLUMN complaint_no TEXT NOT NULL DEFAULT '';
  ALTER TABLE phone_expense ADD COLUMN complaint_no TEXT NOT NULL DEFAULT '';
  ALTER TABLE miscellaneous_expense ADD COLUMN complaint_no TEXT NOT NULL DEFAULT '';
`;

export const MIGRATION_6_SQL = `
  CREATE TABLE subcategories (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE UNIQUE INDEX idx_subcategories_category_name
    ON subcategories(category_id, name COLLATE NOCASE);
  CREATE INDEX idx_subcategories_category_id
    ON subcategories(category_id);

  ALTER TABLE personal_expenses ADD COLUMN subcategory_id TEXT
    REFERENCES subcategories(id) ON DELETE SET NULL ON UPDATE CASCADE;
`;

export const MIGRATION_7_SQL = `
  CREATE TABLE split_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE split_people (
    id TEXT PRIMARY KEY NOT NULL,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES split_groups(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE INDEX idx_split_people_group_id ON split_people(group_id);

  CREATE TABLE split_expenses (
    id TEXT PRIMARY KEY NOT NULL,
    group_id TEXT NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL,
    paid_by_person_id TEXT NOT NULL,
    expense_date INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES split_groups(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (paid_by_person_id) REFERENCES split_people(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE INDEX idx_split_expenses_group_id ON split_expenses(group_id);
  CREATE INDEX idx_split_expenses_payer ON split_expenses(paid_by_person_id);
`;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema: Create 10 tables, indexes, and seed default categories',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(MIGRATION_1_SQL);
      await seedDefaultCategories(db);
    },
  },
  {
    version: 2,
    description: 'Daily allowance: replace single date with no_of_days + start_date + end_date',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(MIGRATION_2_SQL);
    },
  },
  {
    version: 3,
    description: 'Employee details: add mobile_no column',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(MIGRATION_3_SQL);
    },
  },
  {
    version: 4,
    description: 'Company expense attachments',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(MIGRATION_4_SQL);
    },
  },
  {
    version: 5,
    description: 'Company expenses: add complaint numbers',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(MIGRATION_5_SQL);
    },
  },
  {
    version: 6,
    description: 'Personal expense subcategories',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(MIGRATION_6_SQL);
      const defaults: Record<string, string[]> = {
        Travel: ['Bus', 'Train', 'Flight', 'Cab', 'Uber', 'Ola', 'Rapido'],
        Subscription: ['Netflix', 'Prime Video', 'Disney+ Hotstar', 'Spotify', 'YouTube Premium'],
        Bills: ['Mobile Recharge', 'Electricity', 'Water', 'Credit Card Bill', 'Internet', 'Gas'],
      };
      const createdAt = getCurrentTimestamp();
      for (const [categoryName, names] of Object.entries(defaults)) {
        const category = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM categories WHERE name = ?;',
          [categoryName],
        );
        if (!category) continue;
        for (const name of names) {
          await db.runAsync(
            'INSERT INTO subcategories (id, category_id, name, is_default, created_at) VALUES (?, ?, ?, 1, ?);',
            [generateUUID(), category.id, name, createdAt],
          );
        }
      }
    },
  },
  {
    version: 7,
    description: 'Friends expense sharing and settlement groups',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(MIGRATION_7_SQL);
    },
  },
];

/**
 * Gets current database schema version using PRAGMA user_version.
 */
export async function getDatabaseVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return result?.user_version ?? 0;
}

/**
 * Executes pending database migrations in sequence.
 *
 * Each migration runs inside a transaction so that:
 *   - The schema changes and the version bump are atomic.
 *   - A failure mid-migration rolls back everything and leaves
 *     user_version untouched so the migration can be retried.
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const currentVersion = await getDatabaseVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await db.execAsync('BEGIN TRANSACTION;');
      try {
        await migration.up(db);
        await db.execAsync(`PRAGMA user_version = ${migration.version};`);
        await db.execAsync('COMMIT;');
      } catch (err) {
        await db.execAsync('ROLLBACK;');
        throw err;
      }
    }
  }
}
