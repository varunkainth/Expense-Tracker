import { isCapability, isSessionId, isSyncKey, parsePairingQr, type CreatedPairing } from '@expense-tracker/shared';
const KEY = 'expense-tracker.remembered-browser.v1';
const PREFERENCE = 'expense-tracker.remember-browser';
export function rememberPreference(storage: Storage): boolean { return storage.getItem(PREFERENCE) !== 'false'; }
export function setRememberPreference(storage: Storage, value: boolean) { storage.setItem(PREFERENCE, String(value)); }
export function forgetBrowser(storage: Storage) { storage.removeItem(KEY); }
export function saveBrowser(storage: Storage, origin: string, session: CreatedPairing, expiresAt: number) {
  const value = JSON.stringify({ origin, session, expiresAt });
  if (storage.getItem(KEY) !== value) storage.setItem(KEY, value);
}
export function loadBrowser(storage: Storage, origin: string, now = Date.now()): CreatedPairing | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const session = value.session as CreatedPairing;
    if (value.origin !== origin || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || !isSessionId(session.sessionId) || !isCapability(session.browserToken) || !isSyncKey(session.qr.syncKey) || parsePairingQr(session.qr).sessionId !== session.sessionId) throw new Error('Invalid saved connection');
    return session;
  } catch { forgetBrowser(storage); return null; }
}
