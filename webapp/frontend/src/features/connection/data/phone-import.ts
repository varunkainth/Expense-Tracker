import { phoneSnapshotSchema } from '@expense-tracker/shared';
import { type ExpenseDatabase } from '../../../lib/database/database';
/** Acknowledge only after this transaction commits. Never overwrite browser-local records. */
export async function importPhoneSnapshot(database: ExpenseDatabase, payload: unknown, sessionId: string, sequence: number) {
  const snapshot = phoneSnapshotSchema.parse(payload);
  return database.transaction('rw', database.expenses, database.categories, database.settings, async () => {
    const key = `phone-transfer:${sessionId}`;
    if (Number((await database.settings.get(key))?.value ?? 0) >= sequence) return { expenseCount: snapshot.expenses.length };
    const existing = await database.expenses.toArray();
    const byId = new Map(existing.map((row) => [row.id, row]));
    const incoming = new Set(snapshot.expenses.map((row) => row.id));
    for (const row of snapshot.expenses) {
      const old = byId.get(row.id);
      if (old && old.source_device !== snapshot.deviceId) throw new Error('A phone expense ID conflicts with an existing record. No data was replaced.');
    }
    for (const category of snapshot.categories) {
      await database.categories.put({ ...category, id: `phone:${snapshot.deviceId}:${category.id}` });
    }
    for (const row of snapshot.expenses) {
      await database.expenses.put({ ...row, category_id: `phone:${snapshot.deviceId}:${row.category_id}`, revision: 0, deleted_at: null, source_device: snapshot.deviceId });
    }
    for (const old of existing) {
      if (old.source_device === snapshot.deviceId && !incoming.has(old.id) && old.deleted_at === null) {
        await database.expenses.update(old.id, { deleted_at: Date.now() });
      }
    }
    const visibleCount = await database.expenses.orderBy('expense_date').filter((row) => row.source_device === snapshot.deviceId && row.deleted_at === null).count();
    if (visibleCount !== snapshot.expenses.length) throw new Error('Imported expenses could not be read back. Transfer was not acknowledged.');
    await database.settings.put({ key, value: String(sequence) });
    await database.settings.put({ key: 'lastPhoneImport', value: String(Date.now()) });
    await database.settings.put({ key: 'lastPhoneImportCount', value: String(snapshot.expenses.length) });
    return { expenseCount: snapshot.expenses.length };
  });
}
