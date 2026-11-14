import { ArrowRight, Laptop, LockKeyhole, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { PairingPanel } from './pairing-panel';
import { ThemeDropdown } from '../../appearance/components/theme-dropdown';

export function PairingScreen({ onContinueLocal }: { onContinueLocal: () => void }) {
  return (
    <div className="pairing-page">
      <header className="pairing-header">
        <div className="brand"><span className="brand-mark"><Wallet size={23} /></span><span>Expense Tracker<small>YOUR PERSONAL WORKSPACE</small></span></div>
        <ThemeDropdown />
      </header>
      <main className="pairing-main">
        <div className="pairing-heading"><span className="pairing-eyebrow">EXPENSE TRACKER FOR WEB</span><h1>Your phone.<br />A bigger picture.</h1><p>Link your phone to view your expenses, plans and receipts on a bigger screen.</p></div>
        <section className="pairing-card" aria-labelledby="pairing-title">
          <div className="pairing-copy">
            <span className="pairing-device-icon"><Smartphone size={25} /><ArrowRight size={17} /><Laptop size={27} /></span>
            <h2 id="pairing-title">Connect with a QR code</h2>
            <p>Open Settings → Linked Browser in the phone app. Scan this code, compare the verification codes, and approve on your phone. The browser connects automatically.</p>
            <ul className="pairing-benefits">
              <li><ShieldCheck size={19} /><div><strong>Your data stays with you</strong><span>A local workspace on each device.</span></div></li>
              <li><LockKeyhole size={19} /><div><strong>You approve the connection</strong><span>Only pair browsers you trust.</span></div></li>
            </ul>
          </div>
          <PairingPanel />
        </section>
        <div className="pairing-local-option"><p>Prefer to keep this browser separate?</p><button type="button" onClick={onContinueLocal}>Use browser only <ArrowRight size={15} /></button><small>Opens separate local records. It does not connect or sync your phone.</small></div>
      </main>
      <footer className="pairing-footer"><LockKeyhole size={13} /><span>Your expenses belong to you.</span></footer>
    </div>
  );
}
