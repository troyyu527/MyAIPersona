/** Input limits and validation for chat requests (pure). */
import type { ChatRequest, ChatTurn } from "./types";

export const MAX_QUESTION_CHARS = 500;
/** History = the last 6 user/assistant messages. */
export const MAX_HISTORY_TURNS = 6;
const MAX_TURN_CHARS = 4000;

/** Returns an error message, or null when the question is acceptable. */
export function validateQuestion(question: unknown): string | null {
  if (typeof question !== "string") return "Question must be text.";
  const trimmed = question.trim();
  if (trimmed.length === 0) return "Please type a question.";
  if (trimmed.length > MAX_QUESTION_CHARS) return `Questions are limited to ${MAX_QUESTION_CHARS} characters.`;
  return null;
}

/** Keeps the last MAX_HISTORY_TURNS messages. */
export function trimHistory(history: ChatTurn[]): ChatTurn[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

/** Validates a POST /api/chat body; returns a clean request (trimmed question, last 6 turns) or an error. */
export function parseChatRequest(body: unknown): { request: ChatRequest } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request." };
  const { question, history = [] } = body as { question?: unknown; history?: unknown };
  const questionError = validateQuestion(question);
  if (questionError) return { error: questionError };
  if (!Array.isArray(history)) return { error: "History must be a list." };
  for (const turn of history) {
    const t = turn as Partial<ChatTurn>;
    if ((t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string") {
      return { error: "Invalid history." };
    }
    if (t.content.length > MAX_TURN_CHARS) return { error: "A history message is too long." };
  }
  const clean = (history as ChatTurn[]).map((t) => ({ role: t.role, content: t.content }));
  return { request: { question: (question as string).trim(), history: trimHistory(clean) } };
}
