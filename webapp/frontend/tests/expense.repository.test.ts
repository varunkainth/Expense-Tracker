import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { ExpenseDatabase } from '../src/lib/database/database';
import { createExpenseRepository } from '../src/features/expenses/data/expense.repository';
let database: ExpenseDatabase;
let repository: ReturnType<typeof createExpenseRepository>;
const draft = { amount: 20000, category_id: 'food', description: 'Lunch', payment_method: 'UPI' as const, expense_date: 1700000000000 };
beforeEach(async () => {
    Dexie.dependencies.indexedDB = indexedDB;
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    database = new ExpenseDatabase(`test-${crypto.randomUUID()}`);
    await database.settings.put({ key: 'deviceId', value: crypto.randomUUID() });
    await database.categories.put({ id: 'food', name: 'Food', icon: null, is_default: 1, created_at: Date.now() });
    repository = createExpenseRepository(database);
});
afterEach(async () => { await database.delete(); });
describe('expense and pending-change transactions', () => {
    test('edits preserve identity and deletions leave one marker', async () => {
        await repository.save(draft);
        const [original] = await repository.list();
        await repository.save({ ...draft, amount: 35000 }, original.id);
        expect((await repository.list())[0]).toMatchObject({ id: original.id, amount: 35000, revision: 2 });
        expect((await database.outbox.toArray()).map((item) => item.baseRevision).sort()).toEqual([0, 1]);
        await repository.remove(original.id);
        await repository.remove(original.id);
        expect(await repository.list()).toHaveLength(0);
        expect((await database.expenses.get(original.id))?.deleted_at).not.toBeNull();
        expect(await database.outbox.count()).toBe(3);
    });
    test('outbox failure rolls back the record too', async () => {
        database.outbox.hook('creating', () => { throw new Error('Simulated outbox failure'); });
        await expect(repository.save(draft)).rejects.toThrow('Simulated');
        expect(await database.expenses.count()).toBe(0);
        expect(await database.outbox.count()).toBe(0);
    });
    test('invalid category cannot create an orphaned record', async () => {
        await expect(repository.save({ ...draft, category_id: 'missing' })).rejects.toThrow('category');
        expect(await database.expenses.count()).toBe(0);
        expect(await database.outbox.count()).toBe(0);
    });
});
