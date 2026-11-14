import { Pencil, ReceiptText, Trash2 } from 'lucide-react';
import { formatMoney, type Category, type Expense } from '@expense-tracker/shared';
export function ExpenseList({ expenses, categories, onEdit, onDelete }: {
    expenses: (Expense & { source_device?: string })[];
    categories: Category[];
    onEdit: (expense: Expense) => void;
    onDelete: (expense: Expense) => void;
}) {
    if (!expenses.length)
        return <div className="empty-state"><span className="empty-icon"><ReceiptText size={28}/></span><h3>A clear start.</h3><p>Add your first expense to see your spending here.</p></div>;
    return <div className="table-scroll"><table><caption className="sr-only">Your recorded expenses</caption><thead><tr><th>Expense</th><th>Date</th><th>Payment</th><th className="align-right">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}>
    <td><strong>{expense.description || categories.find((category) => category.id === expense.category_id)?.name || 'Expense'}</strong><small>{categories.find((category) => category.id === expense.category_id)?.name ?? 'Unknown category'}</small></td>
    <td>{new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><span className="payment-tag">{expense.payment_method}</span></td><td className="align-right amount">{formatMoney(expense.amount)}</td>
    <td className="row-actions">{expense.source_device ? <small>From phone · read only</small> : <><button className="icon-button" aria-label={`Edit ${expense.description || 'expense'}`} onClick={() => onEdit(expense)}><Pencil size={16}/></button><button className="icon-button danger" aria-label={`Delete ${expense.description || 'expense'}`} onClick={() => onDelete(expense)}><Trash2 size={16}/></button></>}</td></tr>)}</tbody></table></div>;
}
