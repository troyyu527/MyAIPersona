/** Production vector store: Cloudflare Vectorize binding, with the id list kept in KV (Vectorize can't list ids). */
import type { VectorMatch, VectorMetadata, VectorRecord } from "../../shared/types";
import type { KvStore, VectorizeBinding } from "../config";
import type { VectorStore } from "./localVectorStore";

const IDS_KEY = "vectorize:ids";
const BATCH = 100;

export function createVectorizeStore(index: VectorizeBinding, kv: KvStore): VectorStore {
  async function readIds(): Promise<string[]> {
    const raw = await kv.get(IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }
  const writeIds = (ids: string[]) => kv.put(IDS_KEY, JSON.stringify([...new Set(ids)].sort()));

  return {
    async upsert(records: VectorRecord[]) {
      for (let i = 0; i < records.length; i += BATCH) {
        await index.upsert(records.slice(i, i + BATCH).map((r) => ({ id: r.id, values: r.values, metadata: { ...r.metadata } })));
      }
      await writeIds([...(await readIds()), ...records.map((r) => r.id)]);
    },
    async deleteByIds(ids) {
      for (let i = 0; i < ids.length; i += BATCH) await index.deleteByIds(ids.slice(i, i + BATCH));
      const gone = new Set(ids);
      await writeIds((await readIds()).filter((id) => !gone.has(id)));
    },
    listIds: readIds,
    async query(vector, k) {
      const result = await index.query(vector, { topK: k, returnMetadata: "all" });
      return result.matches.map((m) => ({ id: m.id, score: m.score, metadata: m.metadata as unknown as VectorMetadata }));
    },
    async getByIds(ids) {
      const found = await index.getByIds(ids);
      return found.map((v): VectorMatch => ({ id: v.id, score: 0, metadata: v.metadata as unknown as VectorMetadata }));
    },
  };
}
