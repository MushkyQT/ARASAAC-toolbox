import type { CategoryCode } from "@/lib/categories";
import type { WordItem } from "@/lib/types";
import { GENERIC_LEMMAS } from "./stopwords";

const CATEGORY_WEIGHT: Record<CategoryCode, number> = {
  P: 2,
  L: 1.5,
  V: 1.2,
  N: 1,
  A: 0.8,
  T: 0.6,
};

/**
 * Calcule une importance pour chaque mot et présélectionne les `limit` meilleurs,
 * en garantissant au moins un mot par catégorie présente dans le texte.
 */
export function scoreAndSelect(items: WordItem[], limit: number): WordItem[] {
  const lastIndex = Math.max(1, ...items.map((w) => w.firstIndex));
  for (const w of items) {
    let score = Math.log2(1 + w.count) * 2 + CATEGORY_WEIGHT[w.category];
    if (w.proper) score += 2;
    // Ce qui est posé au début d'un récit (personnages, lieu, moment) compte davantage.
    if (w.firstIndex / lastIndex < 0.2) score += 0.75;
    if (w.pictoId === null) score -= 1.5;
    if (GENERIC_LEMMAS.has(w.lemma)) score -= 4;
    w.score = Math.round(score * 100) / 100;
  }

  const ranked = [...items].sort((a, b) => b.score - a.score || a.firstIndex - b.firstIndex);
  const chosen = new Set<string>();
  const present = new Set(items.map((w) => w.category));
  for (const cat of present) {
    const best = ranked.find((w) => w.category === cat && !GENERIC_LEMMAS.has(w.lemma));
    if (best && chosen.size < limit) chosen.add(best.id);
  }
  for (const w of ranked) {
    if (chosen.size >= limit) break;
    chosen.add(w.id);
  }
  for (const w of items) w.selected = chosen.has(w.id);
  return items.sort((a, b) => a.firstIndex - b.firstIndex);
}
