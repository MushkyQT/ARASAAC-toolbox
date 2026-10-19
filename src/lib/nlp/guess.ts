import nlp from "fr-compromise";
import type { Guesser } from "./analyze";

/** Lemme et nature d'un mot absent du lexique ARASAAC, via fr-compromise (règles, sans IA). */
export const compromiseGuess: Guesser = (word) => {
  const doc = nlp(word);
  doc.compute("root");
  const term = doc.json()[0]?.terms?.[0] as { tags?: string[]; root?: string; normal?: string } | undefined;
  const tags = new Set(term?.tags ?? []);
  const lemma = term?.root || term?.normal || word;
  if (tags.has("Pronoun") || tags.has("Determiner") || tags.has("Preposition") || tags.has("Conjunction")) {
    return { lemma, pos: "other" };
  }
  if (tags.has("Verb")) return { lemma, pos: "verb" };
  if (tags.has("Adjective")) return { lemma, pos: "adjective" };
  if (tags.has("Noun")) return { lemma, pos: "noun" };
  return { lemma, pos: "other" };
};
