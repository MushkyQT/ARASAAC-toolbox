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
}

/** Aperçu des planches A4, à l'échelle de la colonne. */
export function SheetPreview({ cards, settings, measure, fontFamily }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(420);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(560, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / A4.width;
  const grid = pageGrid(settings.sizeMm);
  const pages = Math.max(1, Math.ceil(cards.length / grid.perPage));

  return (
    <div ref={ref} className="flex w-full flex-col items-center gap-6">
      {Array.from({ length: pages }, (_, p) => (
        <figure key={p}>
          <div
            className="relative bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-stone-200"
            style={{ width: A4.width * scale, height: A4.height * scale }}
          >
            {cards.slice(p * grid.perPage, (p + 1) * grid.perPage).map((card, i) => {
              const slot = grid.slots[i];
              return (
                <div key={card.id} className="absolute" style={{ left: slot.x * scale, top: slot.y * scale }}>
                  <CardView card={card} settings={settings} measure={measure} fontFamily={fontFamily} scale={scale} />
                </div>
              );
            })}
          </div>
        </figure>
      ))}
    </div>
  );
}
