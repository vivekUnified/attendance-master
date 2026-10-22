/**
 * Live camera preview with a full-face landmark mesh overlay
 * and a camera-switch control.
 */
import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import type { FaceDetectionResult } from '../types';
import type { UseCameraResult } from '../hooks/useCamera';

interface CameraViewProps {
  camera: UseCameraResult;
  detection?: FaceDetectionResult | null;
  overlayColor?: string;
  children?: React.ReactNode;
}

const ERROR_MESSAGES: Record<string, string> = {
  'permission-denied': 'Camera permission denied. Please allow camera access and try again.',
  'not-found': 'No camera was found on this device.',
  unavailable: 'Camera is not supported in this browser.',
  unknown: 'Unable to start the camera.',
};

export function CameraView({ camera, detection, overlayColor = '#22d3ee', children }: CameraViewProps) {
  const { videoRef, ready, error, canSwitchCamera, switchCamera, requestPermission } = camera;
  // Tracked via onLoadedMetadata/onResize instead of reading videoRef.current
  // during render, which would not be reactive.
  const [videoSize, setVideoSize] = useState({ width: 1, height: 1 });
  const meshRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = meshRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const points = detection?.landmarks;
    if (!ready || error || !points || detection?.faceCount !== 1) return;

    context.strokeStyle = overlayColor;
    context.fillStyle = overlayColor;
    context.lineWidth = Math.max(0.5, videoSize.width / 1000);
    context.globalAlpha = 0.35;
    context.beginPath();
    for (const { start, end } of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
      const a = points[start];
      const b = points[end];
      if (!a || !b) continue;
      context.moveTo(a.x * videoSize.width, a.y * videoSize.height);
      context.lineTo(b.x * videoSize.width, b.y * videoSize.height);
    }
    context.stroke();
    context.globalAlpha = 0.9;
    context.beginPath();
    for (const point of points) {
      const x = point.x * videoSize.width;
      const y = point.y * videoSize.height;
      const radius = Math.max(1, videoSize.width / 600);
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
    }
    context.fill();
  }, [detection, videoSize, overlayColor, ready, error]);

  function syncVideoSize() {
    const video = videoRef.current;
    if (video?.videoWidth && video.videoHeight) {
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
    }
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900 aspect-video shadow-inner">
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        onLoadedMetadata={syncVideoSize}
        onResize={syncVideoSize}
        className="h-full w-full object-cover"
      />

      <canvas
        ref={meshRef}
        width={videoSize.width}
        height={videoSize.height}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          <span className="animate-pulse text-sm">Starting camera…</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/95 p-6 text-center text-slate-200">
          <p className="text-sm">{ERROR_MESSAGES[error.kind] ?? error.message}</p>
          <button
            type="button"
            onClick={requestPermission}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Try again
          </button>
        </div>
      )}

      {canSwitchCamera && ready && !error && (
        <button
          type="button"
          onClick={switchCamera}
          aria-label="Switch camera"
          className="absolute right-3 top-3 rounded-full bg-slate-900/70 p-2 text-slate-100 backdrop-blur hover:bg-slate-800"
        >
          ⟳
        </button>
      )}

      {children}
    </div>
  );
}
