import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx-js-style';
import { getDatabase } from '../database/client';
import { DAILY_ALLOWANCE_RATES, EmployeeDetails } from '../types/company';
import {
  MonthPeriod,
  formatPeriodLabel,
  formatPeriodRange,
  getPeriodRange,
} from '../types/period';

// ------------------------------------------------------------
// Data shapes read from the DB
// ------------------------------------------------------------
interface LocalConveyanceRow {
  id: string;
  date: number;
  particulars: string;
  mode: string;
  complaint_no: string;
  amount: number;
}

interface OutstationRow {
  id: string;
  date: number;
  from_location: string;
  departure_time: number | null;
  to_location: string;
  arrival_time: number | null;
  mode: string;
  complaint_no: string;
  amount: number;
}

interface TourRow {
  id: string;
  date: number;
  from_location: string;
  to_location: string;
  mode: string;
  complaint_no: string;
  fare: number;
}

interface PhoneRow {
  id: string;
  date: number;
  particulars: string;
  tel_fax_no: string;
  bill_no: string;
  complaint_no: string;
  amount: number;
}

interface MiscRow {
  id: string;
  date: number;
  particulars: string;
  bill_no: string;
  complaint_no: string;
  amount: number;
}

interface DailyAllowanceRow {
  id: string;
  no_of_days: number;
  start_date: number;
  end_date: number;
  travel_allowance: number;
  food_allowance: number;
  total_amount: number;
}

interface HotelRow {
  id: string;
  hotel_name: string;
  bill_no: string | null;
  complaint_no: string;
  start_date: number;
  end_date: number;
  no_of_days: number;
  rate_per_day: number;
  food_amount: number | null;
  amount: number;
}

interface ExportData {
  employee: EmployeeDetails;
  period: MonthPeriod;
  local: LocalConveyanceRow[];
  outstation: OutstationRow[];
  tour: TourRow[];
  phone: PhoneRow[];
  misc: MiscRow[];
  dailyAllowance: DailyAllowanceRow[];
  hotel: HotelRow[];
}

const MIN_BLANK_ROWS = 10;
const CURRENCY_FMT = '"₹"#,##0.00';

// ------------------------------------------------------------
// Load all data for the active employee, filtered by period
// ------------------------------------------------------------
async function loadExportData(
  employeeId: string,
  period: MonthPeriod
): Promise<ExportData> {
  const db = await getDatabase();
  const range = getPeriodRange(period);

  const [employee] = await db.getAllAsync<EmployeeDetails>(
    `SELECT id, name, employee_code, grade, department, location, created_at, updated_at
     FROM employee_details WHERE id = ?;`,
    [employeeId]
  );
  if (!employee) throw new Error('Employee not found.');

  // ---- Point-date tables (filter on `date`) ----
  const pointFilter =
    range.start != null && range.end != null
      ? 'AND date >= ? AND date < ?'
      : '';
  const pointArgs = (): (string | number)[] =>
    range.start != null && range.end != null
      ? [employeeId, range.start, range.end]
      : [employeeId];

  const local = await db.getAllAsync<LocalConveyanceRow>(
    `SELECT id, date, particulars, mode, complaint_no, amount
     FROM local_conveyance WHERE employee_id = ? ${pointFilter}
     ORDER BY date ASC;`,
    pointArgs()
  );

  const outstation = await db.getAllAsync<OutstationRow>(
    `SELECT id, date, from_location, departure_time, to_location, arrival_time, mode, complaint_no, amount
     FROM outstation_conveyance WHERE employee_id = ? ${pointFilter}
     ORDER BY date ASC;`,
    pointArgs()
  );

  const tour = await db.getAllAsync<TourRow>(
    `SELECT id, date, from_location, to_location, mode, complaint_no, fare
     FROM tour_conveyance WHERE employee_id = ? ${pointFilter}
     ORDER BY date ASC;`,
    pointArgs()
  );

  const phone = await db.getAllAsync<PhoneRow>(
    `SELECT id, date, particulars, tel_fax_no, bill_no, complaint_no, amount
     FROM phone_expense WHERE employee_id = ? ${pointFilter}
     ORDER BY date ASC;`,
    pointArgs()
  );

  const misc = await db.getAllAsync<MiscRow>(
    `SELECT id, date, particulars, bill_no, complaint_no, amount
     FROM miscellaneous_expense WHERE employee_id = ? ${pointFilter}
     ORDER BY date ASC;`,
    pointArgs()
  );

  // ---- Range-overlap tables (hotel, daily_allowance) ----
  // Include a row if its [start,end] window overlaps the requested month.
  const rangeFilter =
    range.start != null && range.end != null
      ? 'AND start_date < ? AND end_date >= ?'
      : '';
  const rangeArgs = (): (string | number)[] =>
    range.start != null && range.end != null
      ? [employeeId, range.end, range.start]
      : [employeeId];

  const dailyAllowance = await db.getAllAsync<DailyAllowanceRow>(
    `SELECT id, no_of_days, start_date, end_date, travel_allowance, food_allowance, total_amount
     FROM daily_allowance WHERE employee_id = ? ${rangeFilter}
     ORDER BY start_date ASC;`,
    rangeArgs()
  );

  const hotel = await db.getAllAsync<HotelRow>(
    `SELECT id, hotel_name, bill_no, complaint_no, start_date, end_date, no_of_days, rate_per_day, food_amount, amount
     FROM hotel WHERE employee_id = ? ${rangeFilter}
     ORDER BY start_date ASC;`,
    rangeArgs()
  );

  return {
    employee,
    period,
    local,
    outstation,
    tour,
    phone,
    misc,
    dailyAllowance,
    hotel,
  };
}

