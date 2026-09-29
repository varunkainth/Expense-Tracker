import { getDatabase } from '../../database/client';
import { CreateHotelExpenseDTO, HotelExpense, UpdateHotelExpenseDTO } from '../../types/company';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class HotelRepository {
  async getAll(employeeId?: string): Promise<HotelExpense[]> {
    const db = await getDatabase();
    if (employeeId) {
      return await db.getAllAsync<HotelExpense>(
        `SELECT id, employee_id, hotel_name, bill_no, start_date, end_date, no_of_days, rate_per_day, food_amount, amount, created_at, updated_at
         FROM hotel
         WHERE employee_id = ?
         ORDER BY start_date DESC;`,
        [employeeId]
      );
    }
    return await db.getAllAsync<HotelExpense>(
      `SELECT id, employee_id, hotel_name, bill_no, start_date, end_date, no_of_days, rate_per_day, food_amount, amount, created_at, updated_at
       FROM hotel
       ORDER BY start_date DESC;`
    );
  }

  async getById(id: string): Promise<HotelExpense | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<HotelExpense>(
      `SELECT id, employee_id, hotel_name, bill_no, start_date, end_date, no_of_days, rate_per_day, food_amount, amount, created_at, updated_at
       FROM hotel
       WHERE id = ?;`,
      [id]
    );
  }

  async create(data: CreateHotelExpenseDTO): Promise<HotelExpense> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();
    const billNo = data.bill_no ?? null;
    const foodAmount = data.food_amount ?? null;

    await db.runAsync(
      `INSERT INTO hotel (
        id, employee_id, hotel_name, bill_no, start_date, end_date, no_of_days, rate_per_day, food_amount, amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.employee_id,
        data.hotel_name,
        billNo,
        data.start_date,
        data.end_date,
        data.no_of_days,
        data.rate_per_day,
        foodAmount,
        data.amount,
        timestamp,
        timestamp,
      ]
    );

    return {
      id,
      employee_id: data.employee_id,
      hotel_name: data.hotel_name,
      bill_no: billNo,
      start_date: data.start_date,
      end_date: data.end_date,
      no_of_days: data.no_of_days,
      rate_per_day: data.rate_per_day,
      food_amount: foodAmount,
      amount: data.amount,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdateHotelExpenseDTO): Promise<HotelExpense> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Hotel expense with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const employeeId = data.employee_id ?? existing.employee_id;
    const hotelName = data.hotel_name ?? existing.hotel_name;
    const billNo = data.bill_no !== undefined ? data.bill_no : existing.bill_no;
    const startDate = data.start_date ?? existing.start_date;
    const endDate = data.end_date ?? existing.end_date;
    const noOfDays = data.no_of_days ?? existing.no_of_days;
    const ratePerDay = data.rate_per_day ?? existing.rate_per_day;
    const foodAmount = data.food_amount !== undefined ? data.food_amount : existing.food_amount;
    const amount = data.amount ?? existing.amount;

    await db.runAsync(
      `UPDATE hotel
       SET employee_id = ?, hotel_name = ?, bill_no = ?, start_date = ?, end_date = ?, no_of_days = ?, rate_per_day = ?, food_amount = ?, amount = ?, updated_at = ?
       WHERE id = ?;`,
      [
        employeeId,
        hotelName,
        billNo,
        startDate,
        endDate,
        noOfDays,
        ratePerDay,
        foodAmount,
        amount,
        timestamp,
        id,
      ]
    );

    return {
      id,
      employee_id: employeeId,
      hotel_name: hotelName,
      bill_no: billNo,
      start_date: startDate,
      end_date: endDate,
      no_of_days: noOfDays,
      rate_per_day: ratePerDay,
      food_amount: foodAmount,
      amount,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM hotel WHERE id = ?;`, [id]);
  }
}

export const hotelRepository = new HotelRepository();
