"use client";

import { useEffect, useState } from "react";
import type { Measure } from "./measure";

const loaded = new Map<string, Promise<void>>();

/** Charge une police TTF dans la page (aperçu) et fournit une mesure de texte cohérente avec le PDF. */
export function useFontMeasure(family: string, url: string, bold: boolean): Measure | null {
  const [measure, setMeasure] = useState<Measure | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${family}|${url}`;
    if (!loaded.has(key)) {
      const face = new FontFace(family, `url(${url})`, { weight: bold ? "700" : "400" });
      const p = face.load().then((f) => {
        document.fonts.add(f);
      });
      p.catch(() => loaded.delete(key));
      loaded.set(key, p);
    }
    loaded
      .get(key)!
      .then(() => {
        if (cancelled) return;
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.font = `${bold ? 700 : 400} 100px "${family}"`;
        const cache = new Map<string, number>();
        setMeasure(() => (text: string, sizePt: number) => {
          let w = cache.get(text);
          if (w === undefined) {
            w = ctx.measureText(text).width / 100;
            cache.set(text, w);
          }
          return w * sizePt;
        });
      })
      .catch(() => {
        if (!cancelled) setMeasure(() => (text: string, sizePt: number) => text.length * sizePt * 0.62);
      });
    return () => {
      cancelled = true;
    };
  }, [family, url, bold]);

  return measure;
}
