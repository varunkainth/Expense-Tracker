import { expect, test } from 'bun:test';
import { buildApp } from '../src/app';
import { readEnv } from '../src/config/env';

const preflight = (origin: string) => ({ method: 'OPTIONS' as const, url: '/api/v1/pairing', headers: {
  origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,authorization',
} });

test('localhost, IPv4 and IPv6 loopback can preflight and create QR sessions in development', async () => {
  const app = buildApp(readEnv({ NODE_ENV: 'development', WEB_ORIGIN: 'http://localhost:5173', LOG_LEVEL: 'silent' }));
  try {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173']) {
      const options = await app.inject(preflight(origin));
      expect(options.statusCode).toBe(204);
      expect(options.headers['access-control-allow-origin']).toBe(origin);
      expect(options.headers['access-control-allow-methods']).toContain('POST');
      expect(options.headers['access-control-allow-headers']).toContain('Authorization');
      const response = await app.inject({ method: 'POST', url: '/api/v1/pairing', headers: { origin }, payload: { browserName: 'Laptop' } });
      expect(response.statusCode).toBe(201);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
    for (const origin of ['http://127.0.0.1:5174', 'https://localhost:5173', 'http://localhost.evil.example:5173', 'null']) {
      const response = await app.inject(preflight(origin));
      expect(response.statusCode).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  } finally { await app.close(); }
});

test('production retains an exact origin allowlist even when configured with a loopback hostname', async () => {
  const app = buildApp(readEnv({ NODE_ENV: 'production', WEB_ORIGIN: 'http://localhost:5173', LOG_LEVEL: 'silent' }));
  try {
    expect((await app.inject(preflight('http://localhost:5173'))).statusCode).toBe(204);
    expect((await app.inject(preflight('http://127.0.0.1:5173'))).statusCode).toBe(403);
  } finally { await app.close(); }
});

test('a deployed web origin never implicitly permits development loopback origins', async () => {
  const app = buildApp(readEnv({ WEB_ORIGIN: 'https://expenses.example', LOG_LEVEL: 'silent' }));
  try {
    const allowed = await app.inject(preflight('https://expenses.example'));
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://expenses.example');
    expect((await app.inject(preflight('http://localhost:5173'))).statusCode).toBe(403);
  } finally { await app.close(); }
});
