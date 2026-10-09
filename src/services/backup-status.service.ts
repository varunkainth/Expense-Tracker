import { StorageService } from './storage.service';
import { BackupStatus } from './backup-data';

const LAST_BACKUP_KEY = 'backup.last-successful';
export type { BackupStatus } from './backup-data';

export async function getLastSuccessfulBackup(): Promise<BackupStatus | null> {
  try {
    const stored = await StorageService.getItem(LAST_BACKUP_KEY);
    if (!stored) return null;

    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const status = value as Partial<BackupStatus>;
    if (
      typeof status.createdAt !== 'number' ||
      !Number.isFinite(status.createdAt) ||
      typeof status.recordCount !== 'number' ||
      typeof status.attachmentCount !== 'number' ||
      typeof status.attachmentBytes !== 'number'
    ) {
      return null;
    }
    return status as BackupStatus;
  } catch (error) {
    console.warn('Could not read the last backup status:', error);
    return null;
  }
}

export async function recordSuccessfulBackup(status: BackupStatus): Promise<void> {
  try {
    await StorageService.setItem(LAST_BACKUP_KEY, JSON.stringify(status));
  } catch (error) {
    // The backup has already been saved, so a reminder-storage failure must not
    // turn a successful backup into a reported backup failure.
    console.warn('Could not update the backup reminder status:', error);
  }
}
