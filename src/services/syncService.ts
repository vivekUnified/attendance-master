/**
 * Background synchronization service. When the app is in `api` data mode and
 * the browser is online, this drains the local sync queue (users +
 * attendance created while offline) to the configured backend. Safe to call
 * repeatedly; it is a no-op when offline or in `sqlite`-only mode.
 */
import { settingsRepository } from './settingsRepository';
import { syncQueueRepository } from './syncQueueRepository';
import { attendanceRepository } from './attendanceRepository';
import { apiClient } from './apiClient';
import type { AttendanceRecord, User } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'error';

type Listener = (status: SyncStatus, pendingCount: number) => void;

let listeners: Listener[] = [];
let running = false;

function notify(status: SyncStatus, pendingCount: number): void {
  listeners.forEach((l) => l(status, pendingCount));
}

export const syncService = {
  onStatusChange(listener: Listener): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  async getPendingCount(): Promise<number> {
    const items = await syncQueueRepository.listPending();
    return items.length;
  },

  /** Attempts to push every queued item to the backend. */
  async runSync(): Promise<void> {
    if (running) return;
    const settings = await settingsRepository.get();
    if (settings.dataMode !== 'api' || !settings.apiBaseUrl) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    running = true;
    try {
      const pending = await syncQueueRepository.listPending();
      notify('syncing', pending.length);

      for (const item of pending) {
        try {
          const payload = JSON.parse(item.payload) as User | AttendanceRecord;
          if (item.operation === 'create-user') {
            await apiClient.pushUser(settings.apiBaseUrl, payload as User);
          } else if (item.operation === 'create-attendance') {
            const record = payload as AttendanceRecord;
            await apiClient.pushAttendance(settings.apiBaseUrl, record);
            await attendanceRepository.markSynced(record.id);
          }
          await syncQueueRepository.remove(item.id);
        } catch (err) {
          await syncQueueRepository.recordFailure(
            item.id,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      const remaining = await syncQueueRepository.listPending();
      notify(remaining.length > 0 ? 'error' : 'idle', remaining.length);
    } finally {
      running = false;
    }
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void syncService.runSync();
  });
}
