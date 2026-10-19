// Passages qui ne font pas partie de l'histoire ou de la recette : mentions légales, crédits, liens,
// menus et boutons d'un site, texte en anglais… Repérés par des règles fixes (sans IA), ignorés par
// défaut, et toujours visibles et réintégrables d'un clic dans la vue « Dans le texte ».
import { canonicalText, lineBreakMode, normalizeKey, type LineBreaks } from "@/lib/text";

export type NoiseReason = "legal" | "credits" | "link" | "site" | "practical" | "foreign";

export const NOISE_LABELS: Record<NoiseReason, string> = {
  legal: "Mentions légales",
  credits: "Crédits et édition",
  link: "Lien ou adresse",
  site: "Navigation du site",
  practical: "Infos pratiques",
  foreign: "Autre langue",
};

export interface Passage {
  /** Début et fin [ du passage dans `canonicalText(text)`. */
  start: number;
  end: number;
  text: string;
  /** Texte normalisé : sert à mémoriser le choix de l'utilisateur pour ce passage. */
  key: string;
  /** Pourquoi le passage est ignoré par défaut (null : il fait partie du texte à analyser). */
  noise: NoiseReason | null;
  /** Exclu de l'analyse : choix de l'utilisateur s'il y en a un, sinon `noise`. */
  ignored: boolean;
}

