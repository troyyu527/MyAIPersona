/** POST /api/chat: validate → rate limit → rewrite → retrieve → prompt → stream the answer as SSE. */
import { mediaChunks, toMedia, toSources } from "../../shared/metadata";
import { buildSystemPrompt, CONTACT_LINE, SUMMARY_CHUNK_ID } from "../../shared/prompt";
import { encodeSse } from "../../shared/sse";
import type { ChatEvent } from "../../shared/types";
import { parseChatRequest } from "../../shared/validate";
import type { Config } from "../config";
import { rewriteQuery, type ChatMessage, type Llm } from "../services/llm";
import type { RateLimiter } from "../services/rateLimit";
import type { Retriever } from "../services/retriever";

export interface ChatDeps {
  cfg: Config;
  retriever: Retriever;
  llm: Llm;
  rateLimiter: RateLimiter;
}

export const UNAVAILABLE_MESSAGE = `I'm resting for the moment and can't answer right now. Please try again later, or ${CONTACT_LINE}.`;
export const RATE_LIMIT_MESSAGE = `Too many questions for now — please try again in an hour, or ${CONTACT_LINE}.`;

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/** `ip` identifies the visitor for the rate limit; `skipRateLimit` is for authorized eval scripts. */
export async function handleChat(
  request: Request,
  deps: ChatDeps,
  ip: string,
  skipRateLimit = false,
): Promise<Response> {
  // Every request counts against the budget, valid or not, so floods of bad requests are limited too.
  if (!skipRateLimit) {
    const limit = await deps.rateLimiter.check(ip);
    if (!limit.allowed) {
      return json({ error: RATE_LIMIT_MESSAGE }, 429, { "Retry-After": String(limit.retryAfter) });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const parsed = parseChatRequest(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const { question, history } = parsed.request;

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const send = (event: ChatEvent) => writer.write(encoder.encode(encodeSse(event)));

  (async () => {
    const started = Date.now();
    try {
      const rewritten = await rewriteQuery(deps.llm, deps.cfg.rewriteModel, question, history);
      const rewriteMs = Date.now() - started;
      const { chunks, summary } = await deps.retriever.retrieveContext(question, rewritten);
      const retrieveMs = Date.now() - started - rewriteMs;
      const context = chunks.filter((c) => c.id !== SUMMARY_CHUNK_ID);
      const withMedia = mediaChunks(chunks);
      const messages: ChatMessage[] = [
        { role: "system", content: buildSystemPrompt(summary?.metadata.text ?? "", context, new Set(withMedia.map((c) => c.id))) },
        ...history,
        { role: "user", content: question },
      ];
      let answered = false;
      let firstTokenMs = -1;
      for await (const t of deps.llm.stream(messages, { maxTokens: deps.cfg.maxAnswerTokens })) {
        if (!answered) firstTokenMs = Date.now() - started;
        answered = true;
        await send({ event: "token", data: { t } });
      }
      if (!answered) throw new Error("empty answer");
      await send({
        event: "done",
        data: { sources: toSources(chunks), media: toMedia(withMedia), model: deps.cfg.chatModel },
      });
      // Structured log for `wrangler tail` / observability: timings only — no question text, no IP.
      console.log(
        JSON.stringify({ route: "chat", status: "done", model: deps.cfg.chatModel, rewriteMs, retrieveMs, firstTokenMs, ms: Date.now() - started, chunks: chunks.length }),
      );
    } catch (err) {
      console.log(
        JSON.stringify({ route: "chat", status: "error", ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) }),
      );
      await send({ event: "error", data: { message: UNAVAILABLE_MESSAGE } });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
