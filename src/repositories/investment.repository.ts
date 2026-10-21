import { getDatabase } from '../database/client';
import { nextMonthlyDate } from '../utils/recurring';
import { generateUUID } from '../utils/uuid';

export interface InvestmentPlan {
  id: string;
  name: string;
  amount: number;
  day_of_month: number;
  next_due: number;
  active: number;
  created_at: number;
  total_invested: number;
  contribution_count: number;
  frequency: 'monthly' | 'one_time';
}

export interface InvestmentContribution {
  id: string;
  plan_id: string;
  amount: number;
  due_at: number;
  invested_at: number;
  created_at: number;
}

function validatePlan(name: string, amount: number, dayOfMonth: number): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 100) throw new Error('Enter a fund or investment name (up to 100 characters).');
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a valid investment amount.');
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) throw new Error('Choose a day from 1 to 31.');
  return trimmed;
}

function upcomingDueDate(dayOfMonth: number, now: number): number {
  const today = new Date(now);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), Math.min(dayOfMonth, lastDay)).getTime();
  return thisMonth >= midnight ? thisMonth : nextMonthlyDate(thisMonth, dayOfMonth);
}

export async function listInvestmentPlans(): Promise<InvestmentPlan[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestmentPlan>(`SELECT p.*,
    COALESCE(SUM(c.amount), 0) AS total_invested,
    COUNT(c.id) AS contribution_count
    FROM investment_plans p LEFT JOIN investment_contributions c ON c.plan_id = p.id
    GROUP BY p.id ORDER BY p.active DESC, p.next_due ASC, p.name COLLATE NOCASE ASC;`);
}

export async function getInvestmentPlan(id: string): Promise<InvestmentPlan | null> {
  const plans = await listInvestmentPlans();
  return plans.find((plan) => plan.id === id) ?? null;
}

export async function listInvestmentContributions(planId: string): Promise<InvestmentContribution[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestmentContribution>(
    'SELECT * FROM investment_contributions WHERE plan_id = ? ORDER BY invested_at DESC, created_at DESC;', [planId],
  );
}

export async function listInvestmentContributionsInRange(startDate: number, endDate: number): Promise<InvestmentContribution[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestmentContribution>(
    'SELECT * FROM investment_contributions WHERE invested_at >= ? AND invested_at <= ? ORDER BY invested_at DESC;',
    [startDate, endDate],
  );
}

export async function getInvestmentContribution(id: string): Promise<InvestmentContribution | null> {
  const db = await getDatabase();
  return db.getFirstAsync<InvestmentContribution>('SELECT * FROM investment_contributions WHERE id = ?;', [id]);
}

function validateContribution(amount: number, investedAt: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a valid investment amount.');
  if (!Number.isSafeInteger(investedAt) || investedAt <= 0 || investedAt > Date.now()) throw new Error('Choose today or an earlier payment date.');
}

export async function updateInvestmentContribution(id: string, amount: number, investedAt: number, oneTimeName?: string): Promise<void> {
  validateContribution(amount, investedAt);
  const cleanName = oneTimeName?.trim().replace(/\s+/g, ' ');
  if (oneTimeName !== undefined && (!cleanName || cleanName.length > 100)) throw new Error('Enter an investment name (up to 100 characters).');
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const contribution = await tx.getFirstAsync<InvestmentContribution>('SELECT * FROM investment_contributions WHERE id = ?;', [id]);
    if (!contribution) throw new Error('This investment entry no longer exists.');
    const plan = await tx.getFirstAsync<InvestmentPlan>('SELECT * FROM investment_plans WHERE id = ?;', [contribution.plan_id]);
    await tx.runAsync('UPDATE investment_contributions SET amount = ?, invested_at = ?, due_at = ? WHERE id = ?;',
      [amount, investedAt, plan?.frequency === 'one_time' ? investedAt : contribution.due_at, id]);
    if (plan?.frequency === 'one_time') {
      await tx.runAsync('UPDATE investment_plans SET name = ?, amount = ?, next_due = ?, day_of_month = ? WHERE id = ?;',
        [cleanName ?? plan.name, amount, investedAt, new Date(investedAt).getDate(), contribution.plan_id]);
    }
  });
}

export async function deleteInvestmentContribution(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const contribution = await tx.getFirstAsync<InvestmentContribution>('SELECT * FROM investment_contributions WHERE id = ?;', [id]);
    if (!contribution) throw new Error('This investment entry no longer exists.');
    const plan = await tx.getFirstAsync<InvestmentPlan>('SELECT * FROM investment_plans WHERE id = ?;', [contribution.plan_id]);
    if (plan?.frequency === 'one_time') {
      await tx.runAsync('DELETE FROM investment_plans WHERE id = ?;', [contribution.plan_id]);
    } else {
      await tx.runAsync('DELETE FROM investment_contributions WHERE id = ?;', [id]);
    }
  });
}

