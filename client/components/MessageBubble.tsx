/** One chat message: markdown-lite text, typing indicator, status, and sources + media under answers. */
import type { ReactNode } from "react";
import { parseMarkdownLite, type Inline } from "../../shared/markdown";
import type { Message } from "../state/useChat";
import MediaCards from "./MediaCards";
import SourceChips from "./SourceChips";

function renderInlines(inlines: Inline[]): ReactNode[] {
  return inlines.map((part, i) => {
    switch (part.type) {
      case "bold":
        return <strong key={i}>{part.text}</strong>;
      case "italic":
        return <em key={i}>{part.text}</em>;
      case "link":
        return (
          <a key={i} className="link break-words" href={part.href} target="_blank" rel="noreferrer">
            {part.text}
          </a>
        );
      default:
        return part.text;
    }
  });
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseMarkdownLite(text).map((block, i) =>
        block.type === "p" ? (
          <p key={i}>{renderInlines(block.inlines)}</p>
        ) : block.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{renderInlines(item)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{renderInlines(item)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="Troy's AI is typing">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

export default function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-blue-700 px-4 py-2 text-white">
          <span className="sr-only">You: </span>
          {message.content}
        </p>
      </div>
    );
  }

  const isError = message.status === "error";
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[92%] break-words rounded-2xl rounded-bl-sm border px-4 py-2 shadow-sm ${
          isError ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <span className="sr-only">Troy's AI: </span>
        {message.content ? <Markdown text={message.content} /> : message.status === "streaming" && <TypingIndicator />}
        {message.status === "stopped" && <p className="mt-1 text-xs italic text-slate-600">Stopped.</p>}
        {message.status === "done" && (
          <>
            <SourceChips sources={message.sources} />
            <MediaCards media={message.media} />
          </>
        )}
      </div>
    </div>
  );
}
