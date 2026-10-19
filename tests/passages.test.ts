import { describe, expect, test } from "vitest";
import fs from "node:fs";
import { analyzeDocument } from "@/lib/nlp/document";
import { compromiseGuess } from "@/lib/nlp/guess";
import type { Lexicon } from "@/lib/nlp/lexicon";
import { findPassages, maskIgnored } from "@/lib/nlp/passages";
import { lineBreakMode } from "@/lib/text";

const lex: Lexicon = JSON.parse(fs.readFileSync("public/data/lexicon-fr.json", "utf8"));
const fixture = (name: string) => fs.readFileSync(`tests/fixtures/${name}.txt`, "utf8");
const ignoredText = (text: string) => findPassages(text).filter((p) => p.ignored).map((p) => p.text);

describe("passages ignorés", () => {
  test("album : crédits, mentions légales, fiche pédagogique et liens", () => {
    const ignored = ignoredText(fixture("album-ours"));
    for (const start of ["Texte de Marie", "Éditions Les Petits Pas", "©", "ISBN", "Loi n°", "Fiche pédagogique", "Document réalisé", "Ressource mise", "Retrouvez", "Page 1/2"]) {
      expect(ignored.some((t) => t.startsWith(start)), start).toBe(true);
    }
    expect(ignored.some((t) => t.includes("Petit Ours"))).toBe(false);
  });

  test("blog de recette : menus, partage, infos pratiques, cookies", () => {
    const passages = findPassages(fixture("blog-gateau"));
    const reason = (start: string) => passages.find((p) => p.text.startsWith(start))?.noise ?? null;
    expect(reason("Accueil >")).toBe("site");
    expect(reason("Partager sur Facebook")).toBe("site");
    expect(reason("Temps de préparation")).toBe("practical");
    expect(reason("Pour 6 personnes")).toBe("practical");
    expect(reason("© 2024")).toBe("legal");
    expect(reason("Nous utilisons des cookies")).toBe("legal");
    // Le contenu de la recette reste.
    for (const start of ["Gâteau au yaourt", "Ingrédients", "- 3 pots de farine", "3. Ajoutez les œufs", "Astuce"]) {
      expect(reason(start), start).toBeNull();
    }
  });

  test("livre numérisé : licence en anglais, en-tête et adresse de l'imprimeur", () => {
    const text = [
      "The Project Gutenberg eBook of Riquet à la Houppe",
      "",
      "This eBook is for the use of anyone anywhere in the United States and",
      "most other parts of the world at no cost and with almost no restrictions",
      "",
      "*** START OF THE PROJECT GUTENBERG EBOOK RIQUET À LA HOUPPE ***",
      "",
      "COLLECTION PICARD",
      "",
      "Paris",
      "",
      "Librairie d'Éducation Nationale",
      "",
      "11, rue Soufflot, 11.",
      "",
      "Il était une fois une reine qui",
      "eut un fils si laid et si mal fait,",
      "qu'on douta longtemps s'il",
      "avait forme humaine.",
    ].join("\n");
    expect(lineBreakMode(text)).toBe("soft");
    // Tout est ignoré, sauf l'histoire.
    expect(findPassages(text).filter((p) => !p.ignored).map((p) => p.text)).toEqual([text.slice(text.indexOf("Il était"))]);
  });

  test("signature de l'auteur et numéro de série, pas le titre", () => {
    const passages = findPassages("Charles Perrault\nRIQUET A LA HOUPPE\n\n20e Série\n\nIl était une fois une reine.");
    expect(passages.map((p) => [p.text, p.noise])).toEqual([
      ["Charles Perrault", "credits"],
      ["RIQUET A LA HOUPPE", null],
      ["20e Série", "credits"],
      ["Il était une fois une reine.", null],
    ]);
    for (const title of ["Petit Ours", "Maman Ourse", "Père Noël", "Boucle d'or"]) {
      expect(findPassages(`${title}\nIl était une fois un ours.`)[0].noise, title).toBeNull();
    }
    expect(findPassages("par Marie Lefèvre\nIl était une fois.")[0].noise).toBe("credits");
  });

  test("une phrase du récit n'est pas prise pour un menu ou des crédits", () => {
    for (const line of [
      "Ils décidèrent de partager la galette en deux.",
      "Mélangez la pâte à cookies avec les pépites de chocolat.",
      "Elle entra dans la librairie du village pour acheter un livre.",
      "Le manuscrit, écrit par Perrault en 1695, raconte l'histoire d'une petite fille qui traverse la forêt pour rendre visite à sa grand-mère malade.",
      "Il fait beau, il est midi.",
    ]) {
      expect(findPassages(line)[0].noise, line).toBeNull();
    }
  });

  test("dans un long paragraphe, seule la phrase parasite est ignorée", () => {
    const text =
      "Le loup frappa à la porte de la maison et la grand-mère lui ouvrit sans se méfier, car elle attendait sa petite-fille depuis le matin. Retrouvez d'autres contes sur www.contes-exemple.fr chaque semaine.";
    const passages = findPassages(text);
    expect(passages.filter((p) => p.ignored).map((p) => p.text)).toEqual(["Retrouvez d'autres contes sur www.contes-exemple.fr chaque semaine."]);
    expect(maskIgnored(text, passages)).toHaveLength(text.length);
  });

  test("le choix de l'utilisateur l'emporte", () => {
    const text = fixture("album-ours");
    const credits = findPassages(text).find((p) => p.text.startsWith("Texte de"))!;
    const story = findPassages(text).find((p) => p.text.startsWith("Ce soir"))!;
    const again = findPassages(text, { [credits.key]: false, [story.key]: true });
    expect(again.find((p) => p.key === credits.key)?.ignored).toBe(false);
    expect(again.find((p) => p.key === story.key)?.ignored).toBe(true);
  });
});

