import { expect, test } from 'bun:test';
import { buildApp } from '../src/app';
import { readEnv } from '../src/config/env';
test('health reports pairing/presence support and keeps expense sync disabled', async () => {
    const app = buildApp(readEnv({ LOG_LEVEL: 'silent' }));
    try {
        const response = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: 'http://localhost:5173' } });
        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.json().capabilities).toEqual({ pairing: true, presence: true, expenseTransfer: true, workspaceTransfer: true, sync: false });
        const malformed = await app.inject({ method: 'POST', url: '/api/v1/pairing' });
        expect(malformed.statusCode).toBe(400);
    }
    finally {
        await app.close();
    }
});
test('rejects invalid configuration before opening a server', () => {
    expect(() => readEnv({ PORT: '0' })).toThrow();
    expect(() => readEnv({ WEB_ORIGIN: 'not a URL' })).toThrow();
});
