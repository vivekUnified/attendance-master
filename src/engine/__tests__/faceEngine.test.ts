import { beforeEach, describe, expect, it, vi } from 'vitest';
import { faceEngine } from '../faceEngine';
import { describeFace } from '../faceRecognizer';

const { detectForVideo } = vi.hoisted(() => ({ detectForVideo: vi.fn() }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  FaceLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue({ detectForVideo }),
  },
}));
vi.mock('../faceRecognizer', () => ({
  getFaceRecognizer: vi.fn().mockResolvedValue({}),
  describeFace: vi.fn(),
}));

function landmarks() {
  return Array.from({ length: 478 }, (_, i) => ({
    x: i % 2 ? 0.3 : 0.7, y: i % 3 ? 0.3 : 0.7, z: 0,
  }));
}

describe('face engine', () => {
  let video: HTMLVideoElement;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    video = document.createElement('video');
    Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 } });
    vi.mocked(describeFace).mockResolvedValue(Array(128).fill(0.1));
  });

  it('returns all mesh points and a dedicated descriptor from the captured frame', async () => {
    const points = landmarks();
    detectForVideo.mockReturnValue({ faceLandmarks: [points] });
    const result = await faceEngine.detect(video, 1);
    expect(result.quality).toBe('ok');
    expect(result.landmarks).toEqual(points);
    expect(result.embedding).toHaveLength(128);
    expect(describeFace).toHaveBeenCalledWith(detectForVideo.mock.calls[0][0]);
  });

  it('does not produce descriptors for absent or multiple faces', async () => {
    for (const faces of [[], [landmarks(), landmarks()]]) {
      detectForVideo.mockReturnValue({ faceLandmarks: faces });
      const result = await faceEngine.detect(video, 2);
      expect(result.embedding).toBeNull();
      expect(result.landmarks).toBeNull();
    }
    expect(describeFace).not.toHaveBeenCalled();
  });

  it('rejects small or clipped faces before identity inference', async () => {
    for (const points of [
      landmarks().map((p) => ({ ...p, x: 0.5 + p.x / 100, y: 0.5 + p.y / 100 })),
      landmarks().map((p, i) => i === 0 ? { ...p, x: 0 } : p),
    ]) {
      detectForVideo.mockReturnValue({ faceLandmarks: [points] });
      expect((await faceEngine.detect(video, 3)).quality).toBe('low-quality');
    }
    expect(describeFace).not.toHaveBeenCalled();
  });

  it('rejects a frame if the recognition detector does not find exactly one usable face', async () => {
    detectForVideo.mockReturnValue({ faceLandmarks: [landmarks()] });
    vi.mocked(describeFace).mockResolvedValue(null);
    expect((await faceEngine.detect(video, 4)).quality).toBe('low-quality');
  });
});
