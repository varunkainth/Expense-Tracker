import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { saveFileWithAndroidPicker } from './native/payment-file-saver';
// import * as Sharing from 'expo-sharing';

import type { SQLiteBindValue } from 'expo-sqlite';
import { getDatabase } from '../database/client';
import { CURRENT_SCHEMA_VERSION } from '../database/migrations';

import {
  decryptBackup,
  encryptBackup,
  EncryptedBackup,
} from './security/backup-crypto.service';

const BACKUP_FORMAT = 'payment-app-backup';
const BACKUP_VERSION = 1;
const BACKUP_EXTENSION = '.pab';

const TABLES = [
  'categories',
  'personal_expenses',
  'employee_details',
  'local_conveyance',
  'outstation_conveyance',
  'hotel',
  'tour_conveyance',
  'phone_expense',
  'miscellaneous_expense',
  'daily_allowance',
] as const;

export type BackupTableName = (typeof TABLES)[number];

export interface BackupData {
  categories: unknown[];
  personal_expenses: unknown[];
  employee_details: unknown[];
  local_conveyance: unknown[];
  outstation_conveyance: unknown[];
  hotel: unknown[];
  tour_conveyance: unknown[];
  phone_expense: unknown[];
  miscellaneous_expense: unknown[];
  daily_allowance: unknown[];
}

export interface PaymentAppBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  schema_version: number;
  created_at: number;

  crypto: EncryptedBackup;
}

function isSQLiteBindValue(v: unknown): v is SQLiteBindValue {
  return (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    v instanceof Uint8Array
  );
}


/**
 * Create a snapshot of all application data.
 *
 * The returned object contains plaintext database data in memory only.
 * It is encrypted before being written to a .pab file.
 */
export async function createBackup(): Promise<BackupData> {
  const db = await getDatabase();

  const data = {} as BackupData;

  for (const table of TABLES) {
    const rows = await db.getAllAsync(
      `SELECT * FROM ${table};`,
    );

    data[table] = rows;
  }

  return data;
}

/**
 * Serialize backup data before encryption.
 */
export function serializeBackup(
  data: BackupData,
): string {
  return JSON.stringify(data);
}

/**
 * Create the complete encrypted backup object.
 *
 * Password is used only during encryption and is never
 * stored inside the backup.
 */
export async function createEncryptedBackup(
  password: string,
): Promise<PaymentAppBackup> {
  if (!password) {
    throw new Error(
      'Backup password is required.',
    );
  }

  const data = await createBackup();

  const plaintext = serializeBackup(data);

  const encrypted = encryptBackup(
    plaintext,
    password,
  );

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schema_version: CURRENT_SCHEMA_VERSION,
    created_at: Date.now(),
    crypto: encrypted,
  };
}

/**
 * Serialize the complete backup container.
 *
 * This JSON is NOT plaintext database data anymore.
 * The actual database contents are inside crypto.ciphertext.
 */
export function serializeEncryptedBackup(
  backup: PaymentAppBackup,
): string {
  return JSON.stringify(backup);
}

/**
 * Create a temporary encrypted .pab file.
 *
 * The file is created inside the application's cache directory
 * and is intended to be passed to the system share/save UI.
 */
export async function createTemporaryBackupFile(
  password: string,
): Promise<string> {
  const backup =
    await createEncryptedBackup(password);

  const json =
    serializeEncryptedBackup(backup);

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const filename =
    `payment-app-backup-${timestamp}${BACKUP_EXTENSION}`;

  const file = new File(
    Paths.cache,
    filename,
  );

  file.create({
    overwrite: true,
  });

  file.write(json);

  return file.uri;
}

/**
 * Create an encrypted backup and open the
 * system share/save UI.
 */
export async function createAndSaveBackup(
  password: string,
): Promise<string> {
  const backup = await createEncryptedBackup(password);

  const json = serializeEncryptedBackup(backup);

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const filename =
    `payment-app-backup-${timestamp}.pab`;

  return await saveFileWithAndroidPicker(
    filename,
    json,
  );
}

/**
 * Open the system file picker and select a .pab file.
 */
export async function pickBackupFile(): Promise<
  string | null
