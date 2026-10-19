// Code couleur des pictogrammes (cf. « Code couleurs picto.pdf »).
// Les couleurs sont celles extraites du document de référence.

export type CategoryCode = "N" | "P" | "V" | "L" | "A" | "T";

export interface Category {
  code: CategoryCode;
  label: string;
  short: string;
  color: string;
  /** Texte lisible sur la couleur (pour les pastilles de l'interface). */
  onColor: string;
}

export const CATEGORIES: Record<CategoryCode, Category> = {
  N: { code: "N", label: "Noms", short: "Nom", color: "#38B6FF", onColor: "#00293F" },
  P: { code: "P", label: "Personnes et êtres vivants", short: "Personne", color: "#FF3131", onColor: "#FFFFFF" },
  V: { code: "V", label: "Actions / verbes", short: "Verbe", color: "#00BF63", onColor: "#00301A" },
  L: { code: "L", label: "Lieux", short: "Lieu", color: "#C21AE5", onColor: "#FFFFFF" },
  A: { code: "A", label: "Adjectifs, description, émotions", short: "Adjectif", color: "#FF914D", onColor: "#3D1600" },
  T: { code: "T", label: "Temps", short: "Temps", color: "#FFDE59", onColor: "#3A3000" },
};

export const CATEGORY_ORDER: CategoryCode[] = ["P", "V", "N", "L", "A", "T"];

/** Types de mots-clés ARASAAC. */
export const ARASAAC_TYPE = {
  PROPER_NOUN: 1,
  COMMON_NOUN: 2,
  VERB: 3,
  DESCRIPTIVE: 4,
  SOCIAL: 5,
  MISC: 6,
} as const;

const TIME_MARKERS = new Set([
  "time",
  "calendar",
  "adverb of time",
  "unit of time",
  "day time",
  "day hours",
  "day",
  "month",
  "season",
  "core vocabulary-time",
  "week",
  "year",
]);

const STRONG_TIME = new Set([
  "adverb of time",
  "unit of time",
  "day time",
  "day hours",
  "day",
  "month",
  "season",
  "core vocabulary-time",
]);

const PERSON_MARKERS = new Set([
  "person",
  "animal",
  "character",
  "family",
  "professional",
  "tale character",
  "book character",
  "movie character",
  "historical character",
  "mythological character",
  "religious character",
  "person according to their age",
  "personal pronoun",
]);

const PLACE_MARKERS = new Set([
  "place",
  "building",
  "room",
  "building room",
  "core vocabulary-place",
  "adverb of place",
  "country",
  "city",
  "political geography",
  "natural habitat",
  "landscape",
  "animal housing",
  "workplace",
]);

const EMOTION_MARKERS = new Set(["feeling", "emotion", "human value", "qualifying adjective", "adjective", "color"]);

const CALENDAR_NAMES = new Set(["day", "month", "season"]);

// Catégories ARASAAC qui désignent un lieu, même sans l'étiquette « place ».
const PLACE_CATEGORY = /building|room|space|habitat|landform|beach|country|city|town|village|place/;

// Étiquettes qui font d'un « lieu » plutôt un objet (un arbre de cour de récréation reste un arbre).
const OBJECT_TAGS = new Set(["plant", "food", "object"]);

// Étiquettes qui désignent une partie d'un être vivant ou un objet, pas l'être lui-même.
const NOT_A_BEING = new Set([
  "animal anatomy",
  "human anatomy",
  "anatomy",
  "animal physiology",
  "animal behaviour",
  "human body",
  "food",
]);

function hasAny(markers: Set<string>, values: readonly string[]) {
  return values.some((v) => markers.has(v));
}

/**
 * Déduit la catégorie couleur d'un pictogramme à partir des métadonnées ARASAAC
 * (type du mot-clé, catégories et étiquettes du pictogramme). Aucune IA : règles fixes.
 */
export function classifyArasaac(
  keywordType: number | undefined,
  categories: readonly string[],
  tags: readonly string[],
): CategoryCode {
  const all = [...categories, ...tags];

  // Les jours et les mois sont parfois typés « verbe » dans ARASAAC (« Lundi »).
  if (hasAny(CALENDAR_NAMES, categories)) return "T";
  if (keywordType === ARASAAC_TYPE.VERB) return "V";
  if (hasAny(STRONG_TIME, categories) || hasAny(TIME_MARKERS, tags)) return "T";
  if (keywordType === ARASAAC_TYPE.DESCRIPTIVE || hasAny(EMOTION_MARKERS, categories)) return "A";
  // Un lieu peut porter l'étiquette « animal » (ferme) ou « person » (maison) : le lieu l'emporte.
  const placeByCategory = categories.some((c) => PLACE_CATEGORY.test(c));
  const placeByTag = hasAny(PLACE_MARKERS, all) && !hasAny(OBJECT_TAGS, tags);
  if (placeByCategory || placeByTag) return "L";
  if (hasAny(PERSON_MARKERS, all) && !hasAny(NOT_A_BEING, all)) return "P";
  if (tags.includes("verb")) return "V";
  return "N";
}
