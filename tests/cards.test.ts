import { describe, expect, test } from "vitest";
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import { cardBoxes, fitLabel, pageGrid, PT_PER_MM } from "@/lib/cards/layout";
import { buildCardsPdf } from "@/lib/cards/pdf";
import type { CardSpec } from "@/lib/cards/model";
import { DEFAULT_SETTINGS } from "@/lib/types";

// PNG 1×1 transparent.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("grille A4", () => {
  test("8 cm → 2 colonnes × 3 lignes, centrées", () => {
    const g = pageGrid(80);
    expect([g.cols, g.rows, g.perPage]).toEqual([2, 3, 6]);
    expect(g.marginX).toBeCloseTo((210 - 166) / 2);
    expect(g.slots[1].x - g.slots[0].x).toBeCloseTo(86);
  });

  test("5 cm → 3 × 5 cartes, 10 cm → au moins 2 cartes", () => {
    expect(pageGrid(50).perPage).toBeGreaterThanOrEqual(12);
    expect(pageGrid(100).perPage).toBeGreaterThanOrEqual(2);
  });

  test("les cartes ne débordent jamais de la page", () => {
    for (const size of [50, 60, 70, 80, 90, 100]) {
      for (const s of pageGrid(size).slots) {
        expect(s.x).toBeGreaterThanOrEqual(5);
        expect(s.x + s.w).toBeLessThanOrEqual(205);
        expect(s.y + s.h).toBeLessThanOrEqual(297 - 5);
      }
    }
  });
});

describe("intérieur de la carte", () => {
  test("le mot est au-dessus de l'image, qui reste dans la carte", () => {
    const b = cardBoxes(80, 2, false);
    expect(b.label.y + b.label.h).toBeLessThanOrEqual(b.image.y);
    expect(b.image.y + b.image.h).toBeLessThanOrEqual(80 - 2);
    expect(b.image.w).toBeGreaterThan(45);
  });

  test("un mot long passe sur deux lignes plutôt que de devenir minuscule", () => {
    const measure = (t: string, s: number) => t.length * s * 0.6;
    const box = cardBoxes(80, 2, false);
    const short = fitLabel("NEZ", box.label, box.maxFontPt, box.minFontPt, measure);
    expect(short.lines).toEqual(["NEZ"]);
    expect(short.sizePt).toBe(box.maxFontPt);
    const long = fitLabel("SE BROSSER LES DENTS", box.label, box.maxFontPt, box.minFontPt, measure);
    expect(long.lines).toHaveLength(2);
    for (const line of long.lines) expect(measure(line, long.sizePt)).toBeLessThanOrEqual(box.label.w * PT_PER_MM + 0.01);
  });
});

describe("PDF", () => {
  test("pages A4, une page par lot de 6 cartes de 8 cm", async () => {
    const cards: CardSpec[] = Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      label: i === 0 ? "FORÊT" : "ÉCOLE",
      color: "#38B6FF",
      imageUrl: i === 6 ? null : "x.png",
      pictoId: null,
    }));
    const bytes = await buildCardsPdf({
      cards,
      settings: DEFAULT_SETTINGS,
      fontBytes: fs.readFileSync("public/fonts/OpenSans-Regular.ttf"),
      loadImage: async () => PNG,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
  });
});
