import { usePairing } from '../hooks/pairing-provider';
export function RememberBrowser() {
  const { rememberBrowser, setRememberBrowser, rememberError } = usePairing();
  return <div className="remember-browser"><label><input type="checkbox" checked={rememberBrowser} onChange={(event) => setRememberBrowser(event.target.checked)} />Remember this browser</label><p className="muted text-small">Saves the connection and transfer key on this browser. Use on your own device.</p>{rememberError && <p role="alert" className="pairing-error">{rememberError}</p>}</div>;
}
