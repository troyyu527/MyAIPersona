/** Merges the results of the original and the rewritten query (pure; course week5 merge_chunks). */
import type { VectorMatch } from "./types";

/** Dedupes by id keeping the higher score, then returns the best k by score. */
export function mergeChunks(a: VectorMatch[], b: VectorMatch[], k: number): VectorMatch[] {
  const best = new Map<string, VectorMatch>();
  for (const match of [...a, ...b]) {
    const seen = best.get(match.id);
    if (!seen || match.score > seen.score) best.set(match.id, match);
  }
  return [...best.values()].sort((x, y) => y.score - x.score).slice(0, k);
}

/** Drops matches below the relevance threshold. */
export function aboveThreshold(matches: VectorMatch[], threshold: number): VectorMatch[] {
  return matches.filter((m) => m.score >= threshold);
}
