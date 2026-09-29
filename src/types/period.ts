
/**
 * A calendar month, or "all time" when year/month are null.
 * monthIndex is 0-based (0 = January) to match JS Date.
 */
export type MonthPeriod =
  | { kind: 'month'; year: number; monthIndex: number }
  | { kind: 'all' };

/** Inclusive start, exclusive end — both epoch ms in device-local time. */
export interface PeriodRange {
  start: number | null; // null = no lower bound
  end: number | null;   // null = no upper bound (exclusive)
}

export function getPeriodRange(period: MonthPeriod): PeriodRange {
  if (period.kind === 'all') return { start: null, end: null };
  const { year, monthIndex } = period;
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime();
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0).getTime();
  return { start, end };
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export function formatPeriodLabel(period: MonthPeriod): string {
  if (period.kind === 'all') return 'All time';
  return `${MONTH_NAMES[period.monthIndex]} ${period.year}`;
}

/** e.g. "01/09/26 – 30/09/26" for headers. */
export function formatPeriodRange(period: MonthPeriod): string {
  if (period.kind === 'all') return 'All time';
  const { year, monthIndex } = period;
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  return `${fmt(first)} – ${fmt(last)}`;
}

/** Builds the list shown in the picker: current month back N months. */
export function buildMonthOptions(countBack = 17): MonthPeriod[] {
  const now = new Date();
  const options: MonthPeriod[] = [];
  for (let i = 0; i < countBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ kind: 'month', year: d.getFullYear(), monthIndex: d.getMonth() });
  }
  return options;
}