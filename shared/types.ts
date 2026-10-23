/** Types shared by client, server and scripts: knowledge-base chunks, vectors, sources and media. */

export interface MediaItem {
  type: "image" | "video";
  url: string;
  caption?: string;
}

export interface LinkItem {
  label: string;
  url: string;
}

/** One line of chunks.jsonl, as written by the knowledge-base preprocessor. */
export interface Chunk {
  id: string;
  doc_id: string;
  section: string;
  text: string;
  metadata: {
    type: string;
    title: string;
    category?: string;
    owner?: string;
    client?: string;
    start?: string;
    end?: string;
    status?: string;
    links?: LinkItem[];
    media?: MediaItem[];
    [key: string]: unknown;
  };
}

/** Flat metadata stored with each vector (Vectorize-compatible: strings only; lists as JSON). */
export interface VectorMetadata {
  doc_id: string;
  section: string;
  title: string;
  type: string;
  category?: string;
  owner?: string;
  client?: string;
  start?: string;
  end?: string;
  status?: string;
  links?: string;
  media?: string;
  text: string;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** POST /api/chat body. */
export interface ChatRequest {
  question: string;
  history: ChatTurn[];
}

/** A chunk shown as a source chip under an answer. */
export interface SourceRef {
  id: string;
  title: string;
  section: string;
  score: number;
  url: string | null;
}

/** Server-Sent Events of /api/chat: tokens, then done (or error instead of done). */
export type ChatEvent =
  | { event: "token"; data: { t: string } }
  | { event: "done"; data: { sources: SourceRef[]; media: MediaItem[]; model: string } }
  | { event: "error"; data: { message: string } };
