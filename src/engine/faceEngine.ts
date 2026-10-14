/**
 * Thin wrapper around MediaPipe Tasks Vision `FaceLandmarker`.
 *
 * MediaPipe gives us accurate face detection and 478 3D landmarks per face,
 * but (as noted in the project requirements) it does not provide an
 * out-of-the-box identity embedding. We derive a lightweight, deterministic
 * "embedding" from the landmark geometry: pairwise distances between a
 * stable subset of landmarks, normalized by inter-ocular distance so the
 * vector is robust to the subject's distance from the camera and to
 * translation. This is compared with cosine similarity during matching.
 *
 * This approach is intentionally simple and transparent so it is easy to
 * replace with a dedicated face-recognition embedding model later without
 * changing any downstream code (the rest of the app only depends on
 * `FaceDetectionResult`).
 */
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { FaceDetectionResult } from '../types';

const WASM_BASE_URL = `${import.meta.env.BASE_URL}mediapipe-wasm`;
const MODEL_ASSET_PATH = `${import.meta.env.BASE_URL}models/face_landmarker.task`;

// Landmark indices (MediaPipe FaceMesh topology) used to build the embedding.
// Chosen to cover eyes, eyebrows, nose, mouth, and jawline contour points
// that vary meaningfully between individuals while being reasonably stable
// across expressions.
const LANDMARK_SUBSET = [
  33, 133, 160, 159, 158, 157, 173, 263, 362, 387, 386, 385, 384, 398, 1, 2, 98, 327, 61, 291, 0,
  17, 78, 308, 50, 280, 234, 454, 10, 152, 149, 377, 136, 365,
];

const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

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

function buildEmbedding(result: FaceLandmarkerResult, faceIndex: number): number[] {
  const landmarks = result.faceLandmarks[faceIndex];
  const left = landmarks[LEFT_EYE_OUTER];
  const right = landmarks[RIGHT_EYE_OUTER];
  const interOcular = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z) || 1e-6;

  const points = LANDMARK_SUBSET.map((i) => landmarks[i]);
  const centroid = points.reduce(
    (acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length, z: acc.z + p.z / points.length }),
    { x: 0, y: 0, z: 0 },
  );

  const embedding: number[] = [];
  for (const p of points) {
    embedding.push(
      (p.x - centroid.x) / interOcular,
      (p.y - centroid.y) / interOcular,
      (p.z - centroid.z) / interOcular,
    );
  }
  return embedding;
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
    await getLandmarker();
  },

  /**
   * Runs detection on a single video frame and returns a detection result.
   * Returns `quality: 'multiple-faces'` when more than one face is present,
   * since attendance should only be marked for a single, clearly identified
   * person at a time.
   */
  async detect(video: HTMLVideoElement, timestampMs: number): Promise<FaceDetectionResult> {
    const landmarker = await getLandmarker();
    const result = landmarker.detectForVideo(video, timestampMs);

    const faceCount = result.faceLandmarks.length;
    if (faceCount === 0) {
      return { faceCount, embedding: null, boundingBox: null, quality: 'no-face' };
    }
    if (faceCount > 1) {
      return { faceCount, embedding: null, boundingBox: null, quality: 'multiple-faces' };
    }

    const boundingBox = boundingBoxFromLandmarks(result, 0, video.videoWidth, video.videoHeight);
    const minDimension = Math.min(boundingBox?.width ?? 0, boundingBox?.height ?? 0);
    if (minDimension < video.videoHeight * 0.12) {
      // Face is too small/far from the camera for a reliable embedding.
      return { faceCount, embedding: null, boundingBox, quality: 'low-quality' };
    }

    const embedding = buildEmbedding(result, 0);
    return { faceCount, embedding, boundingBox, quality: 'ok' };
  },
};
