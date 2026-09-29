import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';

import { getDatabase } from '../database/client';
import { EmployeeDetails } from '../types/company';

import {
  MonthPeriod,
  formatPeriodLabel,
  getPeriodRange,
} from '../types/period';

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type SaturdayOffRule = 'none' | '1st-3rd' | '2nd-4th';

export interface AttendanceExtras {
    googleReviews: string;
    serviceCallsTat: string;
    saturdayOff: SaturdayOffRule;
    holidayDays: number[];
    absentDays: number[];
}

interface MonthExpenseBreakdown {
    conveyance: number;
    travelling: number;
    telephone: number;
    afterSale: number;
    misc: number;
    printing: number;
    postage: number;
    grandTotal: number;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Paise -> formatted rupee string WITHOUT symbol.
 * Example: 123400 -> "1,234.00"
 */
function rupees(paise: number): string {
    const v = paise / 100;

    return v.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Only return a formatted amount when non-zero.
 * Otherwise return an empty string.
 */
function rupeesOrBlank(paise: number): string {
    return paise && paise !== 0 ? `Rs. ${rupees(paise)}` : '';
}

function daysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function weekdayOf(
    year: number,
    monthIndex: number,
    day: number,
): number {
    return new Date(year, monthIndex, day).getDay();
}

function sundaysOf(
    year: number,
    monthIndex: number,
): number[] {
    const total = daysInMonth(year, monthIndex);
    const out: number[] = [];

    for (let d = 1; d <= total; d++) {
        if (weekdayOf(year, monthIndex, d) === 0) {
            out.push(d);
        }
    }

    return out;
}

function offSaturdaysOf(
    year: number,
    monthIndex: number,
    rule: SaturdayOffRule,
): number[] {
    if (rule === 'none') {
        return [];
    }

    const total = daysInMonth(year, monthIndex);
    const saturdays: number[] = [];

    for (let d = 1; d <= total; d++) {
        if (weekdayOf(year, monthIndex, d) === 6) {
            saturdays.push(d);
        }
    }

    const wanted = rule === '1st-3rd' ? [1, 3] : [2, 4];

    return saturdays.filter((_, idx) => wanted.includes(idx + 1));
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ------------------------------------------------------------
// Data loading
// ------------------------------------------------------------

async function loadEmployee(
    employeeId: string,
): Promise<EmployeeDetails> {
    const db = await getDatabase();

    const [emp] = await db.getAllAsync<EmployeeDetails>(
        `
      SELECT
        id,
        name,
        employee_code,
        grade,
        department,
        location,
        mobile_no,
        created_at,
        updated_at
      FROM employee_details
      WHERE id = ?;
    `,
        [employeeId],
    );

    if (!emp) {
        throw new Error('Employee not found.');
    }

    return emp;
}

async function loadExpenseBreakdown(
    employeeId: string,
    period: MonthPeriod,
): Promise<MonthExpenseBreakdown> {
    const db = await getDatabase();

    const range = getPeriodRange(period);

    const pointFilter =
        range.start != null && range.end != null
            ? 'AND date >= ? AND date < ?'
            : '';

    const pointArgs = (): (string | number)[] =>
        range.start != null && range.end != null
            ? [employeeId, range.start, range.end]
            : [employeeId];

    const rangeFilter =
        range.start != null && range.end != null
            ? 'AND start_date < ? AND end_date >= ?'
            : '';

    const rangeArgs = (): (string | number)[] =>
        range.start != null && range.end != null
            ? [employeeId, range.end, range.start]
            : [employeeId];

    const sum = async (
        sql: string,
        args: (string | number)[],
    ): Promise<number> => {
        const row = await db.getFirstAsync<{ s: number | null }>(
            sql,
            args,
        );

        return row?.s ?? 0;
    };

    const conveyance = await sum(
        `
      SELECT SUM(amount) AS s
      FROM local_conveyance
      WHERE employee_id = ?
      ${pointFilter};
    `,
        pointArgs(),
    );

    const outstation = await sum(
        `
      SELECT SUM(amount) AS s
      FROM outstation_conveyance
      WHERE employee_id = ?
      ${pointFilter};
    `,
        pointArgs(),
    );

    const tour = await sum(
        `
      SELECT SUM(fare) AS s
      FROM tour_conveyance
      WHERE employee_id = ?
      ${pointFilter};
    `,
        pointArgs(),
    );

    const hotel = await sum(
        `
      SELECT SUM(amount) AS s
      FROM hotel
      WHERE employee_id = ?
      ${rangeFilter};
    `,
        rangeArgs(),
    );

    const dailyAllowance = await sum(
        `
      SELECT SUM(total_amount) AS s
      FROM daily_allowance
      WHERE employee_id = ?
      ${rangeFilter};
    `,
        rangeArgs(),
    );

    const telephone = await sum(
        `
      SELECT SUM(amount) AS s
      FROM phone_expense
      WHERE employee_id = ?
      ${pointFilter};
    `,
        pointArgs(),
    );

    const misc = await sum(
        `
      SELECT SUM(amount) AS s
      FROM miscellaneous_expense
      WHERE employee_id = ?
      ${pointFilter};
    `,
        pointArgs(),
    );

    const travelling =
        outstation +
        tour +
        hotel +
        dailyAllowance;

    const afterSale = 0;
    const printing = 0;
    const postage = 0;

    const grandTotal =
        conveyance +
        travelling +
        telephone +
        afterSale +
        misc +
        printing +
        postage;

    return {
        conveyance,
        travelling,
        telephone,
        afterSale,
        misc,
        printing,
        postage,
        grandTotal,
    };
}

// ------------------------------------------------------------
// Attendance status
// ------------------------------------------------------------

interface DayStatus {
    day: number;
    code: 'P' | 'S' | 'A' | 'H' | 'O';
}

function buildDayStatuses(
    year: number,
    monthIndex: number,
    extras: AttendanceExtras,
): DayStatus[] {
    const total = daysInMonth(year, monthIndex);

    const sundays = new Set(sundaysOf(year, monthIndex));
    const holidays = new Set(extras.holidayDays);
    const absents = new Set(extras.absentDays);

    const offSats = new Set(
        offSaturdaysOf(year, monthIndex, extras.saturdayOff),
    );

    const out: DayStatus[] = [];

    for (let d = 1; d <= total; d++) {
        let code: DayStatus['code'] = 'P';

        if (sundays.has(d)) {
            code = 'S';
        } else if (holidays.has(d)) {
            code = 'H';
        } else if (offSats.has(d)) {
            code = 'O';
        }

        if (absents.has(d) && code !== 'S') {
            code = 'A';
        }

        out.push({
            day: d,
            code,
        });
    }

    return out;
}

// ------------------------------------------------------------
// HTML builder
// ------------------------------------------------------------

interface BuildArgs {
    employee: EmployeeDetails;
    period: MonthPeriod;
    extras: AttendanceExtras;
    expenses: MonthExpenseBreakdown;
    statuses: DayStatus[];
}

function buildHtml(args: BuildArgs): string {
    const { employee, period, extras, expenses, statuses } = args;

    const now = new Date();
    const year = period.kind === 'month' ? period.year : now.getFullYear();
    const monthIndex = period.kind === 'month' ? period.monthIndex : now.getMonth();
    const monthLabel = formatPeriodLabel(period);

    const sundays = sundaysOf(year, monthIndex);

    const sundayBoxes = Array.from({ length: 5 }, (_, i) => {
        const d = sundays[i];
        return `<td class="sun-box">${d !== undefined ? d : ''}</td>`;
    }).join('');

    const leaveBoxes = Array.from(
        { length: 5 },
        () => `<td class="sun-box"></td>`,
    ).join('');

    const statusByDay = new Map(
        statuses.map((s) => [s.day, s.code]),
    );

    // Attendance: vertical list, 31 equal rows that stretch to fill the column
    const attendanceRowsHtml = Array.from(
        { length: 31 },
        (_, i) => {
            const day = i + 1;
            const code = statusByDay.get(day);

            if (!code) {
                return `
        <div class="att-row">
          <div class="att-day"></div>
          <div class="att-empty"></div>
        </div>
      `;
            }

            return `
        <div class="att-row">
          <div class="att-day">${day}</div>
          <div class="att-box st-${code}">${code}</div>
        </div>
      `;
        },
    ).join('');

    const expLines: { label: string; amount: string }[] = [
        {
            label: '1. Re-Imbursement of Conveyance Expenses',
            amount: rupeesOrBlank(expenses.conveyance),
        },
        {
            label: '2. Travelling Expenses.',
            amount: rupeesOrBlank(expenses.travelling),
        },
        {
            label: '3. Telephone Expenses.',
            amount: rupeesOrBlank(expenses.telephone),
        },
        {
            label: '4. After Sale & Service Expense.',
            amount: rupeesOrBlank(expenses.afterSale),
        },
        {
            label: '5. Misc. Expense.',
            amount: rupeesOrBlank(expenses.misc),
        },
        {
            label: '6. Printing & Stationery',
            amount: rupeesOrBlank(expenses.printing),
        },
        {
            label: '7. Postage & Courier',
            amount: rupeesOrBlank(expenses.postage),
        },
    ];

    const expRowsHtml = expLines
        .map(
            (line) => `
        <tr>
          <td class="exp-label">${escapeHtml(line.label)}</td>
          <td class="exp-amount">${line.amount ? escapeHtml(line.amount) : ''}</td>
        </tr>
      `,
        )
        .join('');

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  @page {
    size: 8.27in 11.69in;
    margin: 0;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    width: 8.27in;
    height: 11.69in;
    overflow: hidden;
    background: #fff;
    color: #000;
    font-family: "Times New Roman", Times, serif;
    font-size: 11.5px;
  }

  /* ==========================================================
     EXACT PAGE DIMENSIONS & MARGINS:
     Width: 8.27in | Height: 11.69in
     Top: 0.50in | Right: 0.46in | Bottom: 0in | Left: 0.54in | Gutter: 0
     ========================================================== */

  .page {
    width: 8.27in;
    height: 11.69in;
    box-sizing: border-box;
    padding-top: 0.50in;
    padding-right: 0.46in;
    padding-bottom: 0in;
    padding-left: 0.54in;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ==========================================================
     1. COMPANY HEADER
     ========================================================== */

  .co-header {
    flex: 0 0 auto;
    width: 100%;
    margin: 0 auto;
    border: 1.4px solid #000;
    padding: 7px 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.35;
    text-transform: uppercase;
  }

  .co-header .co-name {
    font-size: 17.5px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  /* ==========================================================
     2. GAPS
     ========================================================== */

  .gap-header {
    flex: 0 0 50px;
  }

  /* Increased space between employee box and sales & service */
  .gap-body {
    flex: 0 0 30px;
  }

  /* ==========================================================
     3. EMPLOYEE DETAILS
     ========================================================== */

  table.fields {
    flex: 0 0 auto;
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  table.fields td {
    border: 1.2px solid #000;
    padding: 5px 8px;
    height: 29px;
    vertical-align: middle;
    font-size: 12px;
    line-height: 1.2;
  }

  table.fields .k {
    font-weight: 700;
    margin-right: 6px;
  }

  /* Sunday / Leave boxes */
  td.sl-cell {
    padding: 3px 6px !important;
    vertical-align: middle !important;
  }

  table.sl {
    width: 100%;
    border-collapse: separate;
    border-spacing: 3px 5px;
    margin: 0;
  }

  table.sl td {
    border: none !important;
    padding: 0 !important;
    height: 22px !important;
    font-size: 10.5px;
  }

  table.sl td.sl-label {
    width: 48px;
    font-weight: 700;
    text-align: left;
    padding-right: 3px !important;
  }

  table.sl td.sun-box {
    width: 22px;
    height: 22px !important;
    border: 1.3px solid #000 !important;
    text-align: center;
    vertical-align: middle;
    font-size: 10.5px;
    font-weight: 700;
  }

  /* ==========================================================
     4. MAIN BODY : LEFT column + RIGHT column (attendance)
     ========================================================== */

  .body-row {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    width: 100%;
  }

  /* ---------- LEFT COLUMN ---------- */

  .left-col {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    margin-right: 14px;
    margin-top: 30px;
  }

  .section-head {
    font-weight: 700;
    font-size: 16.5px;
    text-decoration: underline;
    margin: 2px 0 6px 0;
    line-height: 1.2;
  }

  /* Sales & service notes */
  ul.notes {
    margin: 0 0 8px 4px;
    padding: 0;
    list-style: none;
  }

  ul.notes li {
    position: relative;
    padding-left: 16px;
    margin-bottom: 5px;
    font-size: 14px;
    line-height: 1.35;
    text-decoration: underline;
  }

  ul.notes li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 3.5px;
    border-left: 8px solid #000;
    border-top: 4.5px solid transparent;
    border-bottom: 4.5px solid transparent;
  }

  ul.notes .hl {
    font-weight: 700;
  }

  /* Month / Total Exp / Google Reviews / Service call box */
  table.svc {
    width: 90%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 40px 0 0 0;
  }

  table.svc th,
  table.svc td {
    border: 1.2px solid #000;
    padding: 5px 4px;
    font-size: 12px;
    line-height: 1.2;
    text-align: center;
    vertical-align: middle;
  }

  table.svc th {
    height: 44px;
    font-weight: 700;
  }

  table.svc td {
    height: 36px;
  }

  /* Increased space at top of Details of Expenses */
  .gap-exp {
    flex: 0 0 70px;
  }

  /* Details of expenses */
  .expense-head {
    margin-bottom: 7px;
  }

  table.exp {
    width: 90%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  table.exp td {
    height: 27px;
    padding: 4px 8px;
    font-size: 12px;
    line-height: 1.2;
    vertical-align: middle;
  }

  table.exp td.exp-label {
    width: 63%;
    border: 1.2px solid #000;
    white-space: nowrap;
  }

  table.exp td.exp-amount {
    width: 37%;
    border: 1px dotted #000;
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Grand total */
  .grand-total {
    width: 66%;
    margin: 10px auto 0 auto;
    padding: 6px 12px;
    border: 1.4px solid #000;
    text-align: center;
    font-size: 13.5px;
    font-weight: 700;
    line-height: 1.2;
  }

  /* ---------- SIGNATURES ---------- */

  .signature-section {
    margin-top: auto;
    width: 100%;
    padding-top: 26px;
  }

  .signature-row {
    display: table;
    width: 100%;
    table-layout: fixed;
  }

  .signature-cell {
    display: table-cell;
    width: 33.333%;
    text-align: center;
    vertical-align: bottom;
    padding: 0 6px;
  }

  .signature-line {
    border-top: 1.2px dotted #000;
    margin-bottom: 5px;
    height: 0;
  }

  .signature-label {
    font-size: 11px;
    font-weight: 700;
    color: #000;
    white-space: nowrap;
  }

  /* ---------- RIGHT COLUMN : ATTENDANCE ---------- */

  .attendance {
    flex: 0 0 126px;
    width: 126px;
    display: flex;
    flex-direction: column;
  }

  .att-head {
    flex: 0 0 auto;
    text-align: center;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 0 0 5px 0;
  }

  .att-list {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .att-row {
    flex: 1 1 0;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    min-height: 0;
  }

  .att-day {
    flex: 0 0 35%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 6px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  .att-box {
    flex: 1 1 auto;
    border: 1.3px solid #000;
    margin-top: -1px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11px;
    line-height: 1;
  }

  .att-empty {
    flex: 1 1 auto;
  }

  .st-P,
  .st-S,
  .st-A,
  .st-H,
  .st-O {
    color: #000;
  }

  /* ==========================================================
     5. BOTTOM INSTRUCTION
     ========================================================== */

  .foot-note {
    flex: 0 0 auto;
    text-align: center;
    margin-top: 6px;
    margin-bottom: 6px;
    font-size: 11.5px;
    font-weight: 700;
    font-style: italic;
    text-decoration: underline;
    line-height: 1.25;
  }
</style>
</head>
<body>
<div class="page">

  <!-- 1. COMPANY DETAILS -->
  <div class="co-header">
    <div class="co-name">UNICORN DENMART LTD.</div>
    3, LOCAL SHOPPING CENTRE,<br/>
    MOR LAND, NEAR J BLOCK,<br/>
    D.D.A. MARKET, NEW RAJINDER NAGAR, NEW DELHI-110060<br/>
    PH: 45331200
  </div>

  <div class="gap-header"></div>

  <!-- 2. EMPLOYEE DETAILS -->
  <table class="fields">
    <tr>
      <td style="width:38%;">
        <span class="k">Name</span>
        ${escapeHtml(employee.name)}
      </td>
      <td style="width:27%;">
        <span class="k">Month</span>
        ${escapeHtml(monthLabel)}
      </td>
      <td style="width:35%;">
        <span class="k">Station</span>
        ${escapeHtml((employee as any).station ?? employee.location ?? '')}
      </td>
    </tr>

    <tr>
      <td>
        <span class="k">Mobile No.</span>
        ${escapeHtml(employee.mobile_no ?? '')}
      </td>
      <td>
        <span class="k">Grade</span>
        ${escapeHtml(employee.grade ?? '')}
      </td>
      <td class="sl-cell" rowspan="3">
        <table class="sl">
          <tr>
            <td class="sl-label">Sunday</td>
            ${sundayBoxes}
          </tr>
          <tr>
            <td class="sl-label">Leave</td>
            ${leaveBoxes}
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <span class="k">Department</span>
        ${escapeHtml(employee.department ?? '')}
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <span class="k">Location</span>
        ${escapeHtml(employee.location ?? '')}
      </td>
    </tr>
  </table>

  <div class="gap-body"></div>

  <!-- 3. MAIN BODY -->
  <div class="body-row">

    <!-- LEFT COLUMN -->
    <div class="left-col">

      <div class="section-head">
        Details of Sales &amp; Service:-
      </div>

      <ul class="notes">
        <li>
          For Sales staff including
          <span class="hl">BSM</span>
          give <span class="hl">Sale Figure</span>.
        </li>
        <li>
          For Product Specialists / Head No. of Units Sold.
        </li>
        <li>
          For Service No. of Calls Attended /
          <span class="hl">TAT</span>.
        </li>
      </ul>

      <table class="svc">
        <thead>
          <tr>
            <th style="width:20%;">Month</th>
            <th style="width:22%;">Total Exp.</th>
            <th style="width:28%;">Google Reviews</th>
            <th style="width:30%;">
              Number of Service<br/>
              Call / TAT
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(monthLabel)}</td>
            <td>Rs. ${rupees(expenses.grandTotal)}</td>
            <td>${escapeHtml(extras.googleReviews || '')}</td>
            <td>${escapeHtml(extras.serviceCallsTat || '')}</td>
          </tr>
        </tbody>
      </table>

      <div class="gap-exp"></div>

      <div class="section-head expense-head">
        Details of Expenses
      </div>

      <table class="exp">
        <tbody>
          ${expRowsHtml}
        </tbody>
      </table>

      <div class="grand-total">
        Grand Total: Rs. ${rupees(expenses.grandTotal)}
      </div>

      <!-- SIGNATURES -->
      <div class="signature-section">
        <div class="signature-row">
          <div class="signature-cell">
            <div class="signature-line"></div>
            <div class="signature-label">Employee Signature</div>
          </div>
          <div class="signature-cell">
            <div class="signature-line"></div>
            <div class="signature-label">Manager Signature</div>
          </div>
          <div class="signature-cell">
            <div class="signature-line"></div>
            <div class="signature-label">H.O. Accounts</div>
          </div>
        </div>
      </div>

    </div>

    <!-- RIGHT COLUMN: ATTENDANCE -->
    <div class="attendance">
      <div class="att-head">ATTENDANCE</div>
      <div class="att-list">
        ${attendanceRowsHtml}
      </div>
    </div>

  </div>

  <!-- 4. INSTRUCTION LINE -->
  <div class="foot-note">
    Note: Please submit the Exp. Every Month, up to 2 day of next months.
  </div>

</div>
</body>
</html>
  `;
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export async function buildAttendancePdf(
    employeeId: string,
    period: MonthPeriod,
    extras: AttendanceExtras,
): Promise<{
    uri: string;
    filename: string;
    mimeType: string;
}> {
    // ----------------------------------------------------------
    // Load employee + expenses
    // ----------------------------------------------------------

    const [employee, expenses] = await Promise.all([
        loadEmployee(employeeId),
        loadExpenseBreakdown(employeeId, period),
    ]);

    // ----------------------------------------------------------
    // Determine period
    // ----------------------------------------------------------

    const now = new Date();

    const year =
        period.kind === 'month'
            ? period.year
            : now.getFullYear();

    const monthIndex =
        period.kind === 'month'
            ? period.monthIndex
            : now.getMonth();

    // ----------------------------------------------------------
    // Attendance
    // ----------------------------------------------------------

    const statuses = buildDayStatuses(year, monthIndex, extras);

    // ----------------------------------------------------------
    // Build HTML
    // ----------------------------------------------------------

    const html = buildHtml({
        employee,
        period,
        extras,
        expenses,
        statuses,
    });

    // ----------------------------------------------------------
    // Generate A4 PDF with Zero OS Margins (8.27in x 11.69in)
    // ----------------------------------------------------------

    const { uri: tmpUri } = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842,
        margins: {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        },
    });

    // ----------------------------------------------------------
    // Filename
    // ----------------------------------------------------------

    const employeeSlug = employee.name.replace(/[^a-zA-Z0-9]/g, '_');

    const periodSlug =
        period.kind === 'all'
            ? 'AllTime'
            : formatPeriodLabel(period).replace(/\s+/g, '-');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const filename =
        `Attendance_Form_${employeeSlug}_${periodSlug}_${timestamp}.pdf`;

    const finalUri = `${FileSystem.cacheDirectory}${filename}`;

    // ----------------------------------------------------------
    // Move generated PDF
    // ----------------------------------------------------------

    await FileSystem.moveAsync({
        from: tmpUri,
        to: finalUri,
    });

    // ----------------------------------------------------------
    // Return
    // ----------------------------------------------------------

    return {
        uri: finalUri,
        filename,
        mimeType: 'application/pdf',
    };
}