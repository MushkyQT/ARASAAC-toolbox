// Mots outils : jamais proposés comme cartes (l'utilisateur peut toujours les ajouter à la main).

export const DETERMINERS = new Set(
  "le la les l' un une des du de d' au aux ce cet cette ces mon ton son ma ta sa mes tes ses notre votre nos vos leur leurs quel quelle quels quelles chaque plusieurs quelques aucun aucune tout toute tous toutes".split(
    " ",
  ),
);

export const SUBJECT_PRONOUNS = new Set("je j' tu il elle on nous vous ils elles qui ne n' se s' me m' te t' y".split(" "));

const PRONOUNS =
  "je j' tu il elle on nous vous ils elles me m' te t' se s' moi toi lui eux soi leur y en celui celle ceux celles ceci cela ça c' ce qui que qu' quoi dont où lequel laquelle lesquels lesquelles quiconque personne rien chacun chacune";

const PREPOSITIONS =
  "à de d' dans sur sous avec sans pour par en entre vers chez contre depuis pendant parmi selon malgré jusque jusqu' jusqu'à près loin autour devant derrière dessus dessous hors via";

const CONJUNCTIONS = "et ou mais donc or ni car que qu' quand lorsque lorsqu' puisque puisqu' comme si quoique quoiqu' parce afin";

const ADVERBS =
  "ne n' pas plus jamais rien très trop assez aussi bien mal peu beaucoup encore déjà toujours même tant tellement si alors puis là ici voilà voici oui non peut-être vraiment presque seulement ainsi y en tout";

// Verbes trop généraux pour faire une carte utile (« être », « avoir » et leurs auxiliaires).
const LIGHT_VERBS = "être avoir il y a";

export const EXCLUDED_LEMMAS = new Set(
  [PRONOUNS, PREPOSITIONS, CONJUNCTIONS, ADVERBS, LIGHT_VERBS]
    .join(" ")
    .split(" ")
    .concat([
      ...DETERMINERS,
      "il y a",
      "il y avait",
      "c'est",
      "il faut",
      "chose",
      "choses",
      "fois",
      "quelque",
      "comment",
      "pourquoi",
      "combien",
      "t",
    ]),
);

// Verbes fréquents mais peu porteurs de sens : gardés dans la liste, pas présélectionnés.
export const GENERIC_LEMMAS = new Set([
  "faire",
  "aller",
  "dire",
  "pouvoir",
  "vouloir",
  "devoir",
  "falloir",
  "mettre",
  "prendre",
  "venir",
  "savoir",
  "demander",
  "répondre",
  "commencer",
  "arriver",
  "rester",
  "passer",
  "trouver",
  "donner",
  "laisser",
  "petit",
  "grand",
  "autre",
  "premier",
  "dernier",
  "une fois",
  "ensuite",
  "après",
  "avant",
  "puis",
  "alors",
  "enfin",
]);

/** Formes conjuguées de « avoir », pour repérer « a été » (auxiliaire) vs « l'été » (saison). */
export const AVOIR_FORMS = new Set(
  "ai as a avons avez ont avais avait avions aviez avaient eus eut eûmes eûtes eurent aurai auras aura aurons aurez auront aurais aurait aurions auriez auraient aie aies ait ayons ayez aient ayant eu".split(
    " ",
  ),
);

/** Variantes anciennes ou régionales absentes d'ARASAAC. */
export const ALIASES: Record<string, string> = {
  "mère-grand": "grand-mère",
  "père-grand": "grand-père",
};

/** Pronoms qui suivent un verbe à l'impératif ou dans une question (« porte-lui », « dit-il »). */
export const ENCLITICS = new Set("moi toi lui leur le la les nous vous en y il elle on ils elles je tu".split(" "));
