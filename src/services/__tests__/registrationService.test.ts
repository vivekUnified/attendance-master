import { afterEach, describe, expect, it } from 'vitest';
import { resetDb, flushDb } from '../../db/sqlite';
import {
  registrationService,
  DuplicateUserError,
  InvalidPasswordError,
} from '../registrationService';
import { attendanceRepository } from '../attendanceRepository';
import { userRepository } from '../userRepository';
import { settingsRepository } from '../settingsRepository';
import { syncQueueRepository } from '../syncQueueRepository';

function embedding(seed: number): number[] {
  return Array.from({ length: 128 }, (_, i) => Math.sin(seed + i) / 10);
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

  it('re-enrolls a legacy face without changing its profile or attendance history', async () => {
    const { user, attendance } = await registrationService.register({
      password: '123456', idCardNumber: 'KEEP', fullName: 'Keep History',
      userType: 'employee', faceEmbedding: embedding(1),
    });
    await userRepository.updateFace(user.id, Array(102).fill(0.1));
    const updated = await registrationService.reenroll(user.id, '123456', embedding(2));
    expect(updated).toEqual({ ...user, faceEmbedding: embedding(2) });
    expect((await userRepository.getById(user.id))?.faceEmbedding).toEqual(embedding(2));
    expect(await attendanceRepository.listAll()).toEqual([attendance]);
  });

  it('requires the password and a valid descriptor for re-enrollment', async () => {
    await expect(registrationService.reenroll('missing', 'wrong', embedding(1)))
      .rejects.toBeInstanceOf(InvalidPasswordError);
    await expect(registrationService.reenroll('missing', '123456', [1]))
      .rejects.toThrow('valid face descriptor');
    await expect(registrationService.reenroll('missing', '123456', embedding(1)))
      .rejects.toThrow('no longer exists');
  });

  it('queues an updated face for API synchronization', async () => {
    const user = await userRepository.create({
      idCardNumber: 'SYNC', fullName: 'Sync', userType: 'student', faceEmbedding: embedding(1),
    });
    await settingsRepository.update({ dataMode: 'api', apiBaseUrl: null });
    await registrationService.reenroll(user.id, '123456', embedding(2));
    const pending = await syncQueueRepository.listPending();
    expect(pending).toHaveLength(1);
    expect(JSON.parse(pending[0].payload)).toMatchObject({ id: user.id, faceEmbedding: embedding(2) });
  });
});
