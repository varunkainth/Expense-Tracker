import { expect, test } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app';
import { readEnv } from '../src/config/env';

test('production serves SPA routes without hiding missing assets or API errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'expense-host-'));
  await writeFile(join(directory, 'index.html'), '<html>Expense Tracker</html>');
  await writeFile(join(directory, 'app.js'), 'console.log("ready")');
  await writeFile(join(directory, '.env'), 'SECRET=hidden');
  const app = buildApp(readEnv({ LOG_LEVEL: 'silent', FRONTEND_DIST: directory }));
  try {
    expect((await app.inject('/company')).body).toContain('Expense Tracker');
    expect((await app.inject('/app.js')).headers['content-type']).toContain('javascript');
    for (const path of ['/api/missing', '/missing.js', '/.env', '/assets/%2e%2e/.env']) expect((await app.inject(path)).statusCode).toBe(404);
    for (let i = 0; i < 130; i++) expect((await app.inject('/api/v1/health')).statusCode).toBe(200);
  } finally { await app.close(); await rm(directory, { recursive: true }); }
});
test('Render public origin is used unless explicitly overridden', () => {
  expect(readEnv({ RENDER_EXTERNAL_URL: 'https://example.onrender.com' }).WEB_ORIGIN).toBe('https://example.onrender.com');
  expect(readEnv({ TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
  expect(() => readEnv({ TRUST_PROXY_HOPS: '-1' })).toThrow();
});
test('proxy trust is bounded and disabled for direct deployments', async () => {
  for (const hops of ['0', '1']) {
    const app = buildApp(readEnv({ LOG_LEVEL: 'silent', TRUST_PROXY_HOPS: hops }));
    app.get('/api/test-ip', request => ({ ip: request.ip }));
    try {
      const response = await app.inject({ url: '/api/test-ip', remoteAddress: '127.0.0.1', headers: { 'x-forwarded-for': '198.51.100.99, 203.0.113.5' } });
      expect(response.json().ip).toBe(hops === '0' ? '127.0.0.1' : '203.0.113.5');
    } finally { await app.close(); }
  }
});
