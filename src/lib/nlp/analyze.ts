import type { CategoryCode } from "@/lib/categories";
import { canonicalText, SEPARATORS, tokenize, type LineBreaks, type Token } from "@/lib/text";
import type { WordItem } from "@/lib/types";
import { lemmaCandidates, type Lexicon } from "./lexicon";
import { ALIASES, AVOIR_FORMS, DETERMINERS, ENCLITICS, EXCLUDED_LEMMAS, SUBJECT_PRONOUNS } from "./stopwords";
import { scoreAndSelect } from "./select";

/** Devine le lemme et la nature d'un mot absent du lexique (fourni par fr-compromise côté navigateur). */
export type Guesser = (word: string) => { lemma: string; pos: "verb" | "noun" | "adjective" | "other" };

export interface AnalyzeOptions {
  /** Nombre de cartes présélectionnées. */
  preselect?: number;
  guess?: Guesser;
  /** Rôle des retours à la ligne (deviné d'après le texte s'il n'est pas donné). */
  lineBreaks?: LineBreaks;
}

const MAX_PHRASE = 6;
const REFLEXIVE = new Set(["me", "m'", "te", "t'", "se", "s'", "nous", "vous"]);
const OBJECT_PRONOUNS = new Set(["le", "la", "les", "l'", "lui", "leur"]);

type Pos = "verb" | "nominal" | null;

interface Hit {
  lemma: string | null;
  start: number;
  end: number;
  surface: string;
  sentence: number;
  proper?: boolean;
  guessedCategory?: CategoryCode;
}

function joinKeys(tokens: Token[]): string {
  let out = "";
  for (const t of tokens) {
    if (out && !out.endsWith("'")) out += " ";
    out += t.key;
  }
  return out;
}

function joinSurface(tokens: Token[]): string {
  let out = "";
  for (const t of tokens) {
    if (out && !out.endsWith("'")) out += " ";
    out += t.surface;
  }
  return out;
}

/** Nature attendue d'après les mots qui précèdent (règles simples, sans IA). */
function contextPos(tokens: Token[], i: number): Pos {
  if (tokens[i].hint) return tokens[i].hint;
  const prev = tokens[i - 1];
  if (!prev || prev.punct) return null;
  const prev2 = tokens[i - 2];
  if (OBJECT_PRONOUNS.has(prev.key) && prev2 && !prev2.punct && SUBJECT_PRONOUNS.has(prev2.key)) return "verb";
  if (DETERMINERS.has(prev.key)) return "nominal";
  if (SUBJECT_PRONOUNS.has(prev.key)) return "verb";
  return null;
}

function chooseLemma(lex: Lexicon, key: string, candidates: string[], pos: Pos): string {
  if (candidates.length === 1) return candidates[0];
  // « est », « as », « été »… : auxiliaire ou copule, sauf après un déterminant (« l'est »).
  if (pos !== "nominal") {
    const aux = candidates.find((l) => l === "être" || l === "avoir");
    if (aux) return aux;
  }
  const self = lex.entries[key];
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const lemma of candidates) {
    const t = lex.entries[lemma].t;
    let score = lemma === key ? 1 : 0.5;
    // « petites » → « petit » plutôt que « petite » : on préfère la forme de base de même nature.
    if (self && lemma !== key && self.t === t) score += 1;
    if (pos === "verb" && t === 3) score += 3;
    if (pos === "nominal" && t !== 3) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = lemma;
    }
  }
  return best;
}

/**
 * Une locution n'est retenue que si elle porte du sens : on écarte les mots outils composés
 * (« bien que », « à cause de ») et « être + adjectif » (on préfère la carte de l'adjectif).
 */
function usefulPhrase(lex: Lexicon, lemma: string) {
  const entry = lex.entries[lemma];
  return entry.t !== 6 && !lemma.startsWith("être ");
}

/** Pluriel ou forme inconnue : on tente le singulier (« côtés » → « côté »). */
function singularCandidates(lex: Lexicon, key: string): string[] {
  if (key.length > 3 && /[sx]$/.test(key)) return lemmaCandidates(lex, key.slice(0, -1));
  return [];
}

function isCapitalized(s: string) {
  return /^\p{Lu}/u.test(s);
}

function isSentenceStart(tokens: Token[], i: number) {
  for (let k = i - 1; k >= 0; k--) {
    const t = tokens[k];
    if (t.sentence !== tokens[i].sentence) return true;
    if (!t.punct) return false;
    if (t.key === ":" || t.key === "«" || t.key === '"' || SEPARATORS.has(t.key)) return true;
  }
  return true;
}

