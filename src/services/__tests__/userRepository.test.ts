import { afterEach, describe, expect, it } from 'vitest';
import { resetDb, flushDb } from '../../db/sqlite';
import { userRepository, DuplicateUserError } from '../userRepository';

function embedding(seed: number): number[] {
  return Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));
}

describe('userRepository', () => {
  afterEach(async () => {
    await flushDb();
    await resetDb();
  });

  it('creates a user and can look it up by ID card number', async () => {
    const user = await userRepository.create({
      idCardNumber: 'EMP-001',
      fullName: 'Ada Lovelace',
      userType: 'employee',
      faceEmbedding: embedding(1),
    });

    expect(user.id).toBeTruthy();
    expect(user.active).toBe(true);

    const found = await userRepository.findByIdCardNumber('EMP-001');
    expect(found?.fullName).toBe('Ada Lovelace');
    expect(found?.faceEmbedding).toEqual(embedding(1));
  });

  it('rejects duplicate ID card numbers', async () => {
    await userRepository.create({
      idCardNumber: 'EMP-002',
      fullName: 'Grace Hopper',
      userType: 'employee',
      faceEmbedding: embedding(2),
    });

    await expect(
      userRepository.create({
        idCardNumber: 'EMP-002',
        fullName: 'Someone Else',
        userType: 'student',
        faceEmbedding: embedding(3),
      }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
  });

  it('can deactivate and reactivate a user', async () => {
    const user = await userRepository.create({
      idCardNumber: 'STU-001',
      fullName: 'Alan Turing',
      userType: 'student',
      faceEmbedding: embedding(4),
    });

    await userRepository.setActive(user.id, false);
    const afterDeactivate = await userRepository.listActive();
    expect(afterDeactivate.find((u) => u.id === user.id)).toBeUndefined();

    await userRepository.setActive(user.id, true);
    const afterReactivate = await userRepository.listActive();
    expect(afterReactivate.find((u) => u.id === user.id)).toBeDefined();
  });
});
