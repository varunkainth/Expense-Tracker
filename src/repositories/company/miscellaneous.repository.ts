import { getDatabase } from '../../database/client';
import {
  CreateMiscellaneousExpenseDTO,
  MiscellaneousExpense,
  UpdateMiscellaneousExpenseDTO,
} from '../../types/company';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class MiscellaneousRepository {
  async getAll(employeeId?: string): Promise<MiscellaneousExpense[]> {
    const db = await getDatabase();
    if (employeeId) {
      return await db.getAllAsync<MiscellaneousExpense>(
        `SELECT id, employee_id, date, particulars, bill_no, amount, created_at, updated_at
         FROM miscellaneous_expense
         WHERE employee_id = ?
         ORDER BY date DESC;`,
        [employeeId]
      );
    }
    return await db.getAllAsync<MiscellaneousExpense>(
      `SELECT id, employee_id, date, particulars, bill_no, amount, created_at, updated_at
       FROM miscellaneous_expense
       ORDER BY date DESC;`
    );
  }

  async getById(id: string): Promise<MiscellaneousExpense | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<MiscellaneousExpense>(
      `SELECT id, employee_id, date, particulars, bill_no, amount, created_at, updated_at
       FROM miscellaneous_expense
       WHERE id = ?;`,
      [id]
    );
  }

  async create(data: CreateMiscellaneousExpenseDTO): Promise<MiscellaneousExpense> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    await db.runAsync(
      `INSERT INTO miscellaneous_expense (
        id, employee_id, date, particulars, bill_no, amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.employee_id,
        data.date,
        data.particulars,
        data.bill_no,
        data.amount,
        timestamp,
        timestamp,
      ]
    );

    return {
      id,
      employee_id: data.employee_id,
      date: data.date,
      particulars: data.particulars,
      bill_no: data.bill_no,
      amount: data.amount,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdateMiscellaneousExpenseDTO): Promise<MiscellaneousExpense> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Miscellaneous expense with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const employeeId = data.employee_id ?? existing.employee_id;
    const date = data.date ?? existing.date;
    const particulars = data.particulars ?? existing.particulars;
    const billNo = data.bill_no ?? existing.bill_no;
    const amount = data.amount ?? existing.amount;

    await db.runAsync(
      `UPDATE miscellaneous_expense
       SET employee_id = ?, date = ?, particulars = ?, bill_no = ?, amount = ?, updated_at = ?
       WHERE id = ?;`,
      [employeeId, date, particulars, billNo, amount, timestamp, id]
    );

    return {
      id,
      employee_id: employeeId,
      date,
      particulars,
      bill_no: billNo,
      amount,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM miscellaneous_expense WHERE id = ?;`, [id]);
  }
}

export const miscellaneousRepository = new MiscellaneousRepository();