export async function createOneTimeInvestment(name: string, amount: number, investedAt: number): Promise<string> {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  if (!cleanName || cleanName.length > 100) throw new Error('Enter an investment name (up to 100 characters).');
  validateContribution(amount, investedAt);
  const id = generateUUID();
  const now = Date.now();
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(`INSERT INTO investment_plans
      (id, name, amount, day_of_month, next_due, active, created_at, frequency)
      VALUES (?, ?, ?, ?, ?, 0, ?, 'one_time');`,
    [id, cleanName, amount, new Date(investedAt).getDate(), investedAt, now]);
    await tx.runAsync(`INSERT INTO investment_contributions
      (id, plan_id, amount, due_at, invested_at, created_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [generateUUID(), id, amount, investedAt, investedAt, now]);
  });
  return id;
}

export async function getInvestmentContributionsTotal(startDate: number, endDate: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM investment_contributions WHERE invested_at >= ? AND invested_at <= ?;',
    [startDate, endDate],
  );
  return row?.total ?? 0;
}

export async function createInvestmentPlan(name: string, amount: number, dayOfMonth: number): Promise<string> {
  const cleanName = validatePlan(name, amount, dayOfMonth);
  const now = Date.now();
  const id = generateUUID();
  const db = await getDatabase();
  await db.runAsync(`INSERT INTO investment_plans
    (id, name, amount, day_of_month, next_due, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?);`,
  [id, cleanName, amount, dayOfMonth, upcomingDueDate(dayOfMonth, now), now]);
  return id;
}

export async function updateInvestmentPlan(id: string, name: string, amount: number, dayOfMonth: number): Promise<void> {
  const cleanName = validatePlan(name, amount, dayOfMonth);
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<InvestmentPlan>('SELECT * FROM investment_plans WHERE id = ?;', [id]);
    if (!current) throw new Error('Investment plan not found.');
    let nextDue = dayOfMonth === current.day_of_month ? current.next_due : upcomingDueDate(dayOfMonth, Date.now());
    const latest = await tx.getFirstAsync<{ due_at: number | null }>('SELECT MAX(due_at) AS due_at FROM investment_contributions WHERE plan_id = ?;', [id]);
    while (latest?.due_at != null && nextDue <= latest.due_at) nextDue = nextMonthlyDate(nextDue, dayOfMonth);
    await tx.runAsync('UPDATE investment_plans SET name = ?, amount = ?, day_of_month = ?, next_due = ? WHERE id = ?;',
      [cleanName, amount, dayOfMonth, nextDue, id]);
  });
}

export async function setInvestmentPlanActive(id: string, active: boolean): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<InvestmentPlan>('SELECT * FROM investment_plans WHERE id = ?;', [id]);
    if (!current) throw new Error('Investment plan not found.');
    let nextDue = active ? upcomingDueDate(current.day_of_month, Date.now()) : current.next_due;
    if (active) {
      const latest = await tx.getFirstAsync<{ due_at: number | null }>('SELECT MAX(due_at) AS due_at FROM investment_contributions WHERE plan_id = ?;', [id]);
      while (latest?.due_at != null && nextDue <= latest.due_at) nextDue = nextMonthlyDate(nextDue, current.day_of_month);
    }
    await tx.runAsync('UPDATE investment_plans SET active = ?, next_due = ? WHERE id = ?;',
      [active ? 1 : 0, nextDue, id]);
  });
}

export async function recordInvestmentContribution(planId: string, amount: number, investedAt = Date.now()): Promise<void> {
  validateContribution(amount, investedAt);
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const plan = await tx.getFirstAsync<InvestmentPlan>('SELECT * FROM investment_plans WHERE id = ?;', [planId]);
    if (!plan || !plan.active || plan.frequency === 'one_time') throw new Error('This SIP plan is paused or unavailable.');
    const now = Date.now();
    await tx.runAsync(`INSERT INTO investment_contributions
      (id, plan_id, amount, due_at, invested_at, created_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [generateUUID(), planId, amount, plan.next_due, investedAt, now]);
    await tx.runAsync('UPDATE investment_plans SET next_due = ? WHERE id = ?;',
      [nextMonthlyDate(plan.next_due, plan.day_of_month), planId]);
  });
}

export async function skipInvestmentMonth(planId: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const plan = await tx.getFirstAsync<InvestmentPlan>('SELECT * FROM investment_plans WHERE id = ?;', [planId]);
    if (!plan || !plan.active) throw new Error('This investment plan is paused or unavailable.');
    await tx.runAsync('UPDATE investment_plans SET next_due = ? WHERE id = ?;',
      [nextMonthlyDate(plan.next_due, plan.day_of_month), planId]);
  });
}
