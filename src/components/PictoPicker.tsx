"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type CategoryCode } from "@/lib/categories";
import { pictoImageUrl, pictoKeywords, searchPictograms, senseHints, type SearchResult } from "@/lib/arasaac";
import { toSquarePng } from "@/lib/cards/model";
import { choosePicto, splitOnForms } from "@/lib/senses";
import type { WordItem } from "@/lib/types";
import { CategoryPicker } from "./CategoryPicker";

/** Revue des mots à plusieurs images, un mot après l'autre. */
interface Review {
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

interface Props {
  word: WordItem;
  onChange: (patch: Partial<WordItem>) => void;
  onClose: () => void;
  review?: Review;
}

// Délai avant de passer au mot suivant, le temps de voir l'image sélectionnée.
const ADVANCE_MS = 280;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

function Thumb({
  id,
  category,
  active,
  noColor,
  plural,
  hint,
  shortcut,
  onPick,
}: {
  id: number;
  category: CategoryCode;
  active: boolean;
  noColor: boolean;
  plural: boolean;
  /** Autres mots-clés du pictogramme, affichés sous l'image pour distinguer les sens. */
  hint?: string;
  /** Touche du clavier qui choisit ce pictogramme. */
  shortcut?: number;
  onPick: () => void;
}) {
  const [keywords, setKeywords] = useState<string[] | null>(null);
  return (
    <button
      onClick={onPick}
      onMouseEnter={() => keywords === null && pictoKeywords(id).then(setKeywords)}
      onFocus={() => keywords === null && pictoKeywords(id).then(setKeywords)}
      aria-pressed={active}
      title={keywords?.join(", ") ?? `Pictogramme ${id}`}
      className={`group relative flex flex-col items-center justify-start rounded-xl border-[3px] bg-white p-2 transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? "ring-4 ring-stone-900/80 ring-offset-2" : ""
      }`}
      style={{ borderColor: CATEGORIES[category].color }}
    >
      <span className="aspect-square w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pictoImageUrl(id, { resolution: 300, noColor, plural })}
          alt={hint ?? keywords?.[0] ?? ""}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </span>
      {hint && <span className="mt-1 line-clamp-2 text-center text-[11px] leading-tight text-stone-600">{hint}</span>}
      {shortcut !== undefined && (
        <kbd className="absolute left-1 top-1 rounded bg-stone-100 px-1 font-sans text-[10px] font-semibold text-stone-500">
          {shortcut}
        </kbd>
      )}
      {keywords && !hint && (
        <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded bg-white/90 px-1 text-[10px] text-stone-600 opacity-0 group-hover:opacity-100">
          {keywords.slice(0, 3).join(", ")}
        </span>
      )}
    </button>
  );
}

export function PictoPicker({ word, onChange, onClose, review }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto max-h-[92vh] w-[min(920px,94vw)] overflow-hidden rounded-3xl bg-white p-0 shadow-2xl backdrop:bg-stone-900/50"
    >
      {/* Remonté à chaque mot pendant la revue : recherche et minuteries repartent de zéro. */}
      <PickerBody key={word.id} word={word} onChange={onChange} review={review} close={() => dialog.current?.close()} />
    </dialog>
  );
}

