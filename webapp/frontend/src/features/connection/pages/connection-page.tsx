import { useWorkspace } from '../../workspace/hooks/use-workspace';
import { useExpenses } from '../../expenses/hooks/use-expenses';
import { RememberBrowser } from '../components/remember-browser';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/page-header';
import { PairingPanel } from '../components/pairing-panel';
import { usePairing } from '../hooks/pairing-provider';
export function ConnectionPage() {
  const workspace = useWorkspace();
  const totalRecords = Object.values(workspace.tables).reduce((sum, rows) => sum + rows.length, 0);
  const { expenses, loading } = useExpenses();
  const { phase, status, reachable, busy, error, transferStatus, disconnect } = usePairing();
  return <><PageHeader eyebrow="YOUR LINKED DEVICES" title="Phone connection" description="Your complete phone workspace transfers while both devices stay open." />
    {phase === 'linked' ? <section className="panel appearance-panel"><h2>{status?.phoneName ?? 'Linked phone'}</h2><p className="theme-status" role="status">{!reachable ? 'Connection interrupted. Retrying…' : status?.phoneOnline ? 'Phone app is available' : 'Phone app is not reachable. Open the mobile app to reconnect.'}</p><p className="muted">{transferStatus}</p><p className="muted">{loading ? 'Reading saved expenses…' : `${expenses.length} personal expenses saved in this browser.`} {totalRecords} phone records across all datasets.</p><Link className="text-link" to="/expenses">View all personal expenses</Link><Link className="text-link" to="/company">View company expenses</Link><RememberBrowser /><button className="secondary-button" disabled={busy} onClick={() => { void disconnect(); }}>Disconnect phone</button>{error && <p role="alert">{error}</p>}</section> : <section className="panel"><PairingPanel /></section>}
    <Link className="text-link" to="/">Back to overview</Link></>;
}
