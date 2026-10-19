"use client";

import { useEffect, useRef, useState } from "react";
import { A4, pageGrid } from "@/lib/cards/layout";
import type { Measure } from "@/lib/cards/measure";
import type { CardSpec } from "@/lib/cards/model";
import type { CardSettings } from "@/lib/types";
import { CardView } from "./CardView";

interface Props {
  cards: CardSpec[];
  settings: CardSettings;
  measure: Measure | null;
  fontFamily: string;
  /** Ouvre la carte pour en changer l'image ou le mot. */
  onOpen: (id: string) => void;
}

/** Aperçu des planches A4, à l'échelle de la colonne. Un clic sur une carte l'ouvre. */
export function SheetPreview({ cards, settings, measure, fontFamily, onOpen }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(420);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(380, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / A4.width;
  const grid = pageGrid(settings.sizeMm);
  const pages = Math.max(1, Math.ceil(cards.length / grid.perPage));

  return (
    <div ref={ref} className="flex w-full flex-col items-center gap-3">
      {Array.from({ length: pages }, (_, p) => (
        <figure key={p} className="flex flex-col items-center gap-2 pt-1">
          <div className="sheet relative bg-paper" style={{ width: A4.width * scale, height: A4.height * scale }}>
            {cards.slice(p * grid.perPage, (p + 1) * grid.perPage).map((card, i) => {
              const slot = grid.slots[i];
              return (
                <button
                  key={card.id}
                  onClick={() => onOpen(card.id)}
                  className="preview-card absolute cursor-pointer"
                  style={{ left: slot.x * scale, top: slot.y * scale }}
                  aria-label={`Modifier la carte ${card.label}`}
                >
                  <CardView card={card} settings={settings} measure={measure} fontFamily={fontFamily} scale={scale} />
                </button>
              );
            })}
            {cards.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-soft">
                Les cartes de la planche apparaîtront ici.
              </p>
            )}
          </div>
          <figcaption className="rounded-control bg-sheet/85 px-2.5 py-0.5 text-center text-sm text-ink">
            <b className="tabular-nums">
              Page {p + 1} sur {pages}
            </b>
            {p === 0 && cards.length > 0 && <> · cliquez sur une carte pour la modifier</>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
