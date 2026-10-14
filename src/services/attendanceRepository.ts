/**
 * Attendance repository: creation, duplicate validation, and history queries.
 */
import { v4 as uuid } from 'uuid';
import { getDb, schedulePersist } from '../db/sqlite';
import { toLocalDateKey } from '../utils/date';
import type { AttendanceRecord, AttendanceSource, AttendanceStatus, User } from '../types';
import type { Database } from 'sql.js';

interface AttendanceRow {
  id: string;
  user_id: string;
  id_card_number: string;
  full_name: string;
  attendance_date: string;
  timestamp: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  confidence: number | null;
  synced: number;
}

function rowToRecord(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    idCardNumber: row.id_card_number,
    fullName: row.full_name,
    attendanceDate: row.attendance_date,
    timestamp: row.timestamp,
    status: row.status,
    source: row.source,
    confidence: row.confidence,
    synced: Boolean(row.synced),
  };
}

function queryAll(
  db: Database,
  sql: string,
  params: (string | number | null)[] = [],
): AttendanceRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: AttendanceRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as AttendanceRow);
  }
  stmt.free();
  return rows;
}

export interface MarkAttendanceInput {
  user: User;
  source: AttendanceSource;
  confidence: number | null;
  /** Whether more than one "present" entry is allowed for the same user/day. */
  allowMultiplePerDay: boolean;
}

export interface AttendanceFilter {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const attendanceRepository = {
  async hasAttendanceToday(userId: string, dateKey = toLocalDateKey()): Promise<boolean> {
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT id FROM attendance WHERE user_id = ? AND attendance_date = ? AND status = 'present'`,
      [userId, dateKey],
    );
    return rows.length > 0;
  },

  /**
   * Marks attendance for a recognized user, honoring the configurable
   * duplicate-prevention rule. Returns the created record and whether it was
   * rejected as a duplicate.
   */
  async markAttendance(
    input: MarkAttendanceInput,
  ): Promise<{ record: AttendanceRecord; duplicate: boolean }> {
    const db = await getDb();
    const dateKey = toLocalDateKey();
    const alreadyPresent = await attendanceRepository.hasAttendanceToday(input.user.id, dateKey);

    if (alreadyPresent && !input.allowMultiplePerDay) {
      const record: AttendanceRecord = {
        id: uuid(),
        userId: input.user.id,
        idCardNumber: input.user.idCardNumber,
        fullName: input.user.fullName,
        attendanceDate: dateKey,
        timestamp: new Date().toISOString(),
        status: 'duplicate-rejected',
        source: input.source,
        confidence: input.confidence,
        synced: false,
      };
      // Duplicate-rejected entries are informational only and are not
      // persisted to avoid cluttering history with noise; callers can still
      // surface the rejection message to the user.
      return { record, duplicate: true };
    }

    const record: AttendanceRecord = {
      id: uuid(),
      userId: input.user.id,
      idCardNumber: input.user.idCardNumber,
      fullName: input.user.fullName,
      attendanceDate: dateKey,
      timestamp: new Date().toISOString(),
      status: 'present',
      source: input.source,
      confidence: input.confidence,
      synced: false,
    };

    db.run(
      `INSERT INTO attendance
         (id, user_id, id_card_number, full_name, attendance_date, timestamp, status, source, confidence, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        record.id,
        record.userId,
        record.idCardNumber,
        record.fullName,
        record.attendanceDate,
        record.timestamp,
        record.status,
        record.source,
        record.confidence,
      ],
    );
    schedulePersist(db);
    return { record, duplicate: false };
  },

  async listAll(filter: AttendanceFilter = {}): Promise<AttendanceRecord[]> {
    const db = await getDb();
    const clauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (filter.dateFrom) {
      clauses.push('attendance_date >= ?');
      params.push(filter.dateFrom);
    }
    if (filter.dateTo) {
      clauses.push('attendance_date <= ?');
      params.push(filter.dateTo);
    }
    if (filter.search) {
      clauses.push('(full_name LIKE ? OR id_card_number LIKE ?)');
      const like = `%${filter.search}%`;
      params.push(like, like);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = queryAll(
      db,
      `SELECT * FROM attendance ${where} ORDER BY timestamp DESC`,
      params,
    );
    return rows.map(rowToRecord);
  },

  async markSynced(id: string): Promise<void> {
    const db = await getDb();
    db.run('UPDATE attendance SET synced = 1 WHERE id = ?', [id]);
    schedulePersist(db);
  },

  async listUnsynced(): Promise<AttendanceRecord[]> {
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM attendance WHERE synced = 0');
    return rows.map(rowToRecord);
  },
};
