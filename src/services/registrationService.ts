/**
 * Registration orchestration: validates the registration password, checks
 * for duplicate ID cards, stores the new user + face embedding, and creates
 * the user's first attendance record, as required by the registration
 * workflow.
 */
import { userRepository, DuplicateUserError } from './userRepository';
import { attendanceService } from './attendanceService';
import { settingsRepository } from './settingsRepository';
import { syncQueueRepository } from './syncQueueRepository';
import { syncService } from './syncService';
import type { CreateUserInput } from './userRepository';
import type { AttendanceRecord, User } from '../types';
import { isFaceDescriptor } from '../engine/faceDescriptor';

export { DuplicateUserError };

export interface RegisterUserInput extends CreateUserInput {
  password: string;
}

export interface RegisterUserResult {
  user: User;
  attendance: AttendanceRecord;
}

export class InvalidPasswordError extends Error {
  constructor() {
    super('The registration password is incorrect.');
    this.name = 'InvalidPasswordError';
  }
}

export const registrationService = {
  async verifyPassword(password: string): Promise<boolean> {
    const settings = await settingsRepository.get();
    return password === settings.registrationPassword;
  },

  async register(input: RegisterUserInput): Promise<RegisterUserResult> {
    const validPassword = await registrationService.verifyPassword(input.password);
    if (!validPassword) {
      throw new InvalidPasswordError();
    }

    const trimmedId = input.idCardNumber.trim();
    const trimmedName = input.fullName.trim();
    if (!trimmedId) throw new Error('ID card number is required.');
    if (!trimmedName) throw new Error('Full name is required.');
    if (!input.faceEmbedding?.length) throw new Error('A face sample is required to register.');
    if (!isFaceDescriptor(input.faceEmbedding)) throw new Error('Capture a new face sample with the recognition model.');

    const user = await userRepository.create({
      idCardNumber: trimmedId,
      fullName: trimmedName,
      userType: input.userType,
      faceEmbedding: input.faceEmbedding,
    });

    const settings = await settingsRepository.get();
    if (settings.dataMode === 'api') {
      await syncQueueRepository.enqueue('create-user', user);
    }

    const { record } = await attendanceService.markAttendance({
      user,
      source: 'registration',
      confidence: 1,
    });

    if (settings.dataMode === 'api') {
      void syncService.runSync();
    }

    return { user, attendance: record };
  },

  async reenroll(userId: string, password: string, faceEmbedding: number[]): Promise<User> {
    if (!await registrationService.verifyPassword(password)) throw new InvalidPasswordError();
    if (!isFaceDescriptor(faceEmbedding)) throw new Error('Capture a valid face descriptor before re-enrolling.');
    const user = await userRepository.updateFace(userId, faceEmbedding);
    const settings = await settingsRepository.get();
    if (settings.dataMode === 'api') {
      await syncQueueRepository.enqueue('create-user', user);
      void syncService.runSync();
    }
    return user;
  },
};
