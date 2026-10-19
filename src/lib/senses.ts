// Mots à plusieurs pictogrammes : « mélanger » un liquide, une pâte au fouet, des cartes…
import type { CategoryCode } from "@/lib/categories";
import type { WordItem } from "@/lib/types";

/** Le mot a plusieurs pictogrammes possibles (sens ou dessins différents). */
export const hasChoices = (w: WordItem) => w.candidates.length > 1 && !w.customImage;

/** Mot imprimé dont le pictogramme a été pris par défaut parmi plusieurs : à faire vérifier. */
export const needsReview = (w: WordItem) => w.selected && hasChoices(w) && !w.pictoChosen;

/** Modification à appliquer quand on choisit un pictogramme (la couleur suit, sauf si elle a été fixée à la main). */
export function choosePicto(w: WordItem, id: number, category: CategoryCode): Partial<WordItem> {
  return { pictoId: id, pictoChosen: true, customImage: undefined, ...(w.categoryLocked ? {} : { category }) };
}

/**
 * Deuxième carte pour le même mot avec un autre sens (« l'avocat mange un avocat ») :
 * elle part sur la première image qu'aucune carte de ce mot n'utilise encore.
 */
export function senseCopy(word: WordItem, all: WordItem[]): WordItem {
  const used = new Set(all.filter((w) => w.lemma === word.lemma).map((w) => w.pictoId));
  const next = word.candidates.find(([id]) => !used.has(id)) ?? word.candidates[0];
  let n = 2;
  while (all.some((w) => w.id === `${word.lemma}#${n}`)) n++;
  return {
    ...word,
    id: `${word.lemma}#${n}`,
    copyOf: word.copyOf ?? word.id,
    pictoId: next?.[0] ?? null,
    pictoChosen: false,
    customImage: undefined,
    // Un autre sens peut changer de nature : la couleur suit à nouveau le pictogramme.
    category: next?.[1] ?? word.category,
    categoryLocked: false,
    selected: true,
  };
}

/** Les `max` premiers pictogrammes, en gardant toujours celui qui est retenu. */
export function visibleChoices(w: WordItem, max: number): WordItem["candidates"] {
  const first = w.candidates.slice(0, max);
  if (w.pictoId === null || first.some(([id]) => id === w.pictoId)) return first;
  const current = w.candidates.find(([id]) => id === w.pictoId);
  return current ? [...first.slice(0, max - 1), current] : first;
}

/** Met en évidence les formes du mot dans la phrase d'exemple : renvoie des morceaux [texte, est-ce le mot]. */
export function splitOnForms(sentence: string, forms: string[]): [string, boolean][] {
  const words = [...new Set(forms.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!words.length) return [[sentence, false]];
  const escaped = words.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return sentence
    .split(re)
    .filter((part) => part !== "")
    .map((part) => [part, words.some((f) => f.localeCompare(part, "fr", { sensitivity: "accent" }) === 0)]);
}
