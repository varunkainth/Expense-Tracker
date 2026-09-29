import { getDatabase } from '../../database/client';
import { CreateEmployeeDTO, EmployeeDetails, UpdateEmployeeDTO } from '../../types/company';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class EmployeeRepository {
  async getAll(): Promise<EmployeeDetails[]> {
    const db = await getDatabase();
    return await db.getAllAsync<EmployeeDetails>(
      `SELECT id, name, employee_code, grade, department, location, mobile_no, created_at, updated_at
       FROM employee_details
       ORDER BY name ASC;`
    );
  }

  async getById(id: string): Promise<EmployeeDetails | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<EmployeeDetails>(
      `SELECT id, name, employee_code, grade, department, location, mobile_no, created_at, updated_at
       FROM employee_details
       WHERE id = ?;`,
      [id]
    );
  }

  async getByCode(code: string): Promise<EmployeeDetails | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<EmployeeDetails>(
      `SELECT id, name, employee_code, grade, department, location, mobile_no, created_at, updated_at
       FROM employee_details
       WHERE employee_code = ?;`,
      [code]
    );
  }

  async create(data: CreateEmployeeDTO): Promise<EmployeeDetails> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    const mobile_no =
      data.mobile_no && data.mobile_no.trim().length > 0
        ? data.mobile_no.trim()
        : null;

    await db.runAsync(
      `INSERT INTO employee_details (
        id, name, employee_code, grade, department, location, mobile_no, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        data.name,
        data.employee_code,
        data.grade,
        data.department,
        data.location,
        mobile_no,
        timestamp,
        timestamp,
      ]
    );

    return {
      id,
      name: data.name,
      employee_code: data.employee_code,
      grade: data.grade,
      department: data.department,
      location: data.location,
      mobile_no,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async update(id: string, data: UpdateEmployeeDTO): Promise<EmployeeDetails> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Employee with ID ${id} not found.`);
    }

    const timestamp = getCurrentTimestamp();
    const name = data.name ?? existing.name;
    const code = data.employee_code ?? existing.employee_code;
    const grade = data.grade ?? existing.grade;
    const department = data.department ?? existing.department;
    const location = data.location ?? existing.location;

    // mobile_no: only overwrite if the field was explicitly provided.
    // Allow explicit null to clear it.
    const mobile_no =
      data.mobile_no === undefined
        ? existing.mobile_no
        : data.mobile_no && data.mobile_no.trim().length > 0
        ? data.mobile_no.trim()
        : null;

    await db.runAsync(
      `UPDATE employee_details
       SET name = ?, employee_code = ?, grade = ?, department = ?, location = ?, mobile_no = ?, updated_at = ?
       WHERE id = ?;`,
      [name, code, grade, department, location, mobile_no, timestamp, id]
    );

    return {
      id,
      name,
      employee_code: code,
      grade,
      department,
      location,
      mobile_no,
      created_at: existing.created_at,
      updated_at: timestamp,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM employee_details WHERE id = ?;`, [id]);
  }
}

export const employeeRepository = new EmployeeRepository();