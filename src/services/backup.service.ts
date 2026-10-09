import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { saveFileWithAndroidPicker } from './native/payment-file-saver';
import { Buffer } from 'react-native-quick-crypto';
// import * as Sharing from 'expo-sharing';

import type { SQLiteBindValue } from 'expo-sqlite';
import { getDatabase } from '../database/client';
import { CURRENT_SCHEMA_VERSION } from '../database/migrations';

import {
  decryptBackup,
  encryptBackup,
  EncryptedBackup,
} from './security/backup-crypto.service';
import { generateUUID } from '../utils/uuid';
import {
  BACKUP_TABLES,
  BackupContentSummary,
  BackupData,
  BackupTableName,
  summarizeBackupData,
  upgradeBackupData,
  validateBackupAttachment,
} from './backup-data';
import { recordSuccessfulBackup } from './backup-status.service';

const BACKUP_FORMAT = 'payment-app-backup';
// Version of the encrypted .pab envelope. This is independent of the
// database schema version stored in `schema_version` below.
const BACKUP_FORMAT_VERSION = 1;
const BACKUP_EXTENSION = '.pab';

export type { BackupContentSummary, BackupData, BackupTableName } from './backup-data';

export interface PaymentAppBackup {
  format: typeof BACKUP_FORMAT;
  /** Encrypted .pab container format version. */
  version: number;
  /** Database schema version used by the encrypted table data. */
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

