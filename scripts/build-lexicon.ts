/**
 * Construit le lexique français hors-ligne utilisé par l'analyse sans IA.
 *
 *   pnpm lexicon            # télécharge le catalogue ARASAAC FR et régénère public/data/lexicon-fr.json
 *   pnpm lexicon --cache f  # réutilise un export local de /v1/pictograms/all/fr
 *
 * Sources :
 *  - ARASAAC (CC BY-NC-SA 4.0) : mots-clés, types, pluriels, catégories, étiquettes.
 *  - Lefff via french-verbs-lefff (LGPL-LR) : conjugaisons des verbes présents dans ARASAAC.
 *  - french-adjectives (Apache-2.0) : accords des adjectifs (féminin / pluriel).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { agree } from "french-adjectives";
import { classifyArasaac, type CategoryCode } from "../src/lib/categories";
import { normalizeKey } from "../src/lib/text";
import type { Lexicon } from "../src/lib/nlp/lexicon";

const require = createRequire(import.meta.url);
const conjugations: Record<string, Record<string, string[]>> = require("french-verbs-lefff/dist/conjugations.json");

interface ApiKeyword {
  keyword: string;
  type?: number;
  plural?: string;
}
interface ApiPictogram {
  _id: number;
  keywords: ApiKeyword[];
  categories: string[];
  tags: string[];
  sex?: boolean;
  violence?: boolean;
  schematic?: boolean;
}

async function loadCatalog(): Promise<ApiPictogram[]> {
  const cacheIdx = process.argv.indexOf("--cache");
  if (cacheIdx > -1) return JSON.parse(fs.readFileSync(process.argv[cacheIdx + 1], "utf8"));
  const res = await fetch("https://api.arasaac.org/v1/pictograms/all/fr");
  if (!res.ok) throw new Error(`ARASAAC a répondu ${res.status}`);
  return res.json();
}

// Temps de conjugaison Lefff utiles pour reconnaître un verbe dans un récit.
const TENSES = ["P", "S", "Y", "I", "G", "K", "J", "T", "F", "C"];

function verbForms(infinitive: string): string[] {
  const table = conjugations[infinitive];
  if (!table) return [];
  return TENSES.flatMap((t) => table[t] ?? []).filter((f) => f && f !== "NA");
}

function adjectiveForms(adj: string): string[] {
  const out = new Set<string>();
  for (const g of ["M", "F"] as const) {
    for (const n of ["S", "P"] as const) {
      try {
        out.add(agree(adj, g, n, null, false, undefined));
      } catch {
        // adjectif inconnu ou invariable : on garde la forme de base
      }
    }
  }
  return [...out];
}

const REFLEXIVE = /^(se |s')/;

async function main() {
  const catalog = await loadCatalog();
  const entries = new Map<string, { w: string; t: number; cands: { id: number; c: CategoryCode; rank: number }[] }>();
  const forms = new Map<string, Set<string>>();

  const addForm = (form: string, lemmaKey: string) => {
    const f = normalizeKey(form);
    if (!f || f === lemmaKey) return;
    if (!forms.has(f)) forms.set(f, new Set());
    forms.get(f)!.add(lemmaKey);
  };

  let kept = 0;
  for (const picto of catalog) {
    if (picto.sex || picto.violence) continue;
    kept++;
    picto.keywords.forEach((kw, position) => {
      const word = kw.keyword?.trim();
      if (!word) return;
      const key = normalizeKey(word);
      const c = classifyArasaac(kw.type, picto.categories ?? [], picto.tags ?? []);
      // Les pictogrammes schématiques (pictos « vides ») passent après les autres.
      const rank = position * 10 + (picto.schematic ? 5 : 0);
      if (!entries.has(key)) entries.set(key, { w: word, t: kw.type ?? 0, cands: [] });
      entries.get(key)!.cands.push({ id: picto._id, c, rank });

      if (kw.plural) addForm(kw.plural, key);
      if (kw.type === 3) {
        // Verbe simple ou locution verbale (« se brosser les dents ») : on conjugue le premier verbe.
        const reflexive = REFLEXIVE.test(key);
        const bare = key.replace(REFLEXIVE, "");
        const [head, ...rest] = bare.split(" ");
        const tail = rest.length ? " " + rest.join(" ") : "";
        for (const f of verbForms(head)) {
          addForm((reflexive ? "se " : "") + f + tail, key);
        }
      }
      if (kw.type === 4 && !key.includes(" ")) {
        for (const f of adjectiveForms(key)) addForm(f, key);
      }
    });
  }

  const out: Lexicon = {
    v: 1,
    built: new Date().toISOString(),
    pictogramCount: kept,
    entries: {},
    forms: {},
  };
  for (const [key, e] of [...entries].sort(([a], [b]) => a.localeCompare(b, "fr"))) {
    const seen = new Set<number>();
    const p = e.cands
      .sort((a, b) => a.rank - b.rank || a.id - b.id)
      .filter((x) => !seen.has(x.id) && seen.add(x.id))
      .map((x) => [x.id, x.c] as [number, CategoryCode]);
    out.entries[key] = { w: e.w, p, t: e.t };
  }
  for (const [f, lemmas] of [...forms].sort(([a], [b]) => a.localeCompare(b, "fr"))) {
    // Une forme qui est elle-même un mot-clé reste reconnue directement : on garde quand même
    // l'alternative pour pouvoir lever l'ambiguïté (« ferme » nom / « ferme » verbe).
    out.forms[f] = [...lemmas].join("|");
  }

  const target = path.join(process.cwd(), "public/data/lexicon-fr.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(out));
  const size = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
  console.log(
    `Lexique : ${Object.keys(out.entries).length} mots-clés, ${Object.keys(out.forms).length} formes fléchies, ${kept} pictogrammes → ${target} (${size} Mo)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
