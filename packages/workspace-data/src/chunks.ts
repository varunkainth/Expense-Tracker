import { CHUNK_BYTES, MAX_WORKSPACE_BYTES } from './tables';
export interface WorkspaceChunk { type: 'workspace-chunk'; snapshotId: string; part: number; parts: number; sha256: string; data: string }
export function base64Bytes(bytes: Uint8Array): string {
  let value = '';
  for (let i = 0; i < bytes.length; i += 16384) value += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(value);
}
export function parseWorkspaceChunk(value: unknown): WorkspaceChunk {
  const row = value as WorkspaceChunk;
  if (!row || typeof row !== 'object' || Object.keys(row).sort().join(',') !== 'data,part,parts,sha256,snapshotId,type' || row.type !== 'workspace-chunk' || typeof row.snapshotId !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.snapshotId) || !Number.isInteger(row.parts) || row.parts < 1 || row.parts > Math.ceil(MAX_WORKSPACE_BYTES / CHUNK_BYTES) || !Number.isInteger(row.part) || row.part < 0 || row.part >= row.parts || typeof row.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.sha256) || typeof row.data !== 'string' || row.data.length > CHUNK_BYTES * 4 / 3 || row.data.length === 0 || row.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(row.data)) throw new Error('Invalid workspace transfer chunk.');
  return row;
}
