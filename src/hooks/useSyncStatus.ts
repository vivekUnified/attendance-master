/**
 * Tracks the sync queue's pending count and status, polling periodically and
 * reacting to sync-service events so the UI can show a live indicator.
 */
import { useEffect, useState } from 'react';
import { syncService, type SyncStatus } from '../services/syncService';

export function useSyncStatus(): { status: SyncStatus; pendingCount: number } {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      syncService.getPendingCount().then((count) => {
        if (!cancelled) setPendingCount(count);
      });
    };

    refresh();
    const unsubscribe = syncService.onStatusChange((nextStatus, count) => {
      setStatus(nextStatus);
      setPendingCount(count);
    });
    const interval = setInterval(refresh, 10_000);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { status, pendingCount };
}
