import { WORKSPACE_TABLES, type WorkspaceSnapshot, type WorkspaceTable, type DataRow } from '@expense-tracker/shared';
import { base64Bytes } from '../../../../packages/workspace-data/src/chunks';
export async function fixtureWorkspace(receiptSize = 18): Promise<WorkspaceSnapshot> {
  const timestamp = 1700000000000;
  const tables = Object.fromEntries(Object.entries(WORKSPACE_TABLES).map(([table, columns]) => {
    const row: DataRow = {};
    for (const [field, column] of Object.entries(columns)) row[field] = column.nullable ? null : column.type === 'text' ? `${table}-${field}` : field.endsWith('_at') || ['date','expense_date','start_date','end_date','next_due'].includes(field) ? timestamp : 1;
    if ('id' in row) row.id = `${table}-1`;
    if ('amount' in row) row.amount = 12345;
    if ('payment_method' in row) row.payment_method = 'UPI';
    if ('day_of_month' in row) row.day_of_month = 15;
    return [table, [row]];
  })) as WorkspaceSnapshot['tables'];
  const row = (table: WorkspaceTable) => tables[table][0];
  for (const rows of Object.values(tables)) for (const value of rows) {
    if ('employee_id' in value) value.employee_id = row('employee_details').id;
    if ('category_id' in value) value.category_id = row('categories').id;
    if ('group_id' in value) value.group_id = row('split_groups').id;
  }
  row('personal_expenses').description = 'Lunch ₹😀';
  row('personal_expenses').subcategory_id = row('subcategories').id;
  row('investment_plans').frequency = 'monthly'; row('investment_plans').active = 1;
  row('investment_contributions').plan_id = row('investment_plans').id;
  row('investment_contributions').due_at = timestamp; row('investment_contributions').invested_at = timestamp;
  row('vehicles').kind = 'bike'; row('fuel_refills').vehicle_id = row('vehicles').id;
  row('fuel_refills').expense_id = row('personal_expenses').id; row('fuel_refills').amount = row('personal_expenses').amount;
  row('split_expenses').paid_by_person_id = row('split_people').id;
  tables.app_preferences = [{ key: 'monthly_budget_paise', value: '100000' }];
  const file = new Uint8Array(Math.max(receiptSize, 18)); file.set(new TextEncoder().encode('%PDF-1.4\n%%EOF'));
  row('company_expense_attachments').expense_type = 'hotel'; row('company_expense_attachments').expense_id = row('hotel').id;
  row('company_expense_attachments').file_name = 'receipt.pdf'; row('company_expense_attachments').mime_type = 'application/pdf';
  row('company_expense_attachments').size_bytes = file.length; row('company_expense_attachments').content_base64 = base64Bytes(file);
  row('company_expense_attachments').sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', file)), (value) => value.toString(16).padStart(2, '0')).join('');
  row('company_expense_attachments').unavailable_reason = null;
  return { version: 2, schemaVersion: 13, deviceId: crypto.randomUUID(), tables };
}
