/** A single bounded, replaceable encrypted snapshot. Keys and plaintext never go to the relay. */
export interface TransferEnvelope { sequence: number; ciphertext: string }
export const MAX_CIPHERTEXT = 750_000;
export function parseTransfer(value: unknown): TransferEnvelope {
  const data = value as TransferEnvelope;
  if (!data || typeof data !== 'object' || Object.keys(data).sort().join(',') !== 'ciphertext,sequence' || !Number.isSafeInteger(data.sequence) || data.sequence < 1 || typeof data.ciphertext !== 'string' || data.ciphertext.length < 40 || data.ciphertext.length > MAX_CIPHERTEXT || data.ciphertext.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.ciphertext)) throw new Error('Invalid encrypted transfer.');
  return { sequence: data.sequence, ciphertext: data.ciphertext };
}
export const isSyncKey = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export function transferContext(sessionId: string, sequence: number) { return `expense-transfer-v1:${sessionId}:${sequence}:phone-to-browser`; }
export interface TransferImportInfo { completed: boolean; companyCount: number; recordCount: number; attachmentCount: number }
export function parseImportInfo(value: unknown): TransferImportInfo {
  const row = value as TransferImportInfo;
  if (!row || typeof row.completed !== 'boolean' || ![row.companyCount, row.recordCount, row.attachmentCount].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 20000)) throw new Error('Invalid workspace import receipt.');
  return { completed: row.completed, companyCount: row.companyCount, recordCount: row.recordCount, attachmentCount: row.attachmentCount };
}
