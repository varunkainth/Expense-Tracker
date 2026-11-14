import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import { createToken } from '../src/lib/tokens';
import { buildApp } from '../src/app';
import { readEnv } from '../src/config/env';
import { pairingQrSchema, type CreatedPairing, type ClaimedPairing, type PairingStatus } from '@expense-tracker/shared';

let app: FastifyInstance;
let now: number;
beforeEach(() => {
  now = 1_800_000_000_000;
  app = buildApp(readEnv({ LOG_LEVEL: 'silent' }), { now: () => now });
});
afterEach(async () => { await app.close(); });
const auth = (token: string) => ({ authorization: `Bearer ${token}` });
async function create() {
  const response = await app.inject({ method: 'POST', url: '/api/v1/pairing', payload: { browserName: 'My laptop' } });
  expect(response.statusCode).toBe(201);
  expect(response.headers['cache-control']).toBe('no-store');
  return response.json<CreatedPairing>();
}
async function claim(session: CreatedPairing) {
  const response = await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/claim`, payload: {
    claimToken: session.qr.claimToken, phoneDeviceId: crypto.randomUUID(), phoneName: 'My phone',
  } });
  expect(response.statusCode).toBe(200);
  return response.json<ClaimedPairing>();
}
async function approve(session: CreatedPairing, phone: ClaimedPairing) {
  return app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/approve`, headers: auth(phone.phoneToken), payload: { verificationCode: phone.verificationCode } });
}
async function confirm(session: CreatedPairing, phone: ClaimedPairing) {
  return app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/confirm`, headers: auth(session.browserToken), payload: { verificationCode: phone.verificationCode } });
}
async function status(session: CreatedPairing) {
  return app.inject({ method: 'GET', url: `/api/v1/pairing/${session.sessionId}`, headers: auth(session.browserToken) });
}

test('single-use QR challenge, phone approval and browser confirmation complete the control handshake', async () => {
  const session = await create();
  expect(pairingQrSchema.safeParse(session.qr).success).toBe(true);
  expect(JSON.stringify(session.qr)).not.toContain(session.browserToken);
  const phone = await claim(session);
  expect(phone.phoneToken).not.toBe(session.browserToken);
  const pending = (await status(session)).json<PairingStatus>();
  expect(pending.state).toBe('claimed');
  expect(pending.verificationCode).toBe(phone.verificationCode);
  expect(pending.phoneOnline).toBe(false);
  expect((await confirm(session, phone)).statusCode).toBe(409);
  expect((await approve(session, phone)).statusCode).toBe(200);
  const linked = await confirm(session, phone);
  expect(linked.json()).toMatchObject({ state: 'linked', phoneOnline: true, verificationCode: null });
  expect(JSON.stringify(linked.json())).not.toContain(phone.phoneToken);
  const replay = await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/claim`, payload: { claimToken: session.qr.claimToken, phoneDeviceId: crypto.randomUUID(), phoneName: 'Attacker' } });
  expect(replay.statusCode).toBe(401);
});

test('credentials are required and cannot be used for the other role', async () => {
  const session = await create(), phone = await claim(session);
  expect((await app.inject({ method: 'GET', url: `/api/v1/pairing/${session.sessionId}` })).statusCode).toBe(401);
  expect((await app.inject({ method: 'GET', url: `/api/v1/pairing/${session.sessionId}`, headers: auth(createToken()) })).statusCode).toBe(401);
  expect((await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/approve`, headers: auth(session.browserToken), payload: { verificationCode: phone.verificationCode } })).statusCode).toBe(401);
  expect((await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/confirm`, headers: auth(phone.phoneToken), payload: { verificationCode: phone.verificationCode } })).statusCode).toBe(401);
  expect((await app.inject({ method: 'GET', url: `/api/v1/pairing/${session.sessionId}?token=${session.browserToken}` })).statusCode).toBe(400);
});

