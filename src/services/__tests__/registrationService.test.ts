import { afterEach, describe, expect, it } from 'vitest';
import { resetDb, flushDb } from '../../db/sqlite';
import {
  registrationService,
  DuplicateUserError,
  InvalidPasswordError,
} from '../registrationService';
import { attendanceRepository } from '../attendanceRepository';

function embedding(seed: number): number[] {
  return Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));
}

describe('registrationService', () => {
  afterEach(async () => {
    await flushDb();
    await resetDb();
  });

  it('rejects registration with an incorrect password', async () => {
    await expect(
      registrationService.register({
        password: 'wrong',
        idCardNumber: 'EMP-200',
        fullName: 'Nikola Tesla',
        userType: 'employee',
        faceEmbedding: embedding(1),
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it('registers a user and creates an initial attendance record', async () => {
    const result = await registrationService.register({
      password: '123456',
      idCardNumber: 'EMP-201',
      fullName: 'Thomas Edison',
      userType: 'employee',
      faceEmbedding: embedding(2),
    });

    expect(result.user.idCardNumber).toBe('EMP-201');
    expect(result.attendance.status).toBe('present');
    expect(result.attendance.source).toBe('registration');

    const history = await attendanceRepository.listAll();
    expect(history.some((r) => r.userId === result.user.id)).toBe(true);
  });

  it('rejects registration for a duplicate ID card number', async () => {
    await registrationService.register({
      password: '123456',
      idCardNumber: 'EMP-202',
      fullName: 'First User',
      userType: 'employee',
      faceEmbedding: embedding(3),
    });

    await expect(
      registrationService.register({
        password: '123456',
        idCardNumber: 'EMP-202',
        fullName: 'Second User',
        userType: 'student',
        faceEmbedding: embedding(4),
      }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
  });

  it('rejects registration without a face sample', async () => {
    await expect(
      registrationService.register({
        password: '123456',
        idCardNumber: 'EMP-203',
        fullName: 'No Face',
        userType: 'employee',
        faceEmbedding: [],
      }),
    ).rejects.toThrow('A face sample is required');
  });
});
