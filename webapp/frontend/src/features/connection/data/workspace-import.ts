import { parseWorkspaceSnapshot, workspaceSummary, parseWorkspaceChunk, MAX_WORKSPACE_BYTES, type WorkspaceSnapshot, type WorkspaceTable } from '@expense-tracker/shared';
import type { ExpenseDatabase, TransferPart } from '../../../lib/database/database';
import { importPhoneSnapshot } from './phone-import';
export interface ImportReceipt { completed: boolean; expenseCount: number; companyCount: number; recordCount: number; attachmentCount: number; part: number; parts: number }
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
export async function verifyWorkspace(value: unknown): Promise<WorkspaceSnapshot> {
  const snapshot = parseWorkspaceSnapshot(value);
  for (const row of snapshot.tables.company_expense_attachments) if (row.content_base64 !== null) {
    const bytes = Uint8Array.from(atob(String(row.content_base64)), (value) => value.charCodeAt(0));
    if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== row.sha256) throw new Error('Receipt checksum did not match.');
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if ((row.mime_type === 'application/pdf' && signature !== '%PDF-') || (row.mime_type === 'image/jpeg' && !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255))) throw new Error('Receipt file type did not match its content.');
  }
  return snapshot;
}
export async function importWorkspace(database: ExpenseDatabase, snapshot: WorkspaceSnapshot, sessionId: string, sequence: number, snapshotId: string) {
  const summary = workspaceSummary(snapshot);
  await database.transaction('rw', [database.expenses, database.categories, database.settings, database.phoneRecords, database.transferParts, database.phoneFiles], async () => {
    if (await database.settings.get(`workspace-complete:${sessionId}:${snapshotId}`)) return;
    const latest = Number((await database.settings.get(`workspace-sequence:${sessionId}`))?.value ?? 0);
    if (latest > sequence) throw new Error('An older workspace cannot replace a newer import.');
    await importPhoneSnapshot(database, { version: 1, deviceId: snapshot.deviceId, categories: snapshot.tables.categories, expenses: snapshot.tables.personal_expenses }, sessionId, sequence);
    await database.phoneRecords.where('deviceId').equals(snapshot.deviceId).delete();
    await database.phoneFiles.where('deviceId').equals(snapshot.deviceId).delete();
    for (const row of snapshot.tables.company_expense_attachments) if (row.content_base64 !== null) await database.phoneFiles.put({ deviceId: snapshot.deviceId, id: String(row.id), bytes: Uint8Array.from(atob(String(row.content_base64)), (value) => value.charCodeAt(0)), mimeType: String(row.mime_type), fileName: String(row.file_name) });
    const records = (Object.keys(snapshot.tables) as WorkspaceTable[]).flatMap((table) => snapshot.tables[table].map((data, ordinal) => ({ ordinal, deviceId: snapshot.deviceId, table, id: String(table === 'app_preferences' ? data.key : data.id), data: table === 'company_expense_attachments' ? { ...data, content_base64: null } : data })));
    await database.phoneRecords.bulkPut(records);
    await database.settings.put({ key: `workspace-complete:${sessionId}:${snapshotId}`, value: JSON.stringify(summary) });
    await database.settings.put({ key: `workspace-sequence:${sessionId}`, value: String(sequence) });
    await database.settings.put({ key: 'lastWorkspaceImport', value: JSON.stringify({ ...summary, deviceId: snapshot.deviceId, importedAt: Date.now() }) });
    await database.transferParts.where('sessionId').equals(sessionId).delete();
  });
  return summary;
}
/** Intermediate acknowledgements mean a chunk is durable; only completed=true means records were imported. */
export async function receiveWorkspaceChunk(database: ExpenseDatabase, payload: unknown, sessionId: string, sequence: number): Promise<ImportReceipt> {
  const chunk = parseWorkspaceChunk(payload);
  const done = await database.settings.get(`workspace-complete:${sessionId}:${chunk.snapshotId}`);
  if (done) {
    const summary = JSON.parse(done.value);
    return { completed: true, expenseCount: summary.personal, companyCount: summary.company, recordCount: summary.records, attachmentCount: summary.attachments, part: chunk.part, parts: chunk.parts };
  }
  const parts = await database.transaction('rw', database.transferParts, async () => {
    await database.transferParts.where('receivedAt').below(Date.now() - 600000).delete();
    const previous = await database.transferParts.where('sessionId').equals(sessionId).toArray();
    const current = previous.filter((part) => part.snapshotId === chunk.snapshotId);
    if (current.some((part) => part.parts !== chunk.parts || part.sha256 !== chunk.sha256 || (part.part === chunk.part && part.data !== chunk.data))) throw new Error('Workspace chunks do not match.');
    for (const old of previous) if (old.snapshotId !== chunk.snapshotId) await database.transferParts.delete([sessionId, old.snapshotId, old.part]);
    await database.transferParts.where('sessionId').equals(sessionId).modify({ receivedAt: Date.now() });
    await database.transferParts.put({ ...chunk, sessionId, receivedAt: Date.now() });
    return [...current.filter((part) => part.part !== chunk.part), { ...chunk, sessionId, receivedAt: Date.now() }].sort((a, b) => a.part - b.part);
  });
  if (parts.length < chunk.parts) return { completed: false, expenseCount: 0, companyCount: 0, recordCount: 0, attachmentCount: 0, part: chunk.part, parts: chunk.parts };
  const segments = parts.map((part: TransferPart) => Uint8Array.from(atob(part.data), (value) => value.charCodeAt(0)));
  const length = segments.reduce((sum, bytes) => sum + bytes.length, 0);
  if (length > MAX_WORKSPACE_BYTES) throw new Error('Workspace exceeds the transfer limit.');
  const bytes = new Uint8Array(length); let offset = 0;
  for (const segment of segments) { bytes.set(segment, offset); offset += segment.length; }
  if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== chunk.sha256) throw new Error('Workspace checksum did not match.');
  const snapshot = await verifyWorkspace(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const summary = await importWorkspace(database, snapshot, sessionId, sequence, chunk.snapshotId);
  return { completed: true, expenseCount: summary.personal, companyCount: summary.company, recordCount: summary.records, attachmentCount: summary.attachments, part: chunk.part, parts: chunk.parts };
}
