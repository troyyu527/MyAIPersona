/** Question box: Enter sends, Shift+Enter adds a line, 500-char counter, send/stop and "New chat". */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_QUESTION_CHARS } from "../../shared/validate";

interface Props {
  busy: boolean;
  canReset: boolean;
  onSend(question: string): void;
  onStop(): void;
  onReset(): void;
}

export default function ChatInput({ busy, canReset, onSend, onStop, onReset }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const tooLong = text.length > MAX_QUESTION_CHARS;
  const canSend = !busy && text.trim().length > 0 && !tooLong;

  // Grow with the text, up to about 6 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    onSend(text);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white px-3 pb-3 pt-2">
      <label htmlFor="question" className="sr-only">
        Ask a question about Troy
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="question"
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about Troy's experience, projects or availability…"
          aria-describedby="question-help"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-500"
        />
        {busy ? (
          <button type="button" onClick={onStop} className="btn btn-secondary">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!canSend} className="btn btn-primary">
            Send
          </button>
        )}
      </div>
      <div id="question-help" className="mt-1.5 flex items-center justify-between text-xs text-slate-600">
        <button type="button" onClick={onReset} disabled={!canReset} className="link disabled:cursor-default disabled:text-slate-500 disabled:no-underline">
          New chat
        </button>
        <span className={tooLong ? "font-semibold text-red-700" : undefined} aria-live={tooLong ? "polite" : "off"}>
          {text.length}/{MAX_QUESTION_CHARS}
          {tooLong && " — too long"}
        </span>
      </div>
    </form>
  );
}