function PickerBody({ word, onChange, review, close }: Omit<Props, "onClose"> & { close: () => void }) {
  const [query, setQuery] = useState(word.lemma);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<Map<number, string[]>>(new Map());
  const fileInput = useRef<HTMLInputElement>(null);
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(advance.current), []);

  // Une seule recherche ARASAAC pour légender tous les sens (« remuer », « fouetter »…).
  useEffect(() => {
    if (word.candidates.length > 1) senseHints(word.lemma).then(setHints);
  }, [word.lemma, word.candidates.length]);

  // Mot inconnu du lexique : on lance directement une recherche en ligne.
  useEffect(() => {
    if (word.candidates.length === 0) search(word.lemma);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(q: string) {
    setSearching(true);
    setError(null);
    try {
      setResults(await searchPictograms(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recherche impossible.");
    } finally {
      setSearching(false);
    }
  }

  function pick(id: number, category: CategoryCode) {
    onChange(choosePicto(word, id, category));
    // Pendant la revue, choisir une image fait passer au mot suivant.
    if (review) {
      clearTimeout(advance.current);
      advance.current = setTimeout(review.onNext, ADVANCE_MS);
    }
  }

  // Clavier : 1 à 9 choisit une proposition ; pendant la revue, ← et → changent de mot.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, word.candidates.length)) {
        e.preventDefault();
        const [id, cat] = word.candidates[n - 1];
        pick(id, cat);
      } else if (review && e.key === "ArrowRight") {
        e.preventDefault();
        keepAndNext();
      } else if (review && e.key === "ArrowLeft" && review.position > 0) {
        e.preventDefault();
        review.onPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function keepAndNext() {
    if (!word.pictoChosen && !word.customImage) onChange({ pictoChosen: true });
    review?.onNext();
  }

  async function importOwnImage(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = await toSquarePng(bytes, 900);
    let binary = "";
    png.forEach((b) => (binary += String.fromCharCode(b)));
    onChange({ customImage: `data:image/png;base64,${btoa(binary)}` });
  }

  const candidateIds = new Set(word.candidates.map(([id]) => id));
  const extra = (results ?? []).filter((r) => !candidateIds.has(r.id));

  return (
    <div className="flex max-h-[92vh] flex-col">
      {review && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-950">
          <span className="font-medium tabular-nums">
            {review.position + 1} / {review.total}
          </span>
          <span
            className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-amber-200"
            role="progressbar"
            aria-label="Avancement de la revue"
            aria-valuemin={1}
            aria-valuemax={review.total}
            aria-valuenow={review.position + 1}
          >
            <span
              className="block h-full rounded-full bg-amber-600 transition-[width]"
              style={{ width: `${((review.position + 1) / review.total) * 100}%` }}
            />
          </span>
          <button
            onClick={review.onPrev}
            disabled={review.position === 0}
            className="rounded-full px-3 py-1 hover:bg-amber-100 disabled:opacity-40"
            aria-label="Précédent"
          >
            ←
          </button>
          <button onClick={keepAndNext} className="rounded-full bg-amber-900 px-4 py-1 font-medium text-white hover:bg-amber-800">
            {review.position + 1 === review.total ? "Terminer" : "Suivant →"}
          </button>
        </div>
      )}
      <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-wide text-stone-900">{word.label.toLocaleUpperCase("fr-FR")}</h3>
          {word.example && (
            <p className="mt-1 line-clamp-2 text-sm text-stone-500">
              «{" "}
              {splitOnForms(word.example, [word.lemma, ...word.forms]).map(([part, isWord], i) =>
                isWord ? (
                  <mark key={i} className="rounded bg-amber-100 px-0.5 font-medium text-stone-900">
                    {part}
                  </mark>
                ) : (
                  part
                ),
              )}{" "}
              »
            </p>
          )}
        </div>
        <button onClick={close} className="rounded-full px-3 py-1 text-xl leading-none text-stone-500 hover:bg-stone-100" aria-label="Fermer">
          ×
        </button>
      </header>

      <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col text-sm">
            <span className="sr-only">Mot écrit sur la carte</span>
            <input
              value={word.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="rounded-xl border border-stone-300 px-3 py-2 uppercase outline-none focus:border-emerald-600"
            />
          </label>
          <div className="flex items-center text-sm">
            <CategoryPicker
              value={word.category}
              label="Catégorie du mot"
              size="md"
              onChange={(category) => onChange({ category, categoryLocked: true })}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-stone-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={word.plural} onChange={(e) => onChange({ plural: e.target.checked })} />
            Pluriel
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={word.noColor} onChange={(e) => onChange({ noColor: e.target.checked })} />
            Noir et blanc
          </label>
        </div>

        {word.candidates.length > 0 && (
          // Pendant la revue, choisir l'image est la tâche principale : les propositions passent en tête.
          <section className={review ? "order-first" : undefined}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {word.candidates.map(([id, cat], i) => (
                <Thumb
                  key={id}
                  id={id}
                  category={cat}
                  active={word.pictoId === id && !word.customImage}
                  noColor={word.noColor}
                  plural={word.plural}
                  hint={hints.get(id)?.slice(0, 2).join(" · ") || undefined}
                  shortcut={word.candidates.length > 1 && i < 9 ? i + 1 : undefined}
                  onPick={() => pick(id, cat)}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
            className="mb-3 flex gap-2"
          >
            <label htmlFor="picto-search" className="sr-only">
              Chercher un autre pictogramme
            </label>
            <input
              id="picto-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher…"
              className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <button className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
              Chercher
            </button>
          </form>
          {searching && <p className="text-sm text-stone-500">Recherche…</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
          {results && !searching && extra.length === 0 && (
            <p className="text-sm text-stone-500">Aucun résultat.</p>
          )}
          {extra.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {extra.slice(0, 48).map((r) => (
                <Thumb
                  key={r.id}
                  id={r.id}
                  category={r.category}
                  active={word.pictoId === r.id && !word.customImage}
                  noColor={word.noColor}
                  plural={word.plural}
                  onPick={() => {
                    onChange({ candidates: [...word.candidates, [r.id, r.category]] });
                    pick(r.id, r.category);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4 text-sm">
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-full border border-stone-300 px-4 py-2 hover:bg-stone-50"
          >
            Mon image…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importOwnImage(f);
              e.target.value = "";
            }}
          />
          {word.customImage && (
            <button onClick={() => onChange({ customImage: undefined })} className="text-stone-600 underline">
              Revenir au pictogramme
            </button>
          )}
          <button
            onClick={() => onChange({ pictoId: null, pictoChosen: true, customImage: undefined })}
            className="text-stone-600 underline underline-offset-2"
          >
            Sans image
          </button>
        </section>
      </div>
    </div>
  );
}
