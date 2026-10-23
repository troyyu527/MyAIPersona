/** The only place that reads Worker env vars and bindings; turns them into typed settings. */

/** The subset of a KV namespace this Worker uses (real binding in wrangler, fake in tests). */
export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** The subset of the Workers AI binding this Worker uses (production only). */
export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

/** The subset of a Vectorize index binding this Worker uses (production only). */
export interface VectorizeBinding {
  upsert(vectors: { id: string; values: number[]; metadata?: Record<string, string> }[]): Promise<unknown>;
  deleteByIds(ids: string[]): Promise<unknown>;
  query(
    vector: number[],
    options: { topK: number; returnMetadata: "all" },
  ): Promise<{ matches: { id: string; score: number; metadata?: Record<string, unknown> }[] }>;
  getByIds(ids: string[]): Promise<{ id: string; metadata?: Record<string, unknown> }[]>;
}

export interface Env {
  KV: KvStore;
  AI?: AiBinding;
  VECTORIZE?: VectorizeBinding;
  ADMIN_TOKEN?: string;
  AI_PROVIDER?: string;
  OLLAMA_URL?: string;
  EMBEDDING_MODEL?: string;
  CHAT_MODEL?: string;
  REWRITE_MODEL?: string;
  RATE_LIMIT_PER_HOUR?: string;
  ALLOWED_ORIGINS?: string;
  THRESHOLD?: string;
}

export type AiProvider = "ollama" | "cloudflare";

export interface Config {
  provider: AiProvider;
  adminToken: string;
  ollamaUrl: string;
  embeddingModel: string;
  chatModel: string;
  rewriteModel: string;
  /** bge-base-en-v1.5 query instruction (documents are embedded without it). */
  queryPrefix: string;
  topK: number;
  threshold: number;
  temperature: number;
  maxAnswerTokens: number;
  rateLimitPerHour: number;
  /** Exact origins; "http://localhost:*" style entries allow any port. */
  allowedOrigins: string[];
}

/** Defaults per provider: local Ollama models in development, Workers AI models in production. */
const DEFAULTS: Record<AiProvider, { embeddingModel: string; chatModel: string }> = {
  ollama: { embeddingModel: "hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0", chatModel: "persona-gemma4" },
  cloudflare: { embeddingModel: "@cf/baai/bge-base-en-v1.5", chatModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
};

export function loadConfig(env: Env): Config {
  const provider: AiProvider = env.AI_PROVIDER === "cloudflare" ? "cloudflare" : "ollama";
  const chatModel = env.CHAT_MODEL ?? DEFAULTS[provider].chatModel;
  return {
    provider,
    adminToken: env.ADMIN_TOKEN ?? "",
    ollamaUrl: env.OLLAMA_URL ?? "http://localhost:11434",
    embeddingModel: env.EMBEDDING_MODEL ?? DEFAULTS[provider].embeddingModel,
    chatModel,
    rewriteModel: env.REWRITE_MODEL ?? chatModel,
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    topK: 6,
    // Local bge (GGUF Q8) scores ~0.04 lower than Workers AI bge, so production sets THRESHOLD=0.55.
    threshold: Number(env.THRESHOLD ?? 0.5),
    temperature: 0.2,
    maxAnswerTokens: 400,
    rateLimitPerHour: Number(env.RATE_LIMIT_PER_HOUR ?? 20),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "https://troyyu527.github.io,http://localhost:*,http://127.0.0.1:*")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

/** Is this browser Origin on the allow-list? */
export function isOriginAllowed(origin: string, allowed: string[]): boolean {
  return allowed.some((a) => (a.endsWith(":*") ? new RegExp(`^${escape(a.slice(0, -2))}:\\d+$`).test(origin) : a === origin));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
