import { describe, expect, test } from "vitest";
import { choosePicto, hasChoices, needsReview, senseCopy, splitOnForms, visibleChoices } from "@/lib/senses";
import { applyBank } from "@/lib/store";
import type { WordItem } from "@/lib/types";

// « mélanger » : un condiment, à la cuillère, en cuisine, au fouet, des cartes, au batteur.
const melanger: WordItem = {
  id: "mélanger",
  lemma: "mélanger",
  label: "mélanger",
  category: "V",
  categoryLocked: false,
  candidates: [
    [5515, "V"],
    [5981, "V"],
    [7162, "V"],
    [25738, "V"],
    [39495, "V"],
    [5924, "V"],
  ],
  pictoId: 5515,
  plural: false,
  noColor: false,
  forms: ["mélangez", "mélange"],
  count: 2,
  firstIndex: 4,
  example: "Mélangez la farine et les œufs.",
  known: true,
  proper: false,
  score: 1,
  selected: true,
};

describe("mots à plusieurs images", () => {
  test("un mot imprimé dont l'image a été prise par défaut est à vérifier", () => {
    expect(hasChoices(melanger)).toBe(true);
    expect(needsReview(melanger)).toBe(true);
    expect(needsReview({ ...melanger, pictoChosen: true })).toBe(false);
    expect(needsReview({ ...melanger, selected: false })).toBe(false);
    expect(needsReview({ ...melanger, customImage: "data:image/png;base64," })).toBe(false);
    expect(needsReview({ ...melanger, candidates: [[5515, "V"]] })).toBe(false);
  });

  test("choisir une image la marque comme choisie, la couleur suit sauf si elle est fixée", () => {
    expect(choosePicto(melanger, 39495, "N")).toEqual({
      pictoId: 39495,
      pictoChosen: true,
      customImage: undefined,
      category: "N",
    });
    expect(choosePicto({ ...melanger, categoryLocked: true }, 39495, "N")).not.toHaveProperty("category");
  });

  test("le raccourci garde toujours l'image retenue", () => {
    expect(visibleChoices(melanger, 4).map(([id]) => id)).toEqual([5515, 5981, 7162, 25738]);
    expect(visibleChoices({ ...melanger, pictoId: 5924 }, 4).map(([id]) => id)).toEqual([5515, 5981, 7162, 5924]);
    expect(visibleChoices({ ...melanger, pictoId: null }, 4)).toHaveLength(4);
  });

  test("le mot est repéré dans la phrase d'exemple, majuscules et accents compris", () => {
    expect(splitOnForms(melanger.example, ["mélanger", ...melanger.forms])).toEqual([
      ["Mélangez", true],
      [" la farine et les œufs.", false],
    ]);
    // « mélange » ne doit pas être surligné à l'intérieur de « mélangeur ».
    expect(splitOnForms("Le mélangeur tourne.", ["mélange"])).toEqual([["Le mélangeur tourne.", false]]);
  });

  test("un choix mémorisé n'est plus à vérifier dans le texte suivant", () => {
    const [w] = applyBank([melanger], {
      mélanger: {
        pictoId: 39495,
        pictoChosen: true,
        label: "mélanger",
        category: "V",
        categoryLocked: false,
        plural: false,
        noColor: false,
      },
    });
    expect(w.pictoId).toBe(39495);
    expect(needsReview(w)).toBe(false);
  });
});

describe("même mot, deux sens", () => {
  // « L'avocat mange un avocat » : le métier, puis le fruit.
  const avocat: WordItem = {
    ...melanger,
    id: "avocat",
    lemma: "avocat",
    label: "avocat",
    category: "P",
    categoryLocked: true,
    candidates: [
      [2636, "P"],
      [8009, "N"],
      [39079, "P"],
    ],
    pictoId: 2636,
    pictoChosen: true,
  };

  test("la copie prend une image encore libre et sa couleur", () => {
    const copy = senseCopy(avocat, [avocat]);
    expect(copy).toMatchObject({
      id: "avocat#2",
      copyOf: "avocat",
      pictoId: 8009,
      category: "N",
      categoryLocked: false,
      selected: true,
    });
    expect(needsReview(copy)).toBe(true);
  });

  test("une troisième carte a un id unique et une autre image", () => {
    const second = senseCopy(avocat, [avocat]);
    const third = senseCopy(second, [avocat, second]);
    expect(third).toMatchObject({ id: "avocat#3", copyOf: "avocat", pictoId: 39079 });
  });
});
