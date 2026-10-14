/**
 * Minimal API client used only by the sync service when the app is
 * configured for `api` data mode. The attendance workflow itself always
 * reads/writes the local SQLite database first, so this client is never on
 * the critical path for offline operation.
 *
 * Idempotency: every record carries a stable UUID generated on the client,
 * so re-sending the same record after a retry is a safe no-op on a
 * well-behaved backend (e.g. an upsert keyed by `id`).
 */
import type { AttendanceRecord, User } from '../types';

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export const apiClient = {
  async pushUser(baseUrl: string, user: User): Promise<void> {
    const res = await fetch(buildUrl(baseUrl, '/users'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new ApiError(`Failed to sync user ${user.id}`, res.status);
  },

  async pushAttendance(baseUrl: string, record: AttendanceRecord): Promise<void> {
    const res = await fetch(buildUrl(baseUrl, '/attendance'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new ApiError(`Failed to sync attendance ${record.id}`, res.status);
  },
};
