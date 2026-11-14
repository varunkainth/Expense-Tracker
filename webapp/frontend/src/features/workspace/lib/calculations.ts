import { calculateSplitBalances, splitTransfers } from '../../../../../../packages/workspace-data/src/splits';
import type { WorkspaceRow } from '../hooks/use-workspace';
import { rowDate } from './format';
export function splitBalances(people: WorkspaceRow[], expenses: WorkspaceRow[]) {
  const members = people.map((row) => ({ ...row, id: String(row.id), name: String(row.name) }));
  return calculateSplitBalances(members, expenses.map((row) => ({ paid_by_person_id: String(row.paid_by_person_id), amount: Number(row.amount) })));
}
export function settlements(balances: ReturnType<typeof splitBalances>) { return splitTransfers(balances).map((row) => ({ from: row.from_name, to: row.to_name, amount: row.amount })); }
export function fuelIntervals(rows: WorkspaceRow[]) {
  const day = (row: WorkspaceRow) => { const value = new Date(rowDate(row)); return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime(); };
  const ordered = [...rows].sort((a, b) => day(a) - day(b) || Number(a.odometer) - Number(b.odometer) || Number(a.created_at) - Number(b.created_at));
  return ordered.map((row, index) => { const previous = ordered[index - 1], distance = previous ? Number(row.odometer) - Number(previous.odometer) : null; return { ...row, distance, mileage: previous && distance !== null && distance > 0 ? distance / Number(previous.litres) : null }; });
}
export function currentMonth(rows: WorkspaceRow[], now = new Date()) { return rows.filter((row) => { const value = new Date(rowDate(row)); return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth(); }); }
