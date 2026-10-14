/**
 * Local SQLite database powered by sql.js (SQLite compiled to WebAssembly).
 * The raw database bytes are persisted to IndexedDB (via idb-keyval) so the
 * application keeps working fully offline across reloads.
 */
import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from './sqlWasmUrl';
import { get, set } from 'idb-keyval';

const DB_STORAGE_KEY = 'attendance-master:sqlite-db';
const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  id_card_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('employee', 'student')),
  face_embedding TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_id_card_number ON users (id_card_number);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (active);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  id_card_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL,
  synced INTEGER NOT NULL DEFAULT 0
);

-- Indexed for fast per-user/day duplicate lookups during attendance
-- validation (see attendanceRepository.hasAttendanceToday). A hard unique
-- constraint is intentionally NOT applied here because duplicate-per-day
-- prevention is a configurable rule (AppSettings.allowMultipleAttendancePerDay)
-- enforced at the application layer; a DB-level constraint would make that
-- setting impossible to honor.
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance (user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (attendance_date);
-- Defensive cleanup: earlier development builds created a hard unique index
-- that conflicted with the configurable multiple-attendance-per-day rule.
DROP INDEX IF EXISTS idx_attendance_unique_present;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
`;

let dbPromise: Promise<Database> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function loadPersistedBytes(): Promise<Uint8Array | undefined> {
  const stored = await get<Uint8Array>(DB_STORAGE_KEY);
  return stored ?? undefined;
}

async function persist(db: Database): Promise<void> {
  const bytes = db.export();
  await set(DB_STORAGE_KEY, bytes);
}

/** Schedules a debounced save so rapid consecutive writes don't thrash IndexedDB. */
export function schedulePersist(db: Database): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persist(db);
  }, 150);
}

async function createDb(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const bytes = await loadPersistedBytes();
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  db.run(SCHEMA);
  db.run('PRAGMA foreign_keys = ON;');
  db.run(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)],
  );
  schedulePersist(db);
  return db;
}

/** Returns the shared, lazily-initialized SQLite database instance. */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = createDb();
  }
  return dbPromise;
}

/** Forces an immediate (non-debounced) save to IndexedDB. Useful for tests/teardown. */
export async function flushDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persist(db);
}

/** Deletes all persisted data and resets the in-memory database. For dev/test use. */
export async function resetDb(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await set(DB_STORAGE_KEY, undefined);
  dbPromise = null;
}

export type { Database };
