"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type CategoryCode } from "@/lib/categories";
import { pictoImageUrl, pictoKeywords, searchPictograms, senseHints, type SearchResult } from "@/lib/arasaac";
import { toSquarePng } from "@/lib/cards/model";
import { choosePicto, splitOnForms } from "@/lib/senses";
import type { WordItem } from "@/lib/types";
import { CategoryPicker } from "./CategoryPicker";
import { IconArrowLeft, IconArrowRight, IconClose, IconImage, IconSearch } from "./icons";

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
  /** Retire la carte de la planche (absent si le mot n'y est pas). */
  onRemove?: () => void;
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
      className={`thumb group relative flex cursor-pointer flex-col items-center justify-start rounded-sheet border-4 bg-sheet p-2 ${
        active ? "ring-4 ring-ink-blue ring-offset-2 ring-offset-sheet" : ""
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
      {hint && <span className="mt-1 line-clamp-2 text-center text-xs leading-tight text-ink-soft">{hint}</span>}
      {shortcut !== undefined && (
        <kbd className="absolute left-1 top-1 rounded-sheet bg-tack px-1 font-sans text-xs font-bold text-ink-soft">
          {shortcut}
        </kbd>
      )}
      {keywords && !hint && (
        <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-sheet bg-sheet/95 px-1 text-xs text-ink-soft opacity-0 transition-opacity duration-(--duration-swap) ease-out group-hover:opacity-100">
          {keywords.slice(0, 3).join(", ")}
        </span>
      )}
    </button>
  );
}

export function PictoPicker({ word, onChange, onClose, onRemove, review }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto max-h-[92vh] w-[min(920px,94vw)] overflow-hidden rounded-sheet p-0 shadow-dialog"
    >
      {/* Remonté à chaque mot pendant la revue : recherche et minuteries repartent de zéro. */}
      <PickerBody
        key={word.id}
        word={word}
        onChange={onChange}
        onRemove={onRemove}
        review={review}
        close={() => dialog.current?.close()}
      />
    </dialog>
  );
}

function PickerBody({ word, onChange, onRemove, review, close }: Omit<Props, "onClose"> & { close: () => void }) {
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
        <div className="flex flex-wrap items-center gap-3 border-b border-attention/30 bg-attention-wash px-6 py-2.5 text-sm text-attention">
          <span className="font-bold tabular-nums">
            Vérification {review.position + 1} sur {review.total}
          </span>
          <span
            className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-attention/20"
            role="progressbar"
            aria-label="Avancement de la revue"
            aria-valuemin={1}
            aria-valuemax={review.total}
            aria-valuenow={review.position + 1}
          >
            <span
              className="block h-full origin-left rounded-full bg-attention transition-transform duration-(--duration-hover) ease-out"
              style={{ transform: `scaleX(${(review.position + 1) / review.total})` }}
            />
          </span>
          <button
            onClick={review.onPrev}
            disabled={review.position === 0}
            className="btn-secondary btn-sm border-attention text-attention hover:bg-sheet"
            aria-label="Mot précédent"
          >
            <IconArrowLeft size={18} />
          </button>
          <button onClick={keepAndNext} className="btn-primary btn-sm" title="Touche →">
            {review.position + 1 === review.total ? "Garder et terminer" : "Garder cette image"}
            {review.position + 1 < review.total && <IconArrowRight size={18} />}
          </button>
        </div>
      )}
      <header className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4">
        <div className="min-w-0">
          <h3 className="font-display text-section font-bold tracking-[0.02em]">{word.label.toLocaleUpperCase("fr-FR")}</h3>
          {word.example && (
            <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
              <span className="sr-only">Dans le texte : </span>
              «{" "}
              {splitOnForms(word.example, [word.lemma, ...word.forms]).map(([part, isWord], i) =>
                isWord ? (
                  <mark key={i} className="rounded-sheet bg-attention-wash px-0.5 font-bold text-ink">
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
        <button
          onClick={close}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-soft transition-colors duration-(--duration-swap) ease-out hover:bg-tack hover:text-ink"
          aria-label="Fermer"
        >
          <IconClose size={22} />
        </button>
      </header>

      <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="label-caps">Mot imprimé sur la carte</span>
            <input
              value={word.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="field font-display font-bold uppercase"
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="label-caps" id="picker-category">
              Couleur de la bordure
            </span>
            <CategoryPicker
              value={word.category}
              label="Couleur de la bordure (nature du mot)"
              size="md"
              onChange={(category) => onChange({ category, categoryLocked: true })}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={word.plural} onChange={(e) => onChange({ plural: e.target.checked })} />
            Image au pluriel
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={word.noColor} onChange={(e) => onChange({ noColor: e.target.checked })} />
            Image en noir et blanc
          </label>
        </div>

        {word.candidates.length > 0 && (
          // Pendant la revue, choisir l'image est la tâche principale : les propositions passent en tête.
          <section aria-labelledby="picker-candidates" className={`flex flex-col gap-3 ${review ? "order-first" : ""}`}>
            <h4 id="picker-candidates" className="flex flex-wrap items-baseline gap-x-3 font-bold">
              Images proposées pour ce mot
              {word.candidates.length > 1 && (
                <span className="text-sm font-normal text-ink-soft">touches 1 à {Math.min(9, word.candidates.length)}</span>
              )}
            </h4>
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

        <section aria-labelledby="picker-search-title" className="flex flex-col gap-3">
          <h4 id="picker-search-title" className="font-bold">
            {word.candidates.length ? "Chercher une autre image dans ARASAAC" : "Chercher une image dans ARASAAC"}
          </h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
            className="flex gap-2"
          >
            <label htmlFor="picto-search" className="sr-only">
              Mot à chercher dans ARASAAC
            </label>
            <input
              id="picto-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un autre mot, un synonyme…"
              className="field min-w-0 flex-1 text-sm"
            />
            <button className="btn-primary">
              <IconSearch size={18} />
              Chercher
            </button>
          </form>
          {searching && (
            <p role="status" className="text-sm text-ink-soft">
              Recherche dans ARASAAC…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error} Vérifiez la connexion, puis réessayez.
            </p>
          )}
          {results && !searching && extra.length === 0 && (
            <p className="text-sm text-ink-soft">
              {results.length ? "Pas d'autre image que celles proposées ci-dessus." : `Aucune image pour « ${query} ». Essayez un synonyme.`}
            </p>
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

        <section aria-label="Autres choix" className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-rule pt-4 text-sm">
          <button onClick={() => fileInput.current?.click()} className="btn-secondary btn-sm">
            <IconImage size={18} />
            Utiliser ma propre image
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
            <button onClick={() => onChange({ customImage: undefined })} className="btn-quiet">
              Revenir au pictogramme
            </button>
          )}
          <button
            onClick={() => onChange({ pictoId: null, pictoChosen: true, customImage: undefined })}
            className="btn-quiet"
          >
            Carte sans image
          </button>
          <span className="ml-auto flex flex-wrap items-center gap-3">
            {onRemove && (
              <button onClick={onRemove} className="btn-quiet text-danger hover:text-danger">
                Retirer de la planche
              </button>
            )}
            {!review && (
              <button onClick={close} className="btn-primary btn-sm">
                Terminé
              </button>
            )}
          </span>
        </section>
      </div>
    </div>
  );
}
