import { describe, expect, test } from "vitest";
import words from "an-array-of-french-words/index.json";
import { correctOcrText, knownWordCount, ocrPageText, type OcrBlocks } from "@/lib/ingest/ocr";
import underImage from "./fixtures/ocr-oie-texte-sous-image.json";
import spread from "./fixtures/ocr-oie-double-page.json";

const dict = new Set(words as string[]);
const isWord = (w: string) => dict.has(w);

describe("mise en forme OCR", () => {
  test("ignore ce que Tesseract lit dans l'illustration", () => {
    expect(ocrPageText(underImage as OcrBlocks)).toBe(
      "Il était une fois un troupeau d’oies qui vivait dans une ferme. Elles avaient toutes\n" +
        "le plumage blanc comme neige et le bec étincelant.\n" +
        "Enfin. sauf une.",
    );
  });

  test("double page : la colonne de gauche avant celle de droite, sans bruit", () => {
    const [left, right, ...rest] = ocrPageText(spread as OcrBlocks).split("\n\n");
    expect(rest).toEqual([]);
    expect(left.split("\n")).toEqual([
      "Cette petite oie-là se roulait dans la mare de gadove.",
      "Son plumage était Join d’être blanc",
      "et son bec était fout savf éfincelant.",
    ]);
    expect(right).toMatch(/^Le: avtres r’arrétaient pas de se moquer d’elle\.\nEh, regardez-la/);
  });
});

describe("correction OCR", () => {
  test("confusions u/v, t/f, l/J et accents des polices d'albums", () => {
    expect(correctOcrText("dans la mare de gadove, son bec était savf éfincelant, Join d'être blanc", isWord)).toBe(
      "dans la mare de gadoue, son bec était sauf étincelant, loin d'être blanc",
    );
    expect(correctOcrText("Les avtres r’arrétaient pas. Vne oie tremblait foujours.", isWord)).toBe(
      "Les autres r’arrêtaient pas. Une oie tremblait toujours.",
    );
    expect(correctOcrText("Lä, les oies menaïent la petite cie.", isWord)).toBe("Là, les oies menaient la petite oie.");
  });

  test("laisse les mots connus, noms propres et onomatopées", () => {
    const text = "Il vivait avec Jules. Wouuuuufff ! Ouh, la mare cra-cra !";
    expect(correctOcrText(text, isWord)).toBe(text);
  });

  test("compte les mots du dictionnaire", () => {
    expect(knownWordCount("Il était une fois 8 © a € F", isWord)).toBe(4);
  });
});
