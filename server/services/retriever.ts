/** Embeds chunks and queries, searches the vector store and assembles the answer context.
 *  Embeddings by AI_PROVIDER: Ollama (development) or Workers AI (production), both bge-base-en-v1.5. */
import { CloudflareWorkersAIEmbeddings } from "@langchain/cloudflare";
import type { Embeddings } from "@langchain/core/embeddings";
import { OllamaEmbeddings } from "@langchain/ollama";
import { aboveThreshold, mergeChunks } from "../../shared/merge";
import { toVectorMetadata } from "../../shared/metadata";
import { SUMMARY_CHUNK_ID } from "../../shared/prompt";
import type { Chunk, VectorMatch } from "../../shared/types";
import type { AiBinding, Config } from "../config";
import type { VectorStore } from "./localVectorStore";

export interface RetrievedContext {
  /** Relevant chunks, best first (after merge and threshold). */
  chunks: VectorMatch[];
  /** The always-on profile summary (profile#00), or null if it isn't indexed. */
  summary: VectorMatch | null;
}

export interface Retriever {
  upsertChunks(chunks: Chunk[]): Promise<void>;
  /** Embeds a query; with `usePrefix` (default) the bge query instruction is prepended. */
  embedQuery(query: string, usePrefix?: boolean): Promise<number[]>;
  search(queryVector: number[], k: number): Promise<VectorMatch[]>;
  /** Searches the original and the rewritten query, merges, applies the threshold and adds the summary. */
  retrieveContext(original: string, rewritten: string): Promise<RetrievedContext>;
}

export function createEmbeddings(cfg: Config, ai?: AiBinding): Embeddings {
  if (cfg.provider === "cloudflare") {
    if (!ai) throw new Error("AI binding missing (AI_PROVIDER=cloudflare)");
    // stripNewLines off: embed exactly the same text as in development, so the tuned threshold carries over.
    return new CloudflareWorkersAIEmbeddings({ binding: ai as never, model: cfg.embeddingModel, stripNewLines: false, maxRetries: 1 });
  }
  // truncate stays off (LangChain default): a chunk over bge's 512 tokens must fail loudly, not lose its end.
  // Few retries: LangChain's default (6, with backoff) turns a hard error into a ~90 s wait.
  return new OllamaEmbeddings({ baseUrl: cfg.ollamaUrl, model: cfg.embeddingModel, maxRetries: 1 });
}

export function createRetriever(cfg: Config, store: VectorStore, embeddings: Embeddings): Retriever {
  const embedQuery = (query: string, usePrefix = true) =>
    embeddings.embedQuery((usePrefix ? cfg.queryPrefix : "") + query);

  return {
    async upsertChunks(chunks) {
      const vectors = await embeddings.embedDocuments(chunks.map((c) => c.text));
      await store.upsert(chunks.map((c, i) => ({ id: c.id, values: vectors[i], metadata: toVectorMetadata(c) })));
    },
    embedQuery,
    search: (queryVector, k) => store.query(queryVector, k),
    async retrieveContext(original, rewritten) {
      const queries = rewritten && rewritten !== original ? [original, rewritten] : [original];
      const vectors = await embeddings.embedDocuments(queries.map((q) => cfg.queryPrefix + q));
      const results = await Promise.all(vectors.map((v) => store.query(v, cfg.topK)));
      const chunks = aboveThreshold(mergeChunks(results[0], results[1] ?? [], cfg.topK), cfg.threshold);
      const summary = chunks.find((c) => c.id === SUMMARY_CHUNK_ID) ?? (await store.getByIds([SUMMARY_CHUNK_ID]))[0] ?? null;
      return { chunks, summary };
    },
  };
}
