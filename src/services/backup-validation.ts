import { BACKUP_TABLES, BackupData, BackupTableName } from './backup-data';

type Row = Record<string, unknown>;
const moneyFields = new Set(['amount', 'fare', 'rate_per_day', 'food_amount', 'travel_allowance', 'food_allowance', 'total_amount']);
const dateFields = new Set(['date', 'expense_date', 'start_date', 'end_date', 'created_at', 'updated_at', 'next_due', 'due_at', 'invested_at', 'departure_time', 'arrival_time']);

/** Check relations and numeric values before staging files or replacing data. SQL remains the final schema check. */
export function validateRestorableData(data: BackupData): void {
  const tables = new Map<BackupTableName, Map<string, Row>>();
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(data[table])) throw new Error(`Invalid backup table: ${table}.`);
    const records = new Map<string, Row>();
    for (const value of data[table]) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid row in ${table}.`);
      const row = value as Row;
      const id = table === 'app_preferences' ? row.key : row.id;
      if (typeof id !== 'string' || !id.trim() || records.has(id)) throw new Error(`Missing or duplicate identifier in ${table}.`);
      for (const [key, field] of Object.entries(row)) {
        if (moneyFields.has(key) && field !== null && (!Number.isSafeInteger(field) || (field as number) < 0)) {
          throw new Error(`Invalid money amount in ${table}.`);
        }
        if (dateFields.has(key) && field !== null && (!Number.isSafeInteger(field) || (field as number) <= 0 || Number.isNaN(new Date(field as number).getTime()))) {
          throw new Error(`Invalid date in ${table}.`);
        }
      }
      if (['recurring_expenses', 'subscriptions'].includes(table) && (!Number.isInteger(row.day_of_month) || (row.day_of_month as number) < 1 || (row.day_of_month as number) > 31 || !Number.isSafeInteger(row.next_due) || (row.next_due as number) <= 0 || !Number.isSafeInteger(row.amount) || (row.amount as number) <= 0)) {
        throw new Error(`Invalid ${table === 'subscriptions' ? 'subscription' : 'recurring expense'} schedule.`);
      }
      if (table === 'subscriptions' && (typeof row.name !== 'string' || !row.name.trim())) throw new Error('Invalid subscription name.');
      if (table === 'investment_plans' && (typeof row.name !== 'string' || !row.name.trim() || !Number.isInteger(row.day_of_month) || (row.day_of_month as number) < 1 || (row.day_of_month as number) > 31 || ![0, 1].includes(row.active as number) || !Number.isSafeInteger(row.amount) || (row.amount as number) <= 0 || !['monthly', 'one_time'].includes(row.frequency as string))) throw new Error('Invalid investment plan.');
      if (table === 'investment_contributions' && (!Number.isSafeInteger(row.amount) || (row.amount as number) <= 0)) throw new Error('Invalid investment contribution.');
      if (table === 'app_preferences') validatePreference(row);
      records.set(id, row);
    }
    tables.set(table, records);
  }
  const requireRow = (table: BackupTableName, id: unknown): Row => {
    const row = typeof id === 'string' ? tables.get(table)?.get(id) : undefined;
    if (!row) throw new Error(`Backup references a missing ${table} record.`);
    return row;
  };
  for (const [table, rows] of tables) {
    for (const row of rows.values()) {
      if ('employee_id' in row) requireRow('employee_details', row.employee_id);
      if ('category_id' in row) requireRow('categories', row.category_id);
      if (row.subcategory_id != null) {
        const sub = requireRow('subcategories', row.subcategory_id);
        if (sub.category_id !== row.category_id) throw new Error('Backup subcategory belongs to a different category.');
      }
      if ('group_id' in row) requireRow('split_groups', row.group_id);
      if (table === 'investment_contributions') requireRow('investment_plans', row.plan_id);
      if (table === 'split_expenses') {
        const payer = requireRow('split_people', row.paid_by_person_id);
        if (payer.group_id !== row.group_id) throw new Error('Backup payer belongs to a different group.');
      }
      if (table === 'company_expense_attachments') {
        const parent = row.expense_type as BackupTableName;
        if (!['hotel', 'outstation_conveyance', 'tour_conveyance', 'miscellaneous_expense'].includes(parent)) throw new Error('Invalid attachment category.');
        requireRow(parent, row.expense_id);
      }
    }
  }
}

function validatePreference(row: Row): void {
  if (typeof row.value !== 'string') throw new Error('Invalid backup preference.');
  if (row.key === '@payment_app_appearance') {
    if (!['light', 'dark', 'system'].includes(row.value)) throw new Error('Invalid appearance preference.');
  } else if (row.key === 'monthly_budget_paise') {
    const amount = Number(row.value);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid monthly budget.');
  } else if (typeof row.key === 'string' && row.key.startsWith('category_budget_paise:')) {
    if (!/^category_budget_paise:[0-9a-f-]{36}$/i.test(row.key)) throw new Error('Invalid category budget key.');
    const amount = Number(row.value);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid category budget.');
  } else if (['reminder.subscription.enabled', 'reminder.recurring.enabled', 'reminder.investment.enabled'].includes(String(row.key))) {
    if (!['true', 'false'].includes(row.value)) throw new Error('Invalid reminder preference.');
  } else if (row.key === 'reminder.time') {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.value)) throw new Error('Invalid reminder time.');
  } else if (row.key === '@payment_app_daily_allowance_rates') {
    const rates = JSON.parse(row.value);
    for (const key of ['TRAVEL_ALLOWANCE_PAISE', 'FOOD_ALLOWANCE_PAISE', 'TOTAL_ALLOWANCE_PAISE']) {
      if (!Number.isSafeInteger(rates?.[key]) || rates[key] <= 0) throw new Error('Invalid allowance rates.');
    }
    if (rates.TOTAL_ALLOWANCE_PAISE !== rates.TRAVEL_ALLOWANCE_PAISE + rates.FOOD_ALLOWANCE_PAISE) throw new Error('Invalid allowance total.');
  } else {
    throw new Error('Unsupported backup preference.');
  }
}
