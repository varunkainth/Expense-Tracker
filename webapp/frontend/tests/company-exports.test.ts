import { expect, test, beforeEach, afterEach } from 'bun:test';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import * as XLSX from 'xlsx-js-style';
import { PDFDocument } from 'pdf-lib';
import { buildClaimWorkbook, companyExcelBytes } from '../../../packages/claim-exports/src/company-excel';
import { buildAttendanceHtml, buildDayStatuses } from '../../../packages/claim-exports/src/attendance';
import { getPeriodRange, type MonthPeriod } from '../../../packages/claim-exports/src/period';
import { ExpenseDatabase, type PhoneRecord } from '../src/lib/database/database';
import { fixtureWorkspace } from './fixtures/workspace';
import { selectClaimData, attendanceBreakdown, loadClaimReceipts, inClaimPeriod } from '../src/features/workspace/exports/company-data';
import { parseDayList } from '../src/features/workspace/exports/attendance-input';
import { mergeReceiptPdf } from '../src/features/workspace/exports/receipt-pdf';
let database:ExpenseDatabase;
beforeEach(()=>{Dexie.dependencies.indexedDB=indexedDB;Dexie.dependencies.IDBKeyRange=IDBKeyRange;database=new ExpenseDatabase(`exports-${crypto.randomUUID()}`);});
afterEach(async()=>{await database.delete();});
const period:MonthPeriod={kind:'month',year:2026,monthIndex:10};
const timestamp=new Date(2026,10,10).getTime();
async function records(){
  const snapshot=await fixtureWorkspace();
  for(const rows of Object.values(snapshot.tables))for(const row of rows)for(const field of ['date','start_date','end_date'])if(field in row)row[field]=timestamp;
  snapshot.tables.employee_details[0].name='Export Person';snapshot.tables.employee_details[0].employee_code='EMP-001';
  snapshot.tables.local_conveyance[0].amount=15000;snapshot.tables.outstation_conveyance[0].amount=500000;
  snapshot.tables.tour_conveyance[0].fare=23456;snapshot.tables.hotel[0].amount=250000;
  snapshot.tables.daily_allowance[0].total_amount=100000;snapshot.tables.phone_expense[0].amount=34567;snapshot.tables.miscellaneous_expense[0].amount=45678;
  const rows=Object.entries(snapshot.tables).flatMap(([table,values])=>values.map((data)=>({deviceId:snapshot.deviceId,table,id:String(data.id??data.key),data}))) as PhoneRecord[];
  return {snapshot,rows,deviceId:snapshot.deviceId,employeeId:String(snapshot.tables.employee_details[0].id)};
}
test('month filtering is inclusive/exclusive for dates and includes overlapping stays',()=>{
  const range=getPeriodRange(period),start=range.start!,end=range.end!;
  expect(inClaimPeriod({date:start-1},period)).toBe(false);expect(inClaimPeriod({date:start},period)).toBe(true);expect(inClaimPeriod({date:end},period)).toBe(false);
  expect(inClaimPeriod({start_date:start-86400000,end_date:start+86400000},period)).toBe(true);
  expect(inClaimPeriod({start_date:end,end_date:end+86400000},period)).toBe(false);
});
test('selected employee/source produces the styled native three-sheet workbook with numeric rupee amounts',async()=>{
  const source=await records();
  const other=source.rows.filter((row)=>row.table==='local_conveyance').map((row)=>({...row,deviceId:crypto.randomUUID(),data:{...row.data,amount:9999999}}));
  const data=selectClaimData([...source.rows,...other],source.deviceId,source.employeeId,period);
  expect(data.local).toHaveLength(1);expect(attendanceBreakdown(data).grandTotal).toBe(968701);
  const workbook=buildClaimWorkbook(data);
  expect(workbook.SheetNames).toEqual(['LOCAL CON','OUTSTAION','OUTSTAION RELATED OTHER EXP.']);
  expect(workbook.Sheets['LOCAL CON']['!merges']?.length).toBeGreaterThan(0);
  const read=XLSX.read(companyExcelBytes(data),{type:'array',cellStyles:true});
  const cells=Object.values(read.Sheets['LOCAL CON']) as {v?:unknown;t?:string}[];
  expect(cells.some((cell)=>cell.v===150 && cell.t==='n')).toBe(true);
  expect(JSON.stringify(read.Sheets)).toContain('Export Person');
});
test('attendance shares native holidays/weekends/leap rules and safely escapes manual text',async()=>{
  const source=await records(),data=selectClaimData(source.rows,source.deviceId,source.employeeId,period);
  const extras={googleReviews:'<script>alert(1)</script>',serviceCallsTat:'95%',saturdayOff:'2nd-4th' as const,holidayDays:[2],absentDays:[3]};
  const statuses=buildDayStatuses(2026,10,extras);
  expect(statuses).toHaveLength(30);expect(statuses.find((row)=>row.day===1)?.code).toBe('S');expect(statuses.find((row)=>row.day===2)?.code).toBe('H');expect(statuses.find((row)=>row.day===3)?.code).toBe('A');expect(statuses.find((row)=>row.day===14)?.code).toBe('O');
  expect(buildDayStatuses(2024,1,extras)).toHaveLength(29);
  const html=buildAttendanceHtml(data.employee,period,extras,attendanceBreakdown(data));
  expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('Export Person');expect(html).toContain('Nov 2026');expect(html).toContain('9,687.01');
  expect(parseDayList('1, 3-5, 3',30)).toEqual([1,3,4,5]);expect(()=>parseDayList('31',30)).toThrow();
});
test('receipt export selects only the employee/month and fails visibly for missing files',async()=>{
  const source=await records();await database.phoneRecords.bulkPut(source.rows);
  await expect(loadClaimReceipts(source.deviceId,source.employeeId,period,database)).rejects.toThrow('unavailable');
  const attachment=source.snapshot.tables.company_expense_attachments[0];
  await database.phoneFiles.put({deviceId:source.deviceId,id:String(attachment.id),fileName:String(attachment.file_name),mimeType:'application/pdf',bytes:new Uint8Array([1,2,3])});
  expect(await loadClaimReceipts(source.deviceId,source.employeeId,period,database)).toHaveLength(1);
  await expect(loadClaimReceipts(source.deviceId,source.employeeId,{kind:'month',year:2026,monthIndex:11},database)).rejects.toThrow('No expense attachments');
});
test('combined receipt PDF preserves original PDF pages and adds an A4 cover',async()=>{
  const input=await PDFDocument.create();input.addPage([300,400]);input.addPage([400,500]);
  const bytes=await mergeReceiptPdf([{filename:'receipt ₹.pdf',mimeType:'application/pdf',bytes:await input.save()}]);
  const output=await PDFDocument.load(bytes);expect(output.getPageCount()).toBe(3);expect(output.getPages()[0].getWidth()).toBeCloseTo(595.28);expect(output.getPages()[1].getWidth()).toBe(300);
  await expect(mergeReceiptPdf([{filename:'broken.pdf',mimeType:'application/pdf',bytes:new Uint8Array([0])}])).rejects.toThrow('broken.pdf');
});

test('JPEG receipts produce an A4 PDF page',async()=>{
 const bytes=Uint8Array.from(atob('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAeABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigD//2Q=='),(letter)=>letter.charCodeAt(0));
 const output=await PDFDocument.load(await mergeReceiptPdf([{filename:'photo.jpg',mimeType:'image/jpeg',bytes}]));
 expect(output.getPageCount()).toBe(1);expect(output.getPages()[0].getHeight()).toBeCloseTo(841.89);
});
