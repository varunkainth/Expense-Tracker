import { z } from 'zod';
import { WORKSPACE_TABLES, MAX_TABLE_ROWS, MAX_WORKSPACE_RECORDS, preferenceAllowed, type WorkspaceTable, type DataRow } from '../../../../../packages/workspace-data/src/tables';
export { WORKSPACE_TABLES, preferenceAllowed };
export type { WorkspaceTable, DataRow };
export * from '../../../../../packages/workspace-data/src/chunks';
export { MAX_WORKSPACE_BYTES, CHUNK_BYTES } from '../../../../../packages/workspace-data/src/tables';
const money = new Set(['amount','fare','rate_per_day','food_amount','travel_allowance','food_allowance','total_amount']);
const dates = new Set(['date','expense_date','start_date','end_date','next_due','due_at','invested_at','created_at','updated_at','departure_time','arrival_time']);
const tableSchemas: Record<string, z.ZodType> = {};
for (const [table, columns] of Object.entries(WORKSPACE_TABLES)) {
  const shape: Record<string, z.ZodType> = {};
  for (const [column, field] of Object.entries(columns)) {
    let schema: z.ZodType = field.type === 'text' ? z.string().max(100000) : field.type === 'real' ? z.number().finite() : z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
    if (column === 'id' || column === 'key') schema = z.string().min(1).max(200);
    if (money.has(column)) schema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
    if (dates.has(column)) schema = z.number().int().positive().max(8_640_000_000_000_000);
    shape[column] = field.nullable ? schema.nullable() : schema;
  }
  if (table === 'company_expense_attachments') {
    shape.mime_type = z.enum(['image/jpeg', 'application/pdf']);
    shape.content_base64 = z.string().max(12_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/).nullable();
    shape.sha256 = z.string().regex(/^[0-9a-f]{64}$/).nullable();
    shape.unavailable_reason = z.enum(['missing', 'too_large']).nullable();
  }
  tableSchemas[table] = z.array(z.object(shape).strict()).max(MAX_TABLE_ROWS);
}
const rawSchema = z.object({ version: z.literal(2), schemaVersion: z.literal(13), deviceId: z.string().uuid(), tables: z.object(tableSchemas).strict() }).strict();
export interface WorkspaceSnapshot { version: 2; schemaVersion: 13; deviceId: string; tables: Record<WorkspaceTable, DataRow[]> }
export function parseWorkspaceSnapshot(value: unknown): WorkspaceSnapshot {
  const parsed = rawSchema.parse(value) as unknown as WorkspaceSnapshot;
  const tables = parsed.tables;
  const maps = new Map<WorkspaceTable, Map<string, DataRow>>();
  let count = 0;
  for (const table of Object.keys(WORKSPACE_TABLES) as WorkspaceTable[]) {
    const rows = tables[table], map = new Map<string, DataRow>();
    for (const row of rows) {
      const id = String(table === 'app_preferences' ? row.key : row.id);
      if (map.has(id)) throw new Error(`Duplicate identifier in ${table}.`);
      map.set(id, row);
      if (table === 'app_preferences') {
        const key = String(row.key), value = String(row.value);
        if (!preferenceAllowed(key)) throw new Error('Unsupported phone preference.');
        if ((key === 'monthly_budget_paise' || key.startsWith('category_budget_paise:')) && (!Number.isSafeInteger(Number(value)) || Number(value) <= 0)) throw new Error('Invalid budget preference.');
        if (key.endsWith('.enabled') && !['true','false'].includes(value)) throw new Error('Invalid reminder setting.');
        if (key === 'reminder.time' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid reminder time.');
        if (key === '@payment_app_appearance' && !['light','dark','system'].includes(value)) throw new Error('Invalid appearance setting.');
        if (key === '@payment_app_daily_allowance_rates') {
          const rates = JSON.parse(value);
          if (!['TRAVEL_ALLOWANCE_PAISE','FOOD_ALLOWANCE_PAISE','TOTAL_ALLOWANCE_PAISE'].every((field) => Number.isSafeInteger(rates?.[field]) && rates[field] > 0) || rates.TOTAL_ALLOWANCE_PAISE !== rates.TRAVEL_ALLOWANCE_PAISE + rates.FOOD_ALLOWANCE_PAISE) throw new Error('Invalid allowance rates.');
        }
      }
      if (table === 'investment_plans' && (!['monthly','one_time'].includes(String(row.frequency)) || ![0,1].includes(Number(row.active)))) throw new Error('Invalid investment schedule.');
      if ('payment_method' in row && !['Cash','UPI','Card','ATM','Bank transfer','Other'].includes(String(row.payment_method))) throw new Error('Invalid payment method.');
      if (['recurring_expenses','subscriptions','investment_plans'].includes(table) && (!Number.isInteger(row.day_of_month) || Number(row.day_of_month) < 1 || Number(row.day_of_month) > 31)) throw new Error('Invalid schedule.');
      if (table === 'vehicles' && !['bike','car','scooty'].includes(String(row.kind))) throw new Error('Invalid vehicle kind.');
      if (table === 'fuel_refills' && (Number(row.litres) <= 0 || Number(row.odometer) < 0)) throw new Error('Invalid fuel measurements.');
    }
    count += rows.length; maps.set(table, map);
  }
  if (count > MAX_WORKSPACE_RECORDS) throw new Error('Too many records in workspace.');
  const requireRow = (table: WorkspaceTable, id: unknown) => {
    const row = maps.get(table)?.get(String(id));
    if (!row) throw new Error(`Missing related ${table} record.`);
    return row;
  };
  const linkedExpenses = new Set<string>();
  for (const table of Object.keys(WORKSPACE_TABLES) as WorkspaceTable[]) for (const row of tables[table]) {
    if (table === 'app_preferences' && String(row.key).startsWith('category_budget_paise:')) requireRow('categories', String(row.key).slice('category_budget_paise:'.length));
    if (row.employee_id != null) requireRow('employee_details', row.employee_id);
    if (row.category_id != null) requireRow('categories', row.category_id);
    if (row.subcategory_id != null && requireRow('subcategories', row.subcategory_id).category_id !== row.category_id) throw new Error('Subcategory belongs to a different category.');
    if (row.group_id != null) requireRow('split_groups', row.group_id);
    if (table === 'split_expenses' && requireRow('split_people', row.paid_by_person_id).group_id !== row.group_id) throw new Error('Payer belongs to a different group.');
    if (table === 'investment_contributions') requireRow('investment_plans', row.plan_id);
    if (table === 'fuel_refills') {
      requireRow('vehicles', row.vehicle_id);
      if (row.expense_id != null) {
        const expense = requireRow('personal_expenses', row.expense_id);
        if (linkedExpenses.has(String(row.expense_id)) || expense.amount !== row.amount || expense.expense_date !== row.expense_date || expense.payment_method !== row.payment_method) throw new Error('Fuel refill and personal expense do not match.');
        linkedExpenses.add(String(row.expense_id));
      }
    }
    if (table === 'company_expense_attachments') {
      if (!['outstation_conveyance','hotel','tour_conveyance','miscellaneous_expense'].includes(String(row.expense_type))) throw new Error('Invalid receipt parent.');
      requireRow(row.expense_type as WorkspaceTable, row.expense_id);
      if (row.content_base64 !== null) {
        const content = String(row.content_base64);
        const size = content.length * 3 / 4 - (content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0);
        if (content.length % 4 || size !== row.size_bytes || !row.sha256 || row.unavailable_reason !== null) throw new Error('Invalid receipt content.');
      } else if (!row.unavailable_reason || row.sha256 !== null) throw new Error('Missing receipt availability information.');
    }
  }
  return parsed;
}
export function workspaceSummary(snapshot: WorkspaceSnapshot) {
  const companyTables: WorkspaceTable[] = ['local_conveyance','outstation_conveyance','hotel','tour_conveyance','phone_expense','miscellaneous_expense','daily_allowance'];
  return { personal: snapshot.tables.personal_expenses.length, company: companyTables.reduce((sum, key) => sum + snapshot.tables[key].length, 0), records: Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0), attachments: snapshot.tables.company_expense_attachments.length };
}
