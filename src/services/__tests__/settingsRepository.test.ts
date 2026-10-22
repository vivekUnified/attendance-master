import { afterEach, describe, expect, it } from 'vitest';
import { resetDb, flushDb, getDb } from '../../db/sqlite';
import { settingsRepository } from '../settingsRepository';

describe('settingsRepository', () => {
  afterEach(async () => {
    await flushDb();
    await resetDb();
  });

  it('returns sensible defaults when nothing has been saved', async () => {
    const settings = await settingsRepository.get();
    expect(settings.recognitionThreshold).toBeGreaterThan(0);
    expect(settings.registrationPassword).toBe('123456');
    expect(settings.dataMode).toBe('sqlite');
  });

  it('persists partial updates and merges with existing values', async () => {
    await settingsRepository.update({ recognitionThreshold: 0.9 });
    const afterFirstUpdate = await settingsRepository.get();
    expect(afterFirstUpdate.recognitionThreshold).toBe(0.9);
    expect(afterFirstUpdate.allowMultipleAttendancePerDay).toBe(false);

    await settingsRepository.update({ allowMultipleAttendancePerDay: true });
    const afterSecondUpdate = await settingsRepository.get();
    expect(afterSecondUpdate.recognitionThreshold).toBe(0.9);
    expect(afterSecondUpdate.allowMultipleAttendancePerDay).toBe(true);
  });

  it('does not reuse a legacy cosine threshold or reset unrelated settings', async () => {
    const db = await getDb();
    db.run("INSERT INTO settings (key, value) VALUES ('recognitionThreshold', '0.95'), ('registrationPassword', 'keep')");
    const upgraded = await settingsRepository.get();
    expect(upgraded.recognitionThreshold).toBe(0.75);
    expect(upgraded.registrationPassword).toBe('keep');
    await settingsRepository.update({ recognitionThreshold: 0.85 });
    expect((await settingsRepository.get()).recognitionThreshold).toBe(0.85);
  });
});
