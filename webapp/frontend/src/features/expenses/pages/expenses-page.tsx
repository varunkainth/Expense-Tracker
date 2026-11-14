import { csv, download } from '../../workspace/lib/format';
import { useState } from 'react';
import { Plus, Search, Download } from 'lucide-react';
import type { Expense } from '@expense-tracker/shared';
import { PageHeader } from '../../../components/ui/page-header';
import { useExpenses } from '../hooks/use-expenses';
import { ExpenseForm } from '../components/expense-form';
import { ExpenseList } from '../components/expense-list';
import { expenseRepository } from '../data/expense.repository';
export function ExpensesPage() {
    const { expenses, categories, loading } = useExpenses();
    const [form, setForm] = useState<Expense | 'new' | null>(null);
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    async function remove(expense: Expense) {
        if (!window.confirm('Delete this expense? A deletion marker will be kept for future sync.'))
            return;
        try {
            await expenseRepository.remove(expense.id);
            setError('');
        }
        catch {
            setError('Could not delete this expense. Please try again.');
        }
    }
    const filtered = expenses.filter((expense) => `${expense.description ?? ''} ${categories.find((category) => category.id === expense.category_id)?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
    return <><PageHeader eyebrow="THE EVERYDAY DETAILS" title="Your expenses" description="A place for every payment, big or small." action={<div className="workspace-actions"><button className="secondary-button" disabled={loading || !expenses.length} onClick={() => download('personal-expenses.csv', csv(expenses.map((row) => ({ ...row, sourceDevice: row.source_device ?? 'browser', category: categories.find((category) => category.id === row.category_id)?.name ?? 'Unknown' })), ['id','expense_date','category','description','payment_method','amount']), 'text/csv;charset=utf-8')}><Download size={16}/>Export CSV</button><button className="primary-button" onClick={() => setForm('new')} disabled={loading}><Plus size={18}/>Add expense</button></div>}/>
    {form && <section className="panel"><ExpenseForm key={form === 'new' ? 'new' : form.id} categories={categories} existing={form === 'new' ? undefined : form} onClose={() => setForm(null)}/></section>}
    {error && <p className="error" role="alert">{error}</p>}<section className="panel"><div className="section-heading"><h2>All transactions <span className="count">{expenses.length}</span></h2><label className="search"><Search size={17}/><input aria-label="Search expenses" placeholder="Search expenses…" value={query} onChange={(e) => setQuery(e.target.value)}/></label></div>
      {loading ? <p className="loading" role="status">Opening your local records…</p> : filtered.length === 0 && query ? <p className="loading">No expenses match your search.</p> : <ExpenseList expenses={filtered} categories={categories} onEdit={setForm} onDelete={(expense) => { void remove(expense); }}/>}</section></>;
}