test('wrong confirmation codes cannot approve and no expense payloads are accepted', async () => {
  const session = await create(), phone = await claim(session);
  const wrong = phone.verificationCode === '000000' ? '111111' : '000000';
  expect((await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/approve`, headers: auth(phone.phoneToken), payload: { verificationCode: wrong } })).statusCode).toBe(409);
  expect((await app.inject({ method: 'POST', url: '/api/v1/pairing', payload: { browserName: 'Laptop', expenses: [{ amount: 100 }] } })).statusCode).toBe(400);
  expect((await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/heartbeat`, headers: auth(phone.phoneToken), payload: { amount: 100 } })).statusCode).toBe(400);
  expect((await status(session)).json().state).toBe('claimed');
});

test('presence expires independently and polling does not make a phone online', async () => {
  const session = await create(), phone = await claim(session);
  await approve(session, phone); await confirm(session, phone);
  now += 45_000;
  expect((await status(session)).json().phoneOnline).toBe(false);
  const heartbeat = await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/heartbeat`, headers: auth(phone.phoneToken) });
  expect(heartbeat.json()).toMatchObject({ phoneOnline: true, browserOnline: false });
  const browserBeat = await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/heartbeat`, headers: auth(session.browserToken) });
  expect(browserBeat.json()).toMatchObject({ phoneOnline: true, browserOnline: true });
});

test('unapproved heartbeats fail, challenges expire and expired sessions cannot be claimed', async () => {
  const session = await create();
  expect((await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/heartbeat`, headers: auth(session.browserToken) })).statusCode).toBe(409);
  now += 120_000;
  expect((await status(session)).statusCode).toBe(404);
  expect((await app.inject({ method: 'POST', url: `/api/v1/pairing/${session.sessionId}/claim`, payload: { claimToken: session.qr.claimToken, phoneDeviceId: crypto.randomUUID(), phoneName: 'Phone' } })).statusCode).toBe(404);
});

test('either paired device can revoke, and linked sessions have an absolute expiry', async () => {
  const session = await create(), phone = await claim(session);
  await approve(session, phone); await confirm(session, phone);
  expect((await app.inject({ method: 'DELETE', url: `/api/v1/pairing/${session.sessionId}`, headers: auth(phone.phoneToken) })).statusCode).toBe(204);
  expect((await status(session)).statusCode).toBe(404);
  const other = await create(), otherPhone = await claim(other);
  await approve(other, otherPhone); await confirm(other, otherPhone);
  now += 28_800_000;
  expect((await status(other)).statusCode).toBe(404);
});

test('sessions stay isolated and restarting the server revokes old credentials', async () => {
  const first = await create(), second = await create();
  expect((await app.inject({ method: 'GET', url: `/api/v1/pairing/${second.sessionId}`, headers: auth(first.browserToken) })).statusCode).toBe(401);
  await app.close(); app = buildApp(readEnv({ LOG_LEVEL: 'silent' }));
  expect((await status(first)).statusCode).toBe(404);
});

test('rejects unapproved browser origins and excessive pairing requests', async () => {
  expect((await app.inject({ method: 'POST', url: '/api/v1/pairing', headers: { origin: 'https://evil.example' }, payload: { browserName: 'Laptop' } })).statusCode).toBe(403);
  for (let i = 0; i < 10; i++) await create();
  const limited = await app.inject({ method: 'POST', url: '/api/v1/pairing', payload: { browserName: 'Laptop' } });
  expect(limited.statusCode).toBe(429); expect(limited.headers['retry-after']).toBe('60');
  now += 60_000;
  expect((await create()).sessionId).toBeString();
});

test('active-session capacity is bounded and canceling frees capacity', async () => {
  await app.close(); app = buildApp(readEnv({ LOG_LEVEL: 'silent', MAX_PAIRING_SESSIONS: '1' }), { now: () => now });
  const session = await create();
  expect((await app.inject({ method: 'POST', url: '/api/v1/pairing', payload: { browserName: 'Second' } })).statusCode).toBe(503);
  await app.inject({ method: 'DELETE', url: `/api/v1/pairing/${session.sessionId}`, headers: auth(session.browserToken) });
  expect((await create()).sessionId).toBeString();
});
