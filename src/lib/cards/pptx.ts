import PptxGenJS from "pptxgenjs";
import { ARASAAC_CREDIT_LONG } from "@/lib/arasaac";
import type { CardSettings } from "@/lib/types";
import { A4, cardBoxes, fitLabel, pageGrid, type Rect } from "./layout";
import type { Measure } from "./measure";
import { FONTS, type CardSpec } from "./model";

export type PptxMode = "sheet" | "single";

export interface PptxInput {
  cards: CardSpec[];
  settings: CardSettings;
  measure: Measure;
  /** Image en data URL PNG (ou null si indisponible). */
  loadImageDataUrl: (url: string) => Promise<string | null>;
  /** « sheet » : planches A4 de 6 cartes ; « single » : une carte par page (pratique dans Canva). */
  mode: PptxMode;
  title?: string;
}

const inch = (mm: number) => mm / 25.4;

function addCard(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  origin: Rect,
  card: CardSpec,
  settings: CardSettings,
  measure: Measure,
  image: string | null,
) {
  const boxes = cardBoxes(settings.sizeMm, settings.borderMm, settings.rounded);
  const at = (r: Rect) => ({ x: inch(origin.x + r.x), y: inch(origin.y + r.y), w: inch(r.w), h: inch(r.h) });
  const color = card.color.replace("#", "").toUpperCase();

  slide.addShape(boxes.cornerRadius > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
    ...at(boxes.border),
    fill: { color: "FFFFFF" },
    line: { color, width: boxes.borderWidth * (72 / 25.4) },
    rectRadius: boxes.cornerRadius > 0 ? boxes.cornerRadius / boxes.border.w : undefined,
    objectName: `Bordure ${card.label}`,
  });

  const fitted = fitLabel(card.label, boxes.label, boxes.maxFontPt, boxes.minFontPt, measure);
  slide.addText(fitted.lines.join("\n"), {
    ...at(boxes.label),
    fontFace: FONTS[settings.font].canva,
    fontSize: fitted.sizePt,
    bold: settings.bold,
    color: "000000",
    align: "center",
    valign: "middle",
    margin: 0,
    fit: "none",
    lang: "fr-FR",
    objectName: `Mot ${card.label}`,
  });

  if (image) {
    slide.addImage({
      data: image,
      ...at(boxes.image),
      sizing: { type: "contain", w: inch(boxes.image.w), h: inch(boxes.image.h) },
      objectName: `Pictogramme ${card.label}`,
    });
  }
}

/** Fichier PowerPoint éditable, importable tel quel dans Canva (formes, textes et images séparés). */
export async function buildCardsPptx({ cards, settings, measure, loadImageDataUrl, mode, title }: PptxInput): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.title = title ?? "Pictogrammes";
  pptx.company = "ARASAAC – CC BY-NC-SA";

  const images = new Map<string, string | null>();
  await Promise.all(
    [...new Set(cards.map((c) => c.imageUrl).filter((u): u is string => Boolean(u)))].map(async (url) => {
      images.set(url, await loadImageDataUrl(url).catch(() => null));
    }),
  );
  const imageOf = (c: CardSpec) => (c.imageUrl ? (images.get(c.imageUrl) ?? null) : null);

  if (mode === "single") {
    const s = settings.sizeMm;
    pptx.defineLayout({ name: "CARTE", width: inch(s), height: inch(s) });
    pptx.layout = "CARTE";
    for (const card of cards) {
      const slide = pptx.addSlide();
      slide.background = { color: "FFFFFF" };
      addCard(slide, pptx, { x: 0, y: 0, w: s, h: s }, card, settings, measure, imageOf(card));
    }
    // Dernière page : mention obligatoire de la licence ARASAAC.
    pptx.addSlide().addText(ARASAAC_CREDIT_LONG, {
      x: inch(s * 0.08),
      y: inch(s * 0.08),
      w: inch(s * 0.84),
      h: inch(s * 0.84),
      fontFace: "Open Sans",
      fontSize: 8,
      color: "4D4D4D",
      align: "center",
      valign: "middle",
    });
  } else {
    pptx.defineLayout({ name: "A4", width: inch(A4.width), height: inch(A4.height) });
    pptx.layout = "A4";
    const grid = pageGrid(settings.sizeMm);
    for (let p = 0; p * grid.perPage < Math.max(cards.length, 1); p++) {
      const slide = pptx.addSlide();
      slide.background = { color: "FFFFFF" };
      cards.slice(p * grid.perPage, (p + 1) * grid.perPage).forEach((card, i) => {
        addCard(slide, pptx, grid.slots[i], card, settings, measure, imageOf(card));
      });
      slide.addText(ARASAAC_CREDIT_LONG, {
        x: inch(10),
        y: inch(A4.height - 9),
        w: inch(A4.width - 20),
        h: inch(6),
        fontFace: "Open Sans",
        fontSize: 6,
        color: "737373",
        margin: 0,
        valign: "bottom",
        objectName: "Crédit ARASAAC",
      });
    }
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}
