import { describe, expect, it } from 'vitest';
import { descriptorSimilarity, isFaceDescriptor } from '../faceDescriptor';

const descriptor = Array.from({ length: 128 }, () => 0.1);

describe('recognition descriptors', () => {
  it('accepts only finite, nonzero, 128-dimensional descriptors', () => {
    expect(isFaceDescriptor(descriptor)).toBe(true);
    for (const invalid of [[], Array(102).fill(1), Array(128).fill(0), Array(128).fill(NaN)]) {
      expect(isFaceDescriptor(invalid)).toBe(false);
    }
  });

  it('maps exact distance boundaries to match scores', () => {
    const other = [...descriptor];
    other[0] += 0.5;
    expect(descriptorSimilarity(descriptor, descriptor)).toBe(1);
    expect(descriptorSimilarity(descriptor, other)).toBeCloseTo(0.75);
    other[0] += 2;
    expect(descriptorSimilarity(descriptor, other)).toBe(0);
    expect(() => descriptorSimilarity(descriptor, [1])).toThrow('re-enroll');
  });
});
