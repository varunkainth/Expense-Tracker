import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { ExpenseDatabase } from '../src/lib/database/database';
import { createExpenseRepository } from '../src/features/expenses/data/expense.repository';
import { importPhoneSnapshot } from '../src/features/connection/data/phone-import';
let database: ExpenseDatabase;
const deviceId = crypto.randomUUID();
const category = { id: 'food', name: 'Food', icon: null, is_default: 1 as const, created_at: 1700000000000 };
const expense = { id: crypto.randomUUID(), amount: 12345, category_id: category.id, subcategory_id: null, description: 'Lunch ₹', payment_method: 'UPI' as const, expense_date: 1700000000000, created_at: 1700000000000, updated_at: 1700000000000 };
const snapshot = (expenses = [expense]) => ({ version: 1, deviceId, categories: [category], expenses });
beforeEach(() => {
  Dexie.dependencies.indexedDB = indexedDB; Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  database = new ExpenseDatabase(`import-${crypto.randomUUID()}`);
});
afterEach(async () => { await database.delete(); });
test('initial import, repeat delivery, edits, deletions and restore preserve IDs and money', async () => {
  await importPhoneSnapshot(database, snapshot(), 'session', 1);
  expect(await database.expenses.get(expense.id)).toMatchObject({ id: expense.id, amount: 12345, source_device: deviceId, deleted_at: null });
  await importPhoneSnapshot(database, snapshot([{ ...expense, amount: 20000 }]), 'session', 2);
  await importPhoneSnapshot(database, snapshot(), 'session', 1);
  expect((await database.expenses.get(expense.id))?.amount).toBe(20000);
  await importPhoneSnapshot(database, snapshot([]), 'session', 3);
  expect((await database.expenses.get(expense.id))?.deleted_at).not.toBeNull();
  await importPhoneSnapshot(database, snapshot(), 'session', 4);
  expect((await database.expenses.get(expense.id))?.deleted_at).toBeNull();
  expect(await database.outbox.count()).toBe(0);
});
test('snapshots never modify browser-local records or another phone and conflicts roll back', async () => {
  await database.expenses.put({ ...expense, revision: 1, deleted_at: null });
  await expect(importPhoneSnapshot(database, snapshot(), 'session', 1)).rejects.toThrow('conflicts');
  expect(await database.categories.count()).toBe(0);
  expect(await database.settings.get('phone-transfer:session')).toBeUndefined();
  await importPhoneSnapshot(database, snapshot([]), 'session', 2);
  expect((await database.expenses.get(expense.id))?.deleted_at).toBeNull();
});
test('malformed snapshots and missing categories cannot delete existing imports', async () => {
  await importPhoneSnapshot(database, snapshot(), 'session', 1);
  await expect(importPhoneSnapshot(database, { ...snapshot(), categories: [] }, 'session', 2)).rejects.toThrow();
  expect((await database.expenses.get(expense.id))?.deleted_at).toBeNull();
});
test('phone records cannot be edited or deleted through web repositories', async () => {
  await importPhoneSnapshot(database, snapshot(), 'session', 1);
  const repository = createExpenseRepository(database);
  await database.settings.put({ key: 'deviceId', value: crypto.randomUUID() });
  await expect(repository.remove(expense.id)).rejects.toThrow('mobile app');
  await expect(repository.save({ ...expense, category_id: `phone:${deviceId}:food` }, expense.id)).rejects.toThrow('mobile app');
});
test('an import is visible in the actual expense-list repository and its live subscription', async () => {
  const repository = createExpenseRepository(database);
  let subscription: { unsubscribe: () => void } | undefined;
  try {
    const updated = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Expense list did not update after import')), 3000);
      subscription = Dexie.liveQuery(() => repository.list()).subscribe((rows) => {
        if (rows.some((row) => row.id === expense.id)) { clearTimeout(timeout); resolve(); }
      }, reject);
    });
    const imported = await importPhoneSnapshot(database, snapshot(), 'session', 1);
    await updated;
    expect(imported.expenseCount).toBe(1);
    expect(await repository.list()).toHaveLength(1);
    expect(await database.settings.get('lastPhoneImportCount')).toEqual({ key: 'lastPhoneImportCount', value: '1' });
  } finally { subscription?.unsubscribe(); }
});
test('a successful empty snapshot explicitly reports zero personal expenses', async () => {
  expect(await importPhoneSnapshot(database, snapshot([]), 'session', 1)).toEqual({ expenseCount: 0 });
  expect(await createExpenseRepository(database).list()).toHaveLength(0);
});
