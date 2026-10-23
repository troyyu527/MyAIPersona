/** Source chips under an answer: "Title · Section", linked when the chunk has a link (F3). */
import type { SourceRef } from "../../shared/types";

const MAX_CHIPS = 4;

export default function SourceChips({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  // One chip per document (its best-ranked section), at most 4 — the most relevant sources, not every chunk.
  const unique = sources.filter((s, i) => sources.findIndex((o) => o.title === s.title) === i).slice(0, MAX_CHIPS);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" aria-label="Sources">
      <span className="text-slate-600">From:</span>
      {unique.map((s) => {
        const label = `${s.title} · ${s.section}`;
        const className = "rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700";
        return s.url ? (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className={`${className} hover:border-blue-600 hover:text-blue-800`}>
            {label}
          </a>
        ) : (
          <span key={s.id} className={className}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
