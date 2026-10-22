import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraView } from '../CameraView';
import type { UseCameraResult } from '../../hooks/useCamera';
import type { FaceDetectionResult } from '../../types';

vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { FACE_LANDMARKS_TESSELATION: [{ start: 0, end: 1 }] },
}));

describe('camera face mesh', () => {
  const context = {
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
  };
  const detection: FaceDetectionResult = {
    faceCount: 1, quality: 'ok', embedding: Array(128).fill(0.1), boundingBox: null,
    landmarks: [{ x: 0.25, y: 0.3, z: 0 }, { x: 0.75, y: 0.7, z: 0 }],
  };
  let camera: UseCameraResult;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    camera = {
      videoRef: createRef<HTMLVideoElement>(), ready: true, error: null, facingMode: 'user',
      canSwitchCamera: false, switchCamera: vi.fn(), requestPermission: vi.fn(),
    };
  });

  it('draws mesh edges and points in video coordinates with matching cover cropping', () => {
    const { container } = render(<CameraView camera={camera} detection={detection} />);
    const video = container.querySelector('video')!;
    Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 } });
    fireEvent.loadedMetadata(video);
    const canvas = container.querySelector('canvas')!;
    expect([canvas.width, canvas.height]).toEqual([640, 480]);
    expect(canvas.className).toContain('object-cover');
    expect(video.className).toContain('object-cover');
    expect(context.moveTo).toHaveBeenCalledWith(160, 144);
    expect(context.lineTo).toHaveBeenCalledWith(480, 336);
    expect(context.arc).toHaveBeenCalledWith(160, 144, expect.any(Number), 0, Math.PI * 2);
    expect(context.stroke).toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalled();
  });

  it('clears stale mesh on face loss and when the camera stops', () => {
    const { rerender } = render(<CameraView camera={camera} detection={detection} />);
    context.stroke.mockClear();
    context.arc.mockClear();
    rerender(<CameraView camera={camera} detection={null} />);
    rerender(<CameraView camera={{ ...camera, ready: false }} detection={detection} />);
    expect(context.clearRect).toHaveBeenCalled();
    expect(context.stroke).not.toHaveBeenCalled();
    expect(context.arc).not.toHaveBeenCalled();
  });
});
