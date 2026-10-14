import { afterEach, describe, expect, it } from 'vitest';
import { resetDb, flushDb } from '../../db/sqlite';
import { userRepository } from '../userRepository';
import { settingsRepository } from '../settingsRepository';
import { faceMatchService } from '../faceMatchService';

function embedding(seed: number): number[] {
  return Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));
}

describe('faceMatchService', () => {
  afterEach(async () => {
    await flushDb();
    await resetDb();
  });

  it('identifies a registered user from a matching embedding', async () => {
    const user = await userRepository.create({
      idCardNumber: 'EMP-300',
      fullName: 'Marie Curie',
      userType: 'employee',
      faceEmbedding: embedding(5),
    });

    const match = await faceMatchService.identify(embedding(5));
    expect(match.user?.id).toBe(user.id);
    expect(match.similarity).toBeGreaterThan(0.99);
  });

  it('returns no user when similarity is below the configured threshold', async () => {
    await userRepository.create({
      idCardNumber: 'EMP-301',
      fullName: 'Isaac Newton',
      userType: 'employee',
      faceEmbedding: embedding(1),
    });
    await settingsRepository.update({ recognitionThreshold: 0.999 });

    // A dissimilar embedding should not match given a strict threshold.
    const match = await faceMatchService.identify(embedding(50));
    expect(match.user).toBeNull();
  });

  it('ignores inactive users when matching', async () => {
    const user = await userRepository.create({
      idCardNumber: 'EMP-302',
      fullName: 'Deactivated User',
      userType: 'employee',
      faceEmbedding: embedding(7),
    });
    await userRepository.setActive(user.id, false);

    const match = await faceMatchService.identify(embedding(7));
    expect(match.user).toBeNull();
  });
});
