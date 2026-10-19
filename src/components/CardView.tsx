"use client";

import { cardBoxes, fitLabel, LINE_HEIGHT, MM_PER_PT } from "@/lib/cards/layout";
import type { Measure } from "@/lib/cards/measure";
import type { CardSpec } from "@/lib/cards/model";
import type { CardSettings } from "@/lib/types";

interface Props {
  card: CardSpec;
  settings: CardSettings;
  measure: Measure | null;
  fontFamily: string;
  /** Pixels écran par millimètre. */
  scale: number;
  className?: string;
}

/** Aperçu fidèle d'une carte (même géométrie que le PDF). */
export function CardView({ card, settings, measure, fontFamily, scale, className }: Props) {
  const s = settings.sizeMm;
  const boxes = cardBoxes(s, settings.borderMm, settings.rounded);
  const px = (mm: number) => mm * scale;
  const fitted = measure
    ? fitLabel(card.label, boxes.label, boxes.maxFontPt, boxes.minFontPt, measure)
    : { lines: [card.label], sizePt: boxes.minFontPt };
  const fontPx = px(fitted.sizePt * MM_PER_PT);

  return (
    <div
      className={`relative bg-paper ${className ?? ""}`}
      style={{ width: px(s), height: px(s) }}
      aria-label={`Carte ${card.label}`}
    >
      <div
        className="absolute"
        style={{
          left: px(boxes.border.x - boxes.borderWidth / 2),
          top: px(boxes.border.y - boxes.borderWidth / 2),
          width: px(boxes.border.w + boxes.borderWidth),
          height: px(boxes.border.h + boxes.borderWidth),
          border: `${px(boxes.borderWidth)}px solid ${card.color}`,
          borderRadius: px(boxes.cornerRadius + boxes.borderWidth / 2),
        }}
      />
      <div
        className="absolute flex flex-col items-center justify-center text-center text-black"
        style={{
          left: px(boxes.label.x),
          top: px(boxes.label.y),
          width: px(boxes.label.w),
          height: px(boxes.label.h),
          fontFamily: `"${fontFamily}", sans-serif`,
          fontWeight: settings.bold ? 700 : 400,
          fontSize: fontPx,
          lineHeight: LINE_HEIGHT,
          whiteSpace: "nowrap",
        }}
      >
        {fitted.lines.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      {card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imageUrl}
          alt=""
          className="absolute object-contain"
          style={{
            left: px(boxes.image.x),
            top: px(boxes.image.y),
            width: px(boxes.image.w),
            height: px(boxes.image.h),
          }}
          loading="lazy"
          crossOrigin="anonymous"
        />
      ) : (
        <div
          className="absolute flex items-center justify-center rounded-sheet border border-dashed border-line text-ink-soft"
          style={{
            left: px(boxes.image.x),
            top: px(boxes.image.y),
            width: px(boxes.image.w),
            height: px(boxes.image.h),
            fontSize: Math.max(10, px(3)),
          }}
        >
          sans image
        </div>
      )}
    </div>
  );
}
