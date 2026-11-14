import { useState, type FormEvent } from 'react';
import { PAYMENT_METHODS, parseRupees, type Category, type Expense } from '@expense-tracker/shared';
import { fromDateInput, toDateInput } from '../../../lib/dates';
import { expenseRepository } from '../data/expense.repository';
export function ExpenseForm({ categories, existing, onClose }: {
    categories: Category[];
    existing?: Expense;
    onClose: () => void;
}) {
    const [amount, setAmount] = useState(existing ? (existing.amount / 100).toFixed(2) : '');
    const [categoryId, setCategoryId] = useState(existing?.category_id ?? categories[0]?.id ?? '');
    const [description, setDescription] = useState(existing?.description ?? '');
    const [method, setMethod] = useState<Expense['payment_method']>(existing?.payment_method ?? 'UPI');
    const [date, setDate] = useState(toDateInput(existing?.expense_date));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (saving)
            return;
        setSaving(true);
        setError('');
        try {
            await expenseRepository.save({ amount: parseRupees(amount), category_id: categoryId, description: description.trim() || null, payment_method: method, expense_date: fromDateInput(date) }, existing?.id);
            onClose();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this expense.');
        }
        finally {
            setSaving(false);
        }
    }
    return <form onSubmit={submit} className="expense-form"><div className="section-heading"><h2>{existing ? 'Edit expense' : 'A new expense'}</h2><button type="button" className="text-button" onClick={onClose} disabled={saving}>Cancel</button></div>
    <div className="form-grid"><label>Amount (₹)<input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required/></label>
    <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label>Date<input type="date" value={date} max={toDateInput()} onChange={(e) => setDate(e.target.value)} required/></label>
    <label>Payment method<select value={method} onChange={(e) => setMethod(e.target.value as Expense['payment_method'])}>{PAYMENT_METHODS.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className="full-width">What was it for?<input maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Lunch, groceries, a little treat…"/></label></div>
    {error && <p role="alert" className="error">{error}</p>}<div className="form-footer"><span>Saved in this browser. Browser changes are not sent to your phone.</span><button className="primary-button" disabled={saving || categories.length === 0}>{saving ? 'Saving…' : 'Save expense'}</button></div>
  </form>;
}
