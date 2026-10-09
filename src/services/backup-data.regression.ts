import {
  BackupData,
  BackupStatus,
  isBackupOverdue,
  summarizeBackupData,
  upgradeBackupData,
  validateBackupAttachment,
} from './backup-data';
import {
  doesExpenseRangeOverlapPeriod,
  isDateInExpensePeriod,
} from '../utils/company-expense-period';
import { MonthPeriod } from '../types/period';
import { calculateSettlements } from '../utils/split-settlement';

function emptyBackupData(): BackupData {
  return {
    categories: [],
    subcategories: [],
    personal_expenses: [],
    split_groups: [],
    split_people: [],
    split_expenses: [],
    employee_details: [],
    local_conveyance: [],
    outstation_conveyance: [],
    hotel: [],
    tour_conveyance: [],
    phone_expense: [],
    miscellaneous_expense: [],
    daily_allowance: [],
    company_expense_attachments: [],
  };
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  assert(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function expectThrows(action: () => unknown, pattern: RegExp, message: string): void {
  try {
    action();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    assert(pattern.test(errorMessage), `${message}: unexpected error: ${errorMessage}`);
    return;
  }
  throw new Error(`${message}: expected an error`);
}

const cases: [string, () => void][] = [
  ['V1 schema upgrade adds current fields and attachment collection', () => {
    const data = {
      ...emptyBackupData(),
      employee_details: [{ id: 'employee-1', name: 'Example' }],
      daily_allowance: [{ id: 'da-1', date: 1234 }],
      outstation_conveyance: [{ id: 'out-1' }],
      hotel: [{ id: 'hotel-1' }],
      tour_conveyance: [{ id: 'tour-1' }],
      phone_expense: [{ id: 'phone-1' }],
      miscellaneous_expense: [{ id: 'misc-1' }],
    };

    const upgraded = upgradeBackupData(data, 1);
    const daily = upgraded.daily_allowance[0] as Record<string, unknown>;
    const employee = upgraded.employee_details[0] as Record<string, unknown>;
    equal(daily.no_of_days, 1, 'V1 allowance day count');
    equal(daily.start_date, 1234, 'V1 allowance start date');
    equal(daily.end_date, 1234, 'V1 allowance end date');
    equal(employee.mobile_no, null, 'V1 employee mobile number');
    equal(upgraded.company_expense_attachments.length, 0, 'V1 attachment collection');
    for (const table of [
      'outstation_conveyance', 'hotel', 'tour_conveyance', 'phone_expense', 'miscellaneous_expense',
    ] as const) {
      equal((upgraded[table][0] as Record<string, unknown>).complaint_no, '', `${table} complaint number`);
    }
  }],
  ['V5 rows preserve existing fields', () => {
    const data = {
      ...emptyBackupData(),
      employee_details: [{ id: 'employee-1', mobile_no: '9876543210' }],
      hotel: [{ id: 'hotel-1', complaint_no: '4402' }],
      company_expense_attachments: [{ id: 'attachment-1', size_bytes: 1 }],
    };
    const upgraded = upgradeBackupData(data, 5);
    equal((upgraded.employee_details[0] as Record<string, unknown>).mobile_no, '9876543210', 'V5 mobile number');
    equal((upgraded.hotel[0] as Record<string, unknown>).complaint_no, '4402', 'V5 complaint number');
    equal(upgraded.company_expense_attachments.length, 1, 'V5 attachment count');
  }],
  ['V5 personal expenses gain an empty optional subcategory field', () => {
    const upgraded = upgradeBackupData({
      ...emptyBackupData(),
      personal_expenses: [{ id: 'expense-1', category_id: 'category-1' }],
    }, 5);
    equal(upgraded.subcategories.length, 0, 'V5 subcategory collection');
    equal((upgraded.personal_expenses[0] as Record<string, unknown>).subcategory_id, null, 'V5 expense subcategory');
  }],
  ['V6 backups gain empty friend-split tables', () => {
    const upgraded = upgradeBackupData(emptyBackupData(), 6);
    equal(upgraded.split_groups.length, 0, 'V6 split groups');
    equal(upgraded.split_people.length, 0, 'V6 split people');
    equal(upgraded.split_expenses.length, 0, 'V6 split expenses');
  }],
  ['equal split calculates the minimum transfers in paise', () => {
    const people = [
      { id: 'u1', group_id: 'g', name: 'U1', created_at: 1, total_paid: 67600 },
      { id: 'u2', group_id: 'g', name: 'U2', created_at: 2, total_paid: 36400 },
    ];
    const expenses = [
      ...[330, 166, 150, 30].map((amount, index) => ({
        id: `e1-${index}`, group_id: 'g', description: null, amount: amount * 100,
        paid_by_person_id: 'u1', expense_date: index, created_at: index, payer_name: 'U1',
      })),
      ...[284, 80].map((amount, index) => ({
        id: `e2-${index}`, group_id: 'g', description: null, amount: amount * 100,
        paid_by_person_id: 'u2', expense_date: index, created_at: index, payer_name: 'U2',
      })),
    ];
    const settlement = calculateSettlements(people, expenses);
    equal(settlement.length, 1, 'transfer count');
    equal(settlement[0].from_name, 'U2', 'transfer payer');
    equal(settlement[0].to_name, 'U1', 'transfer receiver');
    equal(settlement[0].amount, 15600, 'transfer amount');
  }],
  ['settlement amounts round down and leave paise with the app owner', () => {
    const people = [
      { id: 'u1', group_id: 'g', name: 'U1', created_at: 1, total_paid: 3100 },
      { id: 'u2', group_id: 'g', name: 'U2', created_at: 2, total_paid: 0 },
    ];
    const settlements = calculateSettlements(people, [{
      id: 'e1', group_id: 'g', description: 'Shared', amount: 3100,
      paid_by_person_id: 'u1', expense_date: 1, created_at: 1, payer_name: 'U1',
    }]);
    equal(settlements.length, 1, 'rounded transfer count');
    equal(settlements[0].amount, 1500, '₹15.50 rounds down to ₹15');
  }],
  ['invalid V1 allowance rows are rejected', () => {
    const data = { ...emptyBackupData(), daily_allowance: [{ id: 'da-1' }] };
    expectThrows(() => upgradeBackupData(data, 1), /valid date/, 'V1 invalid date');
  }],
  ['valid attachment data matches its metadata size', () => {
    const result = validateBackupAttachment({
      id: 'attachment-1', expense_type: 'hotel', expense_id: 'hotel-1',
      file_name: 'receipt.pdf', mime_type: 'application/pdf',
      size_bytes: 1, created_at: 100, file_base64: 'YQ==',
    });
    equal(result.byteLength, 1, 'attachment byte length');
  }],
  ['malformed or truncated attachment data is rejected', () => {
    const base = {
      id: 'attachment-1', expense_type: 'hotel', expense_id: 'hotel-1',
      file_name: 'receipt.pdf', mime_type: 'application/pdf', size_bytes: 1, created_at: 100,
    };
    expectThrows(
      () => validateBackupAttachment({ ...base, file_base64: 'not base64!' }),
      /invalid/i,
      'malformed base64',
    );
    expectThrows(
      () => validateBackupAttachment({ ...base, size_bytes: 2, file_base64: 'YQ==' }),
      /integrity check/,
      'attachment size mismatch',
    );
  }],
  ['backup summary reports record and receipt counts/bytes', () => {
    const data = {
      ...emptyBackupData(),
      categories: [{ id: 'category-1' }],
      personal_expenses: [{ id: 'expense-1' }],
      company_expense_attachments: [
        { id: 'a1', size_bytes: 10 },
        { id: 'a2', size_bytes: 25 },
      ],
    };
    const summary = summarizeBackupData(data);
    equal(summary.recordCount, 2, 'record count');
    equal(summary.attachmentCount, 2, 'attachment count');
    equal(summary.attachmentBytes, 35, 'attachment bytes');
  }],
  ['backup reminder becomes due after 30 days', () => {
    const day = 24 * 60 * 60 * 1000;
    equal(isBackupOverdue(null, 100), true, 'missing backup status');
    const recent: BackupStatus = {
      createdAt: 10, recordCount: 1, attachmentCount: 0, attachmentBytes: 0,
    };
    equal(isBackupOverdue(recent, 10 + 29 * day), false, '29-day-old backup');
    equal(isBackupOverdue(recent, 10 + 30 * day), true, '30-day-old backup');
  }],
  ['monthly export filters include calendar boundaries and overlapping hotel stays', () => {
    const january: MonthPeriod = { kind: 'month', year: 2026, monthIndex: 0 };
    const start = new Date(2026, 0, 1).getTime();
    const end = new Date(2026, 1, 1).getTime();
    equal(isDateInExpensePeriod(start, january), true, 'month start included');
    equal(isDateInExpensePeriod(end - 1, january), true, 'last month instant included');
    equal(isDateInExpensePeriod(end, january), false, 'next month start excluded');
    equal(doesExpenseRangeOverlapPeriod(start - 1, start, january), true, 'stay ending on month start included');
    equal(doesExpenseRangeOverlapPeriod(end, end + 1, january), false, 'stay starting next month excluded');
  }],
];

for (const [name, run] of cases) {
  run();
  console.log(`PASS ${name}`);
}

console.log(`Passed ${cases.length} backup regression checks.`);
