export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Other';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  is_default: number; // 1 = default, 0 = custom
  created_at: number;
}

export interface CreateCategoryDTO {
  name: string;
  icon?: string | null;
  is_default?: number;
}

export interface PersonalExpense {
  id: string;
  amount: number; // in paise
  category_id: string;
  description: string | null;
  payment_method: PaymentMethod;
  expense_date: number; // Unix timestamp
  created_at: number;
  updated_at: number;
}

export interface PersonalExpenseWithCategory extends PersonalExpense {
  category_name?: string;
  category_icon?: string | null;
}

export interface CreatePersonalExpenseDTO {
  amount: number; // in paise
  category_id: string;
  description?: string | null;
  payment_method: PaymentMethod;
  expense_date?: number; // Defaults to current timestamp if omitted
}

export interface QuickAddExpenseDTO {
  amount: number; // in paise
  category_id: string;
  payment_method: PaymentMethod;
}

export interface UpdatePersonalExpenseDTO {
  amount?: number;
  category_id?: string;
  description?: string | null;
  payment_method?: PaymentMethod;
  expense_date?: number;
}
