import { isSessionId } from '@expense-tracker/shared';
import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import { installFrontend } from './lib/frontend';
import { healthRoutes } from './modules/health/health.routes';
import { readEnv, allowedWebOrigins, type AppEnv } from './config/env';
import { ApiError } from './lib/api-error';
import { RequestLimiter } from './lib/request-limiter';
import { PairingService } from './modules/pairing/pairing.service';
import { pairingRoutes } from './modules/pairing/pairing.routes';

/** Construction is separate from listening, allowing deterministic in-process API tests. */
export function buildApp(env: AppEnv = readEnv(), options: { now?: () => number } = {}) {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body', 'res.body'] },
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 8 * 1024,
    trustProxy: env.TRUST_PROXY_HOPS ? (_address, hop) => hop < env.TRUST_PROXY_HOPS : false,
  });
  const service = new PairingService({
    pairingTtlMs: env.PAIRING_TTL_SECONDS * 1000, linkedTtlMs: env.LINKED_TTL_SECONDS * 1000,
    presenceTtlMs: env.PRESENCE_TTL_SECONDS * 1000, maxSessions: env.MAX_PAIRING_SESSIONS, now: options.now,
    onEvent: (event) => app.log.info(event, event.event.replaceAll('_', ' ')),
  });
  const origins = allowedWebOrigins(env);
  const limiter = new RequestLimiter(options.now);
  const creationLimiter = new RequestLimiter(options.now, 10);
  const cleanup = setInterval(() => { service.prune(); limiter.prune(); creationLimiter.prune(); }, 30_000);
  cleanup.unref();
  app.addHook('onClose', async () => { clearInterval(cleanup); service.clear(); limiter.clear(); creationLimiter.clear(); });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    if (request.headers.origin && !origins.includes(request.headers.origin)) {
      throw new ApiError(403, 'ORIGIN_REJECTED', 'This browser origin is not allowed.');
    }
    if (request.url.startsWith('/api/') && request.url.split('?')[0] !== '/api/v1/health') limiter.consume(request.ip);
    if (request.method === 'POST' && request.url.split('?')[0] === '/api/v1/pairing') creationLimiter.consume(request.ip);
  });
  app.addHook('onResponse', async (request, reply) => {
    request.log.debug({ event: 'http_response', requestId: request.id, method: request.method, route: request.routeOptions.url ?? 'unmatched', statusCode: reply.statusCode, durationMs: Math.round(reply.elapsedTime) }, 'Request completed');
  });
  app.register(cors, { origin: origins, methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] });
  app.register(healthRoutes, { prefix: '/api/v1' });
  app.register(pairingRoutes(service), { prefix: '/api/v1' });
  if (env.FRONTEND_DIST) installFrontend(app, env.FRONTEND_DIST);
  app.setErrorHandler((error, request, reply) => {
    const status = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;

    if (status === 429) reply.header('Retry-After', '60');
    const known = error instanceof ApiError;
    const params = request.params as { id?: unknown } | undefined;
    const details = { sessionId: isSessionId(params?.id) ? params.id : undefined, event: 'request_failed', requestId: request.id, method: request.method, route: request.routeOptions.url ?? 'unmatched', statusCode: status, code: known ? error.code : status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST' };
    if (status >= 500) request.log.error(details, 'Request failed'); else request.log.warn(details, known ? error.message : 'Request rejected');
    reply.code(status).send({ code: known ? error.code : status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
      error: known ? error.message : status >= 500 ? 'Internal server error' : 'Invalid request' });
  });
  return app;
}
