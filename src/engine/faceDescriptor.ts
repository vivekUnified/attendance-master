export const FACE_DESCRIPTOR_LENGTH = 128;
export const RECOGNITION_MODEL = 'face-api-resnet-v1';

export function isFaceDescriptor(value: number[]): boolean {
  return value.length === FACE_DESCRIPTOR_LENGTH &&
    value.every(Number.isFinite) &&
    value.some((component) => component !== 0);
}

/** Distance-based match score, not a probability of identity. */
export function descriptorSimilarity(a: number[], b: number[]): number {
  if (!isFaceDescriptor(a) || !isFaceDescriptor(b)) {
    throw new Error('A valid recognition descriptor is required. Please re-enroll this face.');
  }
  const distance = Math.hypot(...a.map((value, index) => value - b[index]));
  return Math.max(0, 1 - distance / 2);
}
