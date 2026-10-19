// Sauvegarde locale (IndexedDB) : le travail en cours et les choix de pictogrammes par mot.
import { createStore, get, set, del } from "idb-keyval";
import type { CategoryCode } from "@/lib/categories";
import { DEFAULT_SETTINGS, type CardSettings, type WordItem } from "@/lib/types";

export interface Project {
  title: string;
  text: string;
  words: WordItem[];
  settings: CardSettings;
  updatedAt: number;
}

export function emptyProject(settings: CardSettings = DEFAULT_SETTINGS): Project {
  return { title: "", text: "", words: [], settings, updatedAt: 0 };
}

/** Ce qui est mémorisé pour un mot d'un texte à l'autre (« loup » → toujours ce pictogramme-là). */
export interface BankEntry {
  pictoId: number | null;
  pictoChosen?: boolean;
  label: string;
  category: CategoryCode;
  categoryLocked: boolean;
  plural: boolean;
  noColor: boolean;
  customImage?: string;
}

const isBrowser = typeof indexedDB !== "undefined";
const store = isBrowser ? createStore("atelier-pictos", "data") : undefined;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!store) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const loadProject = () => safe(() => get<Project>("project", store), undefined);
export const saveProject = (p: Project) => safe(() => set("project", p, store), undefined);
export const clearProject = () => safe(() => del("project", store), undefined);

export const loadBank = () => safe(async () => (await get<Record<string, BankEntry>>("bank", store)) ?? {}, {});

export async function rememberWord(w: WordItem) {
  await safe(async () => {
    const bank = (await get<Record<string, BankEntry>>("bank", store)) ?? {};
    bank[w.lemma] = {
      pictoId: w.pictoId,
      pictoChosen: w.pictoChosen,
      label: w.label,
      category: w.category,
      categoryLocked: w.categoryLocked,
      plural: w.plural,
      noColor: w.noColor,
      customImage: w.customImage,
    };
    await set("bank", bank, store);
  }, undefined);
}

export async function forgetBank() {
  await safe(() => del("bank", store), undefined);
}

/** Réapplique les choix mémorisés aux mots d'une nouvelle analyse. */
export function applyBank(words: WordItem[], bank: Record<string, BankEntry>): WordItem[] {
  return words.map((w) => {
    const b = bank[w.lemma];
    if (!b) return w;
    const candidates =
      b.pictoId !== null && !w.candidates.some(([id]) => id === b.pictoId)
        ? ([[b.pictoId, b.category], ...w.candidates] as WordItem["candidates"])
        : w.candidates;
    return {
      ...w,
      candidates,
      pictoId: b.pictoId,
      // Entrées mémorisées avant l'existence du champ : on suppose le pictogramme choisi.
      pictoChosen: b.pictoChosen ?? true,
      label: b.label,
      category: b.category,
      categoryLocked: b.categoryLocked,
      plural: b.plural,
      noColor: b.noColor,
      customImage: b.customImage,
    };
  });
}
