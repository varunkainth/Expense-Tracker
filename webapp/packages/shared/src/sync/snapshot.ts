import { z } from 'zod';
import { categorySchema, expenseSchema } from '../domain/expense';
/** Complete personal-expense snapshot; absence means deletion only within this source device. */
export const phoneSnapshotSchema = z.object({
  version: z.literal(1), deviceId: z.string().uuid(),
  categories: z.array(categorySchema.extend({ name: z.string().trim().min(1).max(100000) })).max(3000), expenses: z.array(expenseSchema.extend({ description: z.string().max(100000).nullable() })).max(3000),
}).strict().superRefine((snapshot, context) => {
  const categories = new Set(snapshot.categories.map((row) => row.id));
  if (categories.size !== snapshot.categories.length || new Set(snapshot.expenses.map((row) => row.id)).size !== snapshot.expenses.length || snapshot.expenses.some((row) => !categories.has(row.category_id))) context.addIssue({ code: 'custom', message: 'Snapshot contains duplicate IDs or missing categories.' });
});
export type PhoneSnapshot = z.infer<typeof phoneSnapshotSchema>;
