import type { FastifyPluginAsync } from 'fastify';
import { PROTOCOL_VERSION, type HealthResponse } from '@expense-tracker/shared';
export const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get<{
        Reply: HealthResponse;
    }>('/health', async (_request, reply) => {
        reply.header('Cache-Control', 'no-store');
        return { status: 'ok', service: 'expense-tracker-relay', protocolVersion: PROTOCOL_VERSION,
            capabilities: { pairing: true, presence: true, expenseTransfer: true, workspaceTransfer: true, sync: false } };
    });
};