> {
  const result =
    await DocumentPicker.getDocumentAsync({
      type: 'application/octet-stream',
      copyToCacheDirectory: true,
      multiple: false,
    });

  if (result.canceled) {
    return null;
  }

  return result.assets[0]?.uri ?? null;
}

/**
 * Read and parse the encrypted backup container.
 *
 * This does NOT decrypt the database.
 */
export async function readBackupFile(
  fileUri: string,
): Promise<PaymentAppBackup> {
  const file = new File(fileUri);

  const content = await file.text();

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      'The selected file is not a valid Payment App backup.',
    );
  }

  validateBackup(parsed);

  return parsed;
}

/**
 * Validate the outer .pab structure.
 */
export function validateBackup(
  backup: unknown,
): asserts backup is PaymentAppBackup {
  if (
    typeof backup !== 'object' ||
    backup === null
  ) {
    throw new Error(
      'Invalid backup file.',
    );
  }

  const candidate =
    backup as Partial<PaymentAppBackup>;

  if (
    candidate.format !== BACKUP_FORMAT
  ) {
    throw new Error(
      'This file is not a Payment App backup.',
    );
  }

  if (
    candidate.version !== BACKUP_VERSION
  ) {
    throw new Error(
      `Unsupported backup version: ${candidate.version}.`,
    );
  }

  if (
    typeof candidate.schema_version !==
    'number'
  ) {
    throw new Error(
      'Backup schema version is missing.',
    );
  }

  if (
    typeof candidate.created_at !==
    'number'
  ) {
    throw new Error(
      'Backup creation timestamp is missing.',
    );
  }

  if (
    typeof candidate.crypto !==
    'object' ||
    candidate.crypto === null
  ) {
    throw new Error(
      'Backup encryption data is missing.',
    );
  }

  validateEncryptedBackup(
    candidate.crypto,
  );
}

/**
 * Validate encryption metadata before attempting
 * decryption.
 */
function validateEncryptedBackup(
  encrypted: unknown,
): asserts encrypted is EncryptedBackup {
  if (
    typeof encrypted !== 'object' ||
    encrypted === null
  ) {
    throw new Error(
      'Invalid backup encryption data.',
    );
  }

  const candidate =
    encrypted as Partial<EncryptedBackup>;

  if (
    candidate.algorithm !==
    'AES-256-GCM'
  ) {
    throw new Error(
      'Unsupported backup encryption algorithm.',
    );
  }

  if (
    candidate.kdf !==
    'PBKDF2-HMAC-SHA256'
  ) {
    throw new Error(
      'Unsupported backup key derivation algorithm.',
    );
  }

  if (
    typeof candidate.iterations !==
    'number'
  ) {
    throw new Error(
      'Backup KDF iteration count is missing.',
    );
  }

  if (
    typeof candidate.salt !==
    'string'
  ) {
    throw new Error(
      'Backup salt is missing.',
    );
  }

  if (
    typeof candidate.iv !==
    'string'
  ) {
    throw new Error(
      'Backup IV is missing.',
    );
  }

  if (
    typeof candidate.authTag !==
    'string'
  ) {
    throw new Error(
      'Backup authentication tag is missing.',
    );
  }

  if (
    typeof candidate.ciphertext !==
    'string'
  ) {
    throw new Error(
      'Backup ciphertext is missing.',
    );
  }
}

/**
 * Decrypt the database payload.
 *
 * This only decrypts and validates the data.
 * It does NOT modify the current database.
 */
export function decryptBackupData(
  backup: PaymentAppBackup,
  password: string,
): BackupData {
  validateBackup(backup);

  const plaintext = decryptBackup(
    backup.crypto,
    password,
  );

  let parsed: unknown;

  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error(
      'Backup was decrypted but contains invalid database data.',
    );
  }

  validateBackupData(parsed);

  return parsed;
}

/**
 * Validate the decrypted database data.
 */
function validateBackupData(
  data: unknown,
): asserts data is BackupData {
  if (
    typeof data !== 'object' ||
    data === null
  ) {
    throw new Error(
      'Invalid backup database data.',
    );
  }

  const candidate =
    data as Partial<BackupData>;

  for (const table of TABLES) {
    if (
      !Array.isArray(candidate[table])
    ) {
      throw new Error(
        `Backup table "${table}" is invalid.`,
      );
    }
  }
}

