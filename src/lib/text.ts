// Normalisation et découpage du texte français.

const APOSTROPHES = /[’‘`´ʼ]/g;
const DASHES = /[‐‑‒–—]/g;

/**
 * Forme de référence d'un texte (NFC, fins de ligne « \n ») : toutes les positions (mots, passages)
 * se rapportent à elle, et la vue « Dans le texte » l'affiche telle quelle.
 */
export function canonicalText(s: string): string {
  return s.normalize("NFC").replace(/\r\n?/g, "\n");
}

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

/**
 * Rôle des retours à la ligne. « hard » : chaque ligne est une phrase (titres, listes d'ingrédients,
 * texte collé depuis une page web). « soft » : texte coupé à largeur fixe (PDF, livres numérisés),
 * seule une ligne vide sépare deux paragraphes.
 */
export type LineBreaks = "hard" | "soft";

/** Devine le rôle des retours à la ligne : beaucoup de lignes qui se poursuivent en minuscule = texte coupé. */
export function lineBreakMode(text: string): LineBreaks {
  const lines = canonicalText(text).split("\n").map((l) => l.trim());
  let pairs = 0;
  let continued = 0;
  for (let i = 0; i + 1 < lines.length; i++) {
    const [a, b] = [lines[i], lines[i + 1]];
    if (!a || !b) continue;
    pairs++;
    if (/[\p{Ll},;'-]$/u.test(a) && /^\p{Ll}/u.test(b)) continued++;
  }
  return pairs >= 3 && continued / pairs > 0.25 ? "soft" : "hard";
}

// Élisions : « l'ogre », « qu'il », « s'endormit », « jusqu'à »…
const ELISION = /^(jusqu'|lorsqu'|puisqu'|quoiqu'|qu'|[cdjlmnst]')(.+)$/i;
// Mots, ponctuation, et séparateurs de pages web ou de listes (« Accueil > Recettes », « · », « - 300 g »).
const WORD = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*'?|[.!?…;:,«»"()]|[·•|>›/]|(?<![\p{L}\p{N}])-(?![\p{L}\p{N}])/gu;
/** Séparateurs : ce qui les suit commence un nouvel élément (« Partager · Épingler »). */
export const SEPARATORS = new Set(["·", "•", "|", ">", "›", "/", "-", "\n"]);

export function tokenize(text: string, lineBreaks: LineBreaks = lineBreakMode(text)): Token[] {
  const clean = canonicalText(text).replace(APOSTROPHES, "'").replace(DASHES, "-");
  const tokens: Token[] = [];
  let sentence = 0;
  let lastEnd = 0;
  for (const m of clean.matchAll(WORD)) {
    const raw = m[0];
    const start = m.index ?? 0;
    const gapStart = lastEnd;
    const gap = clean.slice(gapStart, start);
    lastEnd = start + raw.length;
    // Fin de ligne : nouvelle phrase, sauf dans un texte coupé à largeur fixe (sauf ligne vide ou puce).
    const newline = gap.indexOf("\n");
    if (newline !== -1) {
      const boundary = lineBreaks === "hard" || /\n[^\S\n]*\n/.test(gap) || /^[-•·]$/.test(raw);
      const last = tokens[tokens.length - 1];
      if (boundary && last && !(last.punct && /^[.!?…\n]$/.test(last.key))) {
        tokens.push({ surface: "\n", key: "\n", sentence, start: gapStart + newline, punct: true });
        sentence++;
      }
    }
    if (/^[.!?…]$/.test(raw)) {
      tokens.push({ surface: raw, key: raw, sentence, start, punct: true });
      sentence++;
      continue;
    }
    if (/^[;:,«»"()]$/.test(raw) || SEPARATORS.has(raw)) {
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
