/** Project photos (click to enlarge in a lightbox) and simulation videos (play inline) from the sources (F3). */
import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../../shared/types";

const MAX_ITEMS = 6;

export default function MediaCards({ media }: { media: MediaItem[] }) {
  const [open, setOpen] = useState<MediaItem | null>(null);
  if (!media.length) return null;
  const items = media.slice(0, MAX_ITEMS);
  const videos = items.filter((m) => m.type === "video");
  const images = items.filter((m) => m.type === "image");

  return (
    <div className="mt-3 space-y-2">
      {videos.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {videos.map((v) => (
            <figure key={v.url} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
              <video controls preload="metadata" className="aspect-video w-full" src={encodeURI(v.url)}>
                <track kind="captions" />
              </video>
              {v.caption && <figcaption className="bg-white px-2 py-1 text-xs text-slate-700">{v.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setOpen(img)}
                className="group block w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left"
                aria-label={`Enlarge photo: ${img.caption ?? "project photo"}`}
              >
                <img src={encodeURI(img.url)} alt={img.caption ?? "Project photo"} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90" />
                {img.caption && <span className="block truncate px-2 py-1 text-xs text-slate-700">{img.caption}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <Lightbox item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Lightbox({ item, onClose }: { item: MediaItem; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption ?? "Project photo"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <img src={encodeURI(item.url)} alt={item.caption ?? "Project photo"} className="max-h-[80vh] w-auto rounded-lg" />
        <figcaption className="mt-2 flex items-center justify-between gap-4 text-sm text-white">
          <span>{item.caption}</span>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md bg-white px-3 py-1 font-medium text-slate-900">
            Close
          </button>
        </figcaption>
      </figure>
    </div>
  );
}
