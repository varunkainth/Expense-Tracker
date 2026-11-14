import { WORKSPACE_TABLES, parseWorkspaceSnapshot, MAX_WORKSPACE_BYTES, type WorkspaceSnapshot, type WorkspaceTable, type DataRow } from '@expense-tracker/shared';
import { base64Bytes } from '../../../../../../packages/workspace-data/src/chunks';
import { db, type ExpenseDatabase } from '../../../lib/database/database';
import { verifyWorkspace, importWorkspace } from '../../connection/data/workspace-import';
const base64 = (buffer: ArrayBuffer | Uint8Array) => base64Bytes(new Uint8Array(buffer));
const bytes = (value: string) => Uint8Array.from(atob(value), (letter) => letter.charCodeAt(0));
export async function exportPhoneCopies(deviceIds: string[], database: ExpenseDatabase = db) {
  const sources: WorkspaceSnapshot[] = [];
  for (const deviceId of deviceIds) {
    const tables = Object.fromEntries(Object.keys(WORKSPACE_TABLES).map((key) => [key, [] as DataRow[]])) as WorkspaceSnapshot['tables'];
    const records = await database.phoneRecords.where('deviceId').equals(deviceId).toArray();
    for (const row of records.sort((a,b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))) tables[row.table].push({ ...row.data });
    for (const row of tables.company_expense_attachments) {
      const file = await database.phoneFiles.get([deviceId, String(row.id)]);
      if (file) row.content_base64 = base64Bytes(file.bytes);
      else { row.content_base64 = null; row.sha256 = null; row.unavailable_reason = 'missing'; }
    }
    sources.push(parseWorkspaceSnapshot({ version: 2, schemaVersion: 13, deviceId, tables }));
  }
  return { format: 'expense-tracker-phone-copy', version: 1, sources };
}
async function key(password: string, salt: Uint8Array, usage: KeyUsage[]) {
  if (password.length < 10) throw new Error('Use a password of at least 10 characters.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: 600000 }, material, { name: 'AES-GCM', length: 256 }, false, usage);
}
export async function encryptPhoneCopy(password: string, deviceIds: string[], database: ExpenseDatabase = db) {
  if (deviceIds.length > 10) throw new Error('Export up to 10 phone copies at a time.');
  const data = await exportPhoneCopies(deviceIds, database);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  if (plaintext.length > MAX_WORKSPACE_BYTES * 2) throw new Error('Selected phone copies exceed the 32 MB backup limit. Export fewer phones.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('expense-tracker-phone-copy:v1') }, await key(password, salt, ['encrypt']), plaintext);
  return JSON.stringify({ format: 'expense-tracker-phone-copy', version: 1, salt: base64(salt), iv: base64(iv), ciphertext: base64(ciphertext) });
}
export async function restorePhoneCopy(text: string, password: string, database: ExpenseDatabase = db) {
  if (text.length > MAX_WORKSPACE_BYTES * 3) throw new Error('Backup exceeds the supported size.');
  const sealed = JSON.parse(text);
  if (sealed.format !== 'expense-tracker-phone-copy' || sealed.version !== 1 || typeof sealed.salt !== 'string' || typeof sealed.iv !== 'string' || typeof sealed.ciphertext !== 'string') throw new Error('Choose an encrypted phone-data copy exported by this web app.');
  const salt = bytes(sealed.salt), iv = bytes(sealed.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid backup encryption parameters.');
  let plaintext: ArrayBuffer;
  try { plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('expense-tracker-phone-copy:v1') }, await key(password, salt, ['decrypt']), bytes(sealed.ciphertext)); }
  catch { throw new Error('Incorrect password or damaged backup.'); }
  if (plaintext.byteLength > MAX_WORKSPACE_BYTES * 2) throw new Error('Backup exceeds the 32 MB data limit.');
  const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  if (payload.format !== 'expense-tracker-phone-copy' || payload.version !== 1 || !Array.isArray(payload.sources) || payload.sources.length > 10) throw new Error('Invalid phone-data copy.');
  const snapshots: WorkspaceSnapshot[] = [];
  for (const source of payload.sources) snapshots.push(await verifyWorkspace(source));
  if (new Set(snapshots.map((source) => source.deviceId)).size !== snapshots.length) throw new Error('Backup repeats a device.');
  const sessionId = `restore-${crypto.randomUUID()}`;
  // All sources restore or none do; preserve browser-origin data and unrelated phones.
  await database.transaction('rw', [database.phoneRecords, database.phoneFiles, database.expenses, database.categories, database.settings, database.transferParts], async () => {
    for (const snapshot of snapshots) await importWorkspace(database, snapshot, `${sessionId}:${snapshot.deviceId}`, Date.now(), crypto.randomUUID());
  });
  return snapshots.reduce((sum, source) => sum + (Object.keys(source.tables) as WorkspaceTable[]).reduce((count, table) => count + source.tables[table].length, 0), 0);
}
