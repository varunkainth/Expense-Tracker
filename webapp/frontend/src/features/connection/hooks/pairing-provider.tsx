import { receiveWorkspaceChunk } from '../data/workspace-import';
import { finishPhoneApproval } from '../lib/finish-phone-approval';
import { forgetBrowser, loadBrowser, rememberPreference, saveBrowser, setRememberPreference } from '../lib/remembered-browser';
import { generateSyncKey, decryptTransfer } from '../lib/transfer-crypto';
import { importPhoneSnapshot } from '../data/phone-import';
import { db } from '../../../lib/database/database';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PairingClient, PairingApiError, type CreatedPairing, type PairingStatus } from '@expense-tracker/shared';

import { browserLabel } from '../lib/browser-label';

type Phase = 'restoring' | 'idle' | 'creating' | 'waiting' | 'claimed' | 'approved' | 'linked' | 'expired' | 'error';
interface PairingContextValue {
  session: CreatedPairing | null; status: PairingStatus | null; phase: Phase; error: string; reachable: boolean; busy: boolean; transferStatus: string;
  rememberBrowser: boolean; rememberError: string; setRememberBrowser: (value: boolean) => void;
  create: () => Promise<void>; disconnect: () => Promise<boolean>; dismissPending: () => void;
}
const Context = createContext<PairingContextValue | null>(null);
function client() { return new PairingClient(import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin), fetch, import.meta.env.DEV); }
export function PairingProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    try { const enabled = rememberPreference(localStorage); return { enabled, session: enabled ? loadBrowser(localStorage, client().origin) : null }; }
    catch { return { enabled: true, session: null }; }
  });
  const [rememberBrowser, setRemember] = useState(initial.enabled);
  const remember = useRef(initial.enabled);
  const [rememberError, setRememberError] = useState('');
  const [session, setSession] = useState<CreatedPairing | null>(initial.session);
  const current = useRef<CreatedPairing | null>(initial.session);
  const linkedStatus = useRef<PairingStatus | null>(null);
  const forget = useCallback(() => {
    try { forgetBrowser(localStorage); setRememberError(''); }
    catch { setRememberError('Could not remove the saved connection. Clear this site’s browser storage to forget it.'); }
  }, []);
  const persist = useCallback((value: PairingStatus) => {
    if (!remember.current || !current.current || value.state !== 'linked') return;
    try { saveBrowser(localStorage, client().origin, current.current, value.expiresAt); setRememberError(''); }
    catch { setRememberError('This browser could not save the connection. Refreshing will require pairing again.'); }
  }, []);
  const setRememberBrowser = useCallback((value: boolean) => {
    remember.current = value; setRemember(value);
    try { setRememberPreference(localStorage, value); } catch { setRememberError('Browser storage is unavailable.'); }
    if (!value) forget(); else if (linkedStatus.current) persist(linkedStatus.current);
  }, [forget, persist]);
  const generation = useRef(0);
  const working = useRef(false);
  const [status, setStatus] = useState<PairingStatus | null>(null);
  const [phase, setPhase] = useState<Phase>(initial.session ? 'restoring' : 'idle');
  const [error, setError] = useState('');
  const [reachable, setReachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferStatus, setTransferStatus] = useState('Waiting for phone expenses…');
  const accept = useCallback((value: PairingStatus) => {
    linkedStatus.current = value;
    setStatus(value); setPhase(value.state); setReachable(true); setError('');
    persist(value);
  }, [persist]);
  const create = useCallback(async () => {
    if (working.current || current.current) return;
    working.current = true; setBusy(true); setPhase('creating'); setError('');
    const version = generation.current;
    try {
      const api = client();
      const secret = generateSyncKey();
      const created = await api.create(browserLabel(navigator.userAgent));
      created.qr.syncKey = secret;
      setTransferStatus('Waiting for phone expenses…');
      if (version !== generation.current) { void api.revoke(created.sessionId, created.browserToken).catch(() => {}); return; }
      current.current = created; setSession(created); setStatus(null); setPhase('waiting'); setReachable(true);
    } catch (cause) {
      if (version === generation.current) { setPhase('error'); setReachable(false); setError(cause instanceof Error ? cause.message : 'Could not create a pairing code.'); }
    } finally { working.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const version = generation.current;
    let active = true, timer: ReturnType<typeof setTimeout>, lastHeartbeat = 0;
    async function poll() {
      try {
        const api = client();
        let value = await api.status(session!.sessionId, session!.browserToken, controller.signal);
        if (!active || version !== generation.current) return;
        if (value.state === 'approved' && value.verificationCode) {
          value = await finishPhoneApproval(api, session!, value);
          if (!active || version !== generation.current) return;
        }
        if (value.state === 'linked' && document.visibilityState === 'visible' && Date.now() - lastHeartbeat >= 20_000) {
          value = await api.heartbeat(session!.sessionId, session!.browserToken, controller.signal); lastHeartbeat = Date.now();
        }
        if (active && version === generation.current) accept(value);
        if (value.state === 'linked' && document.visibilityState === 'visible') {
          try {
            const envelope = await api.receiveTransfer(session!.sessionId, session!.browserToken, controller.signal);
            if (!active || version !== generation.current) return;
            if (envelope) {
              const payload = await decryptTransfer(session!.qr.syncKey ?? '', session!.sessionId, envelope);
              if (!active || version !== generation.current) return;
              const workspace = payload && typeof payload === 'object' && 'type' in payload && payload.type === 'workspace-chunk';
              const imported = workspace ? await receiveWorkspaceChunk(db, payload, session!.sessionId, envelope.sequence) : { ...await importPhoneSnapshot(db, payload, session!.sessionId, envelope.sequence), completed: true, companyCount: 0, recordCount: 0, attachmentCount: 0, part: 0, parts: 1 };
              if (!active || version !== generation.current) return;
              await api.acknowledgeTransfer(session!.sessionId, session!.browserToken, envelope.sequence, controller.signal, imported.expenseCount, workspace ? { completed: imported.completed, companyCount: imported.companyCount, recordCount: imported.recordCount, attachmentCount: imported.attachmentCount } : undefined);
              if (active) setTransferStatus(!imported.completed ? `Receiving workspace · chunk ${imported.part + 1} of ${imported.parts}` : workspace ? `Imported ${imported.expenseCount} personal and ${imported.companyCount} company expenses · ${imported.recordCount} records · ${imported.attachmentCount} receipts` : `${imported.expenseCount} personal expenses imported.`);
            }
          } catch { if (active) setTransferStatus('Expense transfer failed. Retrying while both devices stay open.'); }
        }
      } catch (cause) {
        if (!active || version !== generation.current) return;
        setReachable(false);
        if (cause instanceof PairingApiError && (cause.status === 401 || cause.status === 404)) {
          forget(); linkedStatus.current = null;
          generation.current++; current.current = null; setSession(null); setStatus(null); setPhase('expired'); setError(cause.message); return;
        }
        setError('Connection interrupted. Retrying…');
      } finally { if (active && !controller.signal.aborted) timer = setTimeout(() => { void poll(); }, document.visibilityState === 'visible' ? 3000 : 15000); }
    }
    void poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [session, accept, forget]);
  const disconnect = useCallback(async () => {
    if (working.current) return false;
    working.current = true; setBusy(true);
    try {
      const value = current.current;
      if (value) await client().revoke(value.sessionId, value.browserToken);
      forget(); linkedStatus.current = null;
      generation.current++; current.current = null; setSession(null); setStatus(null); setPhase('idle'); setError(''); setReachable(false);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not disconnect. Try again.'); return false; }
    finally { working.current = false; setBusy(false); }
  }, [forget]);
  const dismissPending = useCallback(() => {
    forget(); linkedStatus.current = null;
    generation.current++;
    const value = current.current;
    current.current = null; setSession(null); setStatus(null); setPhase('idle'); setError(''); setReachable(false);
    if (value) void client().revoke(value.sessionId, value.browserToken).catch(() => {});
  }, [forget]);
  return <Context.Provider value={{ rememberBrowser, rememberError, setRememberBrowser, session, status, phase, error, reachable, busy, transferStatus, create, disconnect, dismissPending }}>{children}</Context.Provider>;
}
export function usePairing() { const value = useContext(Context); if (!value) throw new Error('PairingProvider is required.'); return value; }
