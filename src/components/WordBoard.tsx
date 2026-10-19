"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_ORDER, type CategoryCode } from "@/lib/categories";
import { pictoImageUrl } from "@/lib/arasaac";
import { hasChoices, needsReview } from "@/lib/senses";
import type { WordItem } from "@/lib/types";
import { PictoPicker } from "./PictoPicker";
import { SenseStrip } from "./SenseStrip";

/** Filtre de la liste : une catégorie, ou les mots qui ont plusieurs images possibles. */
type Filter = CategoryCode | "choices" | null;

interface Props {
  words: WordItem[];
  perPage: number;
  onUpdate: (id: string, patch: Partial<WordItem>) => void;
  /** Coche ou décoche les mots donnés (tous si `ids` est absent). */
  onSelectAll: (selected: boolean, ids?: string[]) => void;
  onAdd: (word: string) => Promise<string | null>;
  /** Ajoute une carte du même mot avec un autre sens ; renvoie son id. */
  onAddSense: (id: string) => string | null;
  onRemove: (id: string) => void;
}

function WordTile({
  word,
  onUpdate,
  onOpen,
  onRemove,
  onAddSense,
}: {
  word: WordItem;
  onUpdate: (patch: Partial<WordItem>) => void;
  onOpen: () => void;
  onRemove: () => void;
  onAddSense: () => void;
}) {
  const color = CATEGORIES[word.category].color;
  const image =
    word.customImage ??
    (word.pictoId !== null ? pictoImageUrl(word.pictoId, { resolution: 300, noColor: word.noColor, plural: word.plural }) : null);

  return (
    <li
      className={`group relative flex gap-3 rounded-2xl border bg-white p-3 transition ${
        word.selected ? "border-stone-300 shadow-sm" : "border-stone-200 opacity-55 hover:opacity-90"
      }`}
    >
      <button
        onClick={onOpen}
        className="relative h-20 w-20 shrink-0 rounded-xl border-[3px] bg-white p-1.5 transition hover:scale-[1.03]"
        style={{ borderColor: color }}
        aria-label={`Choisir le pictogramme de ${word.label}`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="flex h-full items-center justify-center text-center text-2xl text-stone-400">
            +
          </span>
        )}
        {needsReview(word) && (
          <span
            className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500"
            aria-hidden
          />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={word.selected}
            onChange={(e) => onUpdate({ selected: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-emerald-700"
            aria-label={`Inclure ${word.label}`}
          />
          <input
            value={word.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 font-semibold uppercase tracking-wide text-stone-900 outline-none hover:border-stone-200 focus:border-emerald-600"
            title={word.label}
            aria-label="Mot écrit sur la carte"
          />
        </div>
        <select
          value={word.category}
          onChange={(e) => onUpdate({ category: e.target.value as CategoryCode, categoryLocked: true })}
          aria-label={`Catégorie de ${word.label}`}
          className="self-start cursor-pointer rounded-full border-0 py-0.5 pl-2.5 pr-7 text-xs font-medium"
          style={{ background: color, color: CATEGORIES[word.category].onColor }}
        >
          {CATEGORY_ORDER.map((code) => (
            <option key={code} value={code}>
              {CATEGORIES[code].label}
            </option>
          ))}
        </select>
        {hasChoices(word) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SenseStrip word={word} onUpdate={onUpdate} onMore={onOpen} />
            <button
              onClick={onAddSense}
              className="text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
              title="Ajouter une deuxième carte pour ce mot, avec une autre image"
            >
              + Autre sens
            </button>
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full px-1.5 text-stone-400 opacity-0 transition hover:bg-stone-100 hover:text-stone-700 group-hover:opacity-100 focus:opacity-100"
        aria-label={`Retirer ${word.label}`}
        title="Retirer de la liste"
      >
        ×
      </button>
    </li>
  );
}

export function WordBoard({ words, perPage, onUpdate, onSelectAll, onAdd, onAddSense, onRemove }: Props) {
  const [filter, setFilter] = useState<Filter>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Revue des mots à plusieurs images : la liste est figée au lancement pour pouvoir revenir en arrière.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [newWord, setNewWord] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, words.filter((w) => w.category === c).length])) as Record<
    CategoryCode,
    number
  >;
  const selected = words.filter((w) => w.selected).length;
  const withChoices = words.filter(hasChoices).length;
  const toReview = words.filter(needsReview);
  const visible = filter === "choices" ? words.filter(hasChoices) : filter ? words.filter((w) => w.category === filter) : words;
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

  return (
    <section aria-label="Mots" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          {selected} carte{selected > 1 ? "s" : ""} · {Math.max(1, Math.ceil(selected / perPage))} page
          {Math.ceil(selected / perPage) > 1 ? "s" : ""}
        </p>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => onSelectAll(true, filter ? visible.map((w) => w.id) : undefined)}
            className="rounded-full border border-stone-300 px-3 py-1 hover:bg-stone-50"
          >
            Tout cocher
          </button>
          <button
            onClick={() => onSelectAll(false, filter ? visible.map((w) => w.id) : undefined)}
            className="rounded-full border border-stone-300 px-3 py-1 hover:bg-stone-50"
          >
            Tout décocher
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filtrer par catégorie">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1 text-sm ${filter === null ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
        >
          Tous ({words.length})
        </button>
        {withChoices > 0 && (
          <button
            onClick={() => setFilter(filter === "choices" ? null : "choices")}
            aria-pressed={filter === "choices"}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === "choices" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            Plusieurs images ({withChoices})
          </button>
        )}
        {CATEGORY_ORDER.map((code) => {
          const c = CATEGORIES[code];
          return (
            <button
              key={code}
              onClick={() => setFilter(filter === code ? null : code)}
              disabled={counts[code] === 0}
              aria-pressed={filter === code}
              className="flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm transition disabled:opacity-30"
              style={{
                borderColor: c.color,
                background: filter === code ? c.color : "white",
                color: filter === code ? c.onColor : "#292524",
              }}
            >
              {c.label} <span className="opacity-70">{counts[code]}</span>
            </button>
          );
        })}
      </div>

      {toReview.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="h-3 w-3 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">
            {toReview.length} image{toReview.length > 1 ? "s" : ""} à vérifier
          </p>
          <button
            onClick={() => {
              const ids = toReview.map((w) => w.id);
              setQueue(ids);
              setOpenId(ids[0]);
            }}
            className="rounded-full bg-amber-900 px-4 py-1.5 font-medium text-white hover:bg-amber-800"
          >
            Vérifier
          </button>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {visible.map((w) => (
          <WordTile
            key={w.id}
            word={w}
            onUpdate={(patch) => onUpdate(w.id, patch)}
            onOpen={() => setOpenId(w.id)}
            onRemove={() => onRemove(w.id)}
            onAddSense={() => {
              // La nouvelle carte s'ouvre aussitôt pour choisir son image.
              const id = onAddSense(w.id);
              if (id) setOpenId(id);
            }}
          />
        ))}
      </ul>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newWord.trim()) return;
          const err = await onAdd(newWord);
          setAddError(err);
          if (!err) setNewWord("");
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label htmlFor="add-word" className="sr-only">
          Ajouter un mot
        </label>
        <input
          id="add-word"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="Ajouter un mot…"
          className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
        />
        <button className="rounded-xl bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700">Ajouter</button>
        {addError && <span className="text-sm text-red-700">{addError}</span>}
      </form>

      {open && (
        <PictoPicker
          word={open}
          onChange={(patch) => onUpdate(open.id, patch)}
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
    </section>
  );
}
