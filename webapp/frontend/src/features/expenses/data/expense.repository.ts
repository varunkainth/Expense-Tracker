import { expenseDraftSchema, expenseOperationSchema, type ExpenseDraft } from '@expense-tracker/shared';
import { db, type ExpenseDatabase } from '../../../lib/database/database';
export function createExpenseRepository(database: ExpenseDatabase) {
    return {
        async list() { return (await database.expenses.orderBy('expense_date').reverse().toArray()).filter((row) => row.deleted_at === null); },
        async save(draft: ExpenseDraft, existingId?: string) {
            const parsed = expenseDraftSchema.parse(draft);
            if (parsed.expense_date > Date.now())
                throw new Error('Choose today or an earlier date.');
            await database.transaction('rw', database.expenses, database.categories, database.outbox, database.settings, async () => {
                if (!await database.categories.get(parsed.category_id))
                    throw new Error('Choose an existing category.');
                const device = await database.settings.get('deviceId');
                if (!device)
                    throw new Error('Local database has not been initialized.');
                const existing = existingId ? await database.expenses.get(existingId) : undefined;
                if (existingId && (!existing || existing.deleted_at !== null))
                    throw new Error('This expense no longer exists.');
                if (existing?.source_device) throw new Error('Edit phone expenses in the mobile app.');
                const now = Date.now();
                const record = { ...parsed, id: existing?.id ?? crypto.randomUUID(), subcategory_id: existing?.subcategory_id ?? null,
                    created_at: existing?.created_at ?? now, updated_at: now, revision: (existing?.revision ?? 0) + 1, deleted_at: null };
                const operation = expenseOperationSchema.parse({ operationId: crypto.randomUUID(), deviceId: device.value,
                    recordId: record.id, entity: 'personal_expenses', action: 'upsert', baseRevision: existing?.revision ?? 0, createdAt: now, payload: record });
                await database.expenses.put(record);
                await database.outbox.add(operation);
            });
        },
        async remove(id: string) {
            await database.transaction('rw', database.expenses, database.outbox, database.settings, async () => {
                const record = await database.expenses.get(id);
                if (!record || record.deleted_at !== null)
                    return;
                if (record.source_device) throw new Error('Delete phone expenses in the mobile app.');
                const device = await database.settings.get('deviceId');
                if (!device)
                    throw new Error('Local database has not been initialized.');
                const now = Date.now();
                const operation = expenseOperationSchema.parse({ operationId: crypto.randomUUID(), deviceId: device.value,
                    recordId: id, entity: 'personal_expenses', action: 'delete', baseRevision: record.revision, createdAt: now });
                await database.expenses.update(id, { deleted_at: now, updated_at: now, revision: record.revision + 1 });
                await database.outbox.add(operation);
            });
        },
    };
}
export const expenseRepository = createExpenseRepository(db);
