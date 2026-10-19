"use client";

import { useState, type CSSProperties } from "react";
import { CATEGORIES, CATEGORY_ORDER, type CategoryCode } from "@/lib/categories";
import { pictoImageUrl } from "@/lib/arasaac";
import { hasChoices, needsReview } from "@/lib/senses";
import type { WordItem } from "@/lib/types";
import { PictoPicker } from "./PictoPicker";
import { SenseStrip } from "./SenseStrip";

/** Filtre de la liste : une catégorie, ou les mots qui ont plusieurs images possibles. */
type Filter = CategoryCode | "choices" | null;

const CHIP =
  "flex cursor-pointer items-center gap-2 rounded-control border-2 px-3 py-1 text-sm font-bold transition-colors duration-(--duration-swap) ease-out";

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

/** Inclinaison de la mini-carte (±0,6°), stable pour un même mot : posée à la main, pas au hasard à chaque rendu. */
function tiltOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 13) - 6) / 10;
}

function WordTile({
  word,
  index,
  onUpdate,
  onOpen,
  onRemove,
  onAddSense,
}: {
  word: WordItem;
  index: number;
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
      className={`group relative flex gap-3 rounded-sheet border border-rule bg-sheet p-3 transition-opacity duration-(--duration-swap) ease-out ${
        word.selected ? "" : "opacity-55 hover:opacity-90"
      }`}
    >
      <button
        onClick={onOpen}
        className="mini-card relative h-20 w-20 shrink-0 cursor-pointer rounded-sheet border-4 bg-sheet p-1.5"
        style={{ borderColor: color, "--tilt": `${tiltOf(word.id)}deg`, "--i": index } as CSSProperties}
        aria-label={`Choisir le pictogramme de ${word.label}`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={image} src={image} alt="" className="swap-in h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="flex h-full items-center justify-center text-center text-2xl text-ink-soft">+</span>
        )}
        {needsReview(word) && (
          <span
            className="absolute -right-2 -top-2 h-3.5 w-3.5 rounded-full border-2 border-sheet bg-attention"
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
            className="mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer"
            aria-label={`Inclure ${word.label}`}
          />
          <input
            value={word.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-1 font-display text-keyword font-bold uppercase tracking-[0.02em] text-ink outline-none transition-colors duration-(--duration-swap) ease-out hover:border-line focus:border-ink-blue focus:shadow-focus"
            title={word.label}
            aria-label="Mot écrit sur la carte"
          />
        </div>
        <select
          value={word.category}
          onChange={(e) => onUpdate({ category: e.target.value as CategoryCode, categoryLocked: true })}
          aria-label={`Catégorie de ${word.label}`}
          className="max-w-full self-start cursor-pointer truncate rounded-control border-0 py-1 pl-2.5 pr-7 text-xs font-bold"
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
              className="btn-quiet text-xs"
              title="Ajouter une deuxième carte pour ce mot, avec une autre image"
            >
              + Autre sens
            </button>
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-control text-lg leading-none text-ink-soft opacity-0 transition-[opacity,background-color,color] duration-(--duration-swap) ease-out hover:bg-tack hover:text-ink group-hover:opacity-100 focus:opacity-100"
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
    <section aria-labelledby="words-title" className="sheet flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="words-title" className="font-display text-section font-bold">
          Les mots-clés
        </h2>
        <p className="label-caps tabular-nums">
          {selected} carte{selected > 1 ? "s" : ""} · {Math.max(1, Math.ceil(selected / perPage))} page
          {Math.ceil(selected / perPage) > 1 ? "s" : ""}
        </p>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => onSelectAll(true, filter ? visible.map((w) => w.id) : undefined)}
            className="btn-secondary btn-sm"
          >
            Tout cocher
          </button>
          <button
            onClick={() => onSelectAll(false, filter ? visible.map((w) => w.id) : undefined)}
            className="btn-secondary btn-sm"
          >
            Tout décocher
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filtrer par catégorie">
        <button
          onClick={() => setFilter(null)}
          aria-pressed={filter === null}
          className={`${CHIP} border-ink ${filter === null ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-tack"}`}
        >
          Tous ({words.length})
        </button>
        {withChoices > 0 && (
          <button
            onClick={() => setFilter(filter === "choices" ? null : "choices")}
            aria-pressed={filter === "choices"}
            className={`${CHIP} border-ink ${filter === "choices" ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-tack"}`}
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
              className={`${CHIP} disabled:cursor-not-allowed disabled:opacity-35 ${filter === code ? "" : "bg-sheet text-ink hover:bg-tack"}`}
              style={{
                borderColor: c.color,
                ...(filter === code ? { background: c.color, color: c.onColor } : {}),
              }}
            >
              {c.label} <span className="tabular-nums opacity-75">{counts[code]}</span>
            </button>
          );
        })}
      </div>

      {toReview.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-attention/30 bg-attention-wash px-4 py-3 text-sm text-attention">
          <span className="h-3 w-3 shrink-0 rounded-full bg-attention" aria-hidden />
          <p className="min-w-0 flex-1 font-bold">
            {toReview.length} image{toReview.length > 1 ? "s" : ""} à vérifier
          </p>
          <button
            onClick={() => {
              const ids = toReview.map((w) => w.id);
              setQueue(ids);
              setOpenId(ids[0]);
            }}
            className="btn-primary btn-sm"
          >
            Vérifier
          </button>
        </div>
      )}

      <ul className="tile-enter grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 2xl:grid-cols-3">
        {visible.map((w, i) => (
          <WordTile
            key={w.id}
            word={w}
            index={i}
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
          className="field text-sm"
        />
        <button className="btn-primary btn-sm">Ajouter</button>
        {addError && <span className="text-sm text-danger">{addError}</span>}
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
