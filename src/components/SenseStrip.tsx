"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { pictoImageUrl, pictoKeywords } from "@/lib/arasaac";
import { choosePicto, visibleChoices } from "@/lib/senses";
import type { WordItem } from "@/lib/types";

const SLOTS = 5;

interface Props {
  word: WordItem;
  onUpdate: (patch: Partial<WordItem>) => void;
  /** Ouvre la fenêtre avec toutes les propositions. */
  onMore: () => void;
}

/** Les autres images d'un mot, directement sur sa tuile : un clic (ou les flèches) suffit pour changer. */
export function SenseStrip({ word, onUpdate, onMore }: Props) {
  const total = word.candidates.length;
  const shown = visibleChoices(word, total > SLOTS ? SLOTS - 1 : SLOTS);
  const hidden = total - shown.length;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [keywords, setKeywords] = useState<Record<number, string>>({});
  const activeIndex = shown.findIndex(([id]) => id === word.pictoId);

  const loadKeywords = (id: number) =>
    keywords[id] === undefined && pictoKeywords(id).then((k) => setKeywords((m) => ({ ...m, [id]: k.join(", ") })));

  function pick(i: number) {
    const [id, category] = shown[i];
    onUpdate(choosePicto(word, id, category));
  }

  function onKeyDown(e: KeyboardEvent, i: number) {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + shown.length) % shown.length;
    pick(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <div role="radiogroup" aria-label={`Image pour ${word.label}`} className="flex flex-wrap gap-1">
        {shown.map(([id], i) => {
          const active = id === word.pictoId;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              aria-checked={active}
              aria-label={keywords[id] || `Image ${i + 1} sur ${total}`}
              title={keywords[id] || undefined}
              tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
              onClick={() => pick(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onMouseEnter={() => loadKeywords(id)}
              onFocus={() => loadKeywords(id)}
              className={`h-9 w-9 cursor-pointer rounded-sheet border bg-sheet p-0.5 transition-[border-color,box-shadow,background-color] duration-(--duration-swap) ease-out ${
                active ? "border-ink-blue bg-ink-blue-wash ring-2 ring-ink-blue" : "border-rule hover:border-ink"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pictoImageUrl(id, { resolution: 300, noColor: word.noColor, plural: word.plural })}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>
      {hidden > 0 && (
        <button
          onClick={onMore}
          className="h-9 cursor-pointer rounded-sheet border border-dashed border-line px-2 text-xs font-bold text-ink-soft transition-colors duration-(--duration-swap) ease-out hover:bg-tack hover:text-ink"
          aria-label={`Voir les ${total} images de ${word.label}`}
        >
          +{hidden}
        </button>
      )}
    </div>
  );
}
