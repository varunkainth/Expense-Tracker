import { getDatabase } from '../../database/client';
import {
  CreateOutstationConveyanceDTO,
  OutstationConveyance,
  UpdateOutstationConveyanceDTO,
} from '../../types/company';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class OutstationConveyanceRepository {
  async getAll(employeeId?: string): Promise<OutstationConveyance[]> {
    const db = await getDatabase();
    if (employeeId) {
      return await db.getAllAsync<OutstationConveyance>(
        `SELECT id, employee_id, date, from_location, departure_time, to_location, arrival_time, mode, amount, complaint_no, created_at, updated_at
         FROM outstation_conveyance
         WHERE employee_id = ?
         ORDER BY date DESC;`,
        [employeeId]
      );
    }
    return await db.getAllAsync<OutstationConveyance>(
      `SELECT id, employee_id, date, from_location, departure_time, to_location, arrival_time, mode, amount, complaint_no, created_at, updated_at
       FROM outstation_conveyance
       ORDER BY date DESC;`
    );
  }

  async getById(id: string): Promise<OutstationConveyance | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<OutstationConveyance>(
      `SELECT id, employee_id, date, from_location, departure_time, to_location, arrival_time, mode, amount, complaint_no, created_at, updated_at
       FROM outstation_conveyance
       WHERE id = ?;`,
      [id]
    );
  }

  async create(data: CreateOutstationConveyanceDTO): Promise<OutstationConveyance> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();
    const departureTime = data.departure_time ?? null;
    const arrivalTime = data.arrival_time ?? null;

    await db.runAsync(
      `INSERT INTO outstation_conveyance (
        id, employee_id, date, from_location, departure_time, to_location, arrival_time, mode, amount, complaint_no, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.employee_id,
        data.date,
        data.from_location,
        departureTime,
        data.to_location,
        arrivalTime,
        data.mode,
        data.amount,
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
      departure_time: departureTime,
      to_location: data.to_location,
      arrival_time: arrivalTime,
      mode: data.mode,
      amount: data.amount,
      complaint_no: data.complaint_no,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdateOutstationConveyanceDTO): Promise<OutstationConveyance> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Outstation conveyance with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const complaintNo = data.complaint_no ?? existing.complaint_no;
    const employeeId = data.employee_id ?? existing.employee_id;
    const date = data.date ?? existing.date;
    const fromLocation = data.from_location ?? existing.from_location;
    const departureTime = data.departure_time !== undefined ? data.departure_time : existing.departure_time;
    const toLocation = data.to_location ?? existing.to_location;
    const arrivalTime = data.arrival_time !== undefined ? data.arrival_time : existing.arrival_time;
    const mode = data.mode ?? existing.mode;
    const amount = data.amount ?? existing.amount;

    await db.runAsync(
      `UPDATE outstation_conveyance
       SET employee_id = ?, date = ?, from_location = ?, departure_time = ?, to_location = ?, arrival_time = ?, mode = ?, amount = ?, complaint_no = ?, updated_at = ?
       WHERE id = ?;`,
      [
        employeeId,
        date,
        fromLocation,
        departureTime,
        toLocation,
        arrivalTime,
        mode,
        amount,
        complaintNo,
        timestamp,
        id,
      ]
    );

    return {
      id,
      employee_id: employeeId,
      date,
      from_location: fromLocation,
      departure_time: departureTime,
      to_location: toLocation,
      arrival_time: arrivalTime,
      mode,
      amount,
      complaint_no: complaintNo,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM outstation_conveyance WHERE id = ?;`, [id]);
  }
}

export const outstationConveyanceRepository = new OutstationConveyanceRepository();
