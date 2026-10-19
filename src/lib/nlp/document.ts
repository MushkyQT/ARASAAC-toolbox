import { canonicalText, lineBreakMode } from "@/lib/text";
import type { WordItem } from "@/lib/types";
import { analyzeText, type AnalyzeOptions } from "./analyze";
import type { Lexicon } from "./lexicon";
import { findPassages, maskIgnored, type Passage } from "./passages";

export interface DocumentAnalysis {
  words: WordItem[];
  passages: Passage[];
}

/**
 * Analyse un document entier : repère d'abord les passages à ignorer (mentions légales, crédits,
 * menus de site…), puis cherche les mots-clés dans le reste. Les positions renvoyées (`spans`,
 * passages) se rapportent à `canonicalText(text)`, passages ignorés compris.
 */
export function analyzeDocument(
  text: string,
  lex: Lexicon,
  options: AnalyzeOptions & { overrides?: Record<string, boolean> } = {},
): DocumentAnalysis {
  const clean = canonicalText(text);
  const lineBreaks = options.lineBreaks ?? lineBreakMode(clean);
  const passages = findPassages(clean, options.overrides, lineBreaks);
  const words = analyzeText(maskIgnored(clean, passages), lex, { ...options, lineBreaks });
  return { words, passages };
}
