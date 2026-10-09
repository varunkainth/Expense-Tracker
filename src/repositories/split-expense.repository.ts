import { getDatabase } from '../database/client';
import { getCurrentTimestamp } from '../utils/date';
import { generateUUID } from '../utils/uuid';
import { SplitExpense, SplitGroup, SplitPerson } from '../types/split-expenses';

export class SplitExpenseRepository {
  async getGroups(): Promise<SplitGroup[]> {
    const db = await getDatabase();
    return db.getAllAsync<SplitGroup>(
      `SELECT g.id, g.name, g.created_at, g.updated_at,
              (SELECT COUNT(*) FROM split_people p WHERE p.group_id = g.id) AS people_count,
              (SELECT COALESCE(SUM(e.amount), 0) FROM split_expenses e WHERE e.group_id = g.id) AS total_amount
       FROM split_groups g
       ORDER BY g.updated_at DESC;`,
    );
  }

  async createGroup(name: string, requestedNames: string[]): Promise<string> {
    if (requestedNames.length < 2 || requestedNames.length > 20) {
      throw new Error('A group needs between 2 and 20 people.');
    }
    const db = await getDatabase();
    const id = generateUUID();
    const now = getCurrentTimestamp();
    const groupName = name.trim() || `Group · ${new Date(now).toLocaleDateString()}`;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO split_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);',
        [id, groupName, now, now],
      );
      for (let index = 0; index < requestedNames.length; index += 1) {
        const personId = generateUUID();
        const personName = requestedNames[index].trim() || `Person ${index + 1}`;
        await db.runAsync(
          'INSERT INTO split_people (id, group_id, name, created_at) VALUES (?, ?, ?, ?);',
          [personId, id, personName, now],
        );
      }
    });
    return id;
  }

  async getPeople(groupId: string): Promise<SplitPerson[]> {
    const db = await getDatabase();
    return db.getAllAsync<SplitPerson>(
      `SELECT p.id, p.group_id, p.name, p.created_at,
              COALESCE(SUM(e.amount), 0) AS total_paid
       FROM split_people p
       LEFT JOIN split_expenses e ON e.paid_by_person_id = p.id
       WHERE p.group_id = ?
       GROUP BY p.id
       ORDER BY p.created_at ASC, p.rowid ASC;`,
      [groupId],
    );
  }

  async getExpenses(groupId: string): Promise<SplitExpense[]> {
    const db = await getDatabase();
    return db.getAllAsync<SplitExpense>(
      `SELECT e.id, e.group_id, e.description, e.amount, e.paid_by_person_id,
              e.expense_date, e.created_at, p.name AS payer_name
       FROM split_expenses e
       JOIN split_people p ON p.id = e.paid_by_person_id
       WHERE e.group_id = ?
       ORDER BY e.expense_date DESC, e.created_at DESC;`,
      [groupId],
    );
  }

  async addExpense(
    groupId: string,
    payerId: string,
    amountPaise: number,
    description: string,
  ): Promise<void> {
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      throw new Error('Enter a valid amount greater than zero.');
    }
    const db = await getDatabase();
    const payer = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM split_people WHERE id = ? AND group_id = ?;',
      [payerId, groupId],
    );
    if (!payer) throw new Error('Choose a person in this group who paid.');
    const now = getCurrentTimestamp();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO split_expenses
         (id, group_id, description, amount, paid_by_person_id, expense_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [generateUUID(), groupId, description.trim() || null, amountPaise, payerId, now, now],
      );
      await db.runAsync('UPDATE split_groups SET updated_at = ? WHERE id = ?;', [now, groupId]);
    });
  }

  async renameGroup(groupId: string, name: string): Promise<void> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (!normalized) throw new Error('Enter a group name.');
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE split_groups SET name = ?, updated_at = ? WHERE id = ?;',
      [normalized, getCurrentTimestamp(), groupId],
    );
  }

  async renamePerson(groupId: string, personId: string, name: string): Promise<void> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (!normalized) throw new Error('Enter a person name.');
    const db = await getDatabase();
    const result = await db.runAsync(
      'UPDATE split_people SET name = ? WHERE id = ? AND group_id = ?;',
      [normalized, personId, groupId],
    );
    if (result.changes === 0) throw new Error('This person could not be found in the group.');
  }

  async updateExpense(
    groupId: string,
    expenseId: string,
    payerId: string,
    amountPaise: number,
    description: string,
  ): Promise<void> {
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      throw new Error('Enter a valid amount greater than zero.');
    }
    const db = await getDatabase();
    const payer = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM split_people WHERE id = ? AND group_id = ?;',
      [payerId, groupId],
    );
    if (!payer) throw new Error('Choose a person in this group who paid.');
    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        `UPDATE split_expenses
         SET description = ?, amount = ?, paid_by_person_id = ?
         WHERE id = ? AND group_id = ?;`,
        [description.trim() || null, amountPaise, payerId, expenseId, groupId],
      );
      if (result.changes === 0) throw new Error('This expense could not be found in the group.');
      await db.runAsync('UPDATE split_groups SET updated_at = ? WHERE id = ?;', [getCurrentTimestamp(), groupId]);
    });
  }

  async deleteExpense(expenseId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM split_expenses WHERE id = ?;', [expenseId]);
  }

  async deleteGroup(groupId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM split_groups WHERE id = ?;', [groupId]);
  }
}

export const splitExpenseRepository = new SplitExpenseRepository();
