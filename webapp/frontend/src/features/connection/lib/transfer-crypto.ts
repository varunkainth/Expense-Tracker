import { isSyncKey, transferContext, type TransferEnvelope } from '@expense-tracker/shared';
export function generateSyncKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, '0')).join('');
}
export async function decryptTransfer(secret: string, sessionId: string, envelope: TransferEnvelope): Promise<unknown> {
  if (!isSyncKey(secret)) throw new Error('Pair again to enable encrypted expense transfer.');
  const bytes = Uint8Array.from(secret.match(/../g)!, (value) => parseInt(value, 16));
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
  const combined = Uint8Array.from(atob(envelope.ciphertext), (value) => value.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12), tagLength: 128, additionalData: new TextEncoder().encode(transferContext(sessionId, envelope.sequence)) }, key, combined.slice(12));
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  return data;
}
