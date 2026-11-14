import { RememberBrowser } from './remember-browser';
import { useEffect, useState } from 'react';
import { PairingQrCode } from './pairing-qr';
import { RefreshCw, ScanLine } from 'lucide-react';
import { usePairing } from '../hooks/pairing-provider';

export function PairingPanel() {
  const { session, status, phase, error, busy, create, disconnect } = usePairing();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (phase === 'idle' || phase === 'expired') void create(); }, [phase, create]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0;
  const showQr = phase === 'waiting' && session && seconds > 0;
  async function renew() { if (await disconnect()) await create(); }
  return <div className="pairing-code-panel">
    {showQr ? <div className="pairing-qr"><PairingQrCode value={JSON.stringify(session.qr)} /></div> : <div className="pairing-code-placeholder" aria-hidden="true"><ScanLine size={60} strokeWidth={1} /><span>{phase === 'restoring' ? 'Restoring connection…' : phase === 'creating' ? 'Creating code…' : phase === 'claimed' || phase === 'approved' ? 'Phone scanned' : 'Pair again'}</span></div>}
    {phase === 'waiting' && seconds > 0 && <><span className="pairing-status">Scan to connect · {seconds}s remaining</span><p>In the phone app, open Settings → Linked Browser.</p></>}
    {(phase === 'claimed' || phase === 'approved') && <div className="pairing-verification"><strong>{status?.phoneName}</strong><p>Compare this code with your phone:</p><span className="verification-code">{status?.verificationCode}</span>{phase === 'claimed' ? <p>Approve on your phone to continue.</p> : <p role="status">Phone approved. Connecting automatically…</p>}</div>}
    {phase === 'linked' && <p role="status">Phone linked. Your workspace will transfer while the app stays open.</p>}
    <RememberBrowser />
    {error && <p className="pairing-error" role="alert">{error}</p>}
    {(phase === 'expired' || phase === 'error' || (phase === 'waiting' && seconds === 0)) && <p>Expired codes refresh automatically. If the server is unavailable, use New QR code to retry.</p>}
    <button className="text-button pairing-refresh" type="button" onClick={() => { void renew(); }} disabled={busy || phase === 'linked' || phase === 'restoring'}><RefreshCw size={13} />New QR code</button>
  </div>;
}
