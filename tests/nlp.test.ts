import { describe, expect, test } from "vitest";
import fs from "node:fs";
import { analyzeText } from "@/lib/nlp/analyze";
import { compromiseGuess } from "@/lib/nlp/guess";
import type { Lexicon } from "@/lib/nlp/lexicon";
import { tokenize, toCardLabel } from "@/lib/text";

const lex: Lexicon = JSON.parse(fs.readFileSync("public/data/lexicon-fr.json", "utf8"));
const fixture = (name: string) => fs.readFileSync(`tests/fixtures/${name}.txt`, "utf8");
const analyze = (text: string) => analyzeText(text, lex, { guess: compromiseGuess });
const byLemma = (text: string) => new Map(analyze(text).map((w) => [w.lemma, w]));

describe("tokenize", () => {
  test("sépare les élisions et garde les mots composés", () => {
    const keys = tokenize("L'ogre s'endormit près de la grand-mère.").map((t) => t.key);
    expect(keys).toEqual(["l'", "ogre", "s'", "endormit", "près", "de", "la", "grand-mère", "."]);
  });

  test("normalise les apostrophes typographiques", () => {
    expect(tokenize("qu’il").map((t) => t.key)).toEqual(["qu'", "il"]);
  });
});

describe("toCardLabel", () => {
  test("met en capitales en gardant les accents", () => {
    expect(toCardLabel("forêt")).toBe("FORÊT");
    expect(toCardLabel("pomme de terre")).toBe("POMME DE TERRE");
    expect(toCardLabel("garçon")).toBe("GARÇON");
  });
});

describe("analyse d'un conte (passé simple, imparfait, expressions)", () => {
  const words = byLemma(fixture("chaperon"));

  test.each([
    ["petit chaperon rouge", "P"],
    ["loup", "P"],
    ["grand-mère", "P"],
    ["bûcheron", "P"],
    ["papillon", "P"],
    ["forêt", "L"],
    ["village", "L"],
    ["chemin", "L"],
    ["rencontrer", "V"],
    ["courir", "V"],
    ["cueillir", "V"],
    ["partir", "V"],
    ["beurre", "N"],
    ["fleur", "N"],
    ["malade", "A"],
    ["jour", "T"],
  ])("%s → %s", (lemma, category) => {
    expect(words.get(lemma)?.category).toBe(category);
  });

  test("lemmatise le passé simple et le pluriel", () => {
    expect(words.get("rencontrer")?.forms).toContain("rencontra");
    expect(words.get("bûcheron")?.forms).toContain("bûcherons");
  });

  test("écarte les mots outils et les auxiliaires", () => {
    for (const junk of ["le", "la", "de", "et", "qui", "être", "avoir", "mais", "mai", "bien que", "il"]) {
      expect(words.has(junk), junk).toBe(false);
    }
  });

  test("présélectionne le personnage principal", () => {
    expect(words.get("petit chaperon rouge")?.selected).toBe(true);
    expect(words.get("loup")?.selected).toBe(true);
  });

  test("« porte-lui » est un verbe, pas une porte", () => {
    expect(words.has("porte")).toBe(false);
    expect(words.get("porter")?.category).toBe("V");
  });
});

describe("analyse d'une recette (impératif, ingrédients)", () => {
  const words = byLemma(fixture("crepes"));

  test("reconnaît les verbes à l'impératif", () => {
    for (const v of ["mélanger", "verser", "ajouter", "fouetter", "reposer", "chauffer"]) {
      expect(words.get(v)?.category, v).toBe("V");
    }
  });

  test("reconnaît les ingrédients et ustensiles", () => {
    for (const n of ["farine", "œuf", "lait", "sucre", "beurre", "saladier", "poêle"]) {
      expect(words.get(n)?.category, n).toBe("N");
    }
  });

  test("ignore les nombres et unités", () => {
    expect(words.has("4")).toBe(false);
    expect(words.has("g")).toBe(false);
  });
});

describe("désambiguïsation par le contexte", () => {
  const words = byLemma(fixture("ecole"));

  test("verbes pronominaux et locutions verbales", () => {
    expect(words.get("se réveiller")?.category).toBe("V");
    expect(words.get("se brosser les dents")?.category).toBe("V");
    expect(words.get("s'endormir")?.category).toBe("V");
  });

  test("« l'été » est une saison, « ont été » un auxiliaire", () => {
    const ete = words.get("été");
    expect(ete?.category).toBe("T");
    expect(ete?.count).toBe(1);
  });

  test("« la ferme » est un lieu", () => {
    expect(words.get("ferme")?.category).toBe("L");
  });

  test("« est » (verbe être) n'est pas le point cardinal", () => {
    expect(words.has("est")).toBe(false);
  });

  test("prénoms inconnus = personnes", () => {
    expect(words.get("léo")?.category).toBe("P");
    expect(words.get("léo")?.proper).toBe(true);
    expect(words.get("inès")?.category).toBe("P");
  });

  test("un exemple de phrase est conservé", () => {
    expect(words.get("cuisine")?.example).toContain("cuisine");
  });
});

describe("présélection", () => {
  test("respecte la limite et couvre chaque catégorie présente", () => {
    const items = analyzeText(fixture("chaperon"), lex, { guess: compromiseGuess, preselect: 8 });
    const selected = items.filter((w) => w.selected);
    expect(selected).toHaveLength(8);
    const cats = new Set(items.map((w) => w.category));
    for (const c of cats) expect(selected.some((w) => w.category === c), c).toBe(true);
  });
});
