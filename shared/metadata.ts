/** Maps knowledge-base chunks to vector metadata and back to links, media and source chips (pure). */
import type { Chunk, LinkItem, MediaItem, SourceRef, VectorMatch, VectorMetadata } from "./types";

const OPTIONAL_FIELDS = ["category", "owner", "client", "start", "end", "status"] as const;

export function toVectorMetadata(chunk: Chunk): VectorMetadata {
  const m = chunk.metadata;
  const meta: VectorMetadata = {
    doc_id: chunk.doc_id,
    section: chunk.section,
    title: m.title,
    type: m.type,
    text: chunk.text,
  };
  for (const field of OPTIONAL_FIELDS) {
    const value = m[field];
    if (value !== undefined && value !== null && value !== "") meta[field] = String(value);
  }
  if (m.links?.length) meta.links = JSON.stringify(m.links);
  if (m.media?.length) meta.media = JSON.stringify(m.media);
  return meta;
}

export function linksOf(meta: VectorMetadata): LinkItem[] {
  return meta.links ? (JSON.parse(meta.links) as LinkItem[]) : [];
}

export function mediaOf(meta: VectorMetadata): MediaItem[] {
  return meta.media ? (JSON.parse(meta.media) as MediaItem[]) : [];
}

/** Source chips for the matches, in rank order (url = the chunk's first link, if any). */
export function toSources(matches: VectorMatch[]): SourceRef[] {
  return matches.map((m) => ({
    id: m.id,
    title: m.metadata.title,
    section: m.metadata.section,
    score: Number(m.score.toFixed(3)),
    url: linksOf(m.metadata)[0]?.url ?? null,
  }));
}

/** Media is shown only for chunks scoring within this gap of the best match (Step 6: a loosely related
 *  rank-4 chunk brought Kosciuszko videos to "What kind of role is Troy looking for?"). */
export const MEDIA_SCORE_GAP = 0.05;

/** The matches whose media should be shown: they carry media and score within `gap` of the best match. */
export function mediaChunks(matches: VectorMatch[], gap = MEDIA_SCORE_GAP): VectorMatch[] {
  const top = Math.max(...matches.map((m) => m.score));
  return matches.filter((m) => m.metadata.media && m.score >= top - gap);
}

/** Media of all matches, deduplicated by URL, in rank order. */
export function toMedia(matches: VectorMatch[]): MediaItem[] {
  const seen = new Set<string>();
  const media: MediaItem[] = [];
  for (const m of matches) {
    for (const item of mediaOf(m.metadata)) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      media.push(item);
    }
  }
  return media;
}
