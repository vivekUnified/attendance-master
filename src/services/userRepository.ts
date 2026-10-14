/**
 * User repository: all reads/writes against the `users` table.
 * This is the canonical local data source used offline; when API sync mode
 * is enabled, successful registrations are additionally queued for upload.
 */
import { v4 as uuid } from 'uuid';
import { getDb, schedulePersist } from '../db/sqlite';
import type { User, UserType } from '../types';
import type { Database } from 'sql.js';

interface UserRow {
  id: string;
  id_card_number: string;
  full_name: string;
  user_type: UserType;
  face_embedding: string;
  registered_at: string;
  active: number;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    idCardNumber: row.id_card_number,
    fullName: row.full_name,
    userType: row.user_type,
    faceEmbedding: JSON.parse(row.face_embedding) as number[],
    registeredAt: row.registered_at,
    active: Boolean(row.active),
  };
}

function queryAll(db: Database, sql: string, params: (string | number | null)[] = []): UserRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: UserRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as UserRow);
  }
  stmt.free();
  return rows;
}

export class DuplicateUserError extends Error {
  constructor(idCardNumber: string) {
    super(`A user with ID card number "${idCardNumber}" is already registered.`);
    this.name = 'DuplicateUserError';
  }
}

export interface CreateUserInput {
  idCardNumber: string;
  fullName: string;
  userType: UserType;
  faceEmbedding: number[];
}

export const userRepository = {
  async findByIdCardNumber(idCardNumber: string): Promise<User | null> {
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM users WHERE id_card_number = ?', [idCardNumber]);
    return rows.length ? rowToUser(rows[0]) : null;
  },

  async getById(id: string): Promise<User | null> {
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM users WHERE id = ?', [id]);
    return rows.length ? rowToUser(rows[0]) : null;
  },

  async listAll(): Promise<User[]> {
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM users ORDER BY registered_at DESC');
    return rows.map(rowToUser);
  },

  async listActive(): Promise<User[]> {
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM users WHERE active = 1 ORDER BY registered_at DESC');
    return rows.map(rowToUser);
  },

  async create(input: CreateUserInput): Promise<User> {
    const db = await getDb();
    const existing = queryAll(db, 'SELECT id FROM users WHERE id_card_number = ?', [
      input.idCardNumber,
    ]);
    if (existing.length > 0) {
      throw new DuplicateUserError(input.idCardNumber);
    }

    const user: User = {
      id: uuid(),
      idCardNumber: input.idCardNumber,
      fullName: input.fullName,
      userType: input.userType,
      faceEmbedding: input.faceEmbedding,
      registeredAt: new Date().toISOString(),
      active: true,
    };

    db.run(
      `INSERT INTO users (id, id_card_number, full_name, user_type, face_embedding, registered_at, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        user.id,
        user.idCardNumber,
        user.fullName,
        user.userType,
        JSON.stringify(user.faceEmbedding),
        user.registeredAt,
      ],
    );
    schedulePersist(db);
    return user;
  },

  async setActive(id: string, active: boolean): Promise<void> {
    const db = await getDb();
    db.run('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
    schedulePersist(db);
  },
};