// ------------------------------------------------------------
// Formatters
// ------------------------------------------------------------
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateShort(ts: number): string {
  const d = new Date(ts);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function formatTimeShort(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function paiseToRupees(paise: number): number {
  return paise / 100;
}

function todayShort(): string {
  return formatDateShort(Date.now());
}

// ------------------------------------------------------------
// Style primitives
// ------------------------------------------------------------
const THIN_BORDER = { style: 'thin', color: { rgb: '000000' } } as const;

const BORDER_ALL = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

type CellStyle = {
  font?: { bold?: boolean; sz?: number };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'center' | 'top' | 'bottom';
    wrapText?: boolean;
  };
  border?: Partial<typeof BORDER_ALL>;
  fill?: { fgColor: { rgb: string } };
  numFmt?: string;
};

const STYLE_TITLE: CellStyle = {
  font: { bold: true, sz: 16 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const STYLE_SUBTITLE: CellStyle = {
  font: { bold: true, sz: 14 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const STYLE_SECTION: CellStyle = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  fill: { fgColor: { rgb: 'F2F2F2' } },
  border: BORDER_ALL,
};

const STYLE_HEADER: CellStyle = {
  font: { bold: true, sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
  fill: { fgColor: { rgb: 'D9E1F2' } },
};

const STYLE_CELL: CellStyle = {
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
};

const STYLE_CELL_CENTER: CellStyle = {
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
};

const STYLE_CELL_RIGHT: CellStyle = {
  alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
};

const STYLE_CELL_CURRENCY: CellStyle = {
  alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
  numFmt: CURRENCY_FMT,
};

const STYLE_TOTAL: CellStyle = {
  font: { bold: true, sz: 10 },
  alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
  numFmt: CURRENCY_FMT,
  fill: { fgColor: { rgb: 'FCE4D6' } },
};

const STYLE_TOTAL_LABEL: CellStyle = {
  font: { bold: true, sz: 10 },
  alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
  fill: { fgColor: { rgb: 'FCE4D6' } },
};

const STYLE_INFO_LABEL: CellStyle = {
  font: { bold: true, sz: 10 },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
};

const STYLE_INFO_VALUE: CellStyle = {
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: BORDER_ALL,
};

const STYLE_FOOTER_CENTER: CellStyle = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function setStyle(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  style: CellStyle
): void {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return;
  cell.s = { ...(cell.s || {}), ...style };
  if (style.numFmt) cell.z = style.numFmt;
}

function setRangeStyle(
  ws: XLSX.WorkSheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  style: CellStyle
): void {
  for (let R = r1; R <= r2; ++R) {
    for (let C = c1; C <= c2; ++C) {
      setStyle(ws, R, C, style);
    }
  }
}

function ensureCell(ws: XLSX.WorkSheet, r: number, c: number): void {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) {
    ws[addr] = { t: 's', v: '' };
  }
}

function ensureRange(
  ws: XLSX.WorkSheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number
): void {
  for (let R = r1; R <= r2; ++R) {
    for (let C = c1; C <= c2; ++C) {
      ensureCell(ws, R, C);
    }
  }
  const existing = ws['!ref'];
  if (!existing) return;
  const decoded = XLSX.utils.decode_range(existing);
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: {
      r: Math.max(decoded.e.r, r2),
      c: Math.max(decoded.e.c, c2),
    },
  });
}

function autoWidth(
  ws: XLSX.WorkSheet,
  minWidths: number[] = [],
  maxWidths: number[] = [],
  skipRows: Set<number> = new Set()
): void {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cols: { wch: number }[] = [];

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const minW = minWidths[C] ?? 8;
    const maxW = maxWidths[C] ?? 40;
    let maxLen = minW;

    for (let R = range.s.r; R <= range.e.r; ++R) {
      if (skipRows.has(R)) continue;

      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.v === '' || cell.v == null) continue;

      const isMergeAnchor = (ws['!merges'] || []).some(
        (m) => m.s.r === R && m.s.c === C && (m.e.c > C || m.e.r > R)
      );
      if (isMergeAnchor) continue;

      const text = String(cell.v);
      const lines = text.split('\n');
      const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
      maxLen = Math.max(maxLen, longest);
    }

    cols.push({ wch: Math.min(Math.max(maxLen + 2, minW), maxW) });
  }

  ws['!cols'] = cols;
}

