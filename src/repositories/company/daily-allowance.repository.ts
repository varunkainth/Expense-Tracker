import { getDatabase } from '../../database/client';
import { DailyAllowanceRatesService } from '../../services/daily-allowance-rates.service';
import {
  CreateDailyAllowanceDTO,
  DailyAllowance,
  DailyAllowanceRates,
  UpdateDailyAllowanceDTO,
} from '../../types/company';
import { getCurrentTimestamp } from '../../utils/date';
import { generateUUID } from '../../utils/uuid';

async function computeAllowances(noOfDays: number, customRates?: DailyAllowanceRates) {
  const rates = customRates ?? (await DailyAllowanceRatesService.getRates());
  const travelAllowance = rates.TRAVEL_ALLOWANCE_PAISE * noOfDays;
  const foodAllowance = rates.FOOD_ALLOWANCE_PAISE * noOfDays;
  const totalAmount = travelAllowance + foodAllowance;
  return { travelAllowance, foodAllowance, totalAmount };
}


export class DailyAllowanceRepository {
  async getAll(employeeId?: string): Promise<DailyAllowance[]> {
    const db = await getDatabase();
    if (employeeId) {
      return await db.getAllAsync<DailyAllowance>(
        `SELECT id, employee_id, no_of_days, start_date, end_date,
                travel_allowance, food_allowance, total_amount,
                created_at, updated_at
         FROM daily_allowance
         WHERE employee_id = ?
         ORDER BY start_date DESC;`,
        [employeeId]
      );
    }
    return await db.getAllAsync<DailyAllowance>(
      `SELECT id, employee_id, no_of_days, start_date, end_date,
              travel_allowance, food_allowance, total_amount,
              created_at, updated_at
       FROM daily_allowance
       ORDER BY start_date DESC;`
    );
  }

  async getById(id: string): Promise<DailyAllowance | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<DailyAllowance>(
      `SELECT id, employee_id, no_of_days, start_date, end_date,
              travel_allowance, food_allowance, total_amount,
              created_at, updated_at
       FROM daily_allowance
       WHERE id = ?;`,
      [id]
    );
  }

  async create(data: CreateDailyAllowanceDTO): Promise<DailyAllowance> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    if (!Number.isFinite(data.no_of_days) || data.no_of_days <= 0) {
      throw new Error('no_of_days must be a positive number.');
    }

    const computed = await computeAllowances(data.no_of_days);
    const travelAllowance = data.travel_allowance ?? computed.travelAllowance;
    const foodAllowance = data.food_allowance ?? computed.foodAllowance;
    const totalAmount = data.total_amount ?? (travelAllowance + foodAllowance);

    await db.runAsync(
      `INSERT INTO daily_allowance (
        id, employee_id, no_of_days, start_date, end_date,
        travel_allowance, food_allowance, total_amount,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.employee_id,
        data.no_of_days,
        data.start_date,
        data.end_date,
        travelAllowance,
        foodAllowance,
        totalAmount,
        timestamp,
        timestamp,
      ]
    );

    return {
      id,
      employee_id: data.employee_id,
      no_of_days: data.no_of_days,
      start_date: data.start_date,
      end_date: data.end_date,
      travel_allowance: travelAllowance,
      food_allowance: foodAllowance,
      total_amount: totalAmount,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdateDailyAllowanceDTO): Promise<DailyAllowance> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Daily allowance with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const employeeId = data.employee_id ?? existing.employee_id;
    const noOfDays = data.no_of_days ?? existing.no_of_days;
    const startDate = data.start_date ?? existing.start_date;
    const endDate = data.end_date ?? existing.end_date;

    // Recompute allowances if no_of_days changed and caller didn't pass values
    let travelAllowance = data.travel_allowance ?? existing.travel_allowance;
    let foodAllowance = data.food_allowance ?? existing.food_allowance;
    let totalAmount = data.total_amount ?? existing.total_amount;

    if (data.no_of_days !== undefined) {
      const computed = await computeAllowances(noOfDays);
      if (data.travel_allowance === undefined) travelAllowance = computed.travelAllowance;
      if (data.food_allowance === undefined) foodAllowance = computed.foodAllowance;
      if (data.total_amount === undefined) totalAmount = travelAllowance + foodAllowance;
    }


    await db.runAsync(
      `UPDATE daily_allowance
       SET employee_id = ?, no_of_days = ?, start_date = ?, end_date = ?,
           travel_allowance = ?, food_allowance = ?, total_amount = ?,
           updated_at = ?
       WHERE id = ?;`,
      [
        employeeId,
        noOfDays,
        startDate,
        endDate,
        travelAllowance,
        foodAllowance,
        totalAmount,
        timestamp,
        id,
      ]
    );

    return {
      id,
      employee_id: employeeId,
      no_of_days: noOfDays,
      start_date: startDate,
      end_date: endDate,
      travel_allowance: travelAllowance,
      food_allowance: foodAllowance,
      total_amount: totalAmount,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM daily_allowance WHERE id = ?;`, [id]);
  }
}

export const dailyAllowanceRepository = new DailyAllowanceRepository();