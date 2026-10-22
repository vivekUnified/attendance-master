import { createRef } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../HomePage';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import { faceMatchService } from '../../services/faceMatchService';
import { attendanceService } from '../../services/attendanceService';
import type { FaceDetectionResult, User } from '../../types';

vi.mock('../../hooks/useFaceDetection', () => ({ useFaceDetection: vi.fn() }));
vi.mock('../../hooks/useCamera', () => ({ useCamera: vi.fn(() => ({
  videoRef: createRef(), ready: true,
})) }));
vi.mock('../../components/CameraView', () => ({ CameraView: () => null }));
vi.mock('../../services/faceMatchService', () => ({ faceMatchService: { identify: vi.fn() } }));
vi.mock('../../services/attendanceService', () => ({ attendanceService: { markAttendance: vi.fn() } }));

const user: User = {
  id: 'person', idCardNumber: 'EMP', fullName: 'Person', userType: 'employee',
  faceEmbedding: Array(128).fill(0.1), registeredAt: '2026-10-22T00:00:00Z', active: true,
};
const detection: FaceDetectionResult = {
  faceCount: 1, embedding: user.faceEmbedding, landmarks: [], boundingBox: null, quality: 'ok',
};

describe('attendance identity confirmation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requires three consecutive confirmations and resets after face loss', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.mocked(faceMatchService.identify).mockResolvedValue({ user, similarity: 0.95 });
    vi.mocked(attendanceService.markAttendance).mockResolvedValue({ record: null, duplicate: true });
    function setDetection(result: FaceDetectionResult) {
      vi.mocked(useFaceDetection).mockReturnValue({
        result, samples: [], modelReady: true, modelError: null,
      });
    }
    setDetection({ ...detection });
    const view = render(<MemoryRouter><HomePage /></MemoryRouter>);
    await act(async () => {});
    async function next(result = { ...detection }) {
      now += 700;
      setDetection(result);
      await act(async () => {
        view.rerender(<MemoryRouter><HomePage /></MemoryRouter>);
      });
    }
    await next();
    expect(attendanceService.markAttendance).not.toHaveBeenCalled();
    await next({ ...detection, embedding: null, landmarks: null, faceCount: 0, quality: 'no-face' });
    await next();
    await next();
    expect(attendanceService.markAttendance).not.toHaveBeenCalled();
    await next();
    expect(attendanceService.markAttendance).toHaveBeenCalledTimes(1);
    expect(attendanceService.markAttendance).toHaveBeenCalledWith({
      user, source: 'face-recognition', confidence: 0.95,
    });
  });
});
