import fontkit from "@pdf-lib/fontkit";

export type Measure = (text: string, sizePt: number) => number;

interface FontkitFont {
  unitsPerEm: number;
  layout(text: string): { advanceWidth: number };
}

/** Mesure exacte d'un texte avec les métriques de la police TTF (identique pour PDF, PPTX, PNG et aperçu). */
export function measurerFromFont(bytes: Uint8Array): Measure {
  const font = fontkit.create(bytes) as unknown as FontkitFont;
  const cache = new Map<string, number>();
  return (text, sizePt) => {
    let w = cache.get(text);
    if (w === undefined) {
      w = font.layout(text).advanceWidth / font.unitsPerEm;
      cache.set(text, w);
    }
    return w * sizePt;
  };
}

const fontCache = new Map<string, Promise<Uint8Array>>();

export function loadFontBytes(url: string): Promise<Uint8Array> {
  if (!fontCache.has(url)) {
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Police indisponible (${r.status})`);
        return r.arrayBuffer();
      })
      .then((b) => new Uint8Array(b));
    p.catch(() => fontCache.delete(url));
    fontCache.set(url, p);
  }
  return fontCache.get(url)!;
}
