import { getDatabase } from '../database/client';

const listeners = new Set<() => void>();
export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function notifyPreferencesChanged(): void {
  for (const listener of listeners) {
    try { listener(); } catch (error) { console.warn('Preference refresh failed:', error); }
  }
}
export async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_preferences WHERE key = ?;', [key]);
  return row?.value ?? null;
}
export async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO app_preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;', [key, value]);
  notifyPreferencesChanged();
}
export async function deletePreference(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM app_preferences WHERE key = ?;', [key]);
  notifyPreferencesChanged();
}
export const MONTHLY_BUDGET_KEY = 'monthly_budget_paise';
