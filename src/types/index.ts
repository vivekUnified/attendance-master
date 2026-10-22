/**
 * Shared domain types for the attendance application.
 * These types are used across the database layer, services, face engine, and UI.
 */

export type UserType = 'employee' | 'student';

export interface User {
  id: string;
  idCardNumber: string;
  fullName: string;
  userType: UserType;
  /** Face embedding vector serialized as a plain number array. */
  faceEmbedding: number[];
  registeredAt: string; // ISO timestamp
  active: boolean;
}

export type AttendanceStatus = 'present' | 'duplicate-rejected';

export type AttendanceSource = 'face-recognition' | 'manual' | 'registration';

export interface AttendanceRecord {
  id: string;
  userId: string;
  idCardNumber: string;
  fullName: string;
  attendanceDate: string; // YYYY-MM-DD (local date used for duplicate validation)
  timestamp: string; // full ISO timestamp
  status: AttendanceStatus;
  source: AttendanceSource;
  confidence: number | null;
  synced: boolean;
}

export interface AppSettings {
  /** Minimum distance-based descriptor score (0-1), not a probability. */
  recognitionThreshold: number;
  /** Whether a user may be marked present more than once per day. */
  allowMultipleAttendancePerDay: boolean;
  /** Registration password - development only, replace with real auth in production. */
  registrationPassword: string;
  /** 'sqlite' = offline-first local DB, 'api' = remote backend. */
  dataMode: 'sqlite' | 'api';
  apiBaseUrl: string | null;
}

export type SyncOperation = 'create-attendance' | 'create-user';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  payload: string; // JSON-serialized payload
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface FaceDetectionResult {
  faceCount: number;
  embedding: number[] | null;
  /** Normalized MediaPipe landmarks, including depth, for the full-face mesh. */
  landmarks: { x: number; y: number; z: number }[] | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  quality: 'ok' | 'no-face' | 'multiple-faces' | 'low-quality';
}

export interface MatchResult {
  user: User | null;
  similarity: number;
}
