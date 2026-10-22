/**
 * Thin wrapper around MediaPipe Tasks Vision `FaceLandmarker`.
 *
 * MediaPipe supplies the live mesh; a dedicated recognition network supplies
 * identity descriptors. Both models see the same captured frame.
 */
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { FaceDetectionResult } from '../types';
import { describeFace, getFaceRecognizer } from './faceRecognizer';

const WASM_BASE_URL = `${import.meta.env.BASE_URL}mediapipe-wasm`;
const MODEL_ASSET_PATH = `${import.meta.env.BASE_URL}models/face_landmarker.task`;

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      return FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 2,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return landmarkerPromise;
}

function boundingBoxFromLandmarks(
  result: FaceLandmarkerResult,
  faceIndex: number,
  videoWidth: number,
  videoHeight: number,
): FaceDetectionResult['boundingBox'] {
  const landmarks = result.faceLandmarks[faceIndex];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of landmarks) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX * videoWidth,
    y: minY * videoHeight,
    width: (maxX - minX) * videoWidth,
    height: (maxY - minY) * videoHeight,
  };
}

export const faceEngine = {
  /** Warms up the model so the first real-time frame isn't slow. */
  async preload(): Promise<void> {
    await Promise.all([getLandmarker(), getFaceRecognizer()]);
  },

  /**
   * Runs detection on a single video frame and returns a detection result.
   * Returns `quality: 'multiple-faces'` when more than one face is present,
   * since attendance should only be marked for a single, clearly identified
   * person at a time.
   */
  async detect(video: HTMLVideoElement, timestampMs: number): Promise<FaceDetectionResult> {
    const landmarker = await getLandmarker();
    const frame = document.createElement('canvas');
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    const context = frame.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable for face recognition.');
    context.drawImage(video, 0, 0);
    const result = landmarker.detectForVideo(frame, timestampMs);

    const faceCount = result.faceLandmarks.length;
    if (faceCount === 0) {
      return { faceCount, embedding: null, landmarks: null, boundingBox: null, quality: 'no-face' };
    }
    if (faceCount > 1) {
      return { faceCount, embedding: null, landmarks: null, boundingBox: null, quality: 'multiple-faces' };
    }

    const boundingBox = boundingBoxFromLandmarks(result, 0, video.videoWidth, video.videoHeight);
    const landmarks = result.faceLandmarks[0];
    const minDimension = Math.min(boundingBox?.width ?? 0, boundingBox?.height ?? 0);
    const clipped = landmarks.some((p) => p.x <= 0.01 || p.x >= 0.99 || p.y <= 0.01 || p.y >= 0.99);
    if (minDimension < Math.max(80, video.videoHeight * 0.2) || clipped) {
      // Face is too small/far from the camera for a reliable embedding.
      return { faceCount, embedding: null, landmarks, boundingBox, quality: 'low-quality' };
    }

    const embedding = await describeFace(frame);
    return { faceCount, embedding, landmarks, boundingBox, quality: embedding ? 'ok' : 'low-quality' };
  },
};
