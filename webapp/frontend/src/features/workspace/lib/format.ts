import { formatMoney, type WorkspaceTable } from '@expense-tracker/shared';
import type { WorkspaceRow } from '../hooks/use-workspace';
export const moneyFields = new Set(['amount','fare','rate_per_day','food_amount','travel_allowance','food_allowance','total_amount','TRAVEL_ALLOWANCE_PAISE','FOOD_ALLOWANCE_PAISE','TOTAL_ALLOWANCE_PAISE']);
export const dateFields = new Set(['date','expense_date','start_date','end_date','next_due','due_at','invested_at','created_at','updated_at','departure_time','arrival_time']);
export const label = (value: string) => value.replace(/^@payment_app_/, '').replace(/_paise/g, '').replace(/[_.:]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
export const date = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const rowDate = (row: WorkspaceRow) => Number(row.expense_date ?? row.date ?? row.start_date ?? row.next_due ?? row.invested_at ?? row.created_at ?? 0);
export const rowAmount = (row: WorkspaceRow) => Number(row.total_amount ?? row.amount ?? row.fare ?? 0);
export function sumMoney(rows: WorkspaceRow[]) { const sum = rows.reduce((value, row) => value + rowAmount(row), 0); if (!Number.isSafeInteger(sum)) throw new Error('Total exceeds the supported money range.'); return sum; }
export function display(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (moneyFields.has(field) && typeof value === 'number') return formatMoney(value);
  if (dateFields.has(field)) return date(value);
  if (['is_default','active'].includes(field)) return value === 1 ? 'Yes' : 'No';
  if (field === 'size_bytes') return `${(Number(value) / 1024).toFixed(1)} KB`;
  return String(value);
}
export const companyTableByPath: Record<string, WorkspaceTable> = { '/company/employee': 'employee_details', '/company/local-conveyance': 'local_conveyance', '/company/outstation-conveyance': 'outstation_conveyance', '/company/hotel': 'hotel', '/company/tour-conveyance': 'tour_conveyance', '/company/phone-expense': 'phone_expense', '/company/miscellaneous': 'miscellaneous_expense', '/company/daily-allowance': 'daily_allowance' };
export function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name.replace(/[^a-zA-Z0-9._ -]/g, '_'); document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function csv(rows: WorkspaceRow[], fields: string[]) {
  const escape = (value: unknown) => { let cell = value == null ? '' : String(value); if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`; return `"${cell.replace(/"/g, '""')}"`; };
  return '\uFEFF' + [fields.map(label).map(escape).join(','), ...rows.map((row) => fields.map((field) => escape(display(row[field], field))).join(','))].join('\r\n');
}
