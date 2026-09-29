import * as SQLite from 'expo-sqlite';
import { generateUUID } from '../utils/uuid';
import { getCurrentTimestamp } from '../utils/date';

export interface DefaultCategorySeed {
  name: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'Food', icon: 'utensils' },
  { name: 'Movie', icon: 'film' },
  { name: 'Petrol', icon: 'gas-pump' },
  { name: 'Grocery', icon: 'shopping-cart' },
  { name: 'Medicine', icon: 'medical-services' },
  { name: 'Shopping', icon: 'shopping-bag' },
  { name: 'Travel', icon: 'flight' },
  { name: 'Bills', icon: 'receipt' },
  { name: 'Subscription', icon: 'subscriptions' },
  { name: 'Other', icon: 'more-horiz' },
];

/**
 * Seeds default categories if they do not already exist.
 * Idempotent: checks for existing category by name before inserting.
 */
export async function seedDefaultCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const timestamp = getCurrentTimestamp();

  for (const category of DEFAULT_CATEGORIES) {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM categories WHERE name = ?;`,
      [category.name]
    );

    if (!existing) {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO categories (id, name, icon, is_default, created_at)
         VALUES (?, ?, ?, 1, ?);`,
        [id, category.name, category.icon, timestamp]
      );
    }
  }
}
