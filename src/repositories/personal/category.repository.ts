import { getDatabase } from '../../database/client';
import { Category, CreateCategoryDTO } from '../../types/personal';
import { generateUUID } from '../../utils/uuid';
import { getCurrentTimestamp } from '../../utils/date';

export class CategoryRepository {
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
  }
}

export const categoryRepository = new CategoryRepository();