/**
 * Restore backup data.
 *
 * IMPORTANT:
 * This function intentionally remains disabled until
 * transaction-safe database replacement is implemented.
 */
export async function restoreBackup(
  backup: PaymentAppBackup,
  password: string,
): Promise<void> {
  // 1. Decrypt and validate before touching the database.
  const data = decryptBackupData(
    backup,
    password,
  );

  // 2. Make sure this backup matches the current schema.
  if (backup.schema_version !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Backup schema version ${backup.schema_version} is not compatible with the current database schema ${CURRENT_SCHEMA_VERSION}.`,
    );
  }

  const db = await getDatabase();

  let transactionStarted = false;

  try {
    // 3. Start transaction.
    await db.execAsync('BEGIN TRANSACTION;');
    transactionStarted = true;

    // ---------------------------------------------------------
    // DELETE EXISTING DATA
    // ---------------------------------------------------------

    // Child tables first because of foreign keys.
    await db.execAsync(`
      DELETE FROM personal_expenses;
      DELETE FROM local_conveyance;
      DELETE FROM outstation_conveyance;
      DELETE FROM hotel;
      DELETE FROM tour_conveyance;
      DELETE FROM phone_expense;
      DELETE FROM miscellaneous_expense;
      DELETE FROM daily_allowance;

      DELETE FROM categories;
      DELETE FROM employee_details;
    `);

    // ---------------------------------------------------------
    // INSERT BACKUP DATA
    // ---------------------------------------------------------

    await insertBackupRows(
      db,
      'categories',
      data.categories,
    );

    await insertBackupRows(
      db,
      'employee_details',
      data.employee_details,
    );

    await insertBackupRows(
      db,
      'personal_expenses',
      data.personal_expenses,
    );

    await insertBackupRows(
      db,
      'local_conveyance',
      data.local_conveyance,
    );

    await insertBackupRows(
      db,
      'outstation_conveyance',
      data.outstation_conveyance,
    );

    await insertBackupRows(
      db,
      'hotel',
      data.hotel,
    );

    await insertBackupRows(
      db,
      'tour_conveyance',
      data.tour_conveyance,
    );

    await insertBackupRows(
      db,
      'phone_expense',
      data.phone_expense,
    );

    await insertBackupRows(
      db,
      'miscellaneous_expense',
      data.miscellaneous_expense,
    );

    await insertBackupRows(
      db,
      'daily_allowance',
      data.daily_allowance,
    );

    // ---------------------------------------------------------
    // COMMIT
    // ---------------------------------------------------------

    await db.execAsync('COMMIT;');
    transactionStarted = false;

  } catch (error) {
    // ---------------------------------------------------------
    // ROLLBACK
    // ---------------------------------------------------------

    if (transactionStarted) {
      try {
        await db.execAsync('ROLLBACK;');
      } catch (rollbackError) {
        console.error(
          'Database rollback failed:',
          rollbackError,
        );
      }
    }

    console.error(
      'Database restore failed:',
      error,
    );

    throw new Error(
      error instanceof Error
        ? `Restore failed: ${error.message}`
        : 'Restore failed. Your existing data was not restored.',
    );
  }
}

async function insertBackupRows(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: BackupTableName,
  rows: unknown[],
): Promise<void> {
  for (const row of rows) {
    if (
      typeof row !== 'object' ||
      row === null ||
      Array.isArray(row)
    ) {
      throw new Error(
        `Invalid row found in backup table "${table}".`,
      );
    }

    const record =
      row as Record<string, unknown>;

    const columns = Object.keys(record);

    if (columns.length === 0) {
      throw new Error(
        `Empty row found in backup table "${table}".`,
      );
    }

    // Only allow normal SQLite identifiers.
    for (const column of columns) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
        throw new Error(
          `Invalid column "${column}" in backup table "${table}".`,
        );
      }
    }

    const placeholders = columns
      .map(() => '?')
      .join(', ');

    const sql = `
      INSERT INTO ${table}
      (${columns.join(', ')})
      VALUES (${placeholders});
    `;

    const values: SQLiteBindValue[] = [];
for (const column of columns) {
  const v = record[column];
  if (!isSQLiteBindValue(v)) {
    throw new Error(
      `Invalid value for column "${column}" in backup table "${table}".`,
    );
  }
  values.push(v);
}

    await db.runAsync(sql, ...values);
  }
}