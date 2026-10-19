import { PDFDocument, PrintScaling, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ARASAAC_CREDIT_LONG } from "@/lib/arasaac";
import type { CardSettings } from "@/lib/types";
import { A4, PT_PER_MM, LINE_HEIGHT, cardBoxes, fitLabel, pageGrid, type Rect } from "./layout";
import { hexToRgb01, isPng, type CardSpec } from "./model";

export interface PdfInput {
  cards: CardSpec[];
  settings: CardSettings;
  fontBytes: Uint8Array;
  /** Fournit les octets d'une image (PNG ou JPEG). */
  loadImage: (url: string) => Promise<Uint8Array>;
  title?: string;
}

const pt = (mm: number) => mm * PT_PER_MM;

/** Convertit un rectangle en mm (origine haut-gauche) en coordonnées pdf-lib (origine bas-gauche). */
function toPdf(r: Rect, pageHeightMm: number) {
  return { x: pt(r.x), y: pt(pageHeightMm - r.y - r.h), width: pt(r.w), height: pt(r.h) };
}

function roundedRectPath(w: number, h: number, r: number) {
  // Chemin SVG relatif au coin haut-gauche (pdf-lib inverse l'axe Y pour drawSvgPath).
  return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

function drawCutMarks(page: PDFPage, slots: Rect[]) {
  const len = 3;
  const color = rgb(0.6, 0.6, 0.6);
  for (const s of slots) {
    const corners: [number, number, number, number][] = [
      [s.x, s.y, -1, -1],
      [s.x + s.w, s.y, 1, -1],
      [s.x, s.y + s.h, -1, 1],
      [s.x + s.w, s.y + s.h, 1, 1],
    ];
    for (const [x, y, dx, dy] of corners) {
      const X = pt(x);
      const Y = pt(A4.height - y);
      page.drawLine({ start: { x: X + pt(dx * 1), y: Y }, end: { x: X + pt(dx * (1 + len)), y: Y }, thickness: 0.4, color });
      page.drawLine({ start: { x: X, y: Y - pt(dy * 1) }, end: { x: X, y: Y - pt(dy * (1 + len)) }, thickness: 0.4, color });
    }
  }
}

function drawCard(page: PDFPage, slot: Rect, card: CardSpec, settings: CardSettings, font: PDFFont, image: PDFImage | null) {
  const boxes = cardBoxes(settings.sizeMm, settings.borderMm, settings.rounded);
  const at = (r: Rect): Rect => ({ x: slot.x + r.x, y: slot.y + r.y, w: r.w, h: r.h });
  const [r, g, b] = hexToRgb01(card.color);
  const border = at(boxes.border);

  if (boxes.cornerRadius > 0) {
    page.drawSvgPath(roundedRectPath(pt(border.w), pt(border.h), pt(boxes.cornerRadius)), {
      x: pt(border.x),
      y: pt(A4.height - border.y),
      borderColor: rgb(r, g, b),
      borderWidth: pt(boxes.borderWidth),
      color: rgb(1, 1, 1),
    });
  } else {
    page.drawRectangle({
      ...toPdf(border, A4.height),
      borderColor: rgb(r, g, b),
      borderWidth: pt(boxes.borderWidth),
      color: rgb(1, 1, 1),
    });
  }

  const label = at(boxes.label);
  const fitted = fitLabel(card.label, label, boxes.maxFontPt, boxes.minFontPt, (t, s) => font.widthOfTextAtSize(t, s));
  const lineH = fitted.sizePt * LINE_HEIGHT;
  const blockH = lineH * fitted.lines.length;
  // Centre vertical : on place la ligne de base en tenant compte de la hauteur des capitales.
  const capHeight = font.heightAtSize(fitted.sizePt, { descender: false }) * 0.72;
  let baseline = pt(A4.height - label.y) - (pt(label.h) - blockH) / 2 - (lineH - capHeight) / 2 - capHeight;
  for (const line of fitted.lines) {
    const w = font.widthOfTextAtSize(line, fitted.sizePt);
    page.drawText(line, {
      x: pt(label.x) + (pt(label.w) - w) / 2,
      y: baseline,
      size: fitted.sizePt,
      font,
      color: rgb(0, 0, 0),
    });
    baseline -= lineH;
  }

  if (image) {
    const box = at(boxes.image);
    const scale = Math.min(box.w / image.width, box.h / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, toPdf({ x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }, A4.height));
  }
}

function drawFooter(page: PDFPage, font: PDFFont, pageNo: number, pages: number) {
  const size = 6;
  const maxW = pt(A4.width - 20);
  const words = ARASAAC_CREDIT_LONG.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  lines.push(line);
  let y = pt(5) + (lines.length - 1) * size * 1.2;
  for (const l of lines) {
    page.drawText(l, { x: pt(10), y, size, font, color: rgb(0.45, 0.45, 0.45) });
    y -= size * 1.2;
  }
  const num = `${pageNo} / ${pages}`;
  page.drawText(num, {
    x: pt(A4.width - 10) - font.widthOfTextAtSize(num, size),
    y: pt(A4.height - 6),
    size,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

/** Génère le PDF imprimable (A4, cartes à taille réelle). Tourne dans le navigateur. */
export async function buildCardsPdf({ cards, settings, fontBytes, loadImage, title }: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title ?? "Pictogrammes");
  pdf.setCreator("Atelier pictos ARASAAC");
  pdf.setProducer("pdf-lib");
  // Impression à 100 % par défaut : la carte doit mesurer exactement la taille demandée.
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const grid = pageGrid(settings.sizeMm);

  const embedded = new Map<string, PDFImage | null>();
  await Promise.all(
    [...new Set(cards.map((c) => c.imageUrl).filter((u): u is string => Boolean(u)))].map(async (url) => {
      try {
        const bytes = await loadImage(url);
        embedded.set(url, isPng(bytes) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes));
      } catch {
        embedded.set(url, null);
      }
    }),
  );

  const pages = Math.max(1, Math.ceil(cards.length / grid.perPage));
  for (let p = 0; p < pages; p++) {
    const page = pdf.addPage([pt(A4.width), pt(A4.height)]);
    const slice = cards.slice(p * grid.perPage, (p + 1) * grid.perPage);
    slice.forEach((card, i) => {
      drawCard(page, grid.slots[i], card, settings, font, card.imageUrl ? (embedded.get(card.imageUrl) ?? null) : null);
    });
    if (settings.cutMarks && grid.gutter > 0) drawCutMarks(page, grid.slots.slice(0, slice.length));
    drawFooter(page, font, p + 1, pages);
  }
  return pdf.save();
}
