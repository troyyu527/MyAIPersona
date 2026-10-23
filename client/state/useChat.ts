/** Conversation state: messages, send, streaming, stop, errors and reset (reducer + hook). */
import { useCallback, useReducer, useRef } from "react";
import type { ChatTurn, MediaItem, SourceRef } from "../../shared/types";
import { trimHistory } from "../../shared/validate";
import type { ChatApi } from "../services/chatApi";

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "done" | "stopped" | "error";
  sources: SourceRef[];
  media: MediaItem[];
}

export interface ChatState {
  messages: Message[];
  busy: boolean;
  nextId: number;
}

export type ChatAction =
  | { type: "send"; question: string }
  | { type: "token"; text: string }
  | { type: "done"; sources: SourceRef[]; media: MediaItem[] }
  | { type: "error"; message: string }
  | { type: "stop" }
  | { type: "reset" };

export const initialChatState: ChatState = { messages: [], busy: false, nextId: 1 };

/** Updates the last (assistant) message while it is streaming. */
function updateLast(state: ChatState, update: (m: Message) => Message): ChatState {
  const last = state.messages.at(-1);
  if (!last || last.role !== "assistant" || last.status !== "streaming") return state;
  return { ...state, messages: [...state.messages.slice(0, -1), update(last)] };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send": {
      if (state.busy) return state;
      const user: Message = { id: state.nextId, role: "user", content: action.question, status: "done", sources: [], media: [] };
      const reply: Message = { id: state.nextId + 1, role: "assistant", content: "", status: "streaming", sources: [], media: [] };
      return { messages: [...state.messages, user, reply], busy: true, nextId: state.nextId + 2 };
    }
    case "token":
      return updateLast(state, (m) => ({ ...m, content: m.content + action.text }));
    case "done":
      return { ...updateLast(state, (m) => ({ ...m, status: "done", sources: action.sources, media: action.media })), busy: false };
    case "error":
      // A failed answer never keeps partial text: the friendly message replaces it.
      return { ...updateLast(state, (m) => ({ ...m, status: "error", content: action.message })), busy: false };
    case "stop":
      return { ...updateLast(state, (m) => ({ ...m, status: "stopped" })), busy: false };
    case "reset":
      return { ...initialChatState, nextId: state.nextId };
  }
}

/** The last ≤ 6 clean turns before the new question: finished answers and their questions only. */
export function buildHistory(messages: Message[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let i = 0; i + 1 < messages.length; i += 2) {
    const [q, a] = [messages[i], messages[i + 1]];
    if (q.role === "user" && a.role === "assistant" && a.status === "done" && a.content) {
      turns.push({ role: "user", content: q.content }, { role: "assistant", content: a.content });
    }
  }
  return trimHistory(turns);
}

export function useChat(api: ChatApi) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const send = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || stateRef.current.busy) return;
      const history = buildHistory(stateRef.current.messages);
      dispatch({ type: "send", question: q });
      const controller = new AbortController();
      abortRef.current = controller;
      void api.send(
        { question: q, history },
        {
          onToken: (text) => !controller.signal.aborted && dispatch({ type: "token", text }),
          onDone: ({ sources, media }) => !controller.signal.aborted && dispatch({ type: "done", sources, media }),
          onError: (message) => !controller.signal.aborted && dispatch({ type: "error", message }),
        },
        controller.signal,
      );
    },
    [api],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "stop" });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { messages: state.messages, busy: state.busy, send, stop, reset };
}
