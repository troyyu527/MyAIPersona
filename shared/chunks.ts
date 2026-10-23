/** Ingestion helpers (pure): validate chunks.jsonl lines, split into batches, find ids to delete. */
import type { Chunk } from "./types";

/** Returns an error message, or null when the object is a usable chunk. */
export function validateChunk(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return "not an object";
  const c = value as Partial<Chunk>;
  if (typeof c.id !== "string" || !/^[a-z0-9-]+#\d{2}$/.test(c.id)) return "missing or malformed id";
  if (typeof c.doc_id !== "string" || !c.id.startsWith(c.doc_id + "#")) return "doc_id does not match id";
  if (typeof c.section !== "string" || !c.section) return "missing section";
  if (typeof c.text !== "string" || !c.text.trim()) return "missing text";
  if (typeof c.metadata !== "object" || c.metadata === null) return "missing metadata";
  if (typeof c.metadata.title !== "string" || typeof c.metadata.type !== "string") return "metadata needs title and type";
  return null;
}

export interface ParseResult {
  chunks: Chunk[];
  errors: string[];
}

/** Parses chunks.jsonl content; every bad line or duplicate id becomes an error with its line number. */
export function parseChunksJsonl(content: string): ParseResult {
  const chunks: Chunk[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  content.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      errors.push(`line ${i + 1}: invalid JSON`);
      return;
    }
    const error = validateChunk(value);
    if (error) {
      errors.push(`line ${i + 1}: ${error}`);
      return;
    }
    const chunk = value as Chunk;
    if (seen.has(chunk.id)) {
      errors.push(`line ${i + 1}: duplicate id ${chunk.id}`);
      return;
    }
    seen.add(chunk.id);
    chunks.push(chunk);
  });
  return { chunks, errors };
}

export function toBatches<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("Batch size must be at least 1");
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** Ids in the index that are no longer in the knowledge base. */
export function idsToDelete(indexed: string[], current: string[]): string[] {
  const keep = new Set(current);
  return indexed.filter((id) => !keep.has(id));
}
