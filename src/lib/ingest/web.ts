// Extraction du texte utile d'une page web (côté serveur).
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export interface WebExtraction {
  kind: "recipe" | "article";
  title: string;
  text: string;
}

type Json = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function isRecipe(node: Json) {
  return asArray(node["@type"] as string | string[]).some((t) => String(t).toLowerCase() === "recipe");
}

function findRecipe(data: unknown): Json | null {
  for (const node of asArray(data as Json | Json[])) {
    if (!node || typeof node !== "object") continue;
    if (isRecipe(node)) return node;
    const nested = findRecipe((node as Json)["@graph"]);
    if (nested) return nested;
  }
  return null;
}

function stepsToText(instructions: unknown): string[] {
  const out: string[] = [];
  for (const step of asArray(instructions as unknown[])) {
    if (typeof step === "string") out.push(step);
    else if (step && typeof step === "object") {
      const s = step as Json;
      if (s["@type"] === "HowToSection") out.push(...stepsToText(s.itemListElement));
      else if (typeof s.text === "string") out.push(s.text);
      else if (typeof s.name === "string") out.push(s.name);
    }
  }
  return out.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Recette décrite en schema.org (Marmiton, 750g, la plupart des blogs de cuisine). */
export function extractRecipe(html: string): WebExtraction | null {
  const { document } = parseHTML(html);
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? "");
    } catch {
      continue;
    }
    const recipe = findRecipe(data);
    if (!recipe) continue;
    const title = String(recipe.name ?? "Recette");
    const ingredients = asArray(recipe.recipeIngredient as string[]).map((s) => `- ${String(s).trim()}`);
    const steps = stepsToText(recipe.recipeInstructions).map((s, i) => `${i + 1}. ${s}`);
    const text = [title, "", "Ingrédients :", ...ingredients, "", "Étapes :", ...steps].join("\n");
    return { kind: "recipe", title, text };
  }
  return null;
}

export function extractArticle(html: string, url: string): WebExtraction | null {
  const { document } = parseHTML(html);
  // Readability a besoin de l'URL du document pour résoudre les liens relatifs.
  Object.defineProperty(document, "documentURI", { value: url });
  const article = new Readability(document as unknown as Document).parse();
  const text = (article?.textContent ?? "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;
  return { kind: "article", title: article?.title ?? "", text };
}

export function extractFromHtml(html: string, url: string): WebExtraction | null {
  return extractRecipe(html) ?? extractArticle(html, url);
}
