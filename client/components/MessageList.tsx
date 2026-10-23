/** Scrolling conversation log; follows new text while the visitor is at the bottom. */
import { useEffect, useRef } from "react";
import type { Message } from "../state/useChat";
import MessageBubble from "./MessageBubble";

export default function MessageList({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, last?.content.length, last?.status]);

  return (
    <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-4 py-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
