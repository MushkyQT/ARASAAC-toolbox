import JSZip from "jszip";
import { ARASAAC_CREDIT_LONG } from "@/lib/arasaac";
import type { CardSettings } from "@/lib/types";
import { LINE_HEIGHT, PT_PER_MM, cardBoxes, fitLabel } from "./layout";
import type { Measure } from "./measure";
import { FONTS, type CardSpec } from "./model";

const DPI = 300;

/** Charge la police dans le document pour que le canvas puisse l'utiliser. */
export async function ensureCanvasFont(family: string, url: string, bold: boolean) {
  const weight = bold ? "700" : "400";
  if ([...document.fonts].some((f) => f.family === family && f.weight === weight && f.status === "loaded")) return;
  const face = new FontFace(family, `url(${url})`, { weight });
  await face.load();
  document.fonts.add(face);
}

async function loadBitmap(bytes: Uint8Array) {
  return createImageBitmap(new Blob([bytes as BlobPart]));
}

/** Dessine une carte à 300 dpi (8 cm ≈ 945 px), au même gabarit que le PDF. */
export async function renderCardPng(
  card: CardSpec,
  settings: CardSettings,
  measure: Measure,
  family: string,
  imageBytes: Uint8Array | null,
): Promise<Blob> {
  const pxPerMm = DPI / 25.4;
  const side = Math.round(settings.sizeMm * pxPerMm);
  const canvas = new OffscreenCanvas(side, side);
  const ctx = canvas.getContext("2d")!;
  const px = (mm: number) => mm * pxPerMm;
  const boxes = cardBoxes(settings.sizeMm, settings.borderMm, settings.rounded);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, side, side);
  ctx.strokeStyle = card.color;
  ctx.lineWidth = px(boxes.borderWidth);
  const b = boxes.border;
  ctx.beginPath();
  ctx.roundRect(px(b.x), px(b.y), px(b.w), px(b.h), px(boxes.cornerRadius));
  ctx.stroke();

  const fitted = fitLabel(card.label, boxes.label, boxes.maxFontPt, boxes.minFontPt, measure);
  const fontPx = (fitted.sizePt / PT_PER_MM) * pxPerMm;
  ctx.font = `${settings.bold ? 700 : 400} ${fontPx}px "${family}"`;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = fontPx * LINE_HEIGHT;
  const centerY = px(boxes.label.y + boxes.label.h / 2);
  fitted.lines.forEach((line, i) => {
    ctx.fillText(line, px(boxes.label.x + boxes.label.w / 2), centerY + (i - (fitted.lines.length - 1) / 2) * lineH);
  });

  if (imageBytes) {
    const bmp = await loadBitmap(imageBytes);
    const box = boxes.image;
    const scale = Math.min(px(box.w) / bmp.width, px(box.h) / bmp.height);
    const w = bmp.width * scale;
    const h = bmp.height * scale;
    ctx.drawImage(bmp, px(box.x) + (px(box.w) - w) / 2, px(box.y) + (px(box.h) - h) / 2, w, h);
  }
  return canvas.convertToBlob({ type: "image/png" });
}

function safeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Archive ZIP d'images PNG (une par carte), à glisser dans Canva ou un classeur de communication. */
export async function buildCardsZip(
  cards: CardSpec[],
  settings: CardSettings,
  measure: Measure,
  fontUrl: string,
  loadImage: (url: string) => Promise<Uint8Array>,
): Promise<Blob> {
  const family = `Carte ${FONTS[settings.font].canva}`;
  await ensureCanvasFont(family, fontUrl, settings.bold);
  const zip = new JSZip();
  let n = 0;
  for (const card of cards) {
    n++;
    const bytes = card.imageUrl ? await loadImage(card.imageUrl).catch(() => null) : null;
    const png = await renderCardPng(card, settings, measure, family, bytes);
    zip.file(`${String(n).padStart(2, "0")}-${safeName(card.label) || "carte"}.png`, png);
  }
  zip.file("LISEZ-MOI.txt", `${ARASAAC_CREDIT_LONG}\n`);
  return zip.generateAsync({ type: "blob" });
}
