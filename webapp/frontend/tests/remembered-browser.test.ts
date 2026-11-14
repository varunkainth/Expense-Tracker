import { expect, test } from 'bun:test';
import { forgetBrowser, loadBrowser, rememberPreference, saveBrowser, setRememberPreference } from '../src/features/connection/lib/remembered-browser';
import type { CreatedPairing } from '@expense-tracker/shared';
function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}
const session: CreatedPairing = { sessionId: crypto.randomUUID(), browserToken: 'a'.repeat(43), expiresAt: 1000,
  qr: { type: 'expense-tracker.pairing', version: 1, sessionId: '', claimToken: 'b'.repeat(43), expiresAt: 1000, syncKey: 'a'.repeat(64) } };
session.qr.sessionId = session.sessionId;
test('refresh restores transfer key and credentials until linked expiry, even after original QR expiry', () => {
  const store = storage();
  saveBrowser(store, 'https://relay.example', session, 10000);
  expect(loadBrowser(store, 'https://relay.example', 2000)).toEqual(session);
  expect(loadBrowser(store, 'https://relay.example', 10000)).toBeNull();
  expect(store.length).toBe(0);
});
test('changed backend, corrupt JSON and invalid keys cannot restore a connection', () => {
  const store = storage();
  saveBrowser(store, 'https://relay.example', session, 10000);
  expect(loadBrowser(store, 'https://other.example', 2000)).toBeNull();
  store.setItem('expense-tracker.remembered-browser.v1', 'broken');
  expect(loadBrowser(store, 'https://relay.example', 2000)).toBeNull();
  saveBrowser(store, 'https://relay.example', { ...session, qr: { ...session.qr, syncKey: 'invalid' } }, 10000);
  expect(loadBrowser(store, 'https://relay.example', 2000)).toBeNull();
});
test('forgetting removes credentials without affecting records and opt-out survives refresh', () => {
  const store = storage();
  expect(rememberPreference(store)).toBe(true);
  saveBrowser(store, 'https://relay.example', session, 10000);
  store.setItem('unrelated-expenses', 'preserved');
  setRememberPreference(store, false); forgetBrowser(store);
  expect(loadBrowser(store, 'https://relay.example', 2000)).toBeNull();
  expect(rememberPreference(store)).toBe(false);
  expect(store.getItem('unrelated-expenses')).toBe('preserved');
});
test('blocked storage surfaces failure to the caller instead of claiming to save', () => {
  const store = storage(); store.setItem = () => { throw new Error('Storage blocked'); };
  expect(() => saveBrowser(store, 'https://relay.example', session, 10000)).toThrow('blocked');
});
