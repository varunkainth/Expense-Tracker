import { useLiveQuery } from 'dexie-react-hooks';
import { WORKSPACE_TABLES, type DataRow, type WorkspaceTable } from '@expense-tracker/shared';
import { db, type PhoneRecord } from '../../../lib/database/database';
export type WorkspaceRow = DataRow & { sourceDevice: string };
export function useWorkspace() {
  const records = useLiveQuery(() => db.phoneRecords.toArray());
  const grouped = Object.fromEntries(Object.keys(WORKSPACE_TABLES).map((table) => [table, [] as WorkspaceRow[]])) as Record<WorkspaceTable, WorkspaceRow[]>;
  for (const record of [...(records ?? [])].sort((a,b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))) grouped[record.table].push({ ...record.data, sourceDevice: record.deviceId });
  return { tables: grouped, loading: records === undefined, devices: [...new Set((records ?? []).map((row: PhoneRecord) => row.deviceId))] };
}
