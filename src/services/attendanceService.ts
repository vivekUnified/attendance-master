/**
 * High-level attendance operations used by the UI. Wraps the repository
 * layer with sync-queue integration so API mode "just works" without
 * changing the core offline workflow.
 */
import { attendanceRepository } from './attendanceRepository';
import { settingsRepository } from './settingsRepository';
import { syncQueueRepository } from './syncQueueRepository';
import { syncService } from './syncService';
import type { AttendanceFilter, MarkAttendanceInput } from './attendanceRepository';
import type { AttendanceRecord } from '../types';

export interface MarkAttendanceResult {
  record: AttendanceRecord;
  duplicate: boolean;
}

export const attendanceService = {
  async markAttendance(
    input: Omit<MarkAttendanceInput, 'allowMultiplePerDay'>,
  ): Promise<MarkAttendanceResult> {
    const settings = await settingsRepository.get();
    const result = await attendanceRepository.markAttendance({
      ...input,
      allowMultiplePerDay: settings.allowMultipleAttendancePerDay,
    });

    if (!result.duplicate && settings.dataMode === 'api') {
      await syncQueueRepository.enqueue('create-attendance', result.record);
      void syncService.runSync();
    }

    return result;
  },

  async listHistory(filter: AttendanceFilter = {}): Promise<AttendanceRecord[]> {
    return attendanceRepository.listAll(filter);
  },
};
