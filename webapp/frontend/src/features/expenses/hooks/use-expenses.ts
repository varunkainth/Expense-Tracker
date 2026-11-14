import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/database/database';
import { expenseRepository } from '../data/expense.repository';
export function useExpenses() {
    const expenses = useLiveQuery(() => expenseRepository.list());
    const categories = useLiveQuery(() => db.categories.orderBy('name').toArray());
    const pendingCount = useLiveQuery(() => db.outbox.count()) ?? 0;
    return { expenses: expenses ?? [], categories: categories ?? [], pendingCount, loading: expenses === undefined || categories === undefined };
}
