import { describe, expect, test } from "vitest";
import { extractFromHtml } from "@/lib/ingest/web";
import { cleanExtractedText } from "@/lib/ingest";

describe("extraction web", () => {
  test("recette schema.org (dans @graph, étapes HowToStep)", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "x" },
        {
          "@type": ["Recipe"],
          name: "Pâte à crêpes",
          recipeIngredient: ["250 g de farine", "4 œufs"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Mettre la farine dans un saladier." },
            { "@type": "HowToStep", text: "Ajouter les œufs." },
          ],
        },
      ],
    })}</script></head><body><p>Pub</p></body></html>`;
    const r = extractFromHtml(html, "https://exemple.fr/crepes");
    expect(r?.kind).toBe("recipe");
    expect(r?.text).toContain("- 250 g de farine");
    expect(r?.text).toContain("2. Ajouter les œufs.");
  });

  test("article : texte principal sans le menu", () => {
    const para = "Le petit ours brun se promène dans la forêt avec sa maman. ".repeat(12);
    const html = `<html><head><title>Conte</title></head><body><nav>Accueil Contact</nav><article><h1>L'ours</h1><p>${para}</p><p>${para}</p></article><footer>Mentions</footer></body></html>`;
    const r = extractFromHtml(html, "https://exemple.fr/conte");
    expect(r?.kind).toBe("article");
    expect(r?.text).toContain("petit ours brun");
    expect(r?.text).not.toContain("Mentions");
  });
});

test("nettoyage : mots coupés en fin de ligne recollés", () => {
  expect(cleanExtractedText("Le loup man-\ngeait  la   galette.\n\n\n\nFin")).toBe("Le loup mangeait la galette.\n\nFin");
});
