import { getDatabase } from '../../database/client';
import {
  CreateTourConveyanceDTO,
  TourConveyance,
  UpdateTourConveyanceDTO,
} from '../../types/company';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class TourConveyanceRepository {
  async getAll(employeeId?: string): Promise<TourConveyance[]> {
    const db = await getDatabase();
    if (employeeId) {
      return await db.getAllAsync<TourConveyance>(
        `SELECT id, employee_id, date, from_location, to_location, mode, fare, complaint_no, created_at, updated_at
         FROM tour_conveyance
         WHERE employee_id = ?
         ORDER BY date DESC;`,
        [employeeId]
      );
    }
    return await db.getAllAsync<TourConveyance>(
      `SELECT id, employee_id, date, from_location, to_location, mode, fare, complaint_no, created_at, updated_at
       FROM tour_conveyance
       ORDER BY date DESC;`
    );
  }

  async getById(id: string): Promise<TourConveyance | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<TourConveyance>(
      `SELECT id, employee_id, date, from_location, to_location, mode, fare, complaint_no, created_at, updated_at
       FROM tour_conveyance
       WHERE id = ?;`,
      [id]
    );
  }

  async create(data: CreateTourConveyanceDTO): Promise<TourConveyance> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    await db.runAsync(
      `INSERT INTO tour_conveyance (
        id, employee_id, date, from_location, to_location, mode, fare, complaint_no, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.employee_id,
        data.date,
        data.from_location,
        data.to_location,
        data.mode,
        data.fare,
        data.complaint_no,
        timestamp,
        timestamp,
      ]
    );

    return {
      id,
      employee_id: data.employee_id,
      date: data.date,
      from_location: data.from_location,
      to_location: data.to_location,
      mode: data.mode,
      fare: data.fare,
      complaint_no: data.complaint_no,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdateTourConveyanceDTO): Promise<TourConveyance> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Tour conveyance with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const complaintNo = data.complaint_no ?? existing.complaint_no;
    const employeeId = data.employee_id ?? existing.employee_id;
    const date = data.date ?? existing.date;
    const fromLocation = data.from_location ?? existing.from_location;
    const toLocation = data.to_location ?? existing.to_location;
    const mode = data.mode ?? existing.mode;
    const fare = data.fare ?? existing.fare;

    await db.runAsync(
      `UPDATE tour_conveyance
       SET employee_id = ?, date = ?, from_location = ?, to_location = ?, mode = ?, fare = ?, complaint_no = ?, updated_at = ?
       WHERE id = ?;`,
      [employeeId, date, fromLocation, toLocation, mode, fare, complaintNo, timestamp, id]
    );

    return {
      id,
      employee_id: employeeId,
      date,
      from_location: fromLocation,
      to_location: toLocation,
      mode,
      fare,
      complaint_no: complaintNo,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM tour_conveyance WHERE id = ?;`, [id]);
  }
}

export const tourConveyanceRepository = new TourConveyanceRepository();
