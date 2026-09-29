import * as SQLite from 'expo-sqlite';

export interface Migration {
  version: number;
  description: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

export interface DatabaseConfig {
  databaseName: string;
  enableForeignKeys: boolean;
  journalMode: 'WAL' | 'DELETE';
}
