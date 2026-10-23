/** Cosine similarity and top-k search over in-memory vectors (pure). */
import type { VectorMatch, VectorRecord } from "./types";

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export function topK(query: number[], records: VectorRecord[], k: number): VectorMatch[] {
  return records
    .map((r) => ({ id: r.id, score: cosine(query, r.values), metadata: r.metadata }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
