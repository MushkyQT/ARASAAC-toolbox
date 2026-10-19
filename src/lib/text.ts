// Normalisation et découpage du texte français.

const APOSTROPHES = /[’‘`´ʼ]/g;
const DASHES = /[‐‑‒–—]/g;

/** Clé de dictionnaire : minuscules, apostrophes et espaces normalisés, accents conservés. */
export function normalizeKey(s: string): string {
  return s
    .normalize("NFC")
    .replace(APOSTROPHES, "'")
    .replace(DASHES, "-")
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mot affiché sur l'étiquette : capitales d'imprimerie, accents conservés (É, È, Ç…). */
export function toCardLabel(s: string): string {
  return s.normalize("NFC").replace(APOSTROPHES, "'").toLocaleUpperCase("fr-FR").replace(/\s+/g, " ").trim();
}

export interface Token {
  /** Forme telle qu'écrite dans le texte. */
  surface: string;
  /** Forme normalisée (clé de dictionnaire). */
  key: string;
  /** Index de la phrase dans le texte. */
  sentence: number;
  /** Position du caractère de début dans le texte d'origine. */
  start: number;
  /** Vrai si le jeton est une ponctuation. */
  punct: boolean;
  /** Indice de nature (ex. verbe avant un pronom accolé : « porte-lui »). */
  hint?: "verb";
}

// Élisions : « l'ogre », « qu'il », « s'endormit », « jusqu'à »…
const ELISION = /^(jusqu'|lorsqu'|puisqu'|quoiqu'|qu'|[cdjlmnst]')(.+)$/i;
const WORD = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*'?|[.!?…;:,«»"()]/gu;

export function tokenize(text: string): Token[] {
  const clean = text.normalize("NFC").replace(APOSTROPHES, "'").replace(DASHES, "-");
  const tokens: Token[] = [];
  let sentence = 0;
  for (const m of clean.matchAll(WORD)) {
    const raw = m[0];
    const start = m.index ?? 0;
    if (/^[.!?…]$/.test(raw)) {
      tokens.push({ surface: raw, key: raw, sentence, start, punct: true });
      sentence++;
      continue;
    }
    if (/^[;:,«»"()]$/.test(raw)) {
      tokens.push({ surface: raw, key: raw, sentence, start, punct: true });
      continue;
    }
    const el = raw.match(ELISION);
    if (el) {
      tokens.push({ surface: el[1], key: normalizeKey(el[1]), sentence, start, punct: false });
      tokens.push({ surface: el[2], key: normalizeKey(el[2]), sentence, start: start + el[1].length, punct: false });
    } else {
      tokens.push({ surface: raw, key: normalizeKey(raw), sentence, start, punct: false });
    }
  }
  return tokens;
}

/** Découpe le texte en phrases (pour l'affichage du contexte et les bandes-phrases). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
