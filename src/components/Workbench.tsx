"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { searchPictograms } from "@/lib/arasaac";
import { pageGrid } from "@/lib/cards/layout";
import { FONTS, fontUrl, toCardSpecs } from "@/lib/cards/model";
import { useFontMeasure } from "@/lib/cards/useMeasure";
import { lemmaCandidates, loadLexicon } from "@/lib/nlp/lexicon";
import {
  applyBank,
  clearProject,
  emptyProject,
  loadBank,
  loadProject,
  rememberWord,
  saveProject,
  type Project,
} from "@/lib/store";
import { senseCopy } from "@/lib/senses";
import { normalizeKey } from "@/lib/text";
import type { CardSettings, WordItem } from "@/lib/types";
import { ExportPanel } from "./ExportPanel";
import { SheetPreview } from "./SheetPreview";
import { SourcePanel } from "./SourcePanel";
import { WordBoard } from "./WordBoard";

type Action =
  | { type: "load"; project: Project }
  | { type: "text"; text: string; title?: string }
  | { type: "words"; words: WordItem[] }
  | { type: "update"; id: string; patch: Partial<WordItem> }
  | { type: "selectAll"; selected: boolean; ids?: string[] }
  | { type: "add"; word: WordItem; after?: string }
  | { type: "remove"; id: string }
  | { type: "settings"; patch: Partial<CardSettings> }
  | { type: "reset" };

function reducer(state: Project, action: Action): Project {
  const next = (p: Partial<Project>): Project => ({ ...state, ...p, updatedAt: Date.now() });
  switch (action.type) {
    case "load":
      return action.project;
    case "text":
      return next({ text: action.text, ...(action.title !== undefined ? { title: action.title } : {}) });
    case "words":
      return next({ words: action.words });
    case "update":
      return next({ words: state.words.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)) });
    case "selectAll":
      return next({
        words: state.words.map((w) => (!action.ids || action.ids.includes(w.id) ? { ...w, selected: action.selected } : w)),
      });
    case "add": {
      const at = state.words.findIndex((w) => w.id === action.after);
      if (at === -1) return next({ words: [...state.words, action.word] });
      return next({ words: [...state.words.slice(0, at + 1), action.word, ...state.words.slice(at + 1)] });
    }
    case "remove":
      return next({ words: state.words.filter((w) => w.id !== action.id) });
    case "settings":
      return next({ settings: { ...state.settings, ...action.patch } });
    case "reset":
      return emptyProject(state.settings);
  }
}

// Champs qui méritent d'être mémorisés pour les prochains textes.
const REMEMBERED: (keyof WordItem)[] = ["pictoId", "pictoChosen", "label", "category", "plural", "noColor", "customImage"];

