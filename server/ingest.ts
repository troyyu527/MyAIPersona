/** Node CLI (npm run ingest): reads chunks.jsonl, posts batches to /admin/ingest, then prunes removed chunks. */
import { readFileSync } from "node:fs";
import { parseChunksJsonl, toBatches } from "../shared/chunks";

const BATCH_SIZE = 20;

try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional when the variables are set in the shell
}
const chunksPath = process.env.CHUNKS_PATH;
if (!chunksPath) throw new Error("CHUNKS_PATH is not set (see .env.example)");
const workerUrl = process.env.WORKER_URL ?? "http://localhost:8787";
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error("ADMIN_TOKEN is not set (see .env.example)");

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${workerUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

const { chunks, errors } = parseChunksJsonl(readFileSync(chunksPath, "utf8"));
if (errors.length) {
  console.error(`chunks.jsonl has ${errors.length} invalid line(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

let upserted = 0;
for (const batch of toBatches(chunks, BATCH_SIZE)) {
  const result = await post<{ upserted: number }>("/admin/ingest", { chunks: batch });
  upserted += result.upserted;
  process.stdout.write(`\r${upserted}/${chunks.length} upserted`);
}
const pruned = await post<{ deleted: number; deletedIds: string[]; total: number }>("/admin/prune", {
  keep: chunks.map((c) => c.id),
});
console.log(
  `\r${chunks.length} chunks read · ${upserted} upserted · ${pruned.deleted} deleted · index total ${pruned.total}` +
    (pruned.deleted ? `\n  deleted: ${pruned.deletedIds.join(", ")}` : ""),
);
