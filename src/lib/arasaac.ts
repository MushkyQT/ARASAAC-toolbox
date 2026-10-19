import { classifyArasaac, type CategoryCode } from "@/lib/categories";
import { normalizeKey } from "@/lib/text";

export const ARASAAC_API = "https://api.arasaac.org/v1";
const STATIC = "https://static.arasaac.org/pictograms";

/** Mention légale obligatoire (texte officiel ARASAAC en français), affichée en pied de page. */
export const ARASAAC_CREDIT =
  "Pictogrammes : Sergio Palao. Origine : ARASAAC (https://arasaac.org). Licence : CC (BY-NC-SA). Propriété : Gouvernement d'Aragon (Espagne).";

/** Version longue de la mention, imprimée sur chaque export. */
export const ARASAAC_CREDIT_LONG =
  "Les symboles pictographiques utilisés sont la propriété du Gouvernement d'Aragon et ont été créés par Sergio Palao pour ARASAAC (https://arasaac.org), qui les distribuent sous Licence Creative Commons BY-NC-SA.";

export interface PictoVariant {
  plural?: boolean;
  noColor?: boolean;
  resolution?: 300 | 500 | 2500;
}

/** URL de l'image PNG d'un pictogramme (variantes pluriel / noir et blanc générées par l'API). */
export function pictoImageUrl(id: number, v: PictoVariant = {}): string {
  const resolution = v.resolution ?? 500;
  if (!v.plural && !v.noColor && resolution !== 2500) return `${STATIC}/${id}/${id}_${resolution}.png`;
  const params = new URLSearchParams({ resolution: String(resolution) });
  if (v.plural) params.set("plural", "true");
  if (v.noColor) params.set("color", "false");
  return `${ARASAAC_API}/pictograms/${id}?${params}`;
}

export interface SearchResult {
  id: number;
  keyword: string;
  category: CategoryCode;
}

interface ApiPicto {
  _id: number;
  keywords: { keyword: string; type?: number }[];
  categories?: string[];
  tags?: string[];
  sex?: boolean;
  violence?: boolean;
}

/** Recherche libre dans ARASAAC (pour les mots inconnus ou un autre choix de pictogramme). */
export async function searchPictograms(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`${ARASAAC_API}/pictograms/fr/search/${encodeURIComponent(q)}`, { signal });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`ARASAAC indisponible (${res.status})`);
  const data = (await res.json()) as ApiPicto[];
  return data
    .filter((p) => !p.sex && !p.violence)
    .map((p) => {
      const kw = p.keywords.find((k) => k.keyword.toLocaleLowerCase("fr") === q.toLocaleLowerCase("fr")) ?? p.keywords[0];
      return {
        id: p._id,
        keyword: kw?.keyword ?? q,
        category: classifyArasaac(kw?.type, p.categories ?? [], p.tags ?? []),
      };
    });
}

const keywordCache = new Map<number, Promise<string[]>>();

/** Mots-clés d'un pictogramme (affichés au survol pour distinguer les sens : avocat fruit / métier). */
export function pictoKeywords(id: number): Promise<string[]> {
  if (!keywordCache.has(id)) {
    keywordCache.set(
      id,
      fetch(`${ARASAAC_API}/pictograms/fr/${id}`)
        .then((r) => (r.ok ? r.json() : { keywords: [] }))
        .then((p: ApiPicto) => p.keywords.map((k) => k.keyword))
        .catch(() => []),
    );
  }
  return keywordCache.get(id)!;
}

const hintCache = new Map<string, Promise<Map<number, string[]>>>();

/**
 * Autres mots-clés de chaque pictogramme d'un mot, pour en distinguer les sens
 * (« mélanger » → remuer, battre, fouetter…). Une seule recherche par mot.
 */
export function senseHints(lemma: string): Promise<Map<number, string[]>> {
  const key = normalizeKey(lemma);
  if (!hintCache.has(key)) {
    hintCache.set(
      key,
      fetch(`${ARASAAC_API}/pictograms/fr/search/${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: ApiPicto[]) => {
          const out = new Map<number, string[]>();
          for (const p of data) {
            const keywords = p.keywords.map((k) => k.keyword);
            if (!keywordCache.has(p._id)) keywordCache.set(p._id, Promise.resolve(keywords));
            out.set(p._id, keywords.filter((k) => normalizeKey(k) !== key));
          }
          return out;
        })
        .catch(() => {
          hintCache.delete(key);
          return new Map<number, string[]>();
        }),
    );
  }
  return hintCache.get(key)!;
}
