import { parseTransfer, isSyncKey, parseImportInfo, type TransferImportInfo, type TransferEnvelope } from './transfer';
export * from './transfer';
/** Platform-neutral pairing contract and HTTP client. No Expo, React, storage or QR-library imports. */
export type PairingState = 'waiting' | 'claimed' | 'approved' | 'linked';
export interface PairingQr { type: 'expense-tracker.pairing'; version: 1; sessionId: string; claimToken: string; expiresAt: number; syncKey?: string }
export interface PairingStatus {
  sessionId: string; state: PairingState; expiresAt: number; browserName: string;
  phoneName: string | null; verificationCode: string | null; phoneOnline: boolean; browserOnline: boolean;
}
export interface CreatedPairing { sessionId: string; browserToken: string; expiresAt: number; qr: PairingQr }
export interface ClaimedPairing { sessionId: string; phoneToken: string; browserName: string; verificationCode: string; expiresAt: number }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token = /^[A-Za-z0-9_-]{43}$/;
const code = /^\d{6}$/;
export function isCapability(value: unknown): value is string { return typeof value === 'string' && token.test(value); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid pairing response.');
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
function name(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 80; }
export function isSessionId(value: unknown): value is string { return typeof value === 'string' && uuid.test(value); }
export function parsePairingQr(value: unknown): PairingQr {
  const data = object(value);
  if (!['claimToken,expiresAt,sessionId,type,version', 'claimToken,expiresAt,sessionId,syncKey,type,version'].includes(Object.keys(data).sort().join(',')) || (data.syncKey !== undefined && !isSyncKey(data.syncKey)) ||
    data.type !== 'expense-tracker.pairing' || data.version !== 1 || !isSessionId(data.sessionId) || !isCapability(data.claimToken) || !timestamp(data.expiresAt)) throw new Error('This is not an Expense Tracker pairing QR code.');
  return data as unknown as PairingQr;
}
export function decodePairingQr(text: string): PairingQr {
  if (text.length > 2048) throw new Error('Invalid pairing QR code.');
  try { return parsePairingQr(JSON.parse(text)); } catch { throw new Error('This is not a supported Expense Tracker pairing QR code.'); }
}
export function parsePairingStatus(value: unknown): PairingStatus {
  const data = object(value);
  if (!isSessionId(data.sessionId) || !['waiting', 'claimed', 'approved', 'linked'].includes(String(data.state)) ||
    !timestamp(data.expiresAt) || !name(data.browserName) || !(data.phoneName === null || name(data.phoneName)) ||
    !(data.verificationCode === null || (typeof data.verificationCode === 'string' && code.test(data.verificationCode))) ||
    typeof data.phoneOnline !== 'boolean' || typeof data.browserOnline !== 'boolean') throw new Error('Invalid pairing status.');
  return data as unknown as PairingStatus;
}
export function normalizePairingOrigin(value: string, allowDevelopmentHttp = false): string {
  const clean = value.trim().replace(/\/$/, '');
  let url: URL;
  try { url = new URL(clean); } catch { throw new Error('Configure a valid pairing server address.'); }
  if (url.username || url.password || url.origin !== clean || !(url.protocol === 'https:' || (allowDevelopmentHttp && url.protocol === 'http:'))) throw new Error('Use a trusted HTTPS server origin without paths or credentials.');
  return url.origin;
}
export class PairingApiError extends Error {
  constructor(public readonly status: number) { super(status === 401 || status === 404 ? 'This connection expired or was disconnected. Pair again.' : status === 429 ? 'Too many attempts. Wait a minute and try again.' : status === 409 ? 'The pairing state changed. Refresh the connection and try again.' : 'The pairing request failed. Try again.'); }
}
export class PairingConnectionError extends Error {
  constructor(public readonly kind: 'timeout' | 'network' | 'cancelled') {
    super(kind === 'cancelled' ? 'Pairing request cancelled.' : kind === 'timeout'
      ? 'The pairing server did not respond in time. Check the server address, Wi-Fi connection and that the backend is running. Refresh the browser QR before trying again.'
      : 'Cannot reach the pairing server. Check its address and port, keep both devices on the same Wi-Fi, and make sure the backend is running.');
    this.name = 'PairingConnectionError';
  }
}
export function phonePairingOrigin(value: string, allowDevelopmentHttp = false): string {
  const origin = normalizePairingOrigin(value, allowDevelopmentHttp);
  if (['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('On your phone, use your computer’s Wi-Fi IP address, not localhost or 127.0.0.1. Example: http://192.168.1.10:3001 (development only).');
  return origin;
}
export type PairingFetch = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;
export class PairingClient {
  readonly origin: string;
  constructor(origin: string, private readonly fetcher: PairingFetch = fetch, allowDevelopmentHttp = false) { this.origin = normalizePairingOrigin(origin, allowDevelopmentHttp); }
  private async request(path: string, method: string, bearer?: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; abort(); }, 8000);
    try {
      const response = await this.fetcher.call(globalThis, `${this.origin}/api/v1${path}`, { method, redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) throw new PairingApiError(response.status);
      if (response.status === 204) return undefined;
      return await response.json();
    } catch (cause) {
      if (cause instanceof PairingApiError) throw cause;
      if (timedOut) throw new PairingConnectionError('timeout');
      if (signal?.aborted) throw new PairingConnectionError('cancelled');
      if (cause instanceof SyntaxError) throw new Error('The server returned an invalid response. Check that this address points to the Expense Tracker backend.');
      throw new PairingConnectionError('network');
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  private path(id: string) { if (!isSessionId(id)) throw new Error('Invalid pairing session.'); return `/pairing/${id}`; }
  async checkServer(signal?: AbortSignal): Promise<void> {
    const data = object(await this.request('/health', 'GET', undefined, undefined, signal));
    const capabilities = object(data.capabilities);
    if (data.status !== 'ok' || data.service !== 'expense-tracker-relay' || data.protocolVersion !== 1 || capabilities.pairing !== true) throw new Error('This address is not a compatible Expense Tracker pairing server.');
  }
  async create(browserName: string, signal?: AbortSignal): Promise<CreatedPairing> {
    const data = object(await this.request('/pairing', 'POST', undefined, { browserName }, signal));
    const qr = parsePairingQr(data.qr);
    if (!isCapability(data.browserToken) || data.browserToken === qr.claimToken || data.sessionId !== qr.sessionId || data.expiresAt !== qr.expiresAt) throw new Error('Invalid pairing challenge.');
    return { sessionId: qr.sessionId, browserToken: data.browserToken, expiresAt: qr.expiresAt, qr };
  }
  async claim(qr: PairingQr, phoneDeviceId: string, phoneName: string): Promise<ClaimedPairing> {
    const valid = parsePairingQr(qr);
    const data = object(await this.request(`${this.path(valid.sessionId)}/claim`, 'POST', undefined, { claimToken: valid.claimToken, phoneDeviceId, phoneName }));
    if (data.sessionId !== valid.sessionId || !isCapability(data.phoneToken) || !name(data.browserName) || typeof data.verificationCode !== 'string' || !code.test(data.verificationCode) || !timestamp(data.expiresAt)) throw new Error('Invalid phone approval response. Refresh the QR code.');
    return data as unknown as ClaimedPairing;
  }
  private async statusRequest(id: string, bearer: string, suffix: string, method: string, body?: unknown, signal?: AbortSignal) {
    if (!isCapability(bearer)) throw new Error('Invalid pairing credentials.');
    const result = parsePairingStatus(await this.request(`${this.path(id)}${suffix}`, method, bearer, body, signal));
    if (result.sessionId !== id) throw new Error('Unexpected pairing session.');
    return result;
  }
  status(id: string, bearer: string, signal?: AbortSignal) { return this.statusRequest(id, bearer, '', 'GET', undefined, signal); }
  approve(id: string, bearer: string, verificationCode: string) { return this.statusRequest(id, bearer, '/approve', 'POST', { verificationCode }); }
  confirm(id: string, bearer: string, verificationCode: string) { return this.statusRequest(id, bearer, '/confirm', 'POST', { verificationCode }); }
  heartbeat(id: string, bearer: string, signal?: AbortSignal) { return this.statusRequest(id, bearer, '/heartbeat', 'POST', undefined, signal); }
  async publishTransfer(id: string, bearer: string, envelope: TransferEnvelope, signal?: AbortSignal) {
    await this.request(`${this.path(id)}/transfer`, 'POST', bearer, parseTransfer(envelope), signal);
  }
  async receiveTransfer(id: string, bearer: string, signal?: AbortSignal): Promise<TransferEnvelope | null> {
    const data = object(await this.request(`${this.path(id)}/transfer`, 'GET', bearer, undefined, signal));
    return data.envelope === null ? null : parseTransfer(data.envelope);
  }
  async transferReceipt(id: string, bearer: string, signal?: AbortSignal): Promise<{ latestSequence: number; acknowledgedSequence: number; importedExpenseCount: number | null; importInfo?: TransferImportInfo }> {
    const data = object(await this.request(`${this.path(id)}/transfer/status`, 'GET', bearer, undefined, signal));
    if (![data.latestSequence, data.acknowledgedSequence].every((value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || (data.acknowledgedSequence as number) > (data.latestSequence as number)) throw new Error('Invalid transfer receipt.');
    if (data.importedExpenseCount !== null && data.importedExpenseCount !== undefined && (typeof data.importedExpenseCount !== 'number' || !Number.isSafeInteger(data.importedExpenseCount) || data.importedExpenseCount < 0 || data.importedExpenseCount > 3000)) throw new Error('Invalid imported expense count.');
    return { latestSequence: data.latestSequence as number, acknowledgedSequence: data.acknowledgedSequence as number, importedExpenseCount: (data.importedExpenseCount ?? null) as number | null, ...(data.importInfo === undefined ? {} : { importInfo: parseImportInfo(data.importInfo) }) };
  }
  async acknowledgeTransfer(id: string, bearer: string, sequence: number, signal?: AbortSignal, expenseCount?: number, importInfo?: TransferImportInfo) {
    await this.request(`${this.path(id)}/transfer/ack`, 'POST', bearer, { sequence, ...(expenseCount === undefined ? {} : { expenseCount }), ...(importInfo === undefined ? {} : { importInfo: parseImportInfo(importInfo) }) }, signal);
  }
  async revoke(id: string, bearer: string) {
    if (!isCapability(bearer)) throw new Error('Invalid pairing credentials.');
    try { await this.request(this.path(id), 'DELETE', bearer); }
    catch (error) { if (!(error instanceof PairingApiError && error.status === 404)) throw error; }
  }
}
