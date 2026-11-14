import { z } from 'zod';
export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'ATM', 'Bank transfer', 'Other'] as const;
const timestamp = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const categorySchema = z.object({
    id: z.string().min(1), name: z.string().trim().min(1).max(80),
    icon: z.string().nullable(), is_default: z.union([z.literal(0), z.literal(1)]), created_at: timestamp,
});
export const expenseSchema = z.object({
    id: z.string().min(1), amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    category_id: z.string().min(1), subcategory_id: z.string().nullable(),
    description: z.string().trim().max(300).nullable(),
    payment_method: z.enum(PAYMENT_METHODS), expense_date: timestamp,
    created_at: timestamp, updated_at: timestamp,
});
export const expenseDraftSchema = expenseSchema.pick({
    amount: true, category_id: true, description: true, payment_method: true, expense_date: true,
});
export type Category = z.infer<typeof categorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseDraft = z.infer<typeof expenseDraftSchema>;
