/** Worker entry: reads config, applies CORS, creates the services (by AI_PROVIDER) and routes requests. */
import { isOriginAllowed, loadConfig, type Config, type Env } from "./config";
import { handleAdmin, isAuthorized } from "./routes/admin";
import { handleChat } from "./routes/chat";
import { createLlm } from "./services/llm";
import { createLocalVectorStore, type VectorStore } from "./services/localVectorStore";
import { createRateLimiter } from "./services/rateLimit";
import { createEmbeddings, createRetriever } from "./services/retriever";
import { createVectorizeStore } from "./services/vectorizeStore";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function withCors(response: Response, origin: string | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Expose-Headers", "Retry-After");
  return new Response(response.body, { status: response.status, headers });
}

function createStore(cfg: Config, env: Env): VectorStore {
  if (cfg.provider === "cloudflare") {
    if (!env.VECTORIZE) throw new Error("VECTORIZE binding missing (AI_PROVIDER=cloudflare)");
    return createVectorizeStore(env.VECTORIZE, env.KV);
  }
  return createLocalVectorStore(env.KV);
}

function createServices(cfg: Config, env: Env) {
  const store = createStore(cfg, env);
  return { store, retriever: createRetriever(cfg, store, createEmbeddings(cfg, env.AI)), llm: createLlm(cfg, env.AI) };
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  let cfg = loadConfig(env);
  const origin = request.headers.get("Origin");

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true });
  }

  if (url.pathname === "/api/chat") {
    // Browsers always send Origin on this cross-origin POST; requests without one are scripts (rate-limited anyway).
    if (origin && !isOriginAllowed(origin, cfg.allowedOrigins)) return json({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS") {
      return withCors(
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        }),
        origin,
      );
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const admin = isAuthorized(request, cfg.adminToken);
    // Model comparison (Step 5): only authorized requests may pick another chat model.
    const modelOverride = admin ? request.headers.get("X-Chat-Model") : null;
    if (modelOverride) cfg = { ...cfg, chatModel: modelOverride, rewriteModel: modelOverride };
    const { retriever, llm } = createServices(cfg, env);
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const response = await handleChat(
      request,
      { cfg, retriever, llm, rateLimiter: createRateLimiter(env.KV, cfg.rateLimitPerHour) },
      ip,
      admin,
    );
    return withCors(response, origin);
  }

  if (url.pathname.startsWith("/admin/")) {
    if (!isAuthorized(request, cfg.adminToken)) return json({ error: "Unauthorized" }, 401);
    const { store, retriever, llm } = createServices(cfg, env);
    const response = await handleAdmin(request, url.pathname, { retriever, store, llm, rewriteModel: cfg.rewriteModel });
    if (response) return response;
  }
  return json({ error: "Not found" }, 404);
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
};
