import { parseDayList } from '../exports/attendance-input';
import { useRef, useState } from 'react';
import { FileSpreadsheet, CalendarDays, Files, Printer } from 'lucide-react';
import { formatPeriodLabel, type MonthPeriod } from '../../../../../../packages/claim-exports/src/period';
import type { AttendanceExtras } from '../../../../../../packages/claim-exports/src/attendance';
import { loadClaimData, attendanceBreakdown, loadClaimReceipts } from '../exports/company-data';
import { download } from '../lib/format';
import type { WorkspaceRow } from '../hooks/use-workspace';
export function CompanyExports({employees}:{employees:WorkspaceRow[]}){
  const now=new Date();
  const [employeeKey,setEmployeeKey]=useState(''),[month,setMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`),[allDates,setAllDates]=useState(false);
  const [googleReviews,setGoogleReviews]=useState(''),[tat,setTat]=useState(''),[saturday,setSaturday]=useState<AttendanceExtras['saturdayOff']>('none'),[holidays,setHolidays]=useState(''),[absences,setAbsences]=useState('');
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[preview,setPreview]=useState<{html:string;title:string}|null>(null);
  const frame=useRef<HTMLIFrameElement>(null);
  const [previewReady,setPreviewReady]=useState(false);
  const selected=employees.find((row)=>`${row.sourceDevice}:${row.id}`===employeeKey)??employees[0];
  function changed(){setPreview(null);setPreviewReady(false);setError('');}
  function period():MonthPeriod{
    if(allDates)return {kind:'all'};
    if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Select a valid claim month.');
    const [year,value]=month.split('-').map(Number);
    if(year<1900 || year>2200 || value<1 || value>12)throw new Error('Select a valid claim month.');
    return {kind:'month',year,monthIndex:value-1};
  }
  async function run(kind:'excel'|'attendance'|'attachments'){
    if(!selected || busy)return;
    setBusy(kind);setError('');
    try{
      const selectedPeriod=period(),employeeId=String(selected.id),deviceId=selected.sourceDevice;
      const employeeSlug=String(selected.name).replace(/[^a-zA-Z0-9]/g,'_'),periodSlug=formatPeriodLabel(selectedPeriod).replace(/\s+/g,'-');
      if(kind==='excel'){
        const data=await loadClaimData(deviceId,employeeId,selectedPeriod);
        const {companyExcelBytes}=await import('../../../../../../packages/claim-exports/src/company-excel');
        download(`Claim_Form_${employeeSlug}_${periodSlug}.xlsx`,companyExcelBytes(data),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }else if(kind==='attachments'){
        const files=await loadClaimReceipts(deviceId,employeeId,selectedPeriod);
        const {mergeReceiptPdf}=await import('../exports/receipt-pdf');
        const bytes=await mergeReceiptPdf(files);
        download(`Expense_Receipts_${employeeSlug}_${periodSlug}.pdf`,new Uint8Array(bytes).buffer,'application/pdf');
      }else{
        if(selectedPeriod.kind!=='month')throw new Error('Choose a specific month for attendance.');
        const days=new Date(selectedPeriod.year,selectedPeriod.monthIndex+1,0).getDate();
        const extras:AttendanceExtras={googleReviews,serviceCallsTat:tat,saturdayOff:saturday,holidayDays:parseDayList(holidays,days),absentDays:parseDayList(absences,days)};
        const data=await loadClaimData(deviceId,employeeId,selectedPeriod);
        const {buildAttendanceHtml}=await import('../../../../../../packages/claim-exports/src/attendance');
        const title=`Attendance_Form_${employeeSlug}_${periodSlug}`;
        let html=buildAttendanceHtml(data.employee,selectedPeriod,extras,attendanceBreakdown(data));
        html=html.replace('<head>','<head><title>'+title+'</title>');
        setPreviewReady(false);setPreview({html,title});
      }
    }catch(cause){setError(cause instanceof Error?cause.message:'Export could not be generated.');}
    finally{setBusy(null);}
  }
  return <section className="panel workspace-cards company-export-panel"><h2>Monthly company exports</h2><p>Use the same claim workbook, attendance form and combined expense receipts as your mobile app. Select the employee and reporting month.</p>
    {!employees.length?<p role="status">No employee profile received. Add your work profile on the phone and complete workspace transfer first.</p>:<>
      <div className="company-export-controls"><label>Employee<select disabled={!!busy} value={selected?`${selected.sourceDevice}:${selected.id}`:''} onChange={(event)=>{setEmployeeKey(event.target.value);changed();}}>{employees.map((row)=><option key={`${row.sourceDevice}:${row.id}`} value={`${row.sourceDevice}:${row.id}`}>{row.name} · {row.employee_code} · {row.sourceDevice.slice(0,8)}</option>)}</select></label><label>Reporting month<input type="month" min="1900-01" max="2200-12" value={month} disabled={!!busy||allDates} onChange={(event)=>{setMonth(event.target.value);changed();}} /></label></div>
      <label className="export-all-dates"><input type="checkbox" checked={allDates} disabled={!!busy} onChange={(event)=>{setAllDates(event.target.checked);changed();}} />All dates for workbook and receipts</label>
      <div className="company-export-cards"><article><FileSpreadsheet size={23}/><h3>Claim workbook</h3><p>Styled Excel workbook with the same three claim sheets as mobile, including conveyance, travel, hotel, allowance, phone and miscellaneous expenses.</p><button className="primary-button" disabled={!!busy} onClick={()=>{void run('excel');}}>{busy==='excel'?'Generating workbook…':'Export Excel (.xlsx)'}</button></article>
      <article><Files size={23}/><h3>Expense attachments</h3><p>One PDF containing the selected employee’s received PDF and image receipts. Hotel stays overlapping the month are included.</p><button className="secondary-button" disabled={!!busy} onClick={()=>{void run('attachments');}}>{busy==='attachments'?'Combining receipts…':'Export expense attachments'}</button></article></div>
      <div className="attendance-export-settings"><h3><CalendarDays size={20}/> Attendance form</h3><p>Uses the mobile A4 form and attendance rules. Preview it here, then choose Save as PDF in your browser’s print dialog.</p><div className="company-export-controls"><label>Google reviews<input maxLength={120} value={googleReviews} disabled={!!busy} onChange={(event)=>{setGoogleReviews(event.target.value);changed();}} /></label><label>Service calls TAT<input maxLength={120} value={tat} disabled={!!busy} onChange={(event)=>{setTat(event.target.value);changed();}} /></label><label>Saturday off<select value={saturday} disabled={!!busy} onChange={(event)=>{setSaturday(event.target.value as AttendanceExtras['saturdayOff']);changed();}}><option value="none">None</option><option value="1st-3rd">1st &amp; 3rd Saturdays</option><option value="2nd-4th">2nd &amp; 4th Saturdays</option></select></label><label>Holiday days<input value={holidays} disabled={!!busy} placeholder="e.g. 5, 12-14" onChange={(event)=>{setHolidays(event.target.value);changed();}} /></label><label>Absent days<input value={absences} disabled={!!busy} placeholder="e.g. 8, 20" onChange={(event)=>{setAbsences(event.target.value);changed();}} /></label></div><button className="secondary-button" disabled={!!busy||allDates} onClick={()=>{void run('attendance');}}>{busy==='attendance'?'Preparing attendance…':'Preview attendance form'}</button>{allDates&&<p className="muted">Attendance requires a specific reporting month.</p>}</div>
      {preview&&<><div className="workspace-actions"><button className="primary-button" disabled={!previewReady} onClick={()=>{frame.current?.contentWindow?.focus();frame.current?.contentWindow?.print();}}><Printer size={16}/>Print / Save attendance PDF</button><button className="text-button" onClick={()=>setPreview(null)}>Close preview</button><span className="muted">A4 · Portrait · No margins · Turn off browser headers/footers</span></div><div className="attendance-export-preview"><iframe ref={frame} title={preview.title} srcDoc={preview.html} onLoad={()=>setPreviewReady(true)} sandbox="allow-same-origin allow-modals" /></div></>}
    </>}{error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
