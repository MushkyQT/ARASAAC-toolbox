import type { CategoryCode } from "@/lib/categories";

export interface LexiconEntry {
  /** Mot-clé tel qu'écrit dans ARASAAC (accents, majuscules). */
  w: string;
  /** Pictogrammes candidats : [id, catégorie], du plus pertinent au moins pertinent. */
  p: [number, CategoryCode][];
  /** Type de mot-clé ARASAAC du meilleur pictogramme (1 nom propre, 2 nom, 3 verbe, 4 adjectif…). */
  t: number;
}

export interface Lexicon {
  v: 1;
  built: string;
  pictogramCount: number;
  entries: Record<string, LexiconEntry>;
  /** Forme fléchie normalisée → lemmes normalisés séparés par « | ». */
  forms: Record<string, string>;
}

export const LEXICON_URL = "/data/lexicon-fr.json";

let pending: Promise<Lexicon> | null = null;

/** Charge le lexique une seule fois (mis en cache par le navigateur ensuite). */
export function loadLexicon(): Promise<Lexicon> {
  pending ??= fetch(LEXICON_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Lexique indisponible (${res.status})`);
      return res.json() as Promise<Lexicon>;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

/** Lemmes possibles pour une clé normalisée : le mot-clé lui-même puis les lemmes dont c'est une forme fléchie. */
export function lemmaCandidates(lex: Lexicon, key: string): string[] {
  const out: string[] = [];
  if (lex.entries[key]) out.push(key);
  const forms = lex.forms[key];
  if (forms) for (const l of forms.split("|")) if (!out.includes(l) && lex.entries[l]) out.push(l);
  return out;
}
