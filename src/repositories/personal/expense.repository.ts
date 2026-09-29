import { getDatabase } from '../../database/client';
import {
  CreatePersonalExpenseDTO,
  PersonalExpense,
  PersonalExpenseWithCategory,
  QuickAddExpenseDTO,
  UpdatePersonalExpenseDTO,
} from '../../types/personal';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class PersonalExpenseRepository {
  /**
   * Retrieves all personal expenses,
   * optionally joined with category details.
   */
  async getAll(options?: {
    startDate?: number;
    endDate?: number;
    categoryId?: string;
  }): Promise<PersonalExpenseWithCategory[]> {
    const db = await getDatabase();

    let query = `
      SELECT 
        pe.id,
        pe.amount,
        pe.category_id,
        pe.description,
        pe.payment_method,
        pe.expense_date,
        pe.created_at,
        pe.updated_at,
        c.name AS category_name,
        c.icon AS category_icon
      FROM personal_expenses pe
      LEFT JOIN categories c
        ON pe.category_id = c.id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (options?.startDate !== undefined) {
      query += ` AND pe.expense_date >= ?`;
      params.push(options.startDate);
    }

    if (options?.endDate !== undefined) {
      query += ` AND pe.expense_date <= ?`;
      params.push(options.endDate);
    }

    if (options?.categoryId !== undefined) {
      query += ` AND pe.category_id = ?`;
      params.push(options.categoryId);
    }

    query += `
      ORDER BY
        pe.expense_date DESC,
        pe.created_at DESC;
    `;

    return await db.getAllAsync<PersonalExpenseWithCategory>(
      query,
      params,
    );
  }

  /**
   * Retrieves a single personal expense by ID
   * with category information.
   */
  async getById(
    id: string,
  ): Promise<PersonalExpenseWithCategory | null> {
    const db = await getDatabase();

    return await db.getFirstAsync<PersonalExpenseWithCategory>(
      `
      SELECT 
        pe.id,
        pe.amount,
        pe.category_id,
        pe.description,
        pe.payment_method,
        pe.expense_date,
        pe.created_at,
        pe.updated_at,
        c.name AS category_name,
        c.icon AS category_icon
      FROM personal_expenses pe
      LEFT JOIN categories c
        ON pe.category_id = c.id
      WHERE pe.id = ?;
      `,
      [id],
    );
  }

  /**
   * Creates a personal expense.
   */
  async createExpense(
    data: CreatePersonalExpenseDTO,
  ): Promise<PersonalExpense> {
    const db = await getDatabase();

    const id = generateUUID();
    const timestamp = getCurrentTimestamp();

    const expenseDate =
      data.expense_date ?? timestamp;

    const description =
      data.description ?? null;

    await db.runAsync(
      `
      INSERT INTO personal_expenses (
        id,
        amount,
        category_id,
        description,
        payment_method,
        expense_date,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        id,
        data.amount,
        data.category_id,
        description,
        data.payment_method,
        expenseDate,
        timestamp,
        timestamp,
      ],
    );

    return {
      id,
      amount: data.amount,
      category_id: data.category_id,
      description,
      payment_method: data.payment_method,
      expense_date: expenseDate,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  /**
   * Quick Add Expense.
   */
  async quickAddExpense(
    data: QuickAddExpenseDTO,
  ): Promise<PersonalExpense> {
    return this.createExpense({
      amount: data.amount,
      category_id: data.category_id,
      payment_method: data.payment_method,
      description: null,
      expense_date: getCurrentTimestamp(),
    });
  }

  /**
   * Updates an existing expense.
   */
  async update(
    id: string,
    data: UpdatePersonalExpenseDTO,
  ): Promise<PersonalExpense> {
    const db = await getDatabase();

    const existing = await this.getById(id);

    if (!existing) {
      throw new Error(
        `Personal expense with ID ${id} not found.`,
      );
    }

    const updatedTimestamp =
      getCurrentTimestamp();

    const updatedAmount =
      data.amount ?? existing.amount;

    const updatedCategoryId =
      data.category_id ?? existing.category_id;

    const updatedDescription =
      data.description !== undefined
        ? data.description
        : existing.description;

    const updatedPaymentMethod =
      data.payment_method ??
      existing.payment_method;

    const updatedExpenseDate =
      data.expense_date ??
      existing.expense_date;

    await db.runAsync(
      `
      UPDATE personal_expenses
      SET
        amount = ?,
        category_id = ?,
        description = ?,
        payment_method = ?,
        expense_date = ?,
        updated_at = ?
      WHERE id = ?;
      `,
      [
        updatedAmount,
        updatedCategoryId,
        updatedDescription,
        updatedPaymentMethod,
        updatedExpenseDate,
        updatedTimestamp,
        id,
      ],
    );

    return {
      id,
      amount: updatedAmount,
      category_id: updatedCategoryId,
      description: updatedDescription,
      payment_method: updatedPaymentMethod,
      expense_date: updatedExpenseDate,
      created_at: existing.created_at,
      updated_at: updatedTimestamp,
    };
  }

  /**
   * Deletes an expense immediately.
   *
   * Returns the deleted expense so it can be
   * restored if the user presses Undo.
   */
  async delete(
    id: string,
  ): Promise<PersonalExpense | null> {
    const db = await getDatabase();

    /*
     * Get the complete record first.
     */
    const expense =
      await db.getFirstAsync<PersonalExpense>(
        `
        SELECT
          id,
          amount,
          category_id,
          description,
          payment_method,
          expense_date,
          created_at,
          updated_at
        FROM personal_expenses
        WHERE id = ?;
        `,
        [id],
      );

    if (!expense) {
      return null;
    }

    /*
     * Delete immediately.
     */
    await db.runAsync(
      `
      DELETE FROM personal_expenses
      WHERE id = ?;
      `,
      [id],
    );

    /*
     * Return exact deleted record.
     */
    return expense;
  }

  /**
   * Restores an expense.
   */
  async restore(
    expense: PersonalExpense,
  ): Promise<void> {
    const db = await getDatabase();

    /*
     * Check if it already exists.
     */
    const existing =
      await db.getFirstAsync<PersonalExpense>(
        `
        SELECT
          id,
          amount,
          category_id,
          description,
          payment_method,
          expense_date,
          created_at,
          updated_at
        FROM personal_expenses
        WHERE id = ?;
        `,
        [expense.id],
      );

    if (existing) {
      return;
    }

    /*
     * Insert the exact original record.
     */
    await db.runAsync(
      `
      INSERT INTO personal_expenses (
        id,
        amount,
        category_id,
        description,
        payment_method,
        expense_date,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        expense.id,
        expense.amount,
        expense.category_id,
        expense.description,
        expense.payment_method,
        expense.expense_date,
        expense.created_at,
        expense.updated_at,
      ],
    );
  }

  /**
   * Calculates total personal expenses.
   */
  async getTotalExpenses(
    startDate?: number,
    endDate?: number,
  ): Promise<number> {
    const db = await getDatabase();

    let query = `
      SELECT
        COALESCE(SUM(amount), 0) AS total
      FROM personal_expenses
      WHERE 1=1
    `;

    const params: number[] = [];

    if (startDate !== undefined) {
      query += `
        AND expense_date >= ?
      `;

      params.push(startDate);
    }

    if (endDate !== undefined) {
      query += `
        AND expense_date <= ?
      `;

      params.push(endDate);
    }

    const result =
      await db.getFirstAsync<{ total: number }>(
        query,
        params,
      );

    const total = Number(
      result?.total ?? 0,
    );

    return Number.isFinite(total)
      ? total
      : 0;
  }
}

export const personalExpenseRepository =
  new PersonalExpenseRepository();