export function Workbench() {
  const [project, dispatch] = useReducer(reducer, undefined, () => emptyProject());
  const [ready, setReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState(true);
  const wordsRef = useRef<HTMLDivElement>(null);

  // Reprise du travail précédent.
  useEffect(() => {
    loadProject().then((p) => {
      if (p) {
        dispatch({ type: "load", project: p });
        if (p.words.length) setEditingSource(false);
      }
      setReady(true);
    });
  }, []);

  // Sauvegarde automatique.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => saveProject(project), 400);
    return () => clearTimeout(t);
  }, [project, ready]);

  // Le lexique (≈ 700 Ko compressé) est préchargé pendant que l'on colle le texte.
  useEffect(() => {
    loadLexicon().catch(() => {});
  }, []);

  const analyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const [lex, { analyzeText }, { compromiseGuess }, bank] = await Promise.all([
        loadLexicon(),
        import("@/lib/nlp/analyze"),
        import("@/lib/nlp/guess"),
        loadBank(),
      ]);
      const words = applyBank(analyzeText(project.text, lex, { guess: compromiseGuess }), bank);
      dispatch({ type: "words", words });
      setEditingSource(false);
      requestAnimationFrame(() => wordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'analyse a échoué.");
    } finally {
      setAnalyzing(false);
    }
  }, [project.text]);

  const update = useCallback(
    (id: string, patch: Partial<WordItem>) => {
      dispatch({ type: "update", id, patch });
      if (REMEMBERED.some((k) => k in patch)) {
        const w = project.words.find((x) => x.id === id);
        // Les copies (autre sens) ne remplacent pas le choix mémorisé pour le mot.
        if (w && !w.copyOf) rememberWord({ ...w, ...patch });
      }
    },
    [project.words],
  );

  const add = useCallback(
    async (input: string): Promise<string | null> => {
      const key = normalizeKey(input);
      if (!key) return null;
      const lex = await loadLexicon();
      const lemma = lemmaCandidates(lex, key)[0] ?? key;
      const existing = project.words.find((w) => w.lemma === lemma);
      if (existing) {
        update(existing.id, { selected: true });
        return null;
      }
      const entry = lex.entries[lemma];
      let candidates: WordItem["candidates"] = entry?.p ?? [];
      if (!candidates.length) {
        const found = await searchPictograms(key).catch(() => []);
        candidates = found.slice(0, 12).map((r) => [r.id, r.category]);
      }
      dispatch({
        type: "add",
        word: {
          id: lemma,
          lemma,
          label: entry?.w ?? input.trim(),
          category: candidates[0]?.[1] ?? "N",
          categoryLocked: false,
          candidates,
          pictoId: candidates[0]?.[0] ?? null,
          plural: false,
          noColor: false,
          forms: [input.trim()],
          count: 0,
          firstIndex: Number.MAX_SAFE_INTEGER,
          example: "",
          known: Boolean(entry),
          proper: false,
          score: 0,
          selected: true,
        },
      });
      return candidates.length ? null : "Aucun pictogramme trouvé : la carte sera sans image (vous pouvez ajouter la vôtre).";
    },
    [project.words, update],
  );

  const addSense = useCallback(
    (id: string): string | null => {
      const w = project.words.find((x) => x.id === id);
      if (!w) return null;
      const copy = senseCopy(w, project.words);
      dispatch({ type: "add", word: copy, after: id });
      return copy.id;
    },
    [project.words],
  );

  const cards = useMemo(() => toCardSpecs(project.words, project.settings), [project.words, project.settings]);
  const fontFamily = `Carte ${FONTS[project.settings.font].canva}${project.settings.bold ? " Bold" : ""}`;
  const measure = useFontMeasure(fontFamily, fontUrl(project.settings), project.settings.bold);
  const perPage = pageGrid(project.settings.sizeMm).perPage;

  return (
    <div className="flex flex-col gap-10">
      {editingSource || project.words.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <SourcePanel
            text={project.text}
            onText={(text, title) => dispatch({ type: "text", text, title })}
            onAnalyze={analyze}
            analyzing={analyzing}
          />
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-stone-200 bg-white px-6 py-4 shadow-sm">
          <p className="min-w-0 truncate text-sm font-medium text-stone-900">{project.title || "Sans titre"}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingSource(true)}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm hover:bg-stone-50"
            >
              Modifier
            </button>
            <button
              onClick={() => {
                if (!confirm("Nouveau document ?")) return;
                dispatch({ type: "reset" });
                clearProject();
                setEditingSource(true);
              }}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm hover:bg-stone-50"
            >
              Nouveau
            </button>
          </div>
        </div>
      )}

      {project.words.length > 0 && (
        <div ref={wordsRef} className="grid scroll-mt-6 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
          <WordBoard
            words={project.words}
            perPage={perPage}
            onUpdate={update}
            onSelectAll={(selected, ids) => dispatch({ type: "selectAll", selected, ids })}
            onAdd={add}
            onAddSense={addSense}
            onRemove={(id) => dispatch({ type: "remove", id })}
          />
          <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <ExportPanel
                cards={cards}
                settings={project.settings}
                onSettings={(patch) => dispatch({ type: "settings", patch })}
                title={project.title}
              />
            </div>
            <SheetPreview cards={cards} settings={project.settings} measure={measure} fontFamily={fontFamily} />
          </aside>
        </div>
      )}
    </div>
  );
}
