import { getDatabase } from '../database/client';
import { CreatePersonalExpenseDTO, PaymentMethod } from '../types/personal';
import { generateUUID } from '../utils/uuid';
import { nextMonthlyDate } from '../utils/recurring';
import { validateAmount } from '../utils/validation';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  category_id: string;
  subcategory_id: string | null;
  payment_method: PaymentMethod;
  day_of_month: number;
  next_due: number;
  created_at: number;
  category_name?: string;
}

function upcomingDueDate(dayOfMonth: number, now: number): number {
  const today = new Date(now);
  const lastThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), Math.min(dayOfMonth, lastThisMonth));
  thisMonth.setHours(0, 0, 0, 0);
  if (thisMonth.getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
    return thisMonth.getTime();
  }
  return nextMonthlyDate(thisMonth.getTime(), dayOfMonth);
}

async function validateCategory(categoryId: string, subcategoryId?: string | null): Promise<{ id: string; name: string }> {
  const db = await getDatabase();
  const category = await db.getFirstAsync<{ id: string; name: string }>('SELECT id, name FROM categories WHERE id = ?;', [categoryId]);
  if (!category) throw new Error('Choose a valid category.');
  if (subcategoryId) {
    const subcategory = await db.getFirstAsync('SELECT id FROM subcategories WHERE id = ? AND category_id = ?;', [subcategoryId, categoryId]);
    if (!subcategory) throw new Error('Choose a subcategory belonging to the selected category.');
  }
  return category;
}

export async function createSubscription(data: CreatePersonalExpenseDTO & { name: string; dayOfMonth: number }): Promise<void> {
  const valid = validateAmount(data.amount);
  if (!valid.isValid) throw new Error(valid.error);
  if (!Number.isInteger(data.dayOfMonth) || data.dayOfMonth < 1 || data.dayOfMonth > 31) {
    throw new Error('Choose a payment day between 1 and 31.');
  }
  const category = await validateCategory(data.category_id, data.subcategory_id);
  const name = data.name.trim() || category.name;
  const now = Date.now();
  const db = await getDatabase();
  await db.runAsync(`INSERT INTO subscriptions
    (id, name, amount, category_id, subcategory_id, payment_method, day_of_month, next_due, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
  [generateUUID(), name, data.amount, data.category_id, data.subcategory_id ?? null, data.payment_method, data.dayOfMonth, upcomingDueDate(data.dayOfMonth, now), now]);
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const db = await getDatabase();
  return db.getAllAsync<Subscription>(`SELECT s.*, c.name AS category_name FROM subscriptions s
    JOIN categories c ON c.id = s.category_id ORDER BY s.next_due, s.name;`);
}

export async function getDueSubscriptions(now = Date.now()): Promise<Subscription[]> {
  const db = await getDatabase();
  return db.getAllAsync<Subscription>(`SELECT s.*, c.name AS category_name FROM subscriptions s
    JOIN categories c ON c.id = s.category_id WHERE s.next_due <= ? ORDER BY s.next_due, s.name;`, [now]);
}

export async function confirmSubscriptionPayment(subscription: Subscription, paidAt = Date.now()): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<Subscription>('SELECT * FROM subscriptions WHERE id = ?;', [subscription.id]);
    if (!current) throw new Error('Subscription not found.');
    const now = Date.now();
    await tx.runAsync(`INSERT INTO personal_expenses
      (id, amount, category_id, subcategory_id, description, payment_method, expense_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [generateUUID(), current.amount, current.category_id, current.subcategory_id, current.name, current.payment_method, paidAt, now, now]);
    await tx.runAsync('UPDATE subscriptions SET next_due = ? WHERE id = ?;', [nextMonthlyDate(paidAt, current.day_of_month), current.id]);
  });
}

export async function remindSubscriptionTomorrow(id: string, now = Date.now()): Promise<void> {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const db = await getDatabase();
  await db.runAsync('UPDATE subscriptions SET next_due = ? WHERE id = ?;', [tomorrow.getTime(), id]);
}

export async function skipSubscriptionThisMonth(subscription: Subscription, now = Date.now()): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE subscriptions SET next_due = ? WHERE id = ?;', [nextMonthlyDate(now, subscription.day_of_month), subscription.id]);
}

export async function deleteSubscription(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM subscriptions WHERE id = ?;', [id]);
}