function applyWrapText(ws: XLSX.WorkSheet): void {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      cell.s = {
        ...(cell.s || {}),
        alignment: {
          ...(cell.s?.alignment || {}),
          wrapText: true,
          vertical: 'center',
        },
      };
    }
  }
}

function outlineRange(
  ws: XLSX.WorkSheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number
): void {
  for (let C = c1; C <= c2; ++C) {
    setStyle(ws, r1, C, {
      border: {
        ...(ws[XLSX.utils.encode_cell({ r: r1, c: C })]?.s?.border || {}),
        top: THIN_BORDER,
      },
    });
    setStyle(ws, r2, C, {
      border: {
        ...(ws[XLSX.utils.encode_cell({ r: r2, c: C })]?.s?.border || {}),
        bottom: THIN_BORDER,
      },
    });
  }
  for (let R = r1; R <= r2; ++R) {
    setStyle(ws, R, c1, {
      border: {
        ...(ws[XLSX.utils.encode_cell({ r: R, c: c1 })]?.s?.border || {}),
        left: THIN_BORDER,
      },
    });
    setStyle(ws, R, c2, {
      border: {
        ...(ws[XLSX.utils.encode_cell({ r: R, c: c2 })]?.s?.border || {}),
        right: THIN_BORDER,
      },
    });
  }
}

function applyTotalRow(
  ws: XLSX.WorkSheet,
  rowIdx: number,
  totalCols: number,
  labelText: string
): void {
  if (totalCols > 2) {
    ws['!merges'] = [
      ...(ws['!merges'] || []),
      { s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 2 } },
    ];
  }
  setRangeStyle(ws, rowIdx, 0, rowIdx, totalCols - 2, STYLE_TOTAL_LABEL);
  setStyle(ws, rowIdx, totalCols - 1, STYLE_TOTAL);
  outlineRange(ws, rowIdx, 0, rowIdx, totalCols - 1);
}

