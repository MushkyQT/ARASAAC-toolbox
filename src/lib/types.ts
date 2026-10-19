import type { CategoryCode } from "@/lib/categories";

/** Un mot-clé extrait du texte, futur pictogramme. */
export interface WordItem {
  /** Clé stable : le lemme normalisé (ou la forme du texte si mot inconnu). */
  id: string;
  /** Lemme normalisé (sert à chercher dans ARASAAC et dans la banque de mots). */
  lemma: string;
  /** Texte écrit sur la carte (modifiable). Affiché en capitales. */
  label: string;
  category: CategoryCode;
  /** Vrai si l'utilisateur a choisi la catégorie lui-même (elle ne suit plus le pictogramme). */
  categoryLocked: boolean;
  /** Pictogrammes candidats [id, catégorie déduite]. */
  candidates: [number, CategoryCode][];
  /** Pictogramme retenu (null = carte sans image ou image personnelle). */
  pictoId: number | null;
  /** Id du mot dont cette carte est une copie (même mot, autre sens : l'avocat métier et le fruit). Non mémorisée. */
  copyOf?: string;
  /** Vrai si l'utilisateur a lui-même choisi le pictogramme (sinon : premier proposé, à vérifier s'il y en a plusieurs). */
  pictoChosen?: boolean;
  /** Image personnelle (data URL), prioritaire sur le pictogramme. */
  customImage?: string;
  plural: boolean;
  /** Rendu noir et blanc pour ce pictogramme. */
  noColor: boolean;
  /** Formes rencontrées dans le texte (« mangeait », « mangèrent »…). */
  forms: string[];
  count: number;
  /** Ordre d'apparition (index du premier jeton). */
  firstIndex: number;
  /** Phrase d'exemple. */
  example: string;
  /** Mot présent dans le lexique ARASAAC. */
  known: boolean;
  /** Mot détecté comme nom propre (personnage). */
  proper: boolean;
  /** Importance calculée (sert à la présélection). */
  score: number;
  selected: boolean;
}

export type FontId = "opensans" | "andika" | "atkinson";

export interface CardSettings {
  /** Côté de la carte en millimètres (80 = 8 cm). */
  sizeMm: number;
  /** Épaisseur de la bordure en millimètres. */
  borderMm: number;
  font: FontId;
  bold: boolean;
  rounded: boolean;
  cutMarks: boolean;
  /** Imprime tous les pictogrammes en noir et blanc. */
  blackWhite: boolean;
  /** Ordre des cartes à l'export. */
  order: "text" | "category" | "alpha";
}

export const DEFAULT_SETTINGS: CardSettings = {
  sizeMm: 80,
  borderMm: 2,
  font: "opensans",
  bold: false,
  rounded: false,
  cutMarks: true,
  blackWhite: false,
  order: "text",
};
