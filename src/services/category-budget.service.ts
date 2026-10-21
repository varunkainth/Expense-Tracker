import { getDatabase } from '../database/client';
import { deletePreference, getPreference, setPreference } from './preferences.service';

const KEY_PREFIX = 'category_budget_paise:';

export interface CategoryBudgetProgress {
  id: string;
  name: string;
  icon: string | null;
  spent: number;
  budget: number | null;
}

export function categoryBudgetKey(categoryId: string): string {
  return `${KEY_PREFIX}${categoryId}`;
}

export async function getCategoryBudget(categoryId: string): Promise<number | null> {
  const value = await getPreference(categoryBudgetKey(categoryId));
  const amount = value === null ? null : Number(value);
  return amount !== null && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export async function saveCategoryBudget(categoryId: string, amount: number | null): Promise<void> {
  if (amount === null) {
    await deletePreference(categoryBudgetKey(categoryId));
    return;
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a budget greater than zero.');
  await setPreference(categoryBudgetKey(categoryId), String(amount));
}

export async function getCategoryMonthSpend(categoryId: string, date: number): Promise<number> {
  const month = new Date(date);
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ spent: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS spent FROM personal_expenses WHERE category_id = ? AND expense_date >= ? AND expense_date < ?;',
    [categoryId, start, end],
  );
  return row?.spent ?? 0;
}

export async function listCategoryBudgetProgress(now = Date.now()): Promise<CategoryBudgetProgress[]> {
  const month = new Date(now);
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; icon: string | null; spent: number; budget_value: string | null }>(
    `SELECT c.id, c.name, c.icon, COALESCE(spending.spent, 0) AS spent, p.value AS budget_value
     FROM categories c
     LEFT JOIN (
       SELECT category_id, SUM(amount) AS spent FROM personal_expenses
       WHERE expense_date >= ? AND expense_date < ? GROUP BY category_id
     ) spending ON spending.category_id = c.id
     LEFT JOIN app_preferences p ON p.key = ? || c.id
     ORDER BY CASE WHEN p.value IS NULL THEN 1 ELSE 0 END, c.name COLLATE NOCASE;`,
    [start, end, KEY_PREFIX],
  );
  return rows.map((row) => {
    const amount = row.budget_value === null ? null : Number(row.budget_value);
    const budget = amount !== null && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
    return { id: row.id, name: row.name, icon: row.icon, spent: row.spent, budget };
  });
}
