import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { beforeEach, afterEach, expect, test } from 'bun:test';
import { base64Bytes } from '../../../packages/workspace-data/src/chunks';
import { CHUNK_BYTES, parseWorkspaceSnapshot, workspaceSummary, type WorkspaceChunk } from '@expense-tracker/shared';
import { ExpenseDatabase } from '../src/lib/database/database';
import { receiveWorkspaceChunk, verifyWorkspace, importWorkspace } from '../src/features/connection/data/workspace-import';
import { fixtureWorkspace } from './fixtures/workspace';
import { createExpenseRepository } from '../src/features/expenses/data/expense.repository';
let database: ExpenseDatabase;
beforeEach(() => { Dexie.dependencies.indexedDB = indexedDB; Dexie.dependencies.IDBKeyRange = IDBKeyRange; database = new ExpenseDatabase(`workspace-${crypto.randomUUID()}`); });
afterEach(async () => { await database.delete(); });
async function chunks(value: unknown): Promise<WorkspaceChunk[]> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('');
  const snapshotId = crypto.randomUUID(), parts = Math.ceil(bytes.length / CHUNK_BYTES);
  return Array.from({ length: parts }, (_, part) => ({ type: 'workspace-chunk', snapshotId, part, parts, sha256, data: base64Bytes(bytes.slice(part * CHUNK_BYTES, (part + 1) * CHUNK_BYTES)) }));
}
test('all 22 datasets and PDF bytes import together; intermediate chunks do not expose partial data', async () => {
  const snapshot = await fixtureWorkspace(700000), parts = await chunks(snapshot);
  expect(parts.length).toBeGreaterThan(1);
  for (let part = 0; part < parts.length; part++) {
    const receipt = await receiveWorkspaceChunk(database, parts[part], 'session', part + 1);
    expect(receipt.completed).toBe(part === parts.length - 1);
    if (!receipt.completed) { expect(await database.phoneRecords.count()).toBe(0); expect(await database.expenses.count()).toBe(0); }
    else expect(receipt).toMatchObject({ expenseCount: 1, companyCount: 7, recordCount: 22, attachmentCount: 1 });
  }
  expect(await database.phoneRecords.count()).toBe(22);
  expect((await createExpenseRepository(database).list())[0].amount).toBe(12345);
  expect((await database.phoneFiles.toArray())[0].bytes.length).toBe(700000);
  expect(await database.transferParts.count()).toBe(0);
  expect((await receiveWorkspaceChunk(database, parts.at(-1), 'session', parts.length)).completed).toBe(true);
});
test('edits and deletion replace only the sending phone; browser-created rows and other phones survive', async () => {
  const a = await fixtureWorkspace(), b = await fixtureWorkspace();
  // Distinct personal identities prevent an intentional cross-device UUID conflict.
  b.tables.personal_expenses[0].id = 'other-expense'; b.tables.fuel_refills[0].expense_id = 'other-expense';
  await importWorkspace(database, await verifyWorkspace(a), 'a', 1, 'one');
  await importWorkspace(database, await verifyWorkspace(b), 'b', 1, 'one');
  const { source_device: _source, ...personal } = (await database.expenses.toArray())[0];
  await database.expenses.put({ ...personal, id: 'browser-local' });
  a.tables.hotel = []; a.tables.company_expense_attachments = []; a.tables.personal_expenses = []; a.tables.fuel_refills = [];
  await importWorkspace(database, await verifyWorkspace(a), 'a', 2, 'two');
  expect(await database.phoneRecords.get([a.deviceId, 'hotel', 'hotel-1'])).toBeUndefined();
  expect(await database.phoneFiles.get([a.deviceId, 'company_expense_attachments-1'])).toBeUndefined();
  expect(await database.phoneRecords.get([b.deviceId, 'hotel', 'hotel-1'])).toBeDefined();
  expect((await createExpenseRepository(database).list()).map((row) => row.id).sort()).toEqual(['browser-local', 'other-expense']);
});
test('invalid relations, receipt hash, preferences and unknown fields are rejected before replacement', async () => {
  const original = await fixtureWorkspace(); await importWorkspace(database, await verifyWorkspace(original), 's', 1, 'first');
  const invalid = structuredClone(original); invalid.tables.hotel[0].employee_id = 'missing';
  expect(() => parseWorkspaceSnapshot(invalid)).toThrow('related');
  const tampered = structuredClone(original); tampered.tables.company_expense_attachments[0].sha256 = '0'.repeat(64);
  await expect(verifyWorkspace(tampered)).rejects.toThrow('checksum');
  const secret = structuredClone(original); secret.tables.app_preferences.push({ key: 'pin', value: 'private' });
  expect(() => parseWorkspaceSnapshot(secret)).toThrow('preference');
  const path = structuredClone(original); path.tables.company_expense_attachments[0].storage_name = 'file:///private';
  expect(() => parseWorkspaceSnapshot(path)).toThrow();
  expect(await database.phoneRecords.count()).toBe(22);
  expect(workspaceSummary(original)).toMatchObject({ company: 7, records: 22 });
});
test('mismatched/replaced partial chunks never delete the previous completed workspace', async () => {
  const snapshot = await fixtureWorkspace(400000); await importWorkspace(database, await verifyWorkspace(snapshot), 's', 1, 'old');
  const parts = await chunks(snapshot);
  await receiveWorkspaceChunk(database, parts[0], 's', 2);
  await expect(receiveWorkspaceChunk(database, { ...parts[1], sha256: '0'.repeat(64) }, 's', 3)).rejects.toThrow('match');
  expect(await database.phoneRecords.count()).toBe(22);
});
test('active chunks refresh staged-piece expiry while inactive old snapshots are removed', async () => {
  const snapshot = await fixtureWorkspace(700000), parts = await chunks(snapshot);
  await receiveWorkspaceChunk(database, parts[0], 'active', 1);
  await database.transferParts.where('sessionId').equals('active').modify({ receivedAt: Date.now() - 9 * 60000 });
  await receiveWorkspaceChunk(database, parts[1], 'active', 2);
  expect((await database.transferParts.get(['active', parts[0].snapshotId, 0]))!.receivedAt).toBeGreaterThan(Date.now() - 2000);
  for (let part = 2; part < parts.length; part++) await receiveWorkspaceChunk(database, parts[part], 'active', part + 1);
  expect(await database.phoneRecords.count()).toBe(22);
});
