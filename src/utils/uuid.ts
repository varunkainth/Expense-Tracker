import * as Crypto from 'expo-crypto';

/**
 * Generates a cryptographically secure UUID v4 string.
 */
export function generateUUID(): string {
  return Crypto.randomUUID();
}
