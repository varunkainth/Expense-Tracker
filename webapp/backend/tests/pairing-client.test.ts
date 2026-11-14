import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import { PairingClient, PairingApiError, decodePairingQr, normalizePairingOrigin, type PairingFetch } from '@expense-tracker/shared';
import { buildApp } from '../src/app';
import { readEnv } from '../src/config/env';

let app: FastifyInstance;
let client: PairingClient;
beforeEach(() => {
  app = buildApp(readEnv({ LOG_LEVEL: 'silent' }));
  const transport = (async (input, init) => {
    const response = await app.inject({ method: (init?.method ?? 'GET') as 'GET' | 'POST' | 'DELETE',
      url: new URL(String(input)).pathname, headers: Object.fromEntries(new Headers(init?.headers).entries()),
      ...(init?.body ? { payload: String(init.body) } : {}) });
    return new Response(response.statusCode === 204 ? null : response.body, { status: response.statusCode, headers: response.headers as Record<string, string> });
  }) as PairingFetch;
  client = new PairingClient('https://relay.example', transport);
});
afterEach(async () => { await app.close(); });

test('the common browser and mobile client completes the real API handshake', async () => {
  const browser = await client.create('Laptop');
  const scanned = decodePairingQr(JSON.stringify(browser.qr));
  const phone = await client.claim(scanned, crypto.randomUUID(), 'My phone');
  expect((await client.status(browser.sessionId, browser.browserToken)).verificationCode).toBe(phone.verificationCode);
  await client.approve(phone.sessionId, phone.phoneToken, phone.verificationCode);
  expect((await client.confirm(browser.sessionId, browser.browserToken, phone.verificationCode)).state).toBe('linked');
  expect((await client.heartbeat(phone.sessionId, phone.phoneToken)).phoneOnline).toBe(true);
  await client.revoke(browser.sessionId, browser.browserToken);
  await expect(client.status(phone.sessionId, phone.phoneToken)).rejects.toBeInstanceOf(PairingApiError);
  await client.revoke(phone.sessionId, phone.phoneToken); // Already-revoked links can be removed locally.
});

test('scanned payloads cannot choose a backend or smuggle other fields', async () => {
  const browser = await client.create('Laptop');
  expect(() => decodePairingQr(JSON.stringify({ ...browser.qr, origin: 'https://evil.example' }))).toThrow();
  expect(() => decodePairingQr('https://evil.example')).toThrow();
  expect(() => decodePairingQr('x'.repeat(2049))).toThrow();
  expect(() => decodePairingQr(JSON.stringify({ ...browser.qr, version: 2 }))).toThrow();
  expect(() => decodePairingQr(JSON.stringify({ ...browser.qr, sessionId: '../other' }))).toThrow();
});

test('production clients reject HTTP, credentials and non-origin URLs', () => {
  expect(normalizePairingOrigin('https://relay.example/')).toBe('https://relay.example');
  expect(normalizePairingOrigin('http://192.168.1.2:3001', true)).toBe('http://192.168.1.2:3001');
  for (const value of ['http://relay.example', 'https://name:password@relay.example', 'https://relay.example/path', 'https://relay.example?token=x', 'javascript:alert(1)']) expect(() => normalizePairingOrigin(value)).toThrow();
});

test('clients reject malformed and cross-session server responses', async () => {
  const broken = new PairingClient('https://relay.example', (async () => Response.json({ state: 'linked' })) as PairingFetch);
  await expect(broken.create('Laptop')).rejects.toThrow();
  const session = await client.create('Laptop');
  const status = await client.status(session.sessionId, session.browserToken);
  const swapped = new PairingClient('https://relay.example', (async () => Response.json({ ...status, sessionId: crypto.randomUUID() })) as PairingFetch);
  await expect(swapped.status(session.sessionId, session.browserToken)).rejects.toThrow('Unexpected pairing session');
});


test('browser fetch receives its required global receiver instead of the PairingClient instance', async () => {
  const response = await client.create('Laptop');
  const brandedFetch: PairingFetch = function (this: typeof globalThis) {
    if (this !== globalThis) throw new TypeError('fetch called on an object that does not implement interface Window');
    return Promise.resolve(Response.json(response));
  };
  const browserClient = new PairingClient('https://relay.example', brandedFetch);
  expect((await browserClient.create('Laptop')).sessionId).toBe(response.sessionId);
});

test('clients can verify the backend before opening the camera', async () => {
  await client.checkServer();
  const other = new PairingClient('https://relay.example', (async () => Response.json({ status: 'ok', capabilities: {} })) as PairingFetch);
  await expect(other.checkServer()).rejects.toThrow('not a compatible');
});

test('connection errors explain network failure and deliberate cancellation separately', async () => {
  const { PairingConnectionError } = await import('@expense-tracker/shared');
  const offline = new PairingClient('https://relay.example', (async () => { throw new TypeError('Network request failed'); }) as PairingFetch);
  try { await offline.create('Laptop'); throw new Error('Expected failure'); }
  catch (cause) { expect(cause).toBeInstanceOf(PairingConnectionError); expect((cause as InstanceType<typeof PairingConnectionError>).kind).toBe('network'); }
  const controller = new AbortController(); controller.abort();
  const cancelled = new PairingClient('https://relay.example', (async () => { throw new Error('cancelled'); }) as PairingFetch);
  try { await cancelled.create('Laptop', controller.signal); throw new Error('Expected failure'); }
  catch (cause) { expect(cause).toBeInstanceOf(PairingConnectionError); expect((cause as InstanceType<typeof PairingConnectionError>).kind).toBe('cancelled'); }
});

test('phones reject loopback addresses but accept a configured LAN development backend', async () => {
  const { phonePairingOrigin } = await import('@expense-tracker/shared');
  for (const origin of ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://[::1]:3001']) expect(() => phonePairingOrigin(origin, true)).toThrow('Wi-Fi IP');
  expect(phonePairingOrigin('http://192.168.1.10:3001', true)).toBe('http://192.168.1.10:3001');
  expect(() => phonePairingOrigin('http://192.168.1.10:3001')).toThrow('HTTPS');
});
