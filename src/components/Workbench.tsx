"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { searchPictograms } from "@/lib/arasaac";
import { pageGrid } from "@/lib/cards/layout";
import { FONTS, fontUrl, toCardSpecs } from "@/lib/cards/model";
import { useFontMeasure } from "@/lib/cards/useMeasure";
import { lemmaCandidates, loadLexicon } from "@/lib/nlp/lexicon";
import { findPassages } from "@/lib/nlp/passages";
import { needsReview, senseCopy } from "@/lib/senses";
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
import { canonicalText, normalizeKey, toCardLabel } from "@/lib/text";
import type { CardSettings, WordItem } from "@/lib/types";
import { mergeWords } from "@/lib/words";
import { ExportPanel } from "./ExportPanel";
import { PictoPicker } from "./PictoPicker";
import { SheetPreview } from "./SheetPreview";
import { SourcePanel } from "./SourcePanel";
import { SourceSummary } from "./SourceSummary";
import { Stepper, type StepState } from "./Stepper";
import { Toast, type ToastMessage } from "./Toast";
import { WordBoard, type BoardView } from "./WordBoard";

type Action =
  | { type: "load"; project: Project }
  | { type: "text"; text: string; title?: string }
  | { type: "title"; title: string }
  | { type: "words"; words: WordItem[] }
  | { type: "update"; id: string; patch: Partial<WordItem> }
  | { type: "select"; ids: string[]; selected: boolean }
  | { type: "add"; word: WordItem; after?: string }
  | { type: "remove"; id: string }
  | { type: "settings"; patch: Partial<CardSettings> }
  | { type: "passages"; passages: Record<string, boolean>; words: WordItem[] }
  | { type: "reset" };

function reducer(state: Project, action: Action): Project {
  const next = (p: Partial<Project>): Project => ({ ...state, ...p, updatedAt: Date.now() });
  switch (action.type) {
    case "load":
      return action.project;
    case "text":
      return next({ text: action.text, ...(action.title !== undefined ? { title: action.title } : {}) });
    case "title":
      return next({ title: action.title });
    case "words":
      return next({ words: action.words });
    case "update":
      return next({ words: state.words.map((w) => (w.id === action.id ? { ...w, ...action.patch } : w)) });
    case "select": {
      const ids = new Set(action.ids);
      return next({ words: state.words.map((w) => (ids.has(w.id) ? { ...w, selected: action.selected } : w)) });
    }
    case "add": {
      const at = state.words.findIndex((w) => w.id === action.after);
      if (at === -1) return next({ words: [...state.words, action.word] });
      return next({ words: [...state.words.slice(0, at + 1), action.word, ...state.words.slice(at + 1)] });
    }
    case "remove":
      return next({ words: state.words.filter((w) => w.id !== action.id) });
    case "settings":
      return next({ settings: { ...state.settings, ...action.patch } });
    case "passages":
      return next({ passages: action.passages, words: action.words });
    case "reset":
      return emptyProject(state.settings);
  }
}

// Champs qui méritent d'être mémorisés pour les prochains textes.
const REMEMBERED: (keyof WordItem)[] = ["pictoId", "pictoChosen", "label", "category", "plural", "noColor", "customImage"];

const countWords = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
const quoted = (w: WordItem) => `« ${toCardLabel(w.label)} »`;

/** Analyse le texte (passages ignorés compris) et fusionne le résultat avec les mots déjà choisis. */
async function analyzeProject(
  text: string,
  overrides: Record<string, boolean>,
  prev: WordItem[],
  options: { selectNew: boolean; keepMissing?: boolean },
): Promise<WordItem[]> {
  const [lex, { analyzeDocument }, { compromiseGuess }, bank] = await Promise.all([
    loadLexicon(),
    import("@/lib/nlp/document"),
    import("@/lib/nlp/guess"),
    loadBank(),
  ]);
  const fresh = applyBank(analyzeDocument(text, lex, { guess: compromiseGuess, overrides }).words, bank);
  return prev.length ? mergeWords(prev, fresh, options) : fresh;
}

