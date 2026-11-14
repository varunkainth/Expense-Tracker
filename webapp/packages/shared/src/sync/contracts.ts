import { z } from 'zod';
import { expenseSchema } from '../domain/expense';
export const PROTOCOL_VERSION = 1 as const;
/** Draft contract, not a completed sync engine. Revision checks must precede application. */
const operationBase = z.object({
    operationId: z.string().uuid(), deviceId: z.string().uuid(), recordId: z.string().min(1),
    entity: z.literal('personal_expenses'),
    baseRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    createdAt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export const expenseOperationSchema = z.discriminatedUnion('action', [
    operationBase.extend({ action: z.literal('upsert'), payload: expenseSchema }),
    operationBase.extend({ action: z.literal('delete') }),
]).refine((operation) => operation.action === 'delete' || operation.payload.id === operation.recordId, { message: 'Payload ID must match the record ID.' });
export type ExpenseOperation = z.infer<typeof expenseOperationSchema>;
export const healthResponseSchema = z.object({
    status: z.literal('ok'),
    service: z.literal('expense-tracker-relay'),
    protocolVersion: z.literal(PROTOCOL_VERSION),
    capabilities: z.object({ pairing: z.boolean(), presence: z.boolean(), expenseTransfer: z.boolean().optional(), workspaceTransfer: z.boolean().optional(), sync: z.literal(false) }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
