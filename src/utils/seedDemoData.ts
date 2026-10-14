/**
 * Dev-only helper to seed a few sample users + attendance so the app is easy
 * to explore without a real camera. Exposed on `window.seedDemoData()` in
 * development builds only (see main.tsx). Face embeddings are synthetic
 * (not derived from a real photo) and are only useful for exercising the
 * matching UI, not for demonstrating recognition accuracy.
 */
import { registrationService } from '../services/registrationService';
import { userRepository } from '../services/userRepository';

function syntheticEmbedding(seed: number): number[] {
  return Array.from({ length: 102 }, (_, i) => Math.sin(seed * 12.9898 + i * 0.37));
}

const SAMPLE_USERS = [
  { idCardNumber: 'EMP-1001', fullName: 'Asha Rao', userType: 'employee' as const, seed: 11 },
  { idCardNumber: 'EMP-1002', fullName: 'Rahul Mehta', userType: 'employee' as const, seed: 22 },
  { idCardNumber: 'STU-2001', fullName: 'Priya Nair', userType: 'student' as const, seed: 33 },
];

export async function seedDemoData(): Promise<void> {
  for (const sample of SAMPLE_USERS) {
    const existing = await userRepository.findByIdCardNumber(sample.idCardNumber);
    if (existing) continue;
    await registrationService.register({
      password: '123456',
      idCardNumber: sample.idCardNumber,
      fullName: sample.fullName,
      userType: sample.userType,
      faceEmbedding: syntheticEmbedding(sample.seed),
    });
  }
  // eslint-disable-next-line no-console
  console.info('Seeded demo users: EMP-1001, EMP-1002, STU-2001 (password: 123456)');
}
