/** Chat model access by AI_PROVIDER: ChatOllama (development) or the Workers AI binding (production);
 *  streamed answers and short non-streamed completions (query rewrite). */
import { ChatOllama } from "@langchain/ollama";
import { buildRewritePrompt, cleanRewrite } from "../../shared/prompt";
import type { AiBinding, Config } from "../config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Llm {
  stream(messages: ChatMessage[], options?: LlmOptions): AsyncIterable<string>;
  complete(messages: ChatMessage[], options?: LlmOptions): Promise<string>;
}

export function createLlm(cfg: Config, ai?: AiBinding): Llm {
  if (cfg.provider === "cloudflare") {
    if (!ai) throw new Error("AI binding missing (AI_PROVIDER=cloudflare)");
    return createWorkersAiLlm(cfg, ai);
  }
  return createOllamaLlm(cfg);
}

function createOllamaLlm(cfg: Config): Llm {
  const model = (options: LlmOptions) =>
    new ChatOllama({
      baseUrl: cfg.ollamaUrl,
      model: options.model ?? cfg.chatModel,
      temperature: options.temperature ?? cfg.temperature,
      numPredict: options.maxTokens ?? cfg.maxAnswerTokens,
      // gemma4 "thinks" by default and spends the token budget on hidden reasoning; answers must stream at once.
      think: false,
      maxRetries: 1,
    });
  const toLangChain = (messages: ChatMessage[]) => messages.map((m) => [m.role, m.content] as [string, string]);

  return {
    async *stream(messages, options = {}) {
      const stream = await model(options).stream(toLangChain(messages));
      for await (const chunk of stream) {
        const text = typeof chunk.content === "string" ? chunk.content : "";
        if (text) yield text;
      }
    },
    async complete(messages, options = {}) {
      const result = await model(options).invoke(toLangChain(messages));
      return typeof result.content === "string" ? result.content : "";
    },
  };
}

/** Workers AI through the binding (LangChain's ChatCloudflareWorkersAI only supports the REST API + API token). */
function createWorkersAiLlm(cfg: Config, ai: AiBinding): Llm {
  const inputs = (messages: ChatMessage[], options: LlmOptions, stream: boolean) => ({
    messages,
    stream,
    max_tokens: options.maxTokens ?? cfg.maxAnswerTokens,
    temperature: options.temperature ?? cfg.temperature,
  });

  return {
    async *stream(messages, options = {}) {
      const body = await ai.run(options.model ?? cfg.chatModel, inputs(messages, options, true));
      if (!(body instanceof ReadableStream)) throw new Error("Workers AI did not return a stream");
      yield* textFromWorkersAiStream(body as ReadableStream<Uint8Array>);
    },
    async complete(messages, options = {}) {
      const result = (await ai.run(options.model ?? cfg.chatModel, inputs(messages, options, false))) as WorkersAiResult;
      return result.response ?? result.choices?.[0]?.message?.content ?? "";
    },
  };
}

interface WorkersAiResult {
  response?: string;
  choices?: { message?: { content?: string }; delta?: { content?: string } }[];
}

/** Workers AI streams SSE lines: `data: {"response":"…"}` (or OpenAI-style `choices[0].delta.content`), then `data: [DONE]`. */
export async function* textFromWorkersAiStream(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as WorkersAiResult;
        const text = parsed.response ?? parsed.choices?.[0]?.delta?.content ?? "";
        if (text) yield text;
      } catch {
        // ignore keep-alive or partial lines
      }
    }
  }
}

/** Follow-ups only (Step 5 decision): rewrites history + question into one knowledge-base query. A first question
 *  (no history) is searched as typed — measured in production, the rewrite didn't improve it and cost ~2 s.
 *  Any failure falls back to the question. */
export async function rewriteQuery(
  llm: Llm,
  model: string,
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  if (history.length === 0) return question;
  try {
    const raw = await llm.complete([{ role: "user", content: buildRewritePrompt(question, history) }], {
      model,
      maxTokens: 60,
      temperature: 0,
    });
    return cleanRewrite(raw, question);
  } catch {
    return question;
  }
}
