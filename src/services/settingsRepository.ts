/**
 * Settings repository: stores app configuration as key/value pairs so it can
 * persist offline and be edited from the Settings screen.
 */
import { getDb, schedulePersist } from '../db/sqlite';
import type { AppSettings } from '../types';
import type { Database } from 'sql.js';

const DEFAULTS: AppSettings = {
  recognitionThreshold: 0.82,
  allowMultipleAttendancePerDay: false,
  registrationPassword: '123456',
  dataMode: (import.meta.env.VITE_DATA_MODE as 'sqlite' | 'api') || 'sqlite',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || null,
};

function readAll(db: Database): Record<string, string> {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const out: Record<string, string> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string };
    out[row.key] = row.value;
  }
  stmt.free();
  return out;
}

function coerce(key: keyof AppSettings, raw: string | undefined, fallback: unknown): unknown {
  if (raw === undefined) return fallback;
  if (key === 'recognitionThreshold') return Number(raw);
  if (key === 'allowMultipleAttendancePerDay') return raw === 'true';
  if (key === 'apiBaseUrl') return raw === '' ? null : raw;
  return raw;
}

export const settingsRepository = {
  async get(): Promise<AppSettings> {
    const db = await getDb();
    const stored = readAll(db);
    return {
      recognitionThreshold: coerce(
        'recognitionThreshold',
        stored.recognitionThreshold,
        DEFAULTS.recognitionThreshold,
      ) as number,
      allowMultipleAttendancePerDay: coerce(
        'allowMultipleAttendancePerDay',
        stored.allowMultipleAttendancePerDay,
        DEFAULTS.allowMultipleAttendancePerDay,
      ) as boolean,
      registrationPassword: coerce(
        'registrationPassword',
        stored.registrationPassword,
        DEFAULTS.registrationPassword,
      ) as string,
      dataMode: coerce('dataMode', stored.dataMode, DEFAULTS.dataMode) as 'sqlite' | 'api',
      apiBaseUrl: coerce('apiBaseUrl', stored.apiBaseUrl, DEFAULTS.apiBaseUrl) as string | null,
    };
  },

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const db = await getDb();
    const current = await settingsRepository.get();
    const next = { ...current, ...partial };

    const entries: [string, string][] = [
      ['recognitionThreshold', String(next.recognitionThreshold)],
      ['allowMultipleAttendancePerDay', String(next.allowMultipleAttendancePerDay)],
      ['registrationPassword', next.registrationPassword],
      ['dataMode', next.dataMode],
      ['apiBaseUrl', next.apiBaseUrl ?? ''],
    ];

    for (const [key, value] of entries) {
      db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    }
    schedulePersist(db);
    return next;
  },
};
