import { useState } from 'react';
import { db } from '../../../lib/database/database';
import { download } from '../lib/format';
import type { WorkspaceRow } from '../hooks/use-workspace';
export function Receipts({ rows }: { rows: WorkspaceRow[] }) {
  const [error, setError] = useState('');
  async function open(row: WorkspaceRow) {
    try {
      const file = await db.phoneFiles.get([row.sourceDevice, String(row.id)]);
      if (!file) throw new Error('This receipt has not been received. Keep the phone connected and transfer again.');
      download(file.fileName, new Uint8Array(file.bytes).buffer, file.mimeType); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open receipt.'); }
  }
  return <div className="workspace-receipts"><h4>Receipts · {rows.length}</h4>{!rows.length ? <p>No receipts attached.</p> : rows.map((row) => <div key={`${row.sourceDevice}:${row.id}`}><span>{row.file_name}</span>{row.unavailable_reason ? <small>{row.unavailable_reason === 'too_large' ? 'File exceeds 8 MB transfer limit' : 'File missing on phone'}</small> : <button className="text-button" onClick={() => { void open(row); }}>Download {row.mime_type === 'application/pdf' ? 'PDF' : 'image'}</button>}</div>)}{error && <p className="error" role="alert">{error}</p>}</div>;
}
