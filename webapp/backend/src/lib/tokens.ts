import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createToken(): string { return randomBytes(32).toString('base64url'); }
export function hashToken(value: string): Buffer { return createHash('sha256').update(value).digest(); }
export function matchesToken(value: string, expected: Buffer | undefined): boolean {
  return expected !== undefined && timingSafeEqual(hashToken(value), expected);
}
