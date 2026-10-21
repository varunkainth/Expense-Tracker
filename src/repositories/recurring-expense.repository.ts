import { getDatabase } from '../database/client';
import { CreatePersonalExpenseDTO } from '../types/personal';
import { generateUUID } from '../utils/uuid';
import { nextMonthlyDate } from '../utils/recurring';
import { validateAmount } from '../utils/validation';

export interface RecurringExpense {
  id: string;
  amount: number;
  category_id: string;
  subcategory_id: string | null;
  description: string | null;
  payment_method: string;
  day_of_month: number;
  next_due: number;
  created_at: number;
  category_name?: string;
}
export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  const db = await getDatabase();
  return db.getAllAsync<RecurringExpense>(`SELECT r.*, c.name AS category_name FROM recurring_expenses r
    JOIN categories c ON c.id = r.category_id ORDER BY next_due;`);
}
export async function stopRecurringExpense(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM recurring_expenses WHERE id = ?;', [id]);
}

/** Save the first expense and its schedule together, never half of the pair. */
export async function createMonthlyExpense(data: CreatePersonalExpenseDTO): Promise<void> {
  const valid = validateAmount(data.amount);
  if (!valid.isValid) throw new Error(valid.error);
  const date = data.expense_date ?? Date.now();
  if (!Number.isSafeInteger(date) || date > Date.now()) throw new Error('Choose today or an earlier date.');
  const day = new Date(date).getDate();
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (data.subcategory_id) {
      const sub = await tx.getFirstAsync('SELECT id FROM subcategories WHERE id = ? AND category_id = ?;', [data.subcategory_id, data.category_id]);
      if (!sub) throw new Error('Choose a subcategory belonging to this category.');
    }
    const now = Date.now();
    await tx.runAsync(`INSERT INTO personal_expenses
      (id, amount, category_id, subcategory_id, description, payment_method, expense_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [generateUUID(), data.amount, data.category_id, data.subcategory_id ?? null, data.description ?? null, data.payment_method, date, now, now]);
    await tx.runAsync(`INSERT INTO recurring_expenses
      (id, amount, category_id, subcategory_id, description, payment_method, day_of_month, next_due, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [generateUUID(), data.amount, data.category_id, data.subcategory_id ?? null, data.description ?? null, data.payment_method, day, nextMonthlyDate(date, day), now]);
  });
}

/** Runs when personal tracking opens. A committed occurrence always advances its schedule. */
export async function postDueRecurringExpenses(now = Date.now()): Promise<number> {
  const db = await getDatabase();
  let posted = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const schedules = await tx.getAllAsync<RecurringExpense>('SELECT * FROM recurring_expenses WHERE next_due <= ?;', [now]);
    for (const schedule of schedules) {
      let due = schedule.next_due;
      let count = 0;
      while (due <= now) {
        if (++count > 1200) throw new Error('A recurring expense is more than 100 years overdue. Stop it and create a new schedule.');
        const next = nextMonthlyDate(due, schedule.day_of_month);
        if (next <= due) throw new Error('Invalid recurring expense schedule.');
        await tx.runAsync(`INSERT INTO personal_expenses
          (id, amount, category_id, subcategory_id, description, payment_method, expense_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [generateUUID(), schedule.amount, schedule.category_id, schedule.subcategory_id, schedule.description, schedule.payment_method, due, now, now]);
        posted += 1;
        due = next;
      }
      await tx.runAsync('UPDATE recurring_expenses SET next_due = ? WHERE id = ?;', [due, schedule.id]);
    }
  });
  return posted;
}
