import { describe, expect, test } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import { buildCardsPptx } from "@/lib/cards/pptx";
import { measurerFromFont } from "@/lib/cards/measure";
import { DEFAULT_SETTINGS } from "@/lib/types";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const measure = measurerFromFont(fs.readFileSync("public/fonts/OpenSans-Regular.ttf"));
const cards = ["FORÊT", "POMME DE TERRE", "LOUP", "ÉCOLE", "MANGER", "HIER", "GARÇON"].map((label, i) => ({
  id: String(i),
  label,
  color: "#C21AE5",
  imageUrl: "x",
  pictoId: i,
}));

describe("PPTX (Canva)", () => {
  test("planches A4 : 7 cartes → 2 diapositives, textes éditables avec accents", async () => {
    const blob = await buildCardsPptx({ cards, settings: DEFAULT_SETTINGS, measure, loadImageDataUrl: async () => PNG, mode: "sheet" });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(2);
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(xml).toContain("FORÊT");
    expect(xml).toContain("Open Sans");
    expect(xml).toContain("C21AE5");
    const pres = await zip.file("ppt/presentation.xml")!.async("string");
    // A4 portrait en EMU : 210 mm × 297 mm.
    expect(pres).toMatch(/cx="7560\d{3}"/);
  });

  test("une carte par page : diapositive carrée de 8 cm + page de crédits", async () => {
    const blob = await buildCardsPptx({ cards, settings: DEFAULT_SETTINGS, measure, loadImageDataUrl: async () => PNG, mode: "single" });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(cards.length + 1);
    const pres = await zip.file("ppt/presentation.xml")!.async("string");
    expect(pres).toMatch(/cx="2880\d{3}" cy="2880\d{3}"/);
  });
});
