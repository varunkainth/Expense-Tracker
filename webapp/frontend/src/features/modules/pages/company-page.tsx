import { Link } from 'react-router-dom';
import { companyFeatures } from '../../../app/navigation';
import { PageHeader } from '../../../components/ui/page-header';
import { useWorkspace } from '../../workspace/hooks/use-workspace';
import { companyTableByPath, sumMoney } from '../../workspace/lib/format';
import { formatMoney } from '@expense-tracker/shared';
export function CompanyPage() {
  const { tables, loading } = useWorkspace();
  const expenseTables = Object.entries(companyTableByPath).filter(([, table]) => table !== 'employee_details');
  const rows = expenseTables.flatMap(([, table]) => tables[table]);
  return <><PageHeader eyebrow="YOUR WORKDAY, ORGANIZED" title="Company expenses" description="Your phone’s work expenses, employee profiles and receipt files." /><div className="workspace-summary"><div><span>Company records</span><strong>{loading ? '—' : rows.length}</strong></div><div><span>Total recorded</span><strong>{loading ? '—' : formatMoney(sumMoney(rows))}</strong></div><div><span>Receipts</span><strong>{loading ? '—' : tables.company_expense_attachments.length}</strong></div></div><p className="module-intro">Read-only phone data. Open a category to search, filter by employee or month, export CSV, and download receipts from record details.</p><div className="feature-grid">{companyFeatures.map(({ path, label, description, icon: Icon }) => { const table = companyTableByPath[path], records = tables[table]; return <Link className="feature-card" key={path} to={path}><div className="feature-card-top"><span className="icon-tile"><Icon size={21} /></span><span>{records.length} records</span></div><h3>{label}</h3><p>{description}</p><strong>{table === 'employee_details' ? `${records.length} employees` : formatMoney(sumMoney(records))}</strong></Link>; })}</div>{!loading && !rows.length && <p className="workspace-notice">No company expenses received yet. Keep the phone unlocked until the workspace transfer is complete.</p>}</>;
}