describe("analyse d'un document bruité", () => {
  test("les mots des passages ignorés ne sont ni proposés ni présélectionnés", () => {
    const { words } = analyzeDocument(fixture("album-ours"), lex, { guess: compromiseGuess });
    const lemmas = new Set(words.map((w) => w.lemma));
    for (const noise of ["éditions", "illustrations", "isbn", "licence", "lefèvre", "girard", "collection", "dépôt", "imprimé"]) {
      expect(lemmas.has(noise), noise).toBe(false);
    }
    const selected = words.filter((w) => w.selected).map((w) => w.lemma);
    for (const word of ["petit ours", "dormir", "forêt", "lit", "hibou"]) expect(selected, word).toContain(word);
  });

  test("un mot en début de ligne n'est pas un nom propre", () => {
    const { words } = analyzeDocument("Ingrédients\nÉtapes :\n1. Mélanger la farine.", lex, { guess: compromiseGuess });
    expect(words.find((w) => w.lemma === "étape")?.proper ?? false).toBe(false);
    expect(words.some((w) => w.proper)).toBe(false);
  });

  test("chaque occurrence est repérée dans le texte", () => {
    const text = "Le loup court. Le loup mange.";
    const loup = analyzeDocument(text, lex, { guess: compromiseGuess }).words.find((w) => w.lemma === "loup")!;
    expect(loup.spans?.map(([s, e]) => text.slice(s, e))).toEqual(["loup", "loup"]);
  });

  test("« temps » reste un mot entier, les mots de liaison ne sont pas proposés", () => {
    const { words } = analyzeDocument("Dans ce temps-là, une telle princesse était néanmoins la vôtre dès le matin.", lex, {
      guess: compromiseGuess,
    });
    const lemmas = words.map((w) => w.lemma);
    expect(lemmas).toContain("temps");
    for (const junk of ["temp", "tel", "néanmoin", "néanmoins", "vôtre", "dès"]) expect(lemmas, junk).not.toContain(junk);
  });

  test("« ne… point » n'est pas une carte « point »", () => {
    const { words } = analyzeDocument("Cette princesse n'aurait point d'esprit.", lex, { guess: compromiseGuess });
    expect(words.some((w) => w.lemma === "point")).toBe(false);
  });
});
