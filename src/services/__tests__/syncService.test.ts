import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, flushDb } from '../../db/sqlite';
import { settingsRepository } from '../settingsRepository';
import { syncQueueRepository } from '../syncQueueRepository';
import { syncService } from '../syncService';
import type { AttendanceRecord } from '../../types';

function fakeAttendance(id: string): AttendanceRecord {
  return {
    id,
    userId: 'user-1',
    idCardNumber: 'EMP-1',
    fullName: 'Test User',
    attendanceDate: '2024-01-01',
    timestamp: '2024-01-01T08:00:00.000Z',
    status: 'present',
    source: 'face-recognition',
    confidence: 0.95,
    synced: false,
  };
}

describe('syncService', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await flushDb();
    await resetDb();
  });

  it('does nothing when data mode is sqlite', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await syncQueueRepository.enqueue('create-attendance', fakeAttendance('a1'));

    await syncService.runSync();

    expect(fetchMock).not.toHaveBeenCalled();
    const pending = await syncQueueRepository.listPending();
    expect(pending).toHaveLength(1);
  });

  it('does nothing when offline even in api mode', async () => {
    await settingsRepository.update({ dataMode: 'api', apiBaseUrl: 'https://api.example.com' });
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await syncQueueRepository.enqueue('create-attendance', fakeAttendance('a2'));

    await syncService.runSync();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pushes queued attendance to the API and clears the queue on success', async () => {
    await settingsRepository.update({ dataMode: 'api', apiBaseUrl: 'https://api.example.com' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await syncQueueRepository.enqueue('create-attendance', fakeAttendance('a3'));

    await syncService.runSync();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/attendance',
      expect.objectContaining({ method: 'PUT' }),
    );
    const pending = await syncQueueRepository.listPending();
    expect(pending).toHaveLength(0);
  });

  it('keeps failed items in the queue with a recorded error for retry', async () => {
    await settingsRepository.update({ dataMode: 'api', apiBaseUrl: 'https://api.example.com' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    await syncQueueRepository.enqueue('create-attendance', fakeAttendance('a4'));

    await syncService.runSync();

    const pending = await syncQueueRepository.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].lastError).toBeTruthy();
  });
});