// [raison, motif, nombre de mots maximal du passage]. Le plafond évite d'écarter une phrase du récit
// qui contiendrait par hasard « écrit par » ou « partager » : les crédits et les menus sont courts.
const RULES: [NoiseReason, RegExp, number?][] = [
  ["legal", /©|\(c\)\s*\d{4}|\bcopyright\b|droits (réservés|de reproduction)|toute reproduction|reproduction (interdite|réservée)/i],
  ["legal", /creative\s*commons|\bcc[\s-]?by\b|\bby-(nc|sa|nd)\b|sous licence|licence (cc|creative|libre|ouverte|gnu|etalab)|domaine public|public domain/i],
  ["legal", /\bisbn\b|\bissn\b|dépôt légal|achevé d'imprimer|imprimé (en|au|aux|par)\s|\bloi n°|publications destinées à la jeunesse/i],
  [
    "legal",
    /mentions légales|politique de confidentialité|données personnelles|conditions générales|\bcg[uv]\b|\brgpd\b|(utilis\w*|accept\w*|gestion|paramétr\w*|refus\w*|politique)\s+(des |les |de |aux )?cookies|cookies? (tiers|publicitaires)/i,
  ],
  ["legal", /project gutenberg|gutenberg\.org|\be-?books?\b|livre numérique/i],
  ["link", /https?:\/\/|\bwww\.|[\w.+-]+@[\w-]+\.\w/i],
  // Nom de domaine en minuscules seulement : « fin.Le » (espace oublié par l'OCR) n'est pas un lien.
  ["link", /(?<!\p{L})[\w-]+\.(fr|com|org|net|eu|be|ch|ca|info|io)(?!\p{L})/u],
  ["link", /(\+33|\b0[1-9])([ .-]?\d{2}){4}\b|\b\d{5}\s+\p{Lu}{2,}/u],
  ["link", /(?<![\p{L}\p{N}])\d{1,4}(\s?(bis|ter))?,?\s+(rue|avenue|boulevard|bd|place|chemin|allée|impasse|quai|route)\s+(de la |de |du |des |d'|la |le )?\p{Lu}/u, 12],
  [
    "site",
    /partager (sur|par e-?mail|cet article|cette (recette|page|histoire)|ce contenu)|\b(facebook|pinterest|twitter|instagram|whatsapp|tiktok|youtube|linkedin)\b/i,
    30,
  ],
  ["site", /newsletter|abonnez-vous|s'abonner|inscrivez-vous|connectez-vous|se connecter|créer un compte|mot de passe/i, 30],
  ["site", /\d+\s+commentaires?|laisse[rz]? un commentaire|laissez une note|noter cette recette|votre avis|avis des internautes|vous avez aimé/i, 30],
  ["site", /imprimer (la|cette) (recette|page|fiche|histoire)|envoyer par e-?mail|épingler|ajouter (à|aux) (mes )?favoris|enregistrer la recette/i, 30],
  ["site", /pourraient (aussi |également )?vous plaire|vous aimerez aussi|à découvrir aussi|lire aussi|voir aussi|(articles?|recettes?|histoires?) similaires|sur le même thème/i, 30],
  [
    "site",
    /liens? affiliés?|sponsorisée?s?(?!\p{L})|retrouvez(-nous| toutes| tous| d'autres| nos| notre)|suivez-nous|rejoignez-nous|contactez-nous|nous contacter|plan du site|retour en haut/iu,
    30,
  ],
  ["site", /^accueil\s*[>›»|/]|(\s[>›]\s\S+){2,}/i, 30],
  ["credits", /^(textes?|illustrations?|dessins?|traduction|adaptation|photos?|photographies?|graphisme|mise en page|couverture|maquette)\s*(:|de\s|d'|par\s)/i, 20],
  ["credits", /([Ii]llustrée?s?|[Ii]llustrations|[ÉéEe]crite?|[Rr]acontée?|[Tt]raduite?|[Aa]daptée?|[Ii]maginée?)\s+(par|de)\s+\p{Lu}/u, 12],
  // Sans drapeau « i » : \p{Lu} doit rester une vraie majuscule (« Éditions Gallimard », pas « éditions spéciales »).
  ["credits", /(?<!\p{L})[ÉE]ditions?\s+(\p{Lu}|du |de la |des )|(?<!\p{L})[ÉéEe]diteurs?(?!\p{L})|Imprimerie/u, 20],
  ["credits", /^(librairie|imprimerie|collection)(?!\p{L})|collection\s+[«"]/iu, 20],
  [
    "credits",
    /^(title|authors?|illustrator|translator|editor|release date|posting date|language|credits|produced by|character set encoding|titre|auteure?s?|autrice|illustrat(eur|rice)|tradu(cteur|ctrice)|éditeur|date de (publication|parution)|source|crédits?)\s*:/i,
  ],
  [
    "credits",
    /publiée? (le|par)|mis à jour le|postée? le|rédigée? par|(document|fiche|ressource|site|page|recette|photo|vidéo)s? (réalisée?s?|conçue?s?|proposée?s?|créée?s?) par/i,
    25,
  ],
  ["practical", /temps (de )?(préparation|cuisson|repos|total)|^(préparation|cuisson|repos|attente|réfrigération)\s*:\s*\d|\b(difficulté|coût|budget)\s*:/i, 20],
  [
    "practical",
    /^\s*(page|p\.)\s*\d+(\s*(\/|sur)\s*\d+)?\s*$|fiche (pédagogique|de préparation|élève|enseignant)|\bcycle\s+[1-4]\b|compétences?\s+(travaillées|visées|attendues)|^(objectifs?|domaine)\s*:|^(séquence|séance)\s*\d/i,
    20,
  ],
  ["practical", /\b(PS|MS|GS|CP|CE1|CE2|CM1|CM2)\s*[-–/]\s*(MS|GS|CP|CE1|CE2|CM1|CM2)\b/, 20],
  // « Pour 6 personnes » : sur une ligne courte, pas dans une phrase de la recette.
  ["practical", /^(pour|portions?|nombre de (parts|personnes))\s*:?\s*\d+\s*(personnes?|parts?|pers\.?|portions?)\b/i, 10],
];

// Rubriques de fin de page web : tout ce qui suit est ignoré.
const TAIL = /^(notes et références|références|bibliographie|liens externes|articles connexes|commentaires|\d+ commentaires?)\s*:?\s*$/i;

const GUTENBERG_START = /\*\*\*\s*start of (the|this) project gutenberg/i;
const GUTENBERG_END = /\*\*\*\s*end of (the|this) project gutenberg/i;

// Mots très fréquents propres à l'anglais (aucun n'est un mot français courant).
const EN = new Set(
  "the of and to in is you that it for with this are be or not by at from your any all may if we our which have has will can under use other works was were he she his her they them their there been would could should do does did what when who into than then these those such only also more most".split(
    " ",
  ),
);
const FR = new Set(
  "le la les de des du et un une est il elle que qui dans pour pas sur au aux ne se ce son sa ses avec à mais ou je tu nous vous ils elles lui leur était sont".split(" "),
);

function isForeign(line: string) {
  const words = line.toLocaleLowerCase("fr-FR").match(/\p{L}+/gu) ?? [];
  if (words.length < 3) return false;
  let en = 0;
  let fr = 0;
  for (const w of words) {
    if (EN.has(w)) en++;
    else if (FR.has(w)) fr++;
  }
  return en >= 2 && en >= 2 * fr && en / words.length >= 0.15;
}

function wordCount(line: string) {
  return line.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

function classify(line: string): NoiseReason | null {
  const words = wordCount(line);
  for (const [reason, re, max] of RULES) if ((max === undefined || words <= max) && re.test(line)) return reason;
  if (isForeign(line)) return "foreign";
  return null;
}

// Une phrase : jusqu'à un point suivi d'un espace (« 4.0 » ou « 1/2 » ne coupent pas).
const SENTENCE = /\S.*?(?:[.!?…]+["»)\]]*(?=\s|$)|$)/g;

/**
 * Une ligne, ou ses phrases si c'est un long paragraphe dont une partie seulement est à ignorer
 * (« … et ils vécurent heureux. Retrouvez d'autres contes sur www.exemple.fr »).
 */
function segments(raw: string, at: number): Line[] {
  const whole: Line = { start: at, end: at + raw.length, text: raw, noise: classify(raw.trim()) };
  if (wordCount(raw) <= 25 || whole.noise === "foreign") return [whole];
  const parts: Line[] = [...raw.matchAll(SENTENCE)].map((m) => {
    const text = m[0].trimEnd();
    return { start: at + (m.index ?? 0), end: at + (m.index ?? 0) + text.length, text, noise: classify(text) };
  });
  return parts.some((p) => p.noise !== null) ? parts : [{ ...whole, noise: null }];
}

// En tête ou en fin de document : la signature de l'auteur (« Charles Perrault », « par Marie Dupont »)
// et le numéro de série (« 20e Série », « Tome 3 »). Les premiers mots d'un titre (« Petit Ours »,
// « Maman Ourse », « Père Noël ») ne sont pas des prénoms.
const EDGE_LINES = 6;
const SERIES = /^(\d+\s*(e|ème|er|re)\s+)?(série|tome|volume|épisode|numéro|n°)(\s*\d+)?\s*$/i;
const NAME = String.raw`\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?`;
const BYLINE = new RegExp(String.raw`^(?:(?:par|de)\s+)?${NAME}(?:\s+(?:\p{Lu}\.|${NAME}|de|du|d'|van|von)){1,3}$`, "u");
const TITLE_WORDS = new Set(
  "le la les l' un une des mon ma mes ton ta son sa petit petite petits grand grande gros grosse vieux vieille papa maman mamie papi papy père mère frère sœur roi reine prince princesse monsieur madame docteur capitaine saint sainte il elle bonne bon belle beau joyeux".split(
    " ",
  ),
);
function isByline(line: string) {
  const first = line.split(/\s+/)[0].toLocaleLowerCase("fr-FR");
  return BYLINE.test(line) && !TITLE_WORDS.has(first);
}

/** Ligne courte sans ponctuation finale (titre, nom, fragment d'adresse) : suit ses voisines. */
const isWeak = (line: string) => wordCount(line) <= 8 && !/[.!?…»"]\s*$/.test(line) && !/^\s*([-•*·]|\d+[.)])\s/.test(line);

interface Line {
  start: number;
  end: number;
  text: string;
  noise: NoiseReason | null;
}

function classifyLines(text: string): Line[] {
  const lines: Line[] = [];
  let at = 0;
  for (const raw of text.split("\n")) {
    if (raw.trim()) lines.push(...segments(raw, at));
    at += raw.length + 1;
  }

  // Livre du projet Gutenberg : tout ce qui précède le début et suit la fin du livre.
  const begin = lines.findIndex((l) => GUTENBERG_START.test(l.text));
  const finish = lines.findIndex((l) => GUTENBERG_END.test(l.text));
  lines.forEach((l, i) => {
    if ((begin !== -1 && i <= begin) || (finish !== -1 && i >= finish)) l.noise ??= "legal";
  });

  // Notes, références et commentaires en fin de page web.
  const tail = lines.findIndex((l, i) => i >= lines.length / 2 && TAIL.test(l.text.trim()));
  if (tail !== -1) for (const l of lines.slice(tail)) l.noise ??= "site";

  // Lignes courtes coincées entre deux lignes ignorées (« Paris », « BIBLIOTHÈQUE DES TOUT PETITS »).
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].noise === null) continue;
    let j = i + 1;
    while (j < lines.length && j - i <= 4 && lines[j].noise === null && isWeak(lines[j].text.trim())) j++;
    if (j > i + 1 && j < lines.length && j - i <= 4 && lines[j].noise !== null) {
      for (let k = i + 1; k < j; k++) lines[k].noise = lines[i].noise;
    }
  }

  // Après coup, pour qu'un titre placé entre la signature et la série ne soit pas emporté avec elles.
  lines.forEach((l, i) => {
    if (l.noise === null && (i < EDGE_LINES || i >= lines.length - EDGE_LINES)) {
      const t = l.text.trim();
      if (SERIES.test(t) || isByline(t)) l.noise = "credits";
    }
  });
  return lines;
}

/**
 * Découpe le texte en passages (une ligne, ou un paragraphe pour un texte coupé à largeur fixe)
 * et repère ceux qui ne font pas partie du contenu. `overrides` : choix de l'utilisateur par clé.
 */
export function findPassages(text: string, overrides: Record<string, boolean> = {}, mode?: LineBreaks): Passage[] {
  const clean = canonicalText(text);
  const lines = classifyLines(clean);
  const soft = (mode ?? lineBreakMode(clean)) === "soft";
  const groups: Line[][] = [];
  for (const line of lines) {
    const group = groups[groups.length - 1];
    const prev = group?.[group.length - 1];
    // Texte coupé : les lignes d'un même paragraphe (sans ligne vide entre elles) restent ensemble.
    const joined = soft && prev && !/\n[^\S\n]*\n/.test(clean.slice(prev.end, line.start)) && prev.noise === line.noise;
    if (joined) group.push(line);
    else groups.push([line]);
  }
  return groups.map((g) => {
    const start = g[0].start;
    const end = g[g.length - 1].end;
    const passageText = clean.slice(start, end);
    const key = normalizeKey(passageText);
    const noise = g[0].noise;
    return { start, end, text: passageText, key, noise, ignored: overrides[key] ?? noise !== null };
  });
}

/** Remplace les passages ignorés par des espaces : les positions des autres mots ne bougent pas. */
export function maskIgnored(text: string, passages: Passage[]): string {
  const clean = canonicalText(text);
  let out = "";
  let at = 0;
  for (const p of passages) {
    if (!p.ignored) continue;
    out += clean.slice(at, p.start) + clean.slice(p.start, p.end).replace(/[^\n]/g, " ");
    at = p.end;
  }
  return out + clean.slice(at);
}
