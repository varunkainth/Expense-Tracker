import { expect, test } from 'bun:test';
import { expenseOperationSchema } from '../src/sync/contracts';
const base = { operationId: crypto.randomUUID(), deviceId: crypto.randomUUID(), recordId: 'expense-1',
    entity: 'personal_expenses', baseRevision: 0, createdAt: 1700000000000 };
const payload = { id: 'expense-1', amount: 20000, category_id: 'petrol', subcategory_id: null, description: 'Fuel',
    payment_method: 'UPI', expense_date: 1700000000000, created_at: 1700000000000, updated_at: 1700000000000 };
test('accepts upserts and deletion markers', () => {
    expect(expenseOperationSchema.safeParse({ ...base, action: 'upsert', payload }).success).toBe(true);
    expect(expenseOperationSchema.safeParse({ ...base, action: 'delete' }).success).toBe(true);
});
test('rejects mismatched identity, invalid money and negative revisions', () => {
    expect(expenseOperationSchema.safeParse({ ...base, action: 'upsert', payload: { ...payload, id: 'other' } }).success).toBe(false);
    expect(expenseOperationSchema.safeParse({ ...base, action: 'upsert', payload: { ...payload, amount: 1.5 } }).success).toBe(false);
    expect(expenseOperationSchema.safeParse({ ...base, action: 'delete', baseRevision: -1 }).success).toBe(false);
});
