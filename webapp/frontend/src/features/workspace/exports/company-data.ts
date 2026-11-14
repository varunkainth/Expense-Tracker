import type { ExportData } from '../../../../../../packages/claim-exports/src/company-excel';
import type { EmployeeDetails } from '../../../../../../packages/claim-exports/src/types';
import { getPeriodRange, type MonthPeriod } from '../../../../../../packages/claim-exports/src/period';
import type { MonthExpenseBreakdown } from '../../../../../../packages/claim-exports/src/attendance';
import { type DataRow, type WorkspaceTable } from '@expense-tracker/shared';
import { db, type ExpenseDatabase, type PhoneRecord } from '../../../lib/database/database';
export function inClaimPeriod(row: DataRow, period: MonthPeriod) {
  const {start,end}=getPeriodRange(period);
  if(start===null || end===null)return true;
  if(typeof row.start_date==='number')return row.start_date<end && Number(row.end_date ?? row.start_date)>=start;
  return Number(row.date)>=start && Number(row.date)<end;
}
export function selectClaimData(records: PhoneRecord[], deviceId: string, employeeId: string, period: MonthPeriod): ExportData {
  const source=records.filter((row)=>row.deviceId===deviceId);
  const employee=source.find((row)=>row.table==='employee_details' && row.id===employeeId)?.data as unknown as EmployeeDetails | undefined;
  if(!employee)throw new Error('The selected employee profile has not been received. Connect the phone and wait for the workspace import.');
  const rows=<T,>(table:WorkspaceTable):T[]=>source.filter((row)=>row.table===table && row.data.employee_id===employeeId && inClaimPeriod(row.data,period)).map((row)=>row.data).sort((a,b)=>Number(a.date ?? a.start_date)-Number(b.date ?? b.start_date)) as unknown as T[];
  return {employee,period,local:rows('local_conveyance'),outstation:rows('outstation_conveyance'),tour:rows('tour_conveyance'),phone:rows('phone_expense'),misc:rows('miscellaneous_expense'),dailyAllowance:rows('daily_allowance'),hotel:rows('hotel')};
}
export function attendanceBreakdown(data:ExportData):MonthExpenseBreakdown {
  const total=(rows:{amount:number}[])=>rows.reduce((sum,row)=>sum+row.amount,0);
  const conveyance=total(data.local),telephone=total(data.phone),misc=total(data.misc);
  const travelling=total(data.outstation)+data.tour.reduce((sum,row)=>sum+row.fare,0)+total(data.hotel)+data.dailyAllowance.reduce((sum,row)=>sum+row.total_amount,0);
  const grandTotal=conveyance+travelling+telephone+misc;
  if(!Number.isSafeInteger(grandTotal))throw new Error('Claim total exceeds the supported money range.');
  return {conveyance,travelling,telephone,misc,afterSale:0,printing:0,postage:0,grandTotal};
}
export async function loadClaimData(deviceId:string,employeeId:string,period:MonthPeriod,database:ExpenseDatabase=db) {
  return database.transaction('r',database.phoneRecords,async()=>selectClaimData(await database.phoneRecords.where('deviceId').equals(deviceId).toArray(),deviceId,employeeId,period));
}
export async function loadClaimReceipts(deviceId:string,employeeId:string,period:MonthPeriod,database:ExpenseDatabase=db) {
  return database.transaction('r',[database.phoneRecords,database.phoneFiles],async()=>{
    const records=await database.phoneRecords.where('deviceId').equals(deviceId).toArray();
    selectClaimData(records,deviceId,employeeId,period); // Require the exact selected source and profile.
    const parentTables:WorkspaceTable[]=['outstation_conveyance','hotel','tour_conveyance','miscellaneous_expense'];
    const parents=new Map(records.filter((row)=>parentTables.includes(row.table) && row.data.employee_id===employeeId && inClaimPeriod(row.data,period)).map((row)=>[`${row.table}:${row.id}`,row.data]));
    const attachments=records.filter((row)=>row.table==='company_expense_attachments' && parents.has(`${row.data.expense_type}:${row.data.expense_id}`)).sort((a,b)=>{
      const pa=parents.get(`${a.data.expense_type}:${a.data.expense_id}`)!,pb=parents.get(`${b.data.expense_type}:${b.data.expense_id}`)!;
      return Number(pa.date ?? pa.start_date)-Number(pb.date ?? pb.start_date) || Number(a.data.created_at)-Number(b.data.created_at);
    });
    if(!attachments.length)throw new Error('No expense attachments were received for this employee and period.');
    const result:{filename:string;mimeType:string;bytes:Uint8Array}[]=[];
    for(const attachment of attachments){
      const file=await database.phoneFiles.get([deviceId,attachment.id]);
      if(!file || attachment.data.unavailable_reason)throw new Error(`Receipt “${attachment.data.file_name}” is unavailable. Complete its transfer from the phone before exporting.`);
      result.push({filename:file.fileName,mimeType:file.mimeType,bytes:new Uint8Array(file.bytes)});
    }
    return result;
  });
}
