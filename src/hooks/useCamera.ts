/**
 * Manages camera device enumeration, stream acquisition, and front/back
 * switching. Handles permission denial and no-camera-available errors.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorKind = 'permission-denied' | 'not-found' | 'unavailable' | 'unknown';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
}

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ready: boolean;
  error: CameraError | null;
  facingMode: 'user' | 'environment';
  canSwitchCamera: boolean;
  switchCamera: () => void;
  requestPermission: () => void;
}

function toCameraError(err: unknown): CameraError {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return { kind: 'permission-denied', message: 'Camera permission was denied.' };
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return { kind: 'not-found', message: 'No camera device was found.' };
    }
  }
  return { kind: 'unknown', message: err instanceof Error ? err.message : 'Camera error' };
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError({ kind: 'unavailable', message: 'Camera API is not supported in this browser.' });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCanSwitchCamera(videoInputs.length > 1);
      } catch (err) {
        if (!cancelled) setError(toCameraError(err));
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, attempt]);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  const requestPermission = useCallback(() => {
    setAttempt((a) => a + 1);
  }, []);

  return { videoRef, ready, error, facingMode, canSwitchCamera, switchCamera, requestPermission };
}
