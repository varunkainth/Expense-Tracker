import { getDatabase } from '../../database/client';
import {
  CreateLocalConveyanceDTO,
  LocalConveyance,
  UpdateLocalConveyanceDTO,
} from '../../types/company';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class LocalConveyanceRepository {
  async getAll(employeeId?: string): Promise<LocalConveyance[]> {
    const db = await getDatabase();
    if (employeeId) {
      return await db.getAllAsync<LocalConveyance>(
        `SELECT id, employee_id, date, particulars, mode, complaint_no, amount, created_at, updated_at
         FROM local_conveyance
         WHERE employee_id = ?
         ORDER BY date DESC;`,
        [employeeId]
      );
    }
    return await db.getAllAsync<LocalConveyance>(
      `SELECT id, employee_id, date, particulars, mode, complaint_no, amount, created_at, updated_at
       FROM local_conveyance
       ORDER BY date DESC;`
    );
  }

  async getById(id: string): Promise<LocalConveyance | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<LocalConveyance>(
      `SELECT id, employee_id, date, particulars, mode, complaint_no, amount, created_at, updated_at
       FROM local_conveyance
       WHERE id = ?;`,
      [id]
    );
  }

  async create(data: CreateLocalConveyanceDTO): Promise<LocalConveyance> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    await db.runAsync(
      `INSERT INTO local_conveyance (
        id, employee_id, date, particulars, mode, complaint_no, amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.employee_id,
        data.date,
        data.particulars,
        data.mode,
        data.complaint_no,
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
      mode: data.mode,
      complaint_no: data.complaint_no,
      amount: data.amount,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdateLocalConveyanceDTO): Promise<LocalConveyance> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Local conveyance with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const employeeId = data.employee_id ?? existing.employee_id;
    const date = data.date ?? existing.date;
    const particulars = data.particulars ?? existing.particulars;
    const mode = data.mode ?? existing.mode;
    const complaintNo = data.complaint_no ?? existing.complaint_no;
    const amount = data.amount ?? existing.amount;

    await db.runAsync(
      `UPDATE local_conveyance
       SET employee_id = ?, date = ?, particulars = ?, mode = ?, complaint_no = ?, amount = ?, updated_at = ?
       WHERE id = ?;`,
      [employeeId, date, particulars, mode, complaintNo, amount, timestamp, id]
    );

    return {
      id,
      employee_id: employeeId,
      date,
      particulars,
      mode,
      complaint_no: complaintNo,
      amount,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM local_conveyance WHERE id = ?;`, [id]);
  }
}

export const localConveyanceRepository = new LocalConveyanceRepository();
