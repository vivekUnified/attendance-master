import { afterEach, describe, expect, it } from 'vitest';
import { resetDb, flushDb } from '../../db/sqlite';
import { userRepository } from '../userRepository';
import { attendanceRepository } from '../attendanceRepository';

function embedding(seed: number): number[] {
  return Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));
}

describe('attendanceRepository', () => {
  afterEach(async () => {
    await flushDb();
    await resetDb();
  });

  it('marks attendance for a user with status "present"', async () => {
    const user = await userRepository.create({
      idCardNumber: 'EMP-100',
      fullName: 'Marie Curie',
      userType: 'employee',
      faceEmbedding: embedding(1),
    });

    const { record, duplicate } = await attendanceRepository.markAttendance({
      user,
      source: 'face-recognition',
      confidence: 0.95,
      allowMultiplePerDay: false,
    });

    expect(duplicate).toBe(false);
    expect(record.status).toBe('present');
    expect(record.userId).toBe(user.id);
  });

  it('prevents duplicate attendance on the same day when not allowed', async () => {
    const user = await userRepository.create({
      idCardNumber: 'EMP-101',
      fullName: 'Rosalind Franklin',
      userType: 'employee',
      faceEmbedding: embedding(2),
    });

    await attendanceRepository.markAttendance({
      user,
      source: 'face-recognition',
      confidence: 0.9,
      allowMultiplePerDay: false,
    });

    const second = await attendanceRepository.markAttendance({
      user,
      source: 'face-recognition',
      confidence: 0.9,
      allowMultiplePerDay: false,
    });

    expect(second.duplicate).toBe(true);
    expect(second.record.status).toBe('duplicate-rejected');

    const history = await attendanceRepository.listAll();
    expect(history.filter((r) => r.userId === user.id)).toHaveLength(1);
  });

  it('allows multiple attendance entries per day when configured', async () => {
    const user = await userRepository.create({
      idCardNumber: 'EMP-102',
      fullName: 'Katherine Johnson',
      userType: 'employee',
      faceEmbedding: embedding(3),
    });

    await attendanceRepository.markAttendance({
      user,
      source: 'face-recognition',
      confidence: 0.9,
      allowMultiplePerDay: true,
    });
    const second = await attendanceRepository.markAttendance({
      user,
      source: 'face-recognition',
      confidence: 0.9,
      allowMultiplePerDay: true,
    });

    expect(second.duplicate).toBe(false);
    const history = await attendanceRepository.listAll();
    expect(history.filter((r) => r.userId === user.id)).toHaveLength(2);
  });

  it('filters history by search and date range', async () => {
    const user = await userRepository.create({
      idCardNumber: 'EMP-103',
      fullName: 'Hedy Lamarr',
      userType: 'employee',
      faceEmbedding: embedding(4),
    });
    await attendanceRepository.markAttendance({
      user,
      source: 'face-recognition',
      confidence: 0.9,
      allowMultiplePerDay: false,
    });

    const bySearch = await attendanceRepository.listAll({ search: 'Hedy' });
    expect(bySearch).toHaveLength(1);

    const byMissingSearch = await attendanceRepository.listAll({ search: 'Nobody' });
    expect(byMissingSearch).toHaveLength(0);

    const futureOnly = await attendanceRepository.listAll({ dateFrom: '2999-01-01' });
    expect(futureOnly).toHaveLength(0);
  });
});
