/**
 * Runs the face engine against a live <video> element on an animation-frame
 * loop and reports the latest detection result.
 */
import { useEffect, useRef, useState } from 'react';
import { faceEngine } from '../engine/faceEngine';
import type { FaceDetectionResult } from '../types';

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
): { result: FaceDetectionResult | null; modelReady: boolean; modelError: string | null } {
  const [result, setResult] = useState<FaceDetectionResult | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    faceEngine
      .preload()
      .then(() => {
        if (!cancelled) setModelReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setModelError(err instanceof Error ? err.message : 'Failed to load face model');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active || !modelReady) return undefined;

    let cancelled = false;

    const loop = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const detection = await faceEngine.detect(video, performance.now());
          if (!cancelled) setResult(detection);
        } catch {
          // Transient detection errors are ignored; the loop keeps running.
        }
      }
      if (!cancelled) {
        rafRef.current = requestAnimationFrame(() => {
          void loop();
        });
      }
    };

    void loop();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, modelReady]);

  return { result, modelReady, modelError };
}
