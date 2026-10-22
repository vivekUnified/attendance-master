import { isFaceDescriptor } from './faceDescriptor';

let recognizerPromise: Promise<typeof import('@vladmandic/face-api')> | null = null;

export function getFaceRecognizer() {
  if (!recognizerPromise) {
    recognizerPromise = (async () => {
      const api = await import('@vladmandic/face-api');
      const modelUrl = `${import.meta.env.BASE_URL}models/recognition`;
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(modelUrl),
        api.nets.faceLandmark68Net.loadFromUri(modelUrl),
        api.nets.faceRecognitionNet.loadFromUri(modelUrl),
      ]);
      return api;
    })();
  }
  return recognizerPromise;
}

export async function describeFace(frame: HTMLCanvasElement): Promise<number[] | null> {
  const api = await getFaceRecognizer();
  const faces = await api.detectAllFaces(
    frame,
    new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.7 }),
  ).withFaceLandmarks().withFaceDescriptors();
  if (faces.length !== 1) return null;
  const descriptor = Array.from(faces[0].descriptor);
  if (!isFaceDescriptor(descriptor)) throw new Error('The recognition model produced an invalid descriptor.');
  return descriptor;
}