function matchTokens(lex: Lexicon, tokens: Token[], guess?: Guesser): Hit[] {
  const hits: Hit[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.punct) {
      i++;
      continue;
    }

    // 1. Expression la plus longue possible (« petit chaperon rouge », « se brosser les dents »).
    let matched = false;
    let limit = i;
    while (limit < tokens.length && limit - i < MAX_PHRASE && !tokens[limit].punct) limit++;
    for (let end = limit; end > i + 1; end--) {
      const slice = tokens.slice(i, end);
      const variants = [joinKeys(slice)];
      if (REFLEXIVE.has(tok.key)) variants.push("se " + joinKeys(slice.slice(1)));
      for (const v of variants) {
        const cands = lemmaCandidates(lex, v).filter((l) => usefulPhrase(lex, l));
        if (cands.length) {
          hits.push({ lemma: cands[0], start: i, end, surface: joinSurface(slice), sentence: tok.sentence });
          i = end;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) continue;

    // 2. Mot seul.
    const key = ALIASES[tok.key] ?? tok.key;
    if (/\d/.test(key) || key.length < 2) {
      i++;
      continue;
    }
    // « a été » : participe de « être », pas la saison.
    const prev = tokens[i - 1];
    if (key === "été" && prev && !prev.punct && AVOIR_FORMS.has(prev.key)) {
      i++;
      continue;
    }
    // « elle n'aurait point d'esprit » : négation, pas le signe de ponctuation.
    if (key === "point" && tokens.slice(Math.max(0, i - 4), i).some((t) => t.sentence === tok.sentence && (t.key === "ne" || t.key === "n'"))) {
      i++;
      continue;
    }
    const all = lemmaCandidates(lex, key);
    // Un mot outil connu (« mais », « dans ») ne doit pas devenir « mai » par le singulier ; un mot
    // classé « divers » par ARASAAC qui n'est pas un mot outil (« temps ») reste une carte possible.
    let cands = all.length ? all.filter((l) => lex.entries[l].t !== 6) : singularCandidates(lex, key);
    if (!cands.length && all.length) {
      if (EXCLUDED_LEMMAS.has(key)) {
        i++;
        continue;
      }
      cands = all;
    }
    if (cands.length) {
      const lemma = chooseLemma(lex, key, cands, contextPos(tokens, i));
      hits.push({ lemma, start: i, end: i + 1, surface: tok.surface, sentence: tok.sentence });
      i++;
      continue;
    }

    // 3. Mot composé inconnu (« a-t-il », « dis-moi ») : on traite chaque partie.
    if (key.includes("-")) {
      const parts = tok.surface.split("-").filter(Boolean);
      if (parts.length > 1) {
        let at = tok.start;
        const sub: Token[] = parts.map((p) => {
          at = tok.start + tok.surface.indexOf(p, at - tok.start);
          const t = { ...tok, surface: p, key: p.toLocaleLowerCase("fr-FR"), start: at };
          at += p.length;
          return t;
        });
        if (ENCLITICS.has(sub[sub.length - 1].key)) sub[0].hint = "verb";
        tokens.splice(i, 1, ...sub);
        continue;
      }
    }

    // 4. Mot inconnu du lexique.
    if (EXCLUDED_LEMMAS.has(key) || key.length < 3 || /\d/.test(key)) {
      i++;
      continue;
    }
    if (isCapitalized(tok.surface) && !isSentenceStart(tokens, i)) {
      hits.push({ lemma: null, start: i, end: i + 1, surface: tok.surface, sentence: tok.sentence, proper: true });
    } else if (guess) {
      const g = guess(tok.surface);
      if (g.pos !== "other") {
        const lemma = g.lemma.toLocaleLowerCase("fr-FR");
        const known = lemmaCandidates(lex, lemma).concat(singularCandidates(lex, lemma));
        if (known.length) {
          hits.push({ lemma: known[0], start: i, end: i + 1, surface: tok.surface, sentence: tok.sentence });
        } else {
          const guessedCategory: CategoryCode = g.pos === "verb" ? "V" : g.pos === "adjective" ? "A" : "N";
          // Nom ou adjectif inconnu : on garde le mot du texte, la racine devinée est souvent tronquée (« néanmoin »).
          const surface = g.pos === "verb" ? lemma : tok.surface.toLocaleLowerCase("fr-FR");
          hits.push({ lemma: null, start: i, end: i + 1, surface, sentence: tok.sentence, guessedCategory });
        }
      }
    }
    i++;
  }
  return hits;
}

/**
 * Analyse un texte français et renvoie les mots-clés candidats, dans l'ordre d'apparition.
 * Entièrement hors-ligne : lexique ARASAAC + conjugaisons Lefff + règles de contexte.
 */
export function analyzeText(text: string, lex: Lexicon, options: AnalyzeOptions = {}): WordItem[] {
  const tokens = tokenize(text, options.lineBreaks);
  const hits = matchTokens(lex, tokens, options.guess);
  const sentences = new Map<number, string>();
  for (const t of tokens) {
    if (!sentences.has(t.sentence)) sentences.set(t.sentence, "");
  }
  const sentenceText = (n: number) => {
    const cached = sentences.get(n);
    if (cached) return cached;
    const s = tokens.filter((t) => t.sentence === n);
    const from = s[0]?.start ?? 0;
    const last = s[s.length - 1];
    const str = canonicalText(text)
      .slice(from, last ? last.start + last.surface.length + 1 : from)
      .replace(/\s+/g, " ")
      .trim();
    sentences.set(n, str);
    return str;
  };

  const items = new Map<string, WordItem>();
  for (const h of hits) {
    const lemma = h.lemma ?? h.surface.toLocaleLowerCase("fr-FR");
    if (EXCLUDED_LEMMAS.has(lemma)) continue;
    const last = tokens[h.end - 1];
    const span: [number, number] = [tokens[h.start].start, last.start + last.surface.length];
    const existing = items.get(lemma);
    if (existing) {
      existing.count++;
      existing.spans?.push(span);
      if (!existing.forms.includes(h.surface)) existing.forms.push(h.surface);
      continue;
    }
    const entry = h.lemma ? lex.entries[h.lemma] : undefined;
    const candidates = entry ? entry.p : [];
    const category: CategoryCode = h.proper ? "P" : (candidates[0]?.[1] ?? h.guessedCategory ?? "N");
    items.set(lemma, {
      id: lemma,
      lemma,
      label: entry ? entry.w : h.surface,
      category,
      categoryLocked: false,
      candidates,
      pictoId: candidates[0]?.[0] ?? null,
      plural: false,
      noColor: false,
      forms: [h.surface],
      count: 1,
      firstIndex: h.start,
      spans: [span],
      example: sentenceText(h.sentence),
      known: Boolean(entry),
      proper: Boolean(h.proper),
      score: 0,
      selected: false,
    });
  }

  return scoreAndSelect([...items.values()], options.preselect ?? 18);
}
