/**
 * Matches a captured face embedding against all registered (active) users
 * using dedicated descriptors, a distance threshold, and an ambiguity margin.
 */
import { userRepository } from './userRepository';
import { settingsRepository } from './settingsRepository';
import { descriptorSimilarity, isFaceDescriptor } from '../engine/faceDescriptor';
import type { MatchResult } from '../types';

export const faceMatchService = {
  async identify(embedding: number[]): Promise<MatchResult> {
    if (!isFaceDescriptor(embedding)) {
      throw new Error('Invalid face descriptor. Capture a new face sample.');
    }
    const [users, settings] = await Promise.all([
      userRepository.listActive(),
      settingsRepository.get(),
    ]);

    let best: MatchResult = { user: null, similarity: 0 };
    let runnerUp = 0;
    for (const user of users) {
      // Legacy geometry vectors cannot be compared with recognition descriptors.
      if (!isFaceDescriptor(user.faceEmbedding)) continue;
      const similarity = descriptorSimilarity(embedding, user.faceEmbedding);
      if (similarity > best.similarity) {
        runnerUp = best.similarity;
        best = { user, similarity };
      } else {
        runnerUp = Math.max(runnerUp, similarity);
      }
    }

    if (best.user && best.similarity >= Math.max(0.75, settings.recognitionThreshold) &&
      best.similarity - runnerUp >= 0.025) {
      return best;
    }
    return { user: null, similarity: best.similarity };
  },
};
