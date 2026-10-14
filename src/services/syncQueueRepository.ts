/**
 * Sync queue repository: the "outbox" used to upload locally recorded data
 * to a remote API once connectivity is restored (API mode only).
 */
import { v4 as uuid } from 'uuid';
import { getDb, schedulePersist } from '../db/sqlite';
import type { SyncOperation, SyncQueueItem } from '../types';
import type { Database } from 'sql.js';

interface SyncRow {
  id: string;
  operation: SyncOperation;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

function rowToItem(row: SyncRow): SyncQueueItem {
  return {
    id: row.id,
    operation: row.operation,
    payload: row.payload,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
  };
}

function queryAll(db: Database, sql: string, params: (string | number | null)[] = []): SyncRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: SyncRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as SyncRow);
  }
  stmt.free();
  return rows;
}

export const syncQueueRepository = {
  async enqueue(operation: SyncOperation, payload: unknown): Promise<SyncQueueItem> {
    const db = await getDb();
    const item: SyncQueueItem = {
      id: uuid(),
      operation,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    };
    db.run(
      `INSERT INTO sync_queue (id, operation, payload, created_at, attempts, last_error)
       VALUES (?, ?, ?, ?, 0, NULL)`,
      [item.id, item.operation, item.payload, item.createdAt],
    );
    schedulePersist(db);
    return item;
  },

  async listPending(): Promise<SyncQueueItem[]> {
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM sync_queue ORDER BY created_at ASC');
    return rows.map(rowToItem);
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM sync_queue WHERE id = ?', [id]);
    schedulePersist(db);
  },

  async recordFailure(id: string, error: string): Promise<void> {
    const db = await getDb();
    db.run(
      'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
      [error, id],
    );
    schedulePersist(db);
  },
};
