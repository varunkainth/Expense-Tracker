import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { approvePairingSchema, capabilityTokenSchema, claimPairingSchema, createPairingSchema, sessionIdSchema } from '@expense-tracker/shared';
import { ApiError } from '../../lib/api-error';
import type { PairingService } from './pairing.service';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'INVALID_REQUEST', 'Invalid request fields.');
  return result.data;
}
function credentials(request: FastifyRequest): string {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHORIZED', 'Valid session credentials are required.');
  const result = capabilityTokenSchema.safeParse(value.slice(7));
  if (!result.success) throw new ApiError(401, 'UNAUTHORIZED', 'Valid session credentials are required.');
  return result.data;
}
export function pairingRoutes(service: PairingService): FastifyPluginAsync {
  return async (app) => {
    app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); reply.header('Referrer-Policy', 'no-referrer'); });
    app.addHook('preValidation', async (request) => {
      if (Object.keys(request.query as object).length) throw new ApiError(400, 'INVALID_REQUEST', 'Query parameters are not supported.');
    });
    const id = (request: FastifyRequest) => parse(z.object({ id: sessionIdSchema }).strict(), request.params).id;
    app.post('/pairing', async (request, reply) => {
      const input = parse(createPairingSchema, request.body);
      return reply.code(201).send(service.create(input.browserName));
    });
    app.post('/pairing/:id/claim', async (request) => service.claim(id(request), parse(claimPairingSchema, request.body)));
    app.post('/pairing/:id/approve', async (request) => service.approve(id(request), credentials(request), parse(approvePairingSchema, request.body).verificationCode));
    app.post('/pairing/:id/confirm', async (request) => service.confirm(id(request), credentials(request), parse(approvePairingSchema, request.body).verificationCode));
    app.get('/pairing/:id', async (request) => service.status(id(request), credentials(request)));
    app.post('/pairing/:id/heartbeat', async (request) => {
      if (request.body !== undefined && request.body !== null) parse(z.object({}).strict(), request.body);
      return service.heartbeat(id(request), credentials(request));
    });
    const envelope = z.object({ sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), ciphertext: z.string().min(40).max(750_000).regex(/^[A-Za-z0-9+/]+={0,2}$/).refine((value) => value.length % 4 === 0) }).strict();
    app.post('/pairing/:id/transfer', { bodyLimit: 760_000 }, async (request) => service.publishTransfer(id(request), credentials(request), parse(envelope, request.body)));
    app.get('/pairing/:id/transfer/status', async (request) => service.transferReceipt(id(request), credentials(request)));
    app.get('/pairing/:id/transfer', async (request) => service.receiveTransfer(id(request), credentials(request)));
    app.post('/pairing/:id/transfer/ack', async (request) => {
      const input = parse(z.object({ sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), expenseCount: z.number().int().min(0).max(3000).optional(), importInfo: z.object({ completed: z.boolean(), companyCount: z.number().int().min(0).max(20000), recordCount: z.number().int().min(0).max(20000), attachmentCount: z.number().int().min(0).max(3000) }).strict().optional() }).strict(), request.body);
      return service.acknowledgeTransfer(id(request), credentials(request), input.sequence, input.expenseCount, input.importInfo);
    });
    app.delete('/pairing/:id', async (request, reply) => { service.revoke(id(request), credentials(request)); return reply.code(204).send(); });
  };
}