export function Workbench() {
  const [project, dispatch] = useReducer(reducer, undefined, () => emptyProject());
  const [ready, setReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState(true);
  const [view, setView] = useState<BoardView>("list");
  const [openId, setOpenId] = useState<string | null>(null);
  // Revue des mots à plusieurs images : la liste est figée au lancement pour pouvoir revenir en arrière.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  // Dernier état connu, pour les opérations asynchrones (une nouvelle analyse peut finir après un clic).
  const latest = useRef(project);
  useEffect(() => {
    latest.current = project;
  }, [project]);

  /** Message en bas de l'écran, avec la possibilité de revenir à l'état d'avant. */
  const notify = useCallback((text: string, undoable = true) => {
    setToast({ id: Date.now(), text, undo: undoable ? latest.current : undefined });
  }, []);

  // Reprise du travail précédent.
  useEffect(() => {
    loadProject().then(async (p) => {
      if (p) {
        dispatch({ type: "load", project: { ...p, passages: p.passages ?? {} } });
        if (p.words.length) setEditingSource(false);
        // Projet enregistré avant la vue « Dans le texte » : on retrouve la position des mots sans rien retirer.
        if (p.text && p.words.some((w) => !w.manual && w.count > 0 && !w.spans)) {
          const words = await analyzeProject(p.text, p.passages ?? {}, p.words, { selectNew: false, keepMissing: true }).catch(
            () => null,
          );
          if (words) dispatch({ type: "words", words });
        }
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
      const p = latest.current;
      const words = await analyzeProject(p.text, p.passages ?? {}, p.words, { selectNew: true });
      dispatch({ type: "words", words });
      // Texte collé sans titre : sa première ligne, si elle ressemble à un titre, nomme le document.
      if (!p.title.trim()) {
        const first = findPassages(p.text, p.passages ?? {}).find((x) => !x.ignored)?.text.split("\n")[0].trim();
        if (first && first.length <= 70 && !/[.!?…:;]$/.test(first)) dispatch({ type: "title", title: first });
      }
      setEditingSource(false);
      requestAnimationFrame(() => wordsRef.current?.scrollIntoView({ block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'analyse a échoué.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  /** Ignore ou réintègre un passage du texte, puis met la liste de mots à jour. */
  const setPassages = useCallback(
    async (keys: string[], ignored: boolean) => {
      const before = latest.current;
      const passages = { ...(before.passages ?? {}), ...Object.fromEntries(keys.map((k) => [k, ignored])) };
      const many = keys.length > 1 ? "Passages" : "Passage";
      try {
        const words = await analyzeProject(before.text, passages, latest.current.words, { selectNew: false });
        const added = words.filter((w) => !before.words.some((b) => b.id === w.id)).length;
        const removed = before.words.filter((b) => !words.some((w) => w.id === b.id)).length;
        notify(
          ignored
            ? `${many} ignoré${keys.length > 1 ? "s" : ""}${removed ? ` : ${removed} mot${removed > 1 ? "s" : ""} retiré${removed > 1 ? "s" : ""} de la liste` : ""}.`
            : `${many} inclus${added ? ` : ${added} mot${added > 1 ? "s" : ""} de plus dans la liste` : ""}.`,
        );
        dispatch({ type: "passages", passages, words });
      } catch (e) {
        setError(e instanceof Error ? e.message : "L'analyse a échoué.");
      }
    },
    [notify],
  );

  const update = useCallback((id: string, patch: Partial<WordItem>) => {
    dispatch({ type: "update", id, patch });
    if (REMEMBERED.some((k) => k in patch)) {
      const w = latest.current.words.find((x) => x.id === id);
      // Les copies (autre sens) ne remplacent pas le choix mémorisé pour le mot.
      if (w && !w.copyOf) rememberWord({ ...w, ...patch });
    }
  }, []);

  const select = useCallback(
    (ids: string[], selected: boolean) => {
      if (!ids.length) return;
      if (!selected) {
        const first = latest.current.words.find((w) => w.id === ids[0]);
        notify(ids.length === 1 && first ? `${quoted(first)} retiré de la planche.` : `${ids.length} cartes retirées de la planche.`);
      }
      dispatch({ type: "select", ids, selected });
    },
    [notify],
  );

  /** Retire une carte de la planche ; une carte « autre sens » disparaît, le mot lui-même reste proposé. */
  const removeCard = useCallback(
    (id: string) => {
      const w = latest.current.words.find((x) => x.id === id);
      if (!w) return;
      if (w.copyOf) {
        notify(`Carte ${quoted(w)} (autre sens) supprimée.`);
        dispatch({ type: "remove", id });
      } else {
        select([id], false);
      }
      if (openId === id) setOpenId(null);
    },
    [notify, select, openId],
  );

  const add = useCallback(
    async (input: string): Promise<string | null> => {
      const key = normalizeKey(input);
      if (!key) return null;
      const lex = await loadLexicon();
      const lemma = lemmaCandidates(lex, key)[0] ?? key;
      const existing = latest.current.words.find((w) => w.lemma === lemma && !w.copyOf);
      if (existing) {
        if (existing.selected) return `${quoted(existing)} est déjà sur la planche.`;
        dispatch({ type: "select", ids: [existing.id], selected: true });
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
          manual: true,
        },
      });
      return candidates.length ? null : "Aucun pictogramme trouvé : la carte sera sans image (vous pouvez ajouter la vôtre).";
    },
    [],
  );

  const addSense = useCallback((id: string) => {
    const w = latest.current.words.find((x) => x.id === id);
    if (!w) return;
    const copy = senseCopy(w, latest.current.words);
    dispatch({ type: "add", word: copy, after: id });
    // La nouvelle carte s'ouvre aussitôt pour choisir son image.
    setQueue(null);
    setOpenId(copy.id);
  }, []);

  const newDocument = useCallback(() => {
    notify("Nouveau document commencé.");
    dispatch({ type: "reset" });
    clearProject();
    setEditingSource(true);
    setView("list");
    setOpenId(null);
  }, [notify]);

  const words = project.words;
  const text = useMemo(() => canonicalText(project.text), [project.text]);
  const passages = useMemo(
    () => (words.length ? findPassages(text, project.passages ?? {}) : []),
    [text, project.passages, words.length],
  );
  const cards = useMemo(() => toCardSpecs(words, project.settings), [words, project.settings]);
  const fontFamily = `Carte ${FONTS[project.settings.font].canva}${project.settings.bold ? " Bold" : ""}`;
  const measure = useFontMeasure(fontFamily, fontUrl(project.settings), project.settings.bold);
  const perPage = pageGrid(project.settings.sizeMm).perPage;
  const pages = Math.ceil(cards.length / perPage);
  const toReview = words.filter(needsReview);

  const open = words.find((w) => w.id === openId);
  const position = queue && openId ? queue.indexOf(openId) : -1;
  function goTo(index: number) {
    if (!queue || index < 0) return;
    if (index >= queue.length) {
      setQueue(null);
      setOpenId(null);
    } else {
      setOpenId(queue[index]);
    }
  }

  const steps: StepState[] = [
    {
      href: "#texte",
      title: "Le texte",
      short: "Texte",
      detail: project.text.trim() ? `${countWords(project.text).toLocaleString("fr-FR")} mots` : "À coller ou importer",
      status: words.length ? "done" : "current",
    },
    {
      href: "#mots",
      title: "Les mots",
      short: "Mots",
      detail: !words.length
        ? "Choisir les cartes"
        : `${cards.length} carte${cards.length > 1 ? "s" : ""}${toReview.length ? ` · ${toReview.length} à vérifier` : ""}`,
      status: !words.length ? "todo" : cards.length && !toReview.length ? "done" : "current",
    },
    {
      href: "#impression",
      title: "L'impression",
      short: "Impression",
      detail: cards.length ? `${pages} page${pages > 1 ? "s" : ""} A4` : "PDF, Canva, images",
      status: cards.length && !toReview.length ? "current" : "todo",
    },
  ];

  return (
    <>
      <Stepper steps={steps} />

      <div className="flex flex-col gap-8 pt-6">
        <section id="texte" aria-label="Le texte" className="scroll-mt-28">
          {editingSource || words.length === 0 ? (
            <div className="sheet p-4 sm:p-6">
              <SourcePanel
                text={project.text}
                onText={(t, title) => dispatch({ type: "text", text: t, title })}
                onAnalyze={analyze}
                analyzing={analyzing}
                reanalyze={words.length > 0}
                onCancel={words.length ? () => setEditingSource(false) : undefined}
              />
              {error && (
                <p role="alert" className="mt-4 rounded-control border border-danger/30 bg-danger-wash px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <SourceSummary
              title={project.title}
              onTitle={(title) => dispatch({ type: "title", title })}
              words={countWords(project.text)}
              onEdit={() => setEditingSource(true)}
              onNew={newDocument}
            />
          )}
        </section>

        {words.length > 0 && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
            <div ref={wordsRef} id="mots" className="scroll-mt-28">
              <WordBoard
                words={words}
                text={text}
                passages={passages}
                order={project.settings.order}
                perPage={perPage}
                view={view}
                onView={setView}
                onUpdate={update}
                onSelect={select}
                onRemoveCard={removeCard}
                onAdd={add}
                onAddSense={addSense}
                onOpen={(id) => {
                  setQueue(null);
                  setOpenId(id);
                }}
                onReview={(ids) => {
                  setQueue(ids);
                  setOpenId(ids[0]);
                }}
                onPassage={setPassages}
              />
            </div>
            <aside
              id="impression"
              aria-label="L'impression"
              className="flex scroll-mt-28 flex-col gap-4 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-4 lg:pt-2"
            >
              <div className="sheet p-4 sm:p-6">
                <ExportPanel
                  cards={cards}
                  pages={pages}
                  perPage={perPage}
                  settings={project.settings}
                  onSettings={(patch) => dispatch({ type: "settings", patch })}
                  title={project.title}
                />
              </div>
              <SheetPreview
                cards={cards}
                settings={project.settings}
                measure={measure}
                fontFamily={fontFamily}
                onOpen={(id) => {
                  setQueue(null);
                  setOpenId(id);
                }}
              />
            </aside>
          </div>
        )}
      </div>

      {open && (
        <PictoPicker
          word={open}
          onChange={(patch) => update(open.id, patch)}
          onRemove={open.selected ? () => removeCard(open.id) : undefined}
          onClose={() => {
            setOpenId(null);
            setQueue(null);
          }}
          review={
            queue && position > -1
              ? { position, total: queue.length, onPrev: () => goTo(position - 1), onNext: () => goTo(position + 1) }
              : undefined
          }
        />
      )}

      <Toast
        message={toast}
        onUndo={(snapshot) => {
          dispatch({ type: "load", project: snapshot });
          if (snapshot.words.length) setEditingSource(false);
          setToast(null);
        }}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
