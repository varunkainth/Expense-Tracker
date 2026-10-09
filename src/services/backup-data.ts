export const BACKUP_TABLES = [
  'categories',
  'subcategories',
  'personal_expenses',
  'split_groups',
  'split_people',
  'split_expenses',
  'employee_details',
  'local_conveyance',
  'outstation_conveyance',
  'hotel',
  'tour_conveyance',
  'phone_expense',
  'miscellaneous_expense',
  'daily_allowance',
  'company_expense_attachments',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export interface BackupData {
  categories: unknown[];
  subcategories: unknown[];
  personal_expenses: unknown[];
  split_groups: unknown[];
  split_people: unknown[];
  split_expenses: unknown[];
  employee_details: unknown[];
  local_conveyance: unknown[];
  outstation_conveyance: unknown[];
  hotel: unknown[];
  tour_conveyance: unknown[];
  phone_expense: unknown[];
  miscellaneous_expense: unknown[];
  daily_allowance: unknown[];
  company_expense_attachments: unknown[];
}

export interface BackupContentSummary {
  recordCount: number;
  attachmentCount: number;
  attachmentBytes: number;
}

export interface BackupStatus extends BackupContentSummary {
  createdAt: number;
}

export const BACKUP_REMINDER_AFTER_DAYS = 30;
const BACKUP_REMINDER_AGE_MS = BACKUP_REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000;

export function isBackupOverdue(
  status: BackupStatus | null,
  now: number = Date.now(),
): boolean {
  return status === null || now - status.createdAt >= BACKUP_REMINDER_AGE_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function summarizeBackupData(data: BackupData): BackupContentSummary {
  const recordCount = BACKUP_TABLES
    .filter((table) => table !== 'company_expense_attachments')
    .reduce((total, table) => total + data[table].length, 0);

  const attachmentBytes = data.company_expense_attachments.reduce<number>((total, row) => {
    if (!isRecord(row) || typeof row.size_bytes !== 'number' || !Number.isFinite(row.size_bytes)) {
      return total;
    }
    return total + row.size_bytes;
  }, 0);

  return {
    recordCount,
    attachmentCount: data.company_expense_attachments.length,
    attachmentBytes,
  };
}

/** Upgrade an authenticated older snapshot to the current row shape. */
export function upgradeBackupData(
  data: BackupData,
  schemaVersion: number,
): BackupData {
  let upgraded = data;

  if (schemaVersion < 2) {
    upgraded = {
      ...upgraded,
      daily_allowance: upgraded.daily_allowance.map((row) => {
        if (!isRecord(row)) throw new Error('Invalid daily allowance row in backup.');

        const { date, ...fields } = row;
        const startDate = fields.start_date ?? date;
        const endDate = fields.end_date ?? date;
        if (typeof startDate !== 'number' || typeof endDate !== 'number') {
          throw new Error('A V1 backup contains a daily allowance row without a valid date.');
        }
        return {
          ...fields,
          no_of_days: fields.no_of_days ?? 1,
          start_date: startDate,
          end_date: endDate,
        };
      }),
    };
  }

  if (schemaVersion < 3) {
    upgraded = {
      ...upgraded,
      employee_details: upgraded.employee_details.map((row) => {
        if (!isRecord(row)) throw new Error('Invalid employee row in backup.');
        return 'mobile_no' in row ? row : { ...row, mobile_no: null };
      }),
    };
  }

  if (schemaVersion < 4) {
    upgraded = { ...upgraded, company_expense_attachments: [] };
  }

  if (schemaVersion < 5) {
    const complaintTables = [
      'outstation_conveyance',
      'hotel',
      'tour_conveyance',
      'phone_expense',
      'miscellaneous_expense',
    ] as const;
    upgraded = { ...upgraded };
    for (const table of complaintTables) {
      upgraded[table] = upgraded[table].map((row) => {
        if (!isRecord(row)) throw new Error(`Invalid ${table} row in backup.`);
        return 'complaint_no' in row ? row : { ...row, complaint_no: '' };
      });
    }
  }

  if (schemaVersion < 6) {
    upgraded = {
      ...upgraded,
      subcategories: [],
      personal_expenses: upgraded.personal_expenses.map((row) => {
        if (!isRecord(row)) throw new Error('Invalid personal expense row in backup.');
        return { ...row, subcategory_id: null };
      }),
    };
  }

  if (schemaVersion < 7) {
    upgraded = {
      ...upgraded,
      split_groups: [],
      split_people: [],
      split_expenses: [],
    };
  }

  return upgraded;
}

/** Return the decoded byte length after rejecting malformed/noncanonical base64. */
export function validateBackupAttachment(
  value: unknown,
): { row: Record<string, unknown>; encoded: string; byteLength: number } {
  if (!isRecord(value)) throw new Error('Invalid attachment record in backup.');
  const row = value;

  if (
    typeof row.id !== 'string' ||
    typeof row.expense_id !== 'string' ||
    typeof row.file_name !== 'string' ||
    typeof row.created_at !== 'number' ||
    !Number.isFinite(row.created_at) ||
    !Number.isInteger(row.size_bytes) ||
    (row.size_bytes as number) <= 0
  ) {
    throw new Error('An attachment record in the backup is incomplete.');
  }
  if (
    !['outstation_conveyance', 'hotel', 'tour_conveyance', 'miscellaneous_expense']
      .includes(String(row.expense_type))
  ) {
    throw new Error('An attachment has an unsupported expense category.');
  }
  if (row.mime_type !== 'image/jpeg' && row.mime_type !== 'application/pdf') {
    throw new Error('An attachment has an unsupported file type.');
  }
  if (typeof row.file_base64 !== 'string') {
    throw new Error('An attachment is missing its file data in the backup.');
  }

  const encoded = row.file_base64;
  const isCanonicalBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded);
  if (!isCanonicalBase64 || encoded.length === 0) {
    throw new Error(`Attachment data is invalid for ${row.file_name}.`);
  }

  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const byteLength = (encoded.length / 4) * 3 - padding;
  if (byteLength !== row.size_bytes) {
    throw new Error(`Attachment data failed its integrity check: ${row.file_name}.`);
  }

  return { row, encoded, byteLength };
}
