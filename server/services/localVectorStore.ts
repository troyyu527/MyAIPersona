/** Development-only vector store: all vectors in one local KV value, brute-force cosine search. */
import { topK } from "../../shared/similarity";
import type { VectorMatch, VectorRecord } from "../../shared/types";
import type { KvStore } from "../config";

const KEY = "vectors:v1";

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
  listIds(): Promise<string[]>;
  query(vector: number[], k: number): Promise<VectorMatch[]>;
  /** Records by id (missing ids are skipped), as matches with score 0. */
  getByIds(ids: string[]): Promise<VectorMatch[]>;
}

export function createLocalVectorStore(kv: KvStore): VectorStore {
  async function load(): Promise<Record<string, VectorRecord>> {
    const raw = await kv.get(KEY);
    return raw ? (JSON.parse(raw) as Record<string, VectorRecord>) : {};
  }
  async function save(all: Record<string, VectorRecord>): Promise<void> {
    await kv.put(KEY, JSON.stringify(all));
  }

  return {
    async upsert(records) {
      const all = await load();
      for (const r of records) all[r.id] = r;
      await save(all);
    },
    async deleteByIds(ids) {
      const all = await load();
      for (const id of ids) delete all[id];
      await save(all);
    },
    async listIds() {
      return Object.keys(await load()).sort();
    },
    async query(vector, k) {
      return topK(vector, Object.values(await load()), k);
    },
    async getByIds(ids) {
      const all = await load();
      return ids.filter((id) => all[id]).map((id) => ({ id, score: 0, metadata: all[id].metadata }));
    },
  };
}
