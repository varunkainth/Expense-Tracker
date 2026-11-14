import { z } from 'zod';

export const PAIRING_VERSION = 1 as const;
export const sessionIdSchema = z.string().uuid();
export const capabilityTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const verificationCodeSchema = z.string().regex(/^\d{6}$/);
export const createPairingSchema = z.object({ browserName: z.string().trim().min(1).max(80) }).strict();
export const claimPairingSchema = z.object({
  claimToken: capabilityTokenSchema, phoneDeviceId: z.string().uuid(), phoneName: z.string().trim().min(1).max(80),
}).strict();
export const approvePairingSchema = z.object({ verificationCode: verificationCodeSchema }).strict();
export const pairingQrSchema = z.object({
  type: z.literal('expense-tracker.pairing'), version: z.literal(PAIRING_VERSION),
  sessionId: sessionIdSchema, claimToken: capabilityTokenSchema, expiresAt: z.number().int().positive(), syncKey: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();

export * from '../../../../../packages/pairing-protocol/src';