  for (const table of BACKUP_TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${table};`,
    );

    if (table === 'company_expense_attachments') {
      const directory = new Directory(Paths.document, 'company-expense-attachments');
      data[table] = await Promise.all(rows.map(async (row) => {
        const file = new File(directory, String(row.storage_name));
        if (!file.exists) {
          throw new Error(`Attachment file is missing: ${String(row.file_name)}.`);
        }
        const bytes = await file.bytes();
        if (!Number.isInteger(row.size_bytes) || bytes.byteLength !== row.size_bytes) {
          throw new Error(`Attachment data failed its integrity check: ${String(row.file_name)}.`);
        }
        return {
          ...row,
          file_base64: Buffer.from(bytes).toString('base64'),
        };
      }));
    } else {
      data[table] = rows;
    }
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
async function createEncryptedBackupSnapshot(
  password: string,
): Promise<{ backup: PaymentAppBackup; summary: BackupContentSummary }> {
  if (!password) {
    throw new Error(
      'Backup password is required.',
    );
  }

  const data = await createBackup();
  const summary = summarizeBackupData(data);
  const plaintext = serializeBackup(data);

  const encrypted = encryptBackup(
    plaintext,
    password,
  );

  return {
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_FORMAT_VERSION,
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: Date.now(),
      crypto: encrypted,
    },
    summary,
  };
}

export async function createEncryptedBackup(
  password: string,
): Promise<PaymentAppBackup> {
  const { backup } = await createEncryptedBackupSnapshot(password);
  return backup;
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
): Promise<{ uri: string; summary: BackupContentSummary; createdAt: number }> {
  const { backup, summary } = await createEncryptedBackupSnapshot(password);

  const json = serializeEncryptedBackup(backup);

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const filename =
    `payment-app-backup-${timestamp}.pab`;

  const uri = await saveFileWithAndroidPicker(
    filename,
    json,
  );
  const createdAt = backup.created_at;
  await recordSuccessfulBackup({ ...summary, createdAt });
  return { uri, summary, createdAt };
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
    candidate.version !== BACKUP_FORMAT_VERSION
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
    !Number.isInteger(candidate.schema_version) ||
    candidate.schema_version < 1 ||
    candidate.schema_version > CURRENT_SCHEMA_VERSION
  ) {
    throw new Error(
      `Unsupported database schema version: ${candidate.schema_version}. This app supports backups through schema version ${CURRENT_SCHEMA_VERSION}.`,
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

  validateBackupData(parsed, backup.schema_version);

  return parsed;
}

/**
 * Validate the decrypted database data.
 */
function validateBackupData(
  data: unknown,
  schemaVersion: number,
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

  for (const table of BACKUP_TABLES) {
    if (table === 'company_expense_attachments' && schemaVersion < 4) {
      continue;
    }
    if (table === 'subcategories' && schemaVersion < 6) {
      continue;
    }
    if (
      ['split_groups', 'split_people', 'split_expenses'].includes(table) &&
      schemaVersion < 7
    ) {
      continue;
    }
    if (
      !Array.isArray(candidate[table])
    ) {
      throw new Error(
        `Backup table "${table}" is invalid.`,
      );
    }
  }
}

/** Restore backup data, upgrading supported older schemas in one transaction. */
export async function restoreBackup(
  backup: PaymentAppBackup,
  password: string,
): Promise<BackupContentSummary> {
  // 1. Decrypt and validate before touching the database.
  const data = decryptBackupData(
    backup,
    password,
  );

  // 2. Upgrade older supported schemas before inserting their rows.
  const currentSchemaData = upgradeBackupData(
    data,
    backup.schema_version,
  );
  const summary = summarizeBackupData(currentSchemaData);
  const attachmentPayloads = currentSchemaData.company_expense_attachments.map(
    validateBackupAttachment,
  );

  const db = await getDatabase();
  const attachmentDirectory = new Directory(
    Paths.document,
    'company-expense-attachments',
  );
  attachmentDirectory.create({ idempotent: true, intermediates: true });
  const oldAttachments = await db.getAllAsync<{ storage_name: string }>(
    'SELECT storage_name FROM company_expense_attachments;',
  );
  const stagedFiles: File[] = [];
  const attachmentRows: Record<string, unknown>[] = [];

  try {
    for (const { row, encoded, byteLength } of attachmentPayloads) {
      const bytes = Buffer.from(encoded, 'base64');
      if (bytes.byteLength !== byteLength) {
        throw new Error(`Attachment data failed its integrity check: ${String(row.file_name)}.`);
      }
      const extension = row.mime_type === 'application/pdf' ? '.pdf' : '.jpg';
      const storageName = `${generateUUID()}${extension}`;
      const file = new File(attachmentDirectory, storageName);
      file.create({ overwrite: false });
      stagedFiles.push(file);
      file.write(bytes);
      const savedBytes = await file.bytes();
      if (
        savedBytes.byteLength !== bytes.byteLength ||
        !Buffer.from(savedBytes).equals(bytes)
      ) {
        throw new Error(`Could not verify restored attachment: ${String(row.file_name)}.`);
      }
      const { file_base64: _fileBase64, ...metadata } = row;
      attachmentRows.push({ ...metadata, storage_name: storageName });
    }
  } catch (error) {
    for (const file of stagedFiles) {
      if (file.exists) file.delete();
    }
    throw error;
  }

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
      DELETE FROM split_expenses;
      DELETE FROM split_people;
      DELETE FROM split_groups;
      DELETE FROM personal_expenses;
      DELETE FROM subcategories;
      DELETE FROM company_expense_attachments;
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
      currentSchemaData.categories,
    );

    await insertBackupRows(
      db,
      'subcategories',
      currentSchemaData.subcategories,
    );

    await insertBackupRows(db, 'split_groups', currentSchemaData.split_groups);
    await insertBackupRows(db, 'split_people', currentSchemaData.split_people);
    await insertBackupRows(db, 'split_expenses', currentSchemaData.split_expenses);

    await insertBackupRows(
      db,
      'employee_details',
      currentSchemaData.employee_details,
    );

    await insertBackupRows(
      db,
      'personal_expenses',
      currentSchemaData.personal_expenses,
    );

    await insertBackupRows(
      db,
      'local_conveyance',
      currentSchemaData.local_conveyance,
    );

    await insertBackupRows(
      db,
      'outstation_conveyance',
      currentSchemaData.outstation_conveyance,
    );

    await insertBackupRows(
      db,
      'hotel',
      currentSchemaData.hotel,
    );

    await insertBackupRows(
      db,
      'tour_conveyance',
      currentSchemaData.tour_conveyance,
    );

    await insertBackupRows(
      db,
      'phone_expense',
      currentSchemaData.phone_expense,
    );

    await insertBackupRows(
      db,
      'miscellaneous_expense',
      currentSchemaData.miscellaneous_expense,
    );

    await insertBackupRows(
      db,
      'daily_allowance',
      currentSchemaData.daily_allowance,
    );

    await insertBackupRows(
      db,
      'company_expense_attachments',
      attachmentRows,
    );

    // ---------------------------------------------------------
    // COMMIT
    // ---------------------------------------------------------

    await db.execAsync('COMMIT;');
    transactionStarted = false;

    for (const attachment of oldAttachments) {
      try {
        const oldFile = new File(attachmentDirectory, attachment.storage_name);
        if (oldFile.exists) oldFile.delete();
      } catch (cleanupError) {
        console.warn('Could not remove a replaced attachment file:', cleanupError);
      }
    }

    return summary;

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

    for (const file of stagedFiles) {
      if (file.exists) file.delete();
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
