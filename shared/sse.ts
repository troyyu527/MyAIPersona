/** Server-Sent Events encoding (Worker) and incremental parsing (client) for /api/chat (pure). */
import type { ChatEvent } from "./types";

export function encodeSse(event: ChatEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/** Incremental parser: feed text as it arrives; returns the complete events and keeps the remainder. */
export function createSseParser() {
  let buffer = "";
  return function feed(text: string): ChatEvent[] {
    buffer += text.replace(/\r\n/g, "\n");
    const events: ChatEvent[] = [];
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let name = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length || !["token", "done", "error"].includes(name)) continue;
      try {
        events.push({ event: name, data: JSON.parse(data.join("\n")) } as ChatEvent);
      } catch {
        // a malformed event is skipped; the stream continues
      }
    }
    return events;
  };
}
