import { getPeriodRange, MonthPeriod } from '../types/period';

export function isDateInExpensePeriod(timestamp: number, period: MonthPeriod): boolean {
  if (period.kind === 'all') return true;
  const { start, end } = getPeriodRange(period);
  return timestamp >= start! && timestamp < end!;
}

/** Expense ranges use inclusive start/end dates, so a stay overlaps a month
 * when its start is before the month's exclusive end and its end is on/after
 * the month's start. */
export function doesExpenseRangeOverlapPeriod(
  startDate: number,
  endDate: number,
  period: MonthPeriod,
): boolean {
  if (period.kind === 'all') return true;
  const { start, end } = getPeriodRange(period);
  return startDate < end! && endDate >= start!;
}
