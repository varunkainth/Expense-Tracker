import { CompanyExports } from '../components/company-exports';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Smartphone } from 'lucide-react';
import { formatMoney, WORKSPACE_TABLES, type WorkspaceTable } from '@expense-tracker/shared';
import type { FeatureLink } from '../../../app/navigation';
import { PageHeader } from '../../../components/ui/page-header';
import { useWorkspace, type WorkspaceRow } from '../hooks/use-workspace';
import { RecordTable } from '../components/record-table';
import { Receipts } from '../components/receipts';
import { companyTableByPath, label, rowDate, rowAmount, sumMoney, download, csv } from '../lib/format';
import { splitBalances, settlements, fuelIntervals, currentMonth } from '../lib/calculations';
import { encryptPhoneCopy, restorePhoneCopy } from '../data/workspace-backup';
import { RememberBrowser } from '../../connection/components/remember-browser';
import { usePairing } from '../../connection/hooks/pairing-provider';
const companyFields: Record<string, string[]> = {
  employee_details: ['name','employee_code','department','grade','location','mobile_no'],
  local_conveyance: ['date','employee_id','particulars','mode','complaint_no','amount'],
  outstation_conveyance: ['date','employee_id','from_location','to_location','mode','amount'],
  hotel: ['start_date','end_date','employee_id','hotel_name','no_of_days','rate_per_day','amount'],
  tour_conveyance: ['date','employee_id','from_location','to_location','mode','fare'],
  phone_expense: ['date','employee_id','particulars','tel_fax_no','bill_no','amount'],
  miscellaneous_expense: ['date','employee_id','particulars','bill_no','amount'],
  daily_allowance: ['start_date','end_date','employee_id','no_of_days','travel_allowance','food_allowance','total_amount'],
};
const basicTables: Record<string, { table: WorkspaceTable; fields: string[] }[]> = {
  '/categories': [{ table: 'categories', fields: ['name','is_default'] }, { table: 'subcategories', fields: ['name','category_id','is_default'] }],
  '/recurring': [{ table: 'recurring_expenses', fields: ['description','category_id','payment_method','day_of_month','next_due','amount'] }],
  '/subscriptions': [{ table: 'subscriptions', fields: ['name','category_id','payment_method','day_of_month','next_due','amount'] }],
  '/investments': [{ table: 'investment_plans', fields: ['name','frequency','active','day_of_month','next_due','amount'] }, { table: 'investment_contributions', fields: ['plan_id','due_at','invested_at','amount'] }],
};
export function WorkspacePage({ feature }: { feature: FeatureLink }) {
  const { tables: all, devices, loading } = useWorkspace();
  const [device, setDevice] = useState('all'), [employee, setEmployee] = useState('all');
  const tables = Object.fromEntries(Object.entries(all).map(([table, rows]) => [table, rows.filter((row) => device === 'all' || row.sourceDevice === device)])) as typeof all;
  const relation = (table: WorkspaceTable, row: WorkspaceRow, id: unknown) => tables[table].find((value) => value.sourceDevice === row.sourceDevice && value.id === id);
  const lookup = (row: WorkspaceRow, field: string) => {
    const target: Record<string, WorkspaceTable> = { employee_id: 'employee_details', category_id: 'categories', subcategory_id: 'subcategories', vehicle_id: 'vehicles', group_id: 'split_groups', paid_by_person_id: 'split_people', plan_id: 'investment_plans' };
    return target[field] ? String(relation(target[field], row, row[field])?.name ?? row[field] ?? '—') : undefined;
  };
  const companyTable = companyTableByPath[feature.path];
  return <><PageHeader eyebrow="YOUR PHONE WORKSPACE" title={feature.label} description={feature.description} />
    <div className="workspace-notice"><Smartphone size={18} /><span>Phone records are read only here. Make changes on your phone; connected updates replace this device’s copy together.</span><Link className="text-link" to="/connect">Connection status</Link></div>
    {devices.length > 1 && <label className="workspace-device">Source phone<select value={device} onChange={(event) => setDevice(event.target.value)}><option value="all">All phones</option>{devices.map((id, index) => <option key={id} value={id}>Phone {index + 1} · {id.slice(0, 8)}</option>)}</select></label>}
    {loading ? <section className="panel" role="status">Opening your saved phone records…</section> : <>
      {companyTable ? <>
        {companyTable !== 'employee_details' && <label className="workspace-device">Employee<select value={employee} onChange={(event) => setEmployee(event.target.value)}><option value="all">All employees</option>{tables.employee_details.map((row) => <option key={`${row.sourceDevice}:${row.id}`} value={`${row.sourceDevice}:${row.id}`}>{row.name} · {row.employee_code}</option>)}</select></label>}
        <RecordTable title={feature.label} rows={tables[companyTable].filter((row) => employee === 'all' || companyTable === 'employee_details' || `${row.sourceDevice}:${row.employee_id}` === employee)} fields={companyFields[companyTable]} lookup={lookup} extra={(row) => <Receipts rows={tables.company_expense_attachments.filter((file) => file.sourceDevice === row.sourceDevice && file.expense_type === companyTable && file.expense_id === row.id)} />} />
      </> : basicTables[feature.path] ? <>{feature.path === '/investments' && <Summary values={[['Plans', String(tables.investment_plans.length)], ['Contributed', formatMoney(sumMoney(tables.investment_contributions))], ['Active plans', String(tables.investment_plans.filter((row) => row.active === 1).length)]]} />}{basicTables[feature.path].map(({ table, fields }) => <RecordTable key={table} title={label(table)} rows={tables[table]} fields={fields} lookup={lookup} />)}</>
      : feature.path === '/vehicles' ? <Fuel tables={tables} lookup={lookup} />
      : feature.path === '/split' ? <Split tables={tables} lookup={lookup} />
      : feature.path === '/insights' ? <Insights tables={tables} />
      : feature.path === '/budgets' ? <Budgets tables={tables} />
      : feature.path === '/upcoming' || feature.path === '/notifications' ? <Upcoming tables={tables} notifications={feature.path === '/notifications'} />
      : feature.path === '/daily-allowance-rates' ? <AllowanceRates tables={tables} />
      : feature.path === '/backup' ? <Backup devices={device === 'all' ? devices : [device]} />
      : feature.path === '/export' ? <Export tables={tables} />
      : feature.path === '/security' ? <Security /> : null}
    </>}
  </>;
}
type Tables = ReturnType<typeof useWorkspace>['tables'];
type Lookup = (row: WorkspaceRow, field: string) => string | undefined;
function Summary({ values }: { values: [string, string][] }) { return <div className="workspace-summary">{values.map(([title, value]) => <div key={title}><span>{title}</span><strong>{value}</strong></div>)}</div>; }
function Fuel({ tables, lookup }: { tables: Tables; lookup: Lookup }) {
  const [selected, setSelected] = useState('all');
  const refills = tables.fuel_refills.filter((row) => selected === 'all' || `${row.sourceDevice}:${row.vehicle_id}` === selected);
  const intervals = tables.vehicles.flatMap((vehicle) => fuelIntervals(refills.filter((row) => row.sourceDevice === vehicle.sourceDevice && row.vehicle_id === vehicle.id)).map((row) => ({ ...row, mileage: row.mileage === null ? 'First refill' : `${row.mileage.toFixed(2)} km/L (estimate)`, distance: row.distance === null ? '—' : `${row.distance} km` })));
  return <><Summary values={[['Vehicles', String(tables.vehicles.length)], ['Fuel spent', formatMoney(sumMoney(refills))], ['Litres', refills.reduce((sum, row) => sum + Number(row.litres), 0).toFixed(2)]]} /><RecordTable title="Vehicles" rows={tables.vehicles} fields={['name','kind','created_at']} /><label className="workspace-device">Refill history<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="all">All vehicles</option>{tables.vehicles.map((row) => <option key={`${row.sourceDevice}:${row.id}`} value={`${row.sourceDevice}:${row.id}`}>{row.name}</option>)}</select></label><p className="module-intro">Mileage uses distance since the previous refill divided by that previous refill’s litres. It is an estimate. Linked personal expenses are not counted twice in your personal overview.</p><RecordTable title="Fuel refills" rows={intervals} fields={['expense_date','vehicle_id','litres','odometer','distance','mileage','location','amount']} lookup={lookup} /></>;
}
function Split({ tables, lookup }: { tables: Tables; lookup: Lookup }) {
  const [group, setGroup] = useState('');
  const selected = tables.split_groups.find((row) => `${row.sourceDevice}:${row.id}` === group) ?? tables.split_groups[0];
  const members = tables.split_people.filter((row) => row.sourceDevice === selected?.sourceDevice && row.group_id === selected?.id);
  const expenses = tables.split_expenses.filter((row) => row.sourceDevice === selected?.sourceDevice && row.group_id === selected?.id);
  const balances = splitBalances(members, expenses), transfers = settlements(balances);
  return <><label className="workspace-device">Group<select value={selected ? `${selected.sourceDevice}:${selected.id}` : ''} onChange={(event) => setGroup(event.target.value)}>{!tables.split_groups.length && <option>No groups received</option>}{tables.split_groups.map((row) => <option key={`${row.sourceDevice}:${row.id}`} value={`${row.sourceDevice}:${row.id}`}>{row.name}</option>)}</select></label><Summary values={[['Members', String(members.length)], ['Group spending', formatMoney(sumMoney(expenses))], ['Suggested settlements', String(transfers.length)]]} /><section className="panel workspace-cards"><h2>Equal shares & balances</h2>{balances.map((row) => <div className="workspace-line" key={String(row.person.id)}><span>{row.person.name}<small>Paid {formatMoney(row.paid)} · Share {formatMoney(row.share)}</small></span><strong>{row.balance < 0 ? 'Owes ' : 'Receives '}{formatMoney(Math.abs(row.balance))}</strong></div>)}{transfers.map((row, index) => <p key={index}>{row.from} → {row.to}: <strong>{formatMoney(row.amount)}</strong></p>)}{!transfers.length && <p className="muted">Balances are settled or no expenses have been recorded.</p>}<p className="muted">Suggested transfers round down to whole rupees, matching your phone. The app owner covers leftover paise. Exact balances are shown above. These suggestions are not recorded payments.</p></section><RecordTable title="Group expenses" rows={expenses} fields={['expense_date','description','paid_by_person_id','amount']} lookup={lookup} /></>;
}
function Insights({ tables }: { tables: Tables }) {
  const month = currentMonth(tables.personal_expenses), total = sumMoney(month);
  const categories = tables.categories.map((category): WorkspaceRow & { amount: number } => ({ ...category, amount: sumMoney(month.filter((row) => row.sourceDevice === category.sourceDevice && row.category_id === category.id)) })).filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount);
  const monthly = new Map<string, number>();
  for (const row of tables.personal_expenses) { const key = new Date(rowDate(row)).toLocaleDateString('sv-SE').slice(0, 7); monthly.set(key, (monthly.get(key) ?? 0) + rowAmount(row)); }
  return <><Summary values={[['This month', formatMoney(total)], ['All personal expenses', formatMoney(sumMoney(tables.personal_expenses))], ['Transactions this month', String(month.length)]]} /><section className="panel workspace-cards"><h2>Categories this month</h2>{!categories.length && <p className="muted">No personal spending this month. Historical totals are below.</p>}{categories.map((row) => <div key={`${row.sourceDevice}:${row.id}`} className="workspace-bar"><div><span>{row.name}</span><strong>{formatMoney(row.amount)}</strong></div><progress value={row.amount} max={Math.max(total, 1)} /></div>)}</section><section className="panel workspace-cards"><h2>Monthly spending</h2>{[...monthly].sort(([a], [b]) => b.localeCompare(a)).map(([month, amount]) => <div className="workspace-line" key={month}><span>{month}</span><strong>{formatMoney(amount)}</strong></div>)}{!monthly.size && <p className="muted">Connect your phone to receive personal expenses.</p>}</section></>;
}
function Budgets({ tables }: { tables: Tables }) {
  const month = currentMonth(tables.personal_expenses);
  const budgets = tables.app_preferences.filter((row) => row.key === 'monthly_budget_paise' || String(row.key).startsWith('category_budget_paise:'));
  return <section className="panel workspace-cards"><h2>Budgets · current month</h2><p className="muted">Uses personal spending received from each phone. Change budgets on the phone.</p>{budgets.map((row) => {
    const categoryId = String(row.key).split(':')[1], budget = Number(row.value);
    const name = categoryId ? tables.categories.find((category) => category.sourceDevice === row.sourceDevice && category.id === categoryId)?.name ?? 'Category' : 'Monthly budget';
    const spent = sumMoney(month.filter((expense) => expense.sourceDevice === row.sourceDevice && (!categoryId || expense.category_id === categoryId)));
    return <div className="workspace-bar" key={`${row.sourceDevice}:${row.key}`}><div><span>{name}</span><strong>{formatMoney(spent)} / {formatMoney(budget)}</strong></div><progress value={Math.min(spent, budget)} max={Math.max(budget, 1)} /><small>{spent > budget ? `${formatMoney(spent - budget)} over budget` : `${formatMoney(budget - spent)} remaining`}</small></div>;
  })}{!budgets.length && <p>No budgets received. Set a monthly or category budget in the mobile app.</p>}</section>;
}
function Upcoming({ tables, notifications }: { tables: Tables; notifications: boolean }) {
  const rows: WorkspaceRow[] = [...tables.recurring_expenses.map((row) => ({ ...row, schedule: 'Recurring', name: row.description ?? 'Recurring expense' })), ...tables.subscriptions.map((row) => ({ ...row, schedule: 'Subscription' })), ...tables.investment_plans.filter((row) => row.active === 1).map((row) => ({ ...row, schedule: row.frequency === 'one_time' ? 'One-time investment' : 'SIP' }))];
  rows.sort((a, b) => Number(a.next_due) - Number(b.next_due));
  const overdue = rows.filter((row) => Number(row.next_due) < new Date().setHours(0, 0, 0, 0));
  return <>{notifications && <section className="panel workspace-cards"><h2>Phone reminder settings</h2><p className="muted">Notifications are scheduled on your phone. This browser shows due items while open; it does not promise background alerts.</p>{tables.app_preferences.filter((row) => String(row.key).startsWith('reminder.')).map((row) => <div className="workspace-line" key={`${row.sourceDevice}:${row.key}`}><span>{label(String(row.key))}</span><strong>{row.value}</strong></div>)}</section>}<Summary values={[['Scheduled items', String(rows.length)], ['Overdue', String(overdue.length)], ['Scheduled amounts', formatMoney(sumMoney(rows))]]} /><RecordTable title={notifications ? 'Reminder inbox' : 'Upcoming payments'} rows={rows} fields={['name','schedule','next_due','day_of_month','amount']} /></>;
}
function AllowanceRates({ tables }: { tables: Tables }) {
  return <section className="panel workspace-cards"><h2>Daily allowance rates</h2>{tables.app_preferences.filter((row) => row.key === '@payment_app_daily_allowance_rates').map((row) => { let rates: Record<string, number> = {}; try { rates = JSON.parse(String(row.value)); } catch { /* An invalid preference is rejected by validation on new imports. */ } return <div key={row.sourceDevice}>{Object.entries(rates).map(([key, value]) => <div className="workspace-line" key={key}><span>{label(key)}</span><strong>{formatMoney(value)}</strong></div>)}</div>; })}{!tables.app_preferences.some((row) => row.key === '@payment_app_daily_allowance_rates') && <p>No custom rates received. Open Daily Allowance Rates on the phone to save your rates.</p>}</section>;
}
function Backup({ devices }: { devices: string[] }) {
  const [password, setPassword] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { download('expense-tracker-phone-copy.encrypted.json', await encryptPhoneCopy(password, devices), 'application/json'); setMessage('Encrypted copy downloaded. Keep its password safe.'); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Backup failed.'); } finally { setBusy(false); } }
  async function restore(file?: File) {
    if (!file) return;
    if (!window.confirm('Replace imported phone records for the devices in this copy? Browser-created expenses and other phones are preserved. Connected phones may later replace restored records with their current data.')) return;
    setBusy(true); try { if (file.size > 48 * 1024 * 1024) throw new Error('Backup file is too large.'); const count = await restorePhoneCopy(await file.text(), password); setMessage(`Restored ${count} phone records.`); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Restore failed.'); } finally { setBusy(false); }
  }
  return <section className="panel workspace-cards"><h2>Encrypted phone-data copy</h2><p>Includes received company records, personal data and receipt files. This web format does not replace your mobile backup. Browser-created personal expenses can be exported from Personal Expenses separately.</p><label>Backup password<input type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" disabled={busy} /></label><div className="workspace-actions"><button className="primary-button" disabled={busy || password.length < 10 || !devices.length} onClick={() => { void save(); }}>{busy ? 'Working…' : 'Download encrypted copy'}</button><label>Restore web phone-data copy<input type="file" accept="application/json,.json" disabled={busy || password.length < 10} onChange={(event) => { void restore(event.target.files?.[0]); event.target.value = ''; }} /></label></div><p role="status">{message}</p></section>;
}
function Export({ tables }: { tables: Tables }) {
  const [table, setTable] = useState<WorkspaceTable>('personal_expenses');
  const fields = Object.keys(WORKSPACE_TABLES[table]);
  return <><CompanyExports employees={tables.employee_details}/><section className="panel workspace-cards"><h2>Export phone records</h2><p>CSV amounts are formatted in rupees. Exports include the selected phone filter and all dates. Receipt files can be downloaded from the corresponding company record.</p><label>Dataset<select value={table} onChange={(event) => setTable(event.target.value as WorkspaceTable)}>{Object.keys(WORKSPACE_TABLES).map((key) => <option value={key} key={key}>{label(key)}</option>)}</select></label><p>{tables[table].length} records</p><button className="primary-button" disabled={!tables[table].length} onClick={() => download(`${table}.csv`, csv(tables[table], fields), 'text/csv;charset=utf-8')}><Download size={16} />Download CSV</button><Link className="text-link" to="/backup">Make an encrypted copy with receipt files</Link></section></>;
}
function Security() {
  const { phase } = usePairing();
  return <section className="panel workspace-cards"><h2>Browser access</h2><p>Connection: {phase === 'linked' ? 'Linked to phone' : 'Browser only'}. Expense transfer uses AES-256-GCM. Your phone’s PIN, biometric credentials and pairing secrets are never part of the workspace snapshot.</p><RememberBrowser /><p className="muted">Browser records are stored locally and are not encrypted at rest. Phone app-lock settings remain on the phone. Disconnect removes access to new updates; previously imported records remain saved.</p><Link className="primary-button" to="/connect">Manage linked phone</Link></section>;
}
