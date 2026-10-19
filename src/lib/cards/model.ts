import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { pictoImageUrl } from "@/lib/arasaac";
import { toCardLabel } from "@/lib/text";
import type { CardSettings, FontId, WordItem } from "@/lib/types";

/** Carte prête à dessiner, indépendante du format de sortie. */
export interface CardSpec {
  id: string;
  label: string;
  color: string;
  /** URL de l'image (pictogramme ARASAAC ou image personnelle en data URL), ou null. */
  imageUrl: string | null;
  pictoId: number | null;
}

export const FONTS: Record<FontId, { name: string; regular: string; bold: string; canva: string }> = {
  opensans: {
    name: "Open Sans",
    regular: "/fonts/OpenSans-Regular.ttf",
    bold: "/fonts/OpenSans-Bold.ttf",
    canva: "Open Sans",
  },
  andika: {
    name: "Andika (lecteurs débutants)",
    regular: "/fonts/Andika-Regular.ttf",
    bold: "/fonts/Andika-Bold.ttf",
    canva: "Andika",
  },
  atkinson: {
    name: "Atkinson Hyperlegible",
    regular: "/fonts/AtkinsonHyperlegible-Regular.ttf",
    bold: "/fonts/AtkinsonHyperlegible-Bold.ttf",
    canva: "Atkinson Hyperlegible",
  },
};

export function fontUrl(settings: Pick<CardSettings, "font" | "bold">) {
  const f = FONTS[settings.font];
  return settings.bold ? f.bold : f.regular;
}

export function sortWords(words: WordItem[], order: CardSettings["order"]): WordItem[] {
  const list = [...words];
  if (order === "category") {
    list.sort(
      (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.firstIndex - b.firstIndex,
    );
  } else if (order === "alpha") {
    list.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  } else {
    list.sort((a, b) => a.firstIndex - b.firstIndex);
  }
  return list;
}

export function toCardSpecs(words: WordItem[], settings: CardSettings): CardSpec[] {
  return sortWords(
    words.filter((w) => w.selected),
    settings.order,
  ).map((w) => ({
    id: w.id,
    label: toCardLabel(w.label),
    color: CATEGORIES[w.category].color,
    pictoId: w.pictoId,
    imageUrl:
      w.customImage ??
      (w.pictoId !== null
        ? pictoImageUrl(w.pictoId, { plural: w.plural, noColor: w.noColor || settings.blackWhite })
        : null),
  }));
}

export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const imageCache = new Map<string, Promise<Uint8Array>>();

/** Télécharge une image une seule fois par session (les mêmes pictos reviennent d'un export à l'autre). */
export function fetchImageBytes(url: string): Promise<Uint8Array> {
  if (!imageCache.has(url)) {
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Image indisponible (${r.status})`);
        return r.arrayBuffer();
      })
      .then((b) => new Uint8Array(b));
    p.catch(() => imageCache.delete(url));
    imageCache.set(url, p);
  }
  return imageCache.get(url)!;
}

/** Ramène n'importe quelle image (JPEG, WebP, photo…) à un PNG carré, via un canvas. */
export async function toSquarePng(bytes: Uint8Array, sidePx = 1000): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(sidePx, sidePx);
  const ctx = canvas.getContext("2d")!;
  const scale = Math.min(sidePx / bitmap.width, sidePx / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (sidePx - w) / 2, (sidePx - h) / 2, w, h);
  const out = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await out.arrayBuffer());
}

export function isPng(bytes: Uint8Array) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}
