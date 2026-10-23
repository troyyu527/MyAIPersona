/** Markdown-lite parser for answers: paragraphs, bullet/numbered lists, **bold**, *italic*, links (pure, no HTML). */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "p"; inlines: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdownLite(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "p", inlines: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: list.type, items: list.items.map(parseInline) });
    list = null;
  };

  for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.replace(/^#{1,6}\s+/, ""); // headings are shown as plain paragraphs
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (list && /^\s{2,}\S/.test(rawLine)) {
      list.items[list.items.length - 1] += " " + line.trim(); // continuation of a list item
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)<>]+[^\s)<>.,;:!?'"])|\*(?!\s)([^*]+?)\*/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "link", text: m[2], href: m[3] });
    else if (m[4] !== undefined) out.push({ type: "link", text: m[4], href: m[4] });
    else out.push({ type: "italic", text: m[5] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}
