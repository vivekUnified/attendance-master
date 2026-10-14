/**
 * Live camera preview with an optional face-detection bounding box overlay
 * and a camera-switch control.
 */
import { useState } from 'react';
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

      {detection?.boundingBox && detection.quality === 'ok' && (
        <div
          className="pointer-events-none absolute rounded-lg border-2 transition-all"
          style={{
            borderColor: overlayColor,
            left: `${(detection.boundingBox.x / videoSize.width) * 100}%`,
            top: `${(detection.boundingBox.y / videoSize.height) * 100}%`,
            width: `${(detection.boundingBox.width / videoSize.width) * 100}%`,
            height: `${(detection.boundingBox.height / videoSize.height) * 100}%`,
          }}
        />
      )}

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
