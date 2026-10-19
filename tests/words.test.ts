import { describe, expect, test } from "vitest";
import type { WordItem } from "@/lib/types";
import { mergeWords } from "@/lib/words";

const word = (id: string, patch: Partial<WordItem> = {}): WordItem => ({
  id,
  lemma: id,
  label: id,
  category: "N",
  categoryLocked: false,
  candidates: [
    [1, "N"],
    [2, "N"],
  ],
  pictoId: 1,
  plural: false,
  noColor: false,
  forms: [id],
  count: 1,
  firstIndex: 0,
  example: "",
  known: true,
  proper: false,
  score: 1,
  selected: false,
  ...patch,
});

describe("nouvelle analyse du même document", () => {
  const prev = [
    word("loup", { selected: true, pictoId: 2, pictoChosen: true, label: "Le loup", count: 3 }),
    word("loup#2", { lemma: "loup", copyOf: "loup", selected: true }),
    word("galette", { selected: false }),
    word("chocolat", { selected: true, manual: true, firstIndex: Number.MAX_SAFE_INTEGER }),
  ];

  test("les choix sont gardés, les faits du texte mis à jour", () => {
    const fresh = [word("loup", { count: 5, firstIndex: 4 }), word("forêt", { selected: true, firstIndex: 9 })];
    const out = mergeWords(prev, fresh, { selectNew: false });
    expect(out.map((w) => w.id)).toEqual(["loup", "loup#2", "forêt", "chocolat"]);
    expect(out[0]).toMatchObject({ selected: true, pictoId: 2, pictoChosen: true, label: "Le loup", count: 5, firstIndex: 4 });
    // Mot nouveau : décoché, puisque l'utilisateur n'a rien demandé pour lui.
    expect(out[2].selected).toBe(false);
    // « galette » n'est plus dans le texte : il disparaît ; « chocolat », ajouté à la main, reste.
    expect(out.some((w) => w.id === "galette")).toBe(false);
  });

  test("après une retouche du texte, les mots nouveaux gardent la présélection", () => {
    const out = mergeWords(prev, [word("forêt", { selected: true })], { selectNew: true });
    expect(out.find((w) => w.id === "forêt")?.selected).toBe(true);
  });

  test("reprise d'un ancien projet : rien n'est retiré", () => {
    const out = mergeWords(prev, [word("loup")], { selectNew: false, keepMissing: true });
    expect(out.map((w) => w.id).sort()).toEqual(["chocolat", "galette", "loup", "loup#2"]);
  });
});
