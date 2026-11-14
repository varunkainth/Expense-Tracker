import Dexie, { type Table } from 'dexie';
import type { Category, Expense, ExpenseOperation, DataRow, WorkspaceTable, WorkspaceChunk } from '@expense-tracker/shared';
export interface LocalExpense extends Expense {
    source_device?: string;
    revision: number;
    deleted_at: number | null;
}
export interface Setting {
    key: string;
    value: string;
}
export interface PhoneFile { deviceId: string; id: string; bytes: Uint8Array; mimeType: string; fileName: string }
export interface PhoneRecord { ordinal?: number; deviceId: string; table: WorkspaceTable; id: string; data: DataRow }
export interface TransferPart extends WorkspaceChunk { sessionId: string; receivedAt: number }
export class ExpenseDatabase extends Dexie {
    phoneFiles!: Table<PhoneFile, [string, string]>;
    phoneRecords!: Table<PhoneRecord, [string, string, string]>;
    transferParts!: Table<TransferPart, [string, string, number]>;
    expenses!: Table<LocalExpense, string>;
    categories!: Table<Category, string>;
    outbox!: Table<ExpenseOperation, string>;
    settings!: Table<Setting, string>;
    constructor(name = 'expense-tracker-web') {
        super(name);
        this.version(1).stores({
            expenses: 'id, expense_date, category_id, updated_at', categories: 'id, name',
            outbox: 'operationId, recordId, createdAt', settings: 'key',
        });
        this.version(2).stores({ phoneRecords: '[deviceId+table+id], deviceId, table, [deviceId+table]', transferParts: '[sessionId+snapshotId+part], sessionId, receivedAt' });
        this.version(3).stores({ phoneFiles: '[deviceId+id], deviceId' });
    }
}
export const db = new ExpenseDatabase();
