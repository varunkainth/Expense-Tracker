import { getDatabase } from '../../database/client';
import { Category, CreateCategoryDTO, CreateSubcategoryDTO, Subcategory } from '../../types/personal';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';
import { categoryBudgetKey } from '../../services/category-budget.service';
import { deletePreference } from '../../services/preferences.service';

export class CategoryRepository {
  async getSubcategories(categoryId: string): Promise<Subcategory[]> {
    const db = await getDatabase();
    return db.getAllAsync<Subcategory>(
      `SELECT id, category_id, name, is_default, created_at
       FROM subcategories WHERE category_id = ?
       ORDER BY is_default DESC, name COLLATE NOCASE ASC;`,
      [categoryId],
    );
  }

  async createSubcategory(data: CreateSubcategoryDTO): Promise<Subcategory> {
    const db = await getDatabase();
    const subcategory: Subcategory = {
      id: generateUUID(),
      category_id: data.category_id,
      name: data.name.trim().replace(/\s+/g, ' '),
      is_default: data.is_default ?? 0,
      created_at: getCurrentTimestamp(),
    };
    await db.runAsync(
      `INSERT INTO subcategories (id, category_id, name, is_default, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [subcategory.id, subcategory.category_id, subcategory.name, subcategory.is_default, subcategory.created_at],
    );
    return subcategory;
  }

  async deleteSubcategory(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM subcategories WHERE id = ?;', [id]);
  }

  /**
   * Retrieves all categories ordered by default first, then by name.
   */
  async getAll(): Promise<Category[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Category>(
      `SELECT id, name, icon, is_default, created_at
       FROM categories
       ORDER BY is_default DESC, name ASC;`
    );
  }

  /**
   * Categories used most often appear first in the expense form. When two
   * categories have the same usage count, the one used most recently wins.
   */
  async getAllByUsage(): Promise<Category[]> {
    const db = await getDatabase();
    return db.getAllAsync<Category>(
      `SELECT c.id, c.name, c.icon, c.is_default, c.created_at
       FROM categories c
       LEFT JOIN personal_expenses e ON e.category_id = c.id
       GROUP BY c.id
       ORDER BY
         COUNT(e.id) DESC,
         MAX(e.expense_date) DESC,
         c.name COLLATE NOCASE ASC;`,
    );
  }

  /**
   * Retrieves a single category by ID.
   */
  async getById(id: string): Promise<Category | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<Category>(
      `SELECT id, name, icon, is_default, created_at
       FROM categories
       WHERE id = ?;`,
      [id]
    );
  }

  /**
   * Retrieves a category by name.
   */
  async getByName(name: string): Promise<Category | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<Category>(
      `SELECT id, name, icon, is_default, created_at
       FROM categories
       WHERE name = ?;`,
      [name]
    );
  }

  /**
   * Creates a new custom category.
   */
  async create(data: CreateCategoryDTO): Promise<Category> {
    const db = await getDatabase();
    const id = generateUUID();
    const timestamp = getCurrentTimestamp();
    const isDefault = data.is_default ?? 0;
    const icon = data.icon ?? null;

    await db.runAsync(
      `INSERT INTO categories (id, name, icon, is_default, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [id, data.name, icon, isDefault, timestamp]
    );

    return {
      id,
      name: data.name,
      icon,
      is_default: isDefault,
      created_at: timestamp,
    };
  }

  /**
   * Deletes a category by ID (only allowed if not referenced by expenses due to ON DELETE RESTRICT).
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM categories WHERE id = ?;`, [id]);
    await deletePreference(categoryBudgetKey(id));
  }
}

export const categoryRepository = new CategoryRepository();