// ------------------------------------------------------------
// Sheet 1: LOCAL CON  (Rate column removed → 5 cols A–E)
// ------------------------------------------------------------
function buildLocalConSheet(data: ExportData): XLSX.WorkSheet {
  const { employee, local, period } = data;
  const COLS = 5;

  const rows: (string | number)[][] = [];

  rows.push(['UNICORN DENMART LTD']);
  rows.push([]);
  rows.push(['Conveyance Claim Form']);
  rows.push([]);

  const boxTop = rows.length;
  rows.push(['Location', employee.location, '', 'Dt of Submission:', todayShort()]);
  rows.push(['Name', employee.name, '', 'Voucher No :', '']);
  rows.push(['Grade', employee.grade, '', 'Emp. Code :', employee.employee_code]);
  rows.push(['', '', '', 'Deptt. :', employee.department]);
  // rows.push(['', '', '', 'Period :', formatPeriodRange(period)]);
  const boxBottom = rows.length - 1;

  rows.push([]);

  const headerRowIdx = rows.length;
  rows.push(['Date', 'Particulars', 'mode', 'Complaint No', 'Amount']);

  const dataStart = rows.length;
  for (const r of local) {
    rows.push([
      formatDateShort(r.date),
      r.particulars,
      r.mode,
      r.complaint_no,
      paiseToRupees(r.amount),
    ]);
  }

  const blanks = Math.max(MIN_BLANK_ROWS - local.length, 0);
  for (let i = 0; i < blanks; ++i) rows.push(['', '', '', '', '']);
  const tableEnd = rows.length - 1;

  const localTotal = local.reduce((s, r) => s + r.amount, 0);
  const totalRowIdx = rows.length;
  rows.push(['', '', '', 'Total', paiseToRupees(localTotal)]);

  const sigRowIdx = rows.length + 1;
  rows.push([]);
  rows.push(["Claimant's Signature", '', '', "Manager's Signature", '']);
  rows.push([]);
  const accountsRowIdx = rows.length;
  rows.push(['For Accounts use only']);
  const receverRowIdx = rows.length;
  rows.push(['Accounts', '', '', "Recever's signature", '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ensureRange(ws, boxTop, 0, boxBottom, COLS - 1);
  ensureRange(ws, headerRowIdx, 0, tableEnd, COLS - 1);
  ensureRange(ws, totalRowIdx, 0, totalRowIdx, COLS - 1);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
    { s: { r: accountsRowIdx, c: 0 }, e: { r: accountsRowIdx, c: COLS - 1 } },
    { s: { r: receverRowIdx, c: 3 }, e: { r: receverRowIdx, c: COLS - 1 } },
  ];

  setRangeStyle(ws, 0, 0, 0, COLS - 1, STYLE_TITLE);
  setRangeStyle(ws, 2, 0, 2, COLS - 1, STYLE_SUBTITLE);

  for (let R = boxTop; R <= boxBottom; ++R) {
    setStyle(ws, R, 0, STYLE_INFO_LABEL);
    setStyle(ws, R, 1, STYLE_INFO_VALUE);
    setStyle(ws, R, 2, STYLE_INFO_VALUE);
    setStyle(ws, R, 3, STYLE_INFO_LABEL);
    setStyle(ws, R, 4, STYLE_INFO_VALUE);
  }
  outlineRange(ws, boxTop, 0, boxBottom, COLS - 1);

  setRangeStyle(ws, headerRowIdx, 0, headerRowIdx, COLS - 1, STYLE_HEADER);

  for (let R = dataStart; R <= tableEnd; ++R) {
    setStyle(ws, R, 0, STYLE_CELL_CENTER);
    setStyle(ws, R, 1, STYLE_CELL);
    setStyle(ws, R, 2, STYLE_CELL_CENTER);
    setStyle(ws, R, 3, STYLE_CELL_CENTER);
    setStyle(ws, R, 4, STYLE_CELL_CURRENCY);
  }
  outlineRange(ws, headerRowIdx, 0, tableEnd, COLS - 1);

  applyTotalRow(ws, totalRowIdx, COLS, 'Total');

  setStyle(ws, sigRowIdx, 0, {
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  setStyle(ws, sigRowIdx, 3, {
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  setRangeStyle(ws, accountsRowIdx, 0, accountsRowIdx, COLS - 1, STYLE_FOOTER_CENTER);
  setStyle(ws, receverRowIdx, 0, {
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  setRangeStyle(ws, receverRowIdx, 3, receverRowIdx, COLS - 1, {
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
  });

  applyWrapText(ws);
  autoWidth(
    ws,
    [12, 26, 8, 16, 12],
    [22, 40, 12, 22, 18],
    new Set([sigRowIdx, accountsRowIdx, receverRowIdx])
  );

  return ws;
}

// ------------------------------------------------------------
// Sheet 2: OUTSTAION
// ------------------------------------------------------------
function buildOutstationSheet(data: ExportData): XLSX.WorkSheet {
  const {
    employee,
    outstation,
    tour,
    phone,
    misc,
    dailyAllowance,
    hotel,
    period,
  } = data;
  const COLS = 8;

  const rows: (string | number)[][] = [];

  rows.push(['UNICORN DENMART LTD.']);
  rows.push([]);
  rows.push(['Outstation Tour Expenses']);
  rows.push([]);

  const boxTop = rows.length;
  rows.push(['Location :', employee.location, '', 'Dt of Submission:', todayShort(), '', '', '']);
  rows.push(['Name :', employee.name, '', 'Voucher No :', '', '', '', '']);
  rows.push(['Grade :', employee.grade, '', 'Emp. Code :', employee.employee_code, '', '', '']);
  rows.push(['', '', '', 'Deptt. :', employee.department, '', '', '']);
  rows.push(['', '', '', 'Period :', formatPeriodRange(period), '', '', '']);
  const boxBottom = rows.length - 1;

  rows.push([]);

  const sectionTitleIdx = rows.length;
  rows.push(['Details of Outstation Travel']);

  const travelHeaderIdx = rows.length;
  rows.push(['Date', 'From', 'Dep. Time', 'Complaint No', 'To', 'Arr. Time', 'Mode', 'Amount']);

  const travelDataStart = rows.length;
  const totalA = outstation.reduce((sum, r) => sum + r.amount, 0);
  for (const r of outstation) {
    rows.push([
      formatDateShort(r.date),
      r.from_location,
      formatTimeShort(r.departure_time),
      r.complaint_no,
      r.to_location,
      formatTimeShort(r.arrival_time),
      r.mode,
      paiseToRupees(r.amount),
    ]);
  }
  const travelBlanks = Math.max(MIN_BLANK_ROWS - outstation.length, 0);
  for (let i = 0; i < travelBlanks; ++i)
    rows.push(['', '', '', '', '', '', '', '']);
  const travelDataEnd = rows.length - 1;

  const travelTotalRowIdx = rows.length;
  rows.push(['', '', '', '', '', '', 'Total', paiseToRupees(totalA)]);

  const totalB = tour.reduce((sum, r) => sum + r.fare, 0);
  const totalC = phone.reduce((sum, r) => sum + r.amount, 0);
  const totalD = misc.reduce((sum, r) => sum + r.amount, 0);
  const totalE = dailyAllowance.reduce((sum, r) => sum + r.total_amount, 0);
  const totalF = hotel.reduce((sum, r) => sum + r.amount, 0);

  const summaryStart = rows.length;
  rows.push(['TOTAL TRAVELLING EXP (A)', '', '', '', '', '', '', paiseToRupees(totalA)]);
  rows.push(['Local travel related expenses  (details Attached) (B)', '', '', '', '', '', '', paiseToRupees(totalB)]);
  rows.push(['Miscellaneous Expeses : Phone, Fax, etc. (detail Attached)  C', '', '', '', '', '', '', paiseToRupees(totalC)]);
  rows.push(['OTHER EXP.   (D)', '', '', '', '', '', '', paiseToRupees(totalD)]);
  const summaryEnd = rows.length - 1;

  const dailyHeaderIdx = rows.length;
  rows.push(['Outstaion allowance (E)', '', 'NO. OF DAY', '', 'DATE', '', '', '']);

  const dailyStart = rows.length;
  for (const r of dailyAllowance) {
    const range =
      r.start_date === r.end_date
        ? formatDateShort(r.start_date)
        : `${formatDateShort(r.start_date)} - ${formatDateShort(r.end_date)}`;

    const foodUnitRate = r.no_of_days > 0 ? r.food_allowance / r.no_of_days : DAILY_ALLOWANCE_RATES.FOOD_ALLOWANCE_PAISE;
    const travelUnitRate = r.no_of_days > 0 ? r.travel_allowance / r.no_of_days : DAILY_ALLOWANCE_RATES.TRAVEL_ALLOWANCE_PAISE;

    rows.push([
      'Food',
      paiseToRupees(foodUnitRate),
      r.no_of_days,
      '',
      range,
      '',
      '',
      paiseToRupees(r.food_allowance),
    ]);
    rows.push([
      'Travel',
      paiseToRupees(travelUnitRate),
      r.no_of_days,
      '',
      range,
      '',
      '',
      paiseToRupees(r.travel_allowance),
    ]);

  }
  const dailyBlanks = Math.max(MIN_BLANK_ROWS - dailyAllowance.length * 2, 0);
  for (let i = 0; i < dailyBlanks; ++i)
    rows.push(['', '', '', '', '', '', '', '']);
  const dailyEnd = rows.length - 1;

  const dailyTotalRowIdx = rows.length;
  rows.push(['', '', '', '', '', '', 'Total', paiseToRupees(totalE)]);

  const hotelHeaderIdx = rows.length;
  rows.push(['Hotel bills (F)', 'COMPLAINT NO', 'B.NO', 'DATE', 'NO. OF NIGHTS', 'RATE PER NIGHT', 'FOODS', 'AMOUNT']);

  const hotelStart = rows.length;
  for (const r of hotel) {
    rows.push([
      r.hotel_name,
      r.complaint_no,
      r.bill_no ?? '',
      `${formatDateShort(r.start_date)} - ${formatDateShort(r.end_date)}`,
      r.no_of_days,
      paiseToRupees(r.rate_per_day),
      r.food_amount ? paiseToRupees(r.food_amount) : '',
      paiseToRupees(r.amount),
    ]);
  }
  const hotelBlanks = Math.max(MIN_BLANK_ROWS - hotel.length, 0);
  for (let i = 0; i < hotelBlanks; ++i)
    rows.push(['', '', '', '', '', '', '', '']);
  const hotelEnd = rows.length - 1;

  const hotelTotalRowIdx = rows.length;
  rows.push(['', '', '', '', '', '', 'Total', paiseToRupees(totalF)]);

  const grandTotal = totalA + totalB + totalC + totalD + totalE + totalF;
  const grandTotalIdx = rows.length;
  rows.push(['Total Expenses (A+B+C+D+E+F)', '', '', '', '', '', '', paiseToRupees(grandTotal)]);

  const footerIdx = rows.length + 2;
  rows.push([]);
  rows.push([]);
  rows.push(['Traveler Sig.', '', '', 'Approve By', '', '', 'H.O. Accounts']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ensureRange(ws, boxTop, 0, boxBottom, COLS - 1);
  ensureRange(ws, travelHeaderIdx, 0, travelDataEnd, COLS - 1);
  ensureRange(ws, travelTotalRowIdx, 0, travelTotalRowIdx, COLS - 1);
  ensureRange(ws, summaryStart, 0, summaryEnd, COLS - 1);
  ensureRange(ws, dailyHeaderIdx, 0, dailyEnd, COLS - 1);
  ensureRange(ws, dailyTotalRowIdx, 0, dailyTotalRowIdx, COLS - 1);
  ensureRange(ws, hotelHeaderIdx, 0, hotelEnd, COLS - 1);
  ensureRange(ws, hotelTotalRowIdx, 0, hotelTotalRowIdx, COLS - 1);
  ensureRange(ws, grandTotalIdx, 0, grandTotalIdx, COLS - 1);
  ensureRange(ws, footerIdx, 0, footerIdx, COLS - 1);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
    { s: { r: sectionTitleIdx, c: 0 }, e: { r: sectionTitleIdx, c: COLS - 1 } },
  ];

  setRangeStyle(ws, 0, 0, 0, COLS - 1, STYLE_TITLE);
  setRangeStyle(ws, 2, 0, 2, COLS - 1, STYLE_SUBTITLE);

  for (let R = boxTop; R <= boxBottom; ++R) {
    setStyle(ws, R, 0, STYLE_INFO_LABEL);
    setStyle(ws, R, 1, STYLE_INFO_VALUE);
    setStyle(ws, R, 2, STYLE_INFO_VALUE);
    setStyle(ws, R, 3, STYLE_INFO_LABEL);
    setStyle(ws, R, 4, STYLE_INFO_VALUE);
    setStyle(ws, R, 5, STYLE_INFO_VALUE);
    setStyle(ws, R, 6, STYLE_INFO_VALUE);
    setStyle(ws, R, 7, STYLE_INFO_VALUE);
  }
  outlineRange(ws, boxTop, 0, boxBottom, COLS - 1);

  setRangeStyle(ws, sectionTitleIdx, 0, sectionTitleIdx, COLS - 1, STYLE_SECTION);

  // Travel table
  setRangeStyle(ws, travelHeaderIdx, 0, travelHeaderIdx, COLS - 1, STYLE_HEADER);
  for (let R = travelDataStart; R <= travelDataEnd; ++R) {
    setStyle(ws, R, 0, STYLE_CELL_CENTER);
    setStyle(ws, R, 1, STYLE_CELL);
    setStyle(ws, R, 2, STYLE_CELL_CENTER);
    setStyle(ws, R, 3, STYLE_CELL_CENTER);
    setStyle(ws, R, 4, STYLE_CELL);
    setStyle(ws, R, 5, STYLE_CELL_CENTER);
    setStyle(ws, R, 6, STYLE_CELL_CENTER);
    setStyle(ws, R, 7, STYLE_CELL_CURRENCY);
  }
  outlineRange(ws, travelHeaderIdx, 0, travelDataEnd, COLS - 1);

  setRangeStyle(ws, travelTotalRowIdx, 0, travelTotalRowIdx, 5, STYLE_TOTAL_LABEL);
  setStyle(ws, travelTotalRowIdx, 6, STYLE_TOTAL_LABEL);
  setStyle(ws, travelTotalRowIdx, 7, STYLE_TOTAL);
  outlineRange(ws, travelTotalRowIdx, 0, travelTotalRowIdx, COLS - 1);

  // Summary
  for (let R = summaryStart; R <= summaryEnd; ++R) {
    setRangeStyle(ws, R, 0, R, COLS - 2, STYLE_TOTAL_LABEL);
    setStyle(ws, R, COLS - 1, STYLE_TOTAL);
  }
  outlineRange(ws, summaryStart, 0, summaryEnd, COLS - 1);

  // Daily allowance
  setRangeStyle(ws, dailyHeaderIdx, 0, dailyHeaderIdx, COLS - 1, STYLE_HEADER);
  for (let R = dailyStart; R <= dailyEnd; ++R) {
    setStyle(ws, R, 0, STYLE_CELL);
    setStyle(ws, R, 1, STYLE_CELL_CURRENCY);
    setStyle(ws, R, 2, STYLE_CELL_CENTER);
    setStyle(ws, R, 3, STYLE_CELL_CENTER);
    setStyle(ws, R, 4, STYLE_CELL_CENTER);
    setStyle(ws, R, 5, STYLE_CELL_CENTER);
    setStyle(ws, R, 6, STYLE_CELL_CENTER);
    setStyle(ws, R, 7, STYLE_CELL_CURRENCY);
  }
  outlineRange(ws, dailyHeaderIdx, 0, dailyEnd, COLS - 1);

  setRangeStyle(ws, dailyTotalRowIdx, 0, dailyTotalRowIdx, 5, STYLE_TOTAL_LABEL);
  setStyle(ws, dailyTotalRowIdx, 6, STYLE_TOTAL_LABEL);
  setStyle(ws, dailyTotalRowIdx, 7, STYLE_TOTAL);
  outlineRange(ws, dailyTotalRowIdx, 0, dailyTotalRowIdx, COLS - 1);

  // Hotel
  setRangeStyle(ws, hotelHeaderIdx, 0, hotelHeaderIdx, COLS - 1, STYLE_HEADER);
  for (let R = hotelStart; R <= hotelEnd; ++R) {
    setStyle(ws, R, 0, STYLE_CELL);
    setStyle(ws, R, 1, STYLE_CELL);
    setStyle(ws, R, 2, STYLE_CELL_CENTER);
    setStyle(ws, R, 3, STYLE_CELL_CENTER);
    setStyle(ws, R, 4, STYLE_CELL_CENTER);
    setStyle(ws, R, 5, STYLE_CELL_CURRENCY);
    setStyle(ws, R, 6, STYLE_CELL_CURRENCY);
    setStyle(ws, R, 7, STYLE_CELL_CURRENCY);
  }
  outlineRange(ws, hotelHeaderIdx, 0, hotelEnd, COLS - 1);

  setRangeStyle(ws, hotelTotalRowIdx, 0, hotelTotalRowIdx, 5, STYLE_TOTAL_LABEL);
  setStyle(ws, hotelTotalRowIdx, 6, STYLE_TOTAL_LABEL);
  setStyle(ws, hotelTotalRowIdx, 7, STYLE_TOTAL);
  outlineRange(ws, hotelTotalRowIdx, 0, hotelTotalRowIdx, COLS - 1);

  // Grand total
  setRangeStyle(ws, grandTotalIdx, 0, grandTotalIdx, COLS - 2, STYLE_TOTAL_LABEL);
  setStyle(ws, grandTotalIdx, COLS - 1, STYLE_TOTAL);
  outlineRange(ws, grandTotalIdx, 0, grandTotalIdx, COLS - 1);

  setRangeStyle(ws, footerIdx, 0, footerIdx, COLS - 1, {
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: BORDER_ALL,
  });

  applyWrapText(ws);

  autoWidth(
    ws,
    [22, 10, 12, 14, 18, 12, 10, 12],
    [30, 18, 18, 22, 26, 14, 12, 18],
    new Set([footerIdx])
  );

  return ws;
}

// ------------------------------------------------------------
// Sheet 3: OUTSTAION RELATED OTHER EXP.
// ------------------------------------------------------------
function buildOutstationOtherSheet(data: ExportData): XLSX.WorkSheet {
  const { tour, phone, misc, period } = data;
  const COLS = 6;
  const MISC_COLS = 5;

  const rows: (string | number)[][] = [];

  rows.push(['UNICORN DENMART LTD.']);
  rows.push([`Period : ${formatPeriodRange(period)}`]);

  // --- Local Conveyance Exp ---
  const tourTitleIdx = rows.length;
  rows.push(['LOCAL CONVEYANCE EXP']);
  const tourHeaderIdx = rows.length;
  rows.push(['DATE', 'FROM', 'TO', 'MODE', 'COMPLAINT NO', 'FARE']);
  const tourStart = rows.length;
  let tourTotal = 0;
  for (const r of tour) {
    tourTotal += r.fare;
    rows.push([
      formatDateShort(r.date),
      r.from_location,
      r.to_location,
      r.mode,
      r.complaint_no,
      paiseToRupees(r.fare),
    ]);
  }
  const tourBlanks = Math.max(MIN_BLANK_ROWS - tour.length, 0);
  for (let i = 0; i < tourBlanks; ++i) rows.push(['', '', '', '', '', '']);
  const tourEnd = rows.length - 1;
  const tourTotalRowIdx = rows.length;
  rows.push(['', '', '', '', 'Total', paiseToRupees(tourTotal)]);

  // --- Telephone / Fax ---
  const phoneTitleIdx = rows.length;
  rows.push(['TELPHONE /FAX EXP']);
  const phoneHeaderIdx = rows.length;
  rows.push(['DATE', 'PARTICLARS', 'TEL NO/FAX NO', 'B. NO', 'COMPLAINT NO', 'AMOUNT']);
  const phoneStart = rows.length;
  let phoneTotal = 0;
  for (const r of phone) {
    phoneTotal += r.amount;
    rows.push([
      formatDateShort(r.date),
      r.particulars,
      r.tel_fax_no,
      r.bill_no,
      r.complaint_no,
      paiseToRupees(r.amount),
    ]);
  }
  const phoneBlanks = Math.max(MIN_BLANK_ROWS - phone.length, 0);
  for (let i = 0; i < phoneBlanks; ++i) rows.push(['', '', '', '', '', '']);
  const phoneEnd = rows.length - 1;
  const phoneTotalRowIdx = rows.length;
  rows.push(['', '', '', '', 'Total', paiseToRupees(phoneTotal)]);

  // --- Other Exp ---
  const miscTitleIdx = rows.length;
  rows.push(['OTHER EXP']);
  const miscHeaderIdx = rows.length;
  rows.push(['DATE', 'PARTICULAR', 'B. NO', 'COMPLAINT NO', 'AMOUNT']);
  const miscStart = rows.length;
  let miscTotal = 0;
  for (const r of misc) {
    miscTotal += r.amount;
    rows.push([
      formatDateShort(r.date),
      r.particulars,
      r.bill_no,
      r.complaint_no,
      paiseToRupees(r.amount),
    ]);
  }
  const miscBlanks = Math.max(MIN_BLANK_ROWS - misc.length, 0);
  for (let i = 0; i < miscBlanks; ++i) rows.push(['', '', '', '', '']);
  const miscEnd = rows.length - 1;
  const miscTotalRowIdx = rows.length;
  rows.push(['', '', '', 'Total', paiseToRupees(miscTotal)]);

  const footerIdx = rows.length + 1;
  rows.push([]);
  rows.push(['Traveler Sig.', 'Approve By', '', '', 'H.O. Accounts']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ensureRange(ws, tourHeaderIdx, 0, tourEnd, COLS - 1);
  ensureRange(ws, tourTotalRowIdx, 0, tourTotalRowIdx, COLS - 1);
  ensureRange(ws, phoneHeaderIdx, 0, phoneEnd, COLS - 1);
  ensureRange(ws, phoneTotalRowIdx, 0, phoneTotalRowIdx, COLS - 1);
  ensureRange(ws, miscHeaderIdx, 0, miscEnd, MISC_COLS - 1);
  ensureRange(ws, miscTotalRowIdx, 0, miscTotalRowIdx, MISC_COLS - 1);
  ensureRange(ws, footerIdx, 0, footerIdx, COLS - 1);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
    { s: { r: tourTitleIdx, c: 0 }, e: { r: tourTitleIdx, c: COLS - 1 } },
    { s: { r: phoneTitleIdx, c: 0 }, e: { r: phoneTitleIdx, c: COLS - 1 } },
    { s: { r: miscTitleIdx, c: 0 }, e: { r: miscTitleIdx, c: COLS - 1 } },
  ];

  setRangeStyle(ws, 0, 0, 0, COLS - 1, STYLE_TITLE);
  setRangeStyle(ws, 1, 0, 1, COLS - 1, {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  setRangeStyle(ws, tourTitleIdx, 0, tourTitleIdx, COLS - 1, STYLE_SECTION);
  setRangeStyle(ws, phoneTitleIdx, 0, phoneTitleIdx, COLS - 1, STYLE_SECTION);
  setRangeStyle(ws, miscTitleIdx, 0, miscTitleIdx, COLS - 1, STYLE_SECTION);

  setRangeStyle(ws, tourHeaderIdx, 0, tourHeaderIdx, COLS - 1, STYLE_HEADER);
  for (let R = tourStart; R <= tourEnd; ++R) {
    setStyle(ws, R, 0, STYLE_CELL_CENTER);
    setStyle(ws, R, 1, STYLE_CELL);
    setStyle(ws, R, 2, STYLE_CELL);
    setStyle(ws, R, 3, STYLE_CELL_CENTER);
    setStyle(ws, R, 4, STYLE_CELL_CENTER);
    setStyle(ws, R, 5, STYLE_CELL_CURRENCY);
  }
  outlineRange(ws, tourHeaderIdx, 0, tourEnd, COLS - 1);
  applyTotalRow(ws, tourTotalRowIdx, COLS, 'Total');

  setRangeStyle(ws, phoneHeaderIdx, 0, phoneHeaderIdx, COLS - 1, STYLE_HEADER);
  for (let R = phoneStart; R <= phoneEnd; ++R) {
    setStyle(ws, R, 0, STYLE_CELL_CENTER);
    setStyle(ws, R, 1, STYLE_CELL);
    setStyle(ws, R, 2, STYLE_CELL_CENTER);
    setStyle(ws, R, 3, STYLE_CELL_CENTER);
    setStyle(ws, R, 4, STYLE_CELL_CENTER);
    setStyle(ws, R, 5, STYLE_CELL_CURRENCY);
  }
  outlineRange(ws, phoneHeaderIdx, 0, phoneEnd, COLS - 1);
  applyTotalRow(ws, phoneTotalRowIdx, COLS, 'Total');

  setRangeStyle(ws, miscHeaderIdx, 0, miscHeaderIdx, MISC_COLS - 1, STYLE_HEADER);
  for (let R = miscStart; R <= miscEnd; ++R) {
    setStyle(ws, R, 0, STYLE_CELL_CENTER);
    setStyle(ws, R, 1, STYLE_CELL);
    setStyle(ws, R, 2, STYLE_CELL_CENTER);
    setStyle(ws, R, 3, STYLE_CELL_CENTER);
    setStyle(ws, R, 4, STYLE_CELL_CURRENCY);
  }
  outlineRange(ws, miscHeaderIdx, 0, miscEnd, MISC_COLS - 1);
  applyTotalRow(ws, miscTotalRowIdx, MISC_COLS, 'Total');

  setRangeStyle(ws, footerIdx, 0, footerIdx, COLS - 1, {
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: BORDER_ALL,
  });

  applyWrapText(ws);

  autoWidth(
    ws,
    [12, 20, 18, 18, 18, 12],
    [20, 28, 22, 22, 26, 18],
    new Set([footerIdx])
  );

  return ws;
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------
export async function buildCompanyExcel(
  employeeId: string,
  period: MonthPeriod = { kind: 'all' }
): Promise<{ uri: string; filename: string; mimeType: string }> {
  const data = await loadExportData(employeeId, period);

  // ---- Workbook assembly (was missing in your pasted file) ----
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildLocalConSheet(data), 'LOCAL CON');
  XLSX.utils.book_append_sheet(wb, buildOutstationSheet(data), 'OUTSTAION');
  XLSX.utils.book_append_sheet(
    wb,
    buildOutstationOtherSheet(data),
    'OUTSTAION RELATED OTHER EXP.'
  );

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  const employeeSlug = data.employee.name.replace(/[^a-zA-Z0-9]/g, '_');
  const periodSlug =
    period.kind === 'all'
      ? 'AllTime'
      : formatPeriodLabel(period).replace(/\s+/g, '-');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const filename = `Claim_Form_${employeeSlug}_${periodSlug}_${timestamp}.xlsx`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    uri,
    filename,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
