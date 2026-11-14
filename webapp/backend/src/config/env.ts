import { z } from 'zod';
const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    WEB_ORIGIN: z.string().url().refine((value) => { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && url.origin === value; }, 'Use an HTTP(S) origin without a path or trailing slash.').default('http://localhost:5173'),
    PAIRING_TTL_SECONDS: z.coerce.number().int().min(30).max(300).default(120),
    LINKED_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(28800),
    PRESENCE_TTL_SECONDS: z.coerce.number().int().min(15).max(120).default(45),
    MAX_PAIRING_SESSIONS: z.coerce.number().int().min(1).max(10000).default(1000),
    FRONTEND_DIST: z.string().optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readEnv(input: Record<string, string | undefined> = process.env) { return schema.parse({ ...input, WEB_ORIGIN: input.WEB_ORIGIN || input.RENDER_EXTERNAL_URL }); }
export type AppEnv = ReturnType<typeof readEnv>;

/** Loopback aliases share a dev server, but remain separate browser storage origins. */
export function allowedWebOrigins(env: AppEnv): string[] {
  const configured = new URL(env.WEB_ORIGIN);
  const origins = new Set([env.WEB_ORIGIN]);
  if (env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname)) {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      const alias = new URL(configured);
      alias.hostname = hostname;
      origins.add(alias.origin);
    }
  }
  return [...origins];
}
