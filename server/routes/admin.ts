/** Token-protected admin routes: ingest, prune, clear, search (for the eval) and the Step 1 spike. */
import { idsToDelete, validateChunk } from "../../shared/chunks";
import type { Chunk } from "../../shared/types";
import { rewriteQuery, type Llm } from "../services/llm";
import type { VectorStore } from "../services/localVectorStore";
import type { Retriever } from "../services/retriever";

export const MAX_INGEST_BATCH = 50;

export interface AdminServices {
  retriever: Retriever;
  store: VectorStore;
  llm: Llm;
  rewriteModel: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function isAuthorized(request: Request, adminToken: string): boolean {
  if (!adminToken) return false;
  return request.headers.get("Authorization") === `Bearer ${adminToken}`;
}

/** Routes an authorized POST /admin/* request; returns null for unknown paths. */
export async function handleAdmin(request: Request, path: string, services: AdminServices): Promise<Response | null> {
  if (request.method !== "POST") return null;
  switch (path) {
    case "/admin/ingest":
      return ingest(request, services);
    case "/admin/prune":
      return prune(request, services.store);
    case "/admin/clear": {
      const ids = await services.store.listIds();
      await services.store.deleteByIds(ids);
      return json({ deleted: ids.length, total: 0 });
    }
    case "/admin/search":
      return search(request, services);
    case "/admin/spike":
      return handleSpike(request, services.retriever, services.llm);
    default:
      return null;
  }
}

/** Body {chunks}: embeds and upserts one batch (id = chunk id). */
async function ingest(request: Request, { retriever, store }: AdminServices): Promise<Response> {
  const body = (await request.json()) as { chunks?: unknown[] };
  const chunks = body.chunks ?? [];
  if (!Array.isArray(chunks) || chunks.length === 0) return json({ error: "No chunks" }, 400);
  if (chunks.length > MAX_INGEST_BATCH) return json({ error: `At most ${MAX_INGEST_BATCH} chunks per batch` }, 400);
  for (const [i, c] of chunks.entries()) {
    const error = validateChunk(c);
    if (error) return json({ error: `chunk ${i}: ${error}` }, 400);
  }
  await retriever.upsertChunks(chunks as Chunk[]);
  return json({ upserted: chunks.length, total: (await store.listIds()).length });
}

/** Body {keep}: deletes every indexed id that is not in `keep`. */
async function prune(request: Request, store: VectorStore): Promise<Response> {
  const body = (await request.json()) as { keep?: unknown };
  if (!Array.isArray(body.keep) || !body.keep.every((id) => typeof id === "string")) {
    return json({ error: "keep must be a list of ids" }, 400);
  }
  const stale = idsToDelete(await store.listIds(), body.keep);
  if (stale.length) await store.deleteByIds(stale);
  return json({ deleted: stale.length, deletedIds: stale, total: (await store.listIds()).length });
}

/** Body {query, k?, prefix?, rewrite?}: top-k matches with scores (used by the retrieval eval).
 *  With `rewrite`, runs the chat pipeline's retrieval instead: rewrite → both queries → merge → threshold. */
async function search(request: Request, { retriever, llm, rewriteModel }: AdminServices): Promise<Response> {
  const body = (await request.json()) as { query?: string; k?: number; prefix?: boolean; rewrite?: boolean };
  if (typeof body.query !== "string" || !body.query.trim()) return json({ error: "query required" }, 400);
  if (body.rewrite) {
    const rewritten = await rewriteQuery(llm, rewriteModel, body.query, []);
    const { chunks } = await retriever.retrieveContext(body.query, rewritten);
    return json({ matches: chunks, rewritten });
  }
  const vector = await retriever.embedQuery(body.query, body.prefix ?? true);
  const matches = await retriever.search(vector, Math.min(Math.max(body.k ?? 6, 1), 20));
  return json({ matches });
}

interface SpikeBody {
  chunks: Chunk[];
  question: string;
  models: string[];
}

/** Step 1 spike (removed in Step 7). Streams NDJSON: "retrieval", then "token"/"model_done" lines per model. */
async function handleSpike(request: Request, retriever: Retriever, llm: Llm): Promise<Response> {
  const body = (await request.json()) as SpikeBody;
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const send = (obj: unknown) => writer.write(encoder.encode(JSON.stringify(obj) + "\n"));

  (async () => {
    try {
      let t = Date.now();
      await retriever.upsertChunks(body.chunks);
      const upsertMs = Date.now() - t;
      t = Date.now();
      const queryVector = await retriever.embedQuery(body.question);
      const embedMs = Date.now() - t;
      t = Date.now();
      const hits = await retriever.search(queryVector, 3);
      const searchMs = Date.now() - t;
      await send({
        type: "retrieval",
        dims: queryVector.length,
        upsertMs,
        embedMs,
        searchMs,
        top: hits.map((h) => ({ id: h.id, score: Number(h.score.toFixed(3)) })),
      });

      const context = hits.map((h) => h.metadata.text).join("\n\n");
      const messages = [
        {
          role: "system" as const,
          content: `You are Troy Yu's AI twin. Answer in 2 sentences, in first person, using only this context:\n\n${context}`,
        },
        { role: "user" as const, content: body.question },
      ];
      for (const model of body.models) {
        const start = Date.now();
        let firstTokenMs = -1;
        let text = "";
        for await (const token of llm.stream(messages, { model, maxTokens: 150 })) {
          if (firstTokenMs < 0) firstTokenMs = Date.now() - start;
          text += token;
          await send({ type: "token", model, t: token });
        }
        await send({ type: "model_done", model, firstTokenMs, totalMs: Date.now() - start, text });
      }
    } catch (err) {
      await send({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, { headers: { "Content-Type": "application/x-ndjson" } });
}
