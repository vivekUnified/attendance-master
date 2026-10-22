/**
 * Runs the face engine against a live <video> element on an animation-frame
 * loop and reports the latest detection result.
 */
import { useEffect, useRef, useState } from 'react';
import { faceEngine } from '../engine/faceEngine';
import type { FaceDetectionResult } from '../types';
import { descriptorSimilarity } from '../engine/faceDescriptor';

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
): { result: FaceDetectionResult | null; samples: number[][]; modelReady: boolean; modelError: string | null } {
  const [result, setResult] = useState<FaceDetectionResult | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [samples, setSamples] = useState<number[][]>([]);
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
    let stableSamples: number[][] = [];
    let lastVideoTime = -1;

    const loop = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const detection = await faceEngine.detect(video, performance.now());
          if (!cancelled) {
            const embedding = detection.quality === 'ok' ? detection.embedding : null;
            if (!embedding) stableSamples = [];
            else if (stableSamples.some((sample) => descriptorSimilarity(sample, embedding) < 0.85)) {
              stableSamples = [embedding];
            } else {
              stableSamples = [...stableSamples.slice(-4), embedding];
            }
            setSamples(stableSamples);
            setResult(detection);
            setModelError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setResult(null);
            stableSamples = [];
            setSamples([]);
            setModelError(err instanceof Error ? err.message : 'Face detection failed');
          }
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

  return { result: active ? result : null, samples: active ? samples : [], modelReady, modelError };
}
