import { db } from './database';
const DEFAULTS = ['Food', 'Movie', 'Petrol', 'Grocery', 'Medicine', 'Shopping', 'Travel', 'Bills', 'Transfer', 'Subscription', 'Other'];
export async function initializeDatabase() {
    await db.transaction('rw', db.categories, db.settings, async () => {
        if (!await db.settings.get('deviceId'))
            await db.settings.put({ key: 'deviceId', value: crypto.randomUUID() });
        if (await db.categories.count() === 0) {
            const now = Date.now();
            await db.categories.bulkAdd(DEFAULTS.map((name) => ({ id: crypto.randomUUID(), name, icon: null, is_default: 1 as const, created_at: now })));
        }
    });
}
