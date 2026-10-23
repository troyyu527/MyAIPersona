/** POST /api/chat and read the SSE stream (token / done / error); abortable. */
import { CONTACT_LINE } from "../../shared/prompt";
import { createSseParser } from "../../shared/sse";
import type { ChatRequest, MediaItem, SourceRef } from "../../shared/types";

export interface ChatHandlers {
  onToken(text: string): void;
  onDone(result: { sources: SourceRef[]; media: MediaItem[] }): void;
  onError(message: string): void;
}

export interface ChatApi {
  send(request: ChatRequest, handlers: ChatHandlers, signal: AbortSignal): Promise<void>;
}

export const NETWORK_ERROR_MESSAGE = `I can't reach the assistant right now. Please check your connection and try again, or ${CONTACT_LINE}.`;

export function createChatApi(baseUrl: string, fetchFn: typeof fetch = (...args) => fetch(...args)): ChatApi {
  return {
    async send(request, handlers, signal) {
      let res: Response;
      try {
        res = await fetchFn(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal,
        });
      } catch (err) {
        if (signal.aborted) return;
        handlers.onError(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        handlers.onError(body?.error ?? NETWORK_ERROR_MESSAGE);
        return;
      }

      const feed = createSseParser();
      const decoder = new TextDecoder();
      const reader = res.body.getReader();
      let finished = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const ev of feed(decoder.decode(value, { stream: true }))) {
            if (ev.event === "token") handlers.onToken(ev.data.t);
            else if (ev.event === "done") {
              finished = true;
              handlers.onDone({ sources: ev.data.sources, media: ev.data.media });
            } else {
              finished = true;
              handlers.onError(ev.data.message);
            }
          }
        }
      } catch {
        if (signal.aborted) return;
      }
      if (!finished && !signal.aborted) handlers.onError(NETWORK_ERROR_MESSAGE);
    },
  };
}
