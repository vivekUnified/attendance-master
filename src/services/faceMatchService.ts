/**
 * Matches a captured face embedding against all registered (active) users
 * using cosine similarity, applying the configurable recognition threshold.
 */
import { userRepository } from './userRepository';
import { settingsRepository } from './settingsRepository';
import { cosineSimilarity } from '../utils/similarity';
import type { MatchResult } from '../types';

export const faceMatchService = {
  async identify(embedding: number[]): Promise<MatchResult> {
    const [users, settings] = await Promise.all([
      userRepository.listActive(),
      settingsRepository.get(),
    ]);

    let best: MatchResult = { user: null, similarity: 0 };
    for (const user of users) {
      const similarity = cosineSimilarity(embedding, user.faceEmbedding);
      if (similarity > best.similarity) {
        best = { user, similarity };
      }
    }

    if (best.user && best.similarity >= settings.recognitionThreshold) {
      return best;
    }
    return { user: null, similarity: best.similarity };
  },
};
