import { getDatabase } from '../../database/client';
import { CreatePhoneExpenseDTO, PhoneExpense, UpdatePhoneExpenseDTO } from '../../types/company';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class PhoneRepository {
  async getAll(employeeId?: string): Promise<PhoneExpense[]> {
    const db = await getDatabase();
    if (employeeId) {
      return await db.getAllAsync<PhoneExpense>(
        `SELECT id, employee_id, date, particulars, tel_fax_no, bill_no, amount, created_at, updated_at
         FROM phone_expense
         WHERE employee_id = ?
         ORDER BY date DESC;`,
        [employeeId]
      );
    }
    return await db.getAllAsync<PhoneExpense>(
      `SELECT id, employee_id, date, particulars, tel_fax_no, bill_no, amount, created_at, updated_at
       FROM phone_expense
       ORDER BY date DESC;`
    );
  }

  async getById(id: string): Promise<PhoneExpense | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<PhoneExpense>(
      `SELECT id, employee_id, date, particulars, tel_fax_no, bill_no, amount, created_at, updated_at
       FROM phone_expense
       WHERE id = ?;`,
      [id]
    );
  }

  async create(data: CreatePhoneExpenseDTO): Promise<PhoneExpense> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    await db.runAsync(
      `INSERT INTO phone_expense (
        id, employee_id, date, particulars, tel_fax_no, bill_no, amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.employee_id,
        data.date,
        data.particulars,
        data.tel_fax_no,
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
      tel_fax_no: data.tel_fax_no,
      bill_no: data.bill_no,
      amount: data.amount,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdatePhoneExpenseDTO): Promise<PhoneExpense> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Phone expense with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const employeeId = data.employee_id ?? existing.employee_id;
    const date = data.date ?? existing.date;
    const particulars = data.particulars ?? existing.particulars;
    const telFaxNo = data.tel_fax_no ?? existing.tel_fax_no;
    const billNo = data.bill_no ?? existing.bill_no;
    const amount = data.amount ?? existing.amount;

    await db.runAsync(
      `UPDATE phone_expense
       SET employee_id = ?, date = ?, particulars = ?, tel_fax_no = ?, bill_no = ?, amount = ?, updated_at = ?
       WHERE id = ?;`,
      [employeeId, date, particulars, telFaxNo, billNo, amount, timestamp, id]
    );

    return {
      id,
      employee_id: employeeId,
      date,
      particulars,
      tel_fax_no: telFaxNo,
      bill_no: billNo,
      amount,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM phone_expense WHERE id = ?;`, [id]);
  }
}

export const phoneRepository = new PhoneRepository();
