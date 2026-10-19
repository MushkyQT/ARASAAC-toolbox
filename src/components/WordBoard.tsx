"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_ORDER, type CategoryCode } from "@/lib/categories";
import { sortWords } from "@/lib/cards/model";
import { NOISE_LABELS, type Passage } from "@/lib/nlp/passages";
import { needsReview } from "@/lib/senses";
import type { CardSettings, WordItem } from "@/lib/types";
import { IconCards, IconEyeOff, IconText } from "./icons";
import { TextView } from "./TextView";
import { WordBank } from "./WordBank";
import { WordTile } from "./WordTile";

export type BoardView = "list" | "text";

const CHIP =
  "flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-control border-2 px-3 py-1 text-sm font-bold transition-colors duration-(--duration-swap) ease-out";

const ORDER_LABELS: Record<CardSettings["order"], string> = {
  text: "ordre du texte",
  category: "par couleur",
  alpha: "ordre alphabétique",
};

interface Props {
  words: WordItem[];
  /** Texte de référence (`canonicalText`) pour la vue « Dans le texte ». */
  text: string;
  passages: Passage[];
  order: CardSettings["order"];
  perPage: number;
  view: BoardView;
  onView: (view: BoardView) => void;
  onUpdate: (id: string, patch: Partial<WordItem>) => void;
  /** Met les mots donnés sur la planche, ou les en retire. */
  onSelect: (ids: string[], selected: boolean) => void;
  onRemoveCard: (id: string) => void;
  onAdd: (word: string) => Promise<string | null>;
  /** Ajoute une carte du même mot avec un autre sens. */
  onAddSense: (id: string) => void;
  onOpen: (id: string) => void;
  /** Lance la vérification des images, mot par mot. */
  onReview: (ids: string[]) => void;
  onPassage: (keys: string[], ignored: boolean) => void;
}

export function WordBoard(props: Props) {
  const { words, text, passages, order, perPage, view, onView, onUpdate, onSelect, onRemoveCard, onAdd, onAddSense, onOpen, onReview, onPassage } =
    props;
  const [filter, setFilter] = useState<CategoryCode | null>(null);

  const ignored = passages.filter((p) => p.ignored);
  const reasons = [...new Set(ignored.map((p) => (p.noise ? NOISE_LABELS[p.noise] : "ignorés à la main")))];
  const toReview = words.filter(needsReview);
  const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, words.filter((w) => w.category === c).length])) as Record<
    CategoryCode,
    number
  >;
  const visible = filter ? words.filter((w) => w.category === filter) : words;
  const planche = sortWords(
    visible.filter((w) => w.selected),
    order,
  );
  const bank = visible.filter((w) => !w.selected);
  const allCards = words.filter((w) => w.selected).length;
  const pages = Math.max(1, Math.ceil(allCards / perPage));

  return (
    <section aria-labelledby="words-title" className="sheet flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="words-title" className="font-display text-section font-bold">
          Les mots
        </h2>
        <div role="tablist" aria-label="Affichage des mots" className="flex gap-1 rounded-control bg-tack p-1 text-sm">
          {(
            [
              ["list", "Liste", "Liste", IconCards],
              ["text", "Dans le texte", "Texte", IconText],
            ] as const
          ).map(([id, label, short, Icon]) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={view === id}
              aria-controls="words-panel"
              onClick={() => onView(id)}
              className={`flex cursor-pointer items-center gap-2 rounded-control px-3 py-1.5 font-bold transition-[background-color,color,box-shadow] duration-(--duration-swap) ease-out ${
                view === id ? "bg-sheet text-ink shadow-sheet" : "text-ink-soft hover:text-ink"
              }`}
            >
              <Icon size={16} />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {ignored.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-tack/70 px-4 py-3 text-sm text-ink">
          <IconEyeOff size={18} className="shrink-0 text-ink-soft" />
          <p className="min-w-0 flex-1 sm:min-w-[12rem]">
            <b>
              {ignored.length} passage{ignored.length > 1 ? "s" : ""} ignoré{ignored.length > 1 ? "s" : ""}
            </b>
            <span className="hidden sm:inline">
              {" "}
              ({reasons.join(", ").toLocaleLowerCase("fr-FR")}) : leurs mots ne sont pas proposés.
            </span>
          </p>
          {view === "list" && (
            <button onClick={() => onView("text")} className="btn-secondary btn-sm">
              <span>Voir<span className="hidden sm:inline"> dans le texte</span></span>
            </button>
          )}
        </div>
      )}

      {toReview.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-attention/30 bg-attention-wash px-4 py-3 text-sm text-attention">
          <span className="h-3 w-3 shrink-0 rounded-full bg-attention" aria-hidden />
          <p className="min-w-0 flex-1 sm:min-w-[12rem]">
            <b>
              {toReview.length} image{toReview.length > 1 ? "s" : ""} à vérifier
            </b>
            <span className="hidden sm:inline"> : ces mots ont plusieurs pictogrammes et le premier a été pris par défaut.</span>
          </p>
          <button onClick={() => onReview(toReview.map((w) => w.id))} className="btn-primary btn-sm">
            <span>Vérifier<span className="hidden sm:inline"> une par une</span></span>
          </button>
        </div>
      )}

      <div id="words-panel" role="tabpanel" aria-labelledby={`tab-${view}`} className="flex flex-col gap-5">
        {view === "text" ? (
          <TextView text={text} passages={passages} words={words} onToggle={(id, selected) => onSelect([id], selected)} onPassages={onPassage} />
        ) : (
          <>
            <div
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
              role="toolbar"
              aria-label="Filtrer par couleur"
            >
              <button
                onClick={() => setFilter(null)}
                aria-pressed={filter === null}
                className={`${CHIP} border-ink ${filter === null ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-tack"}`}
              >
                <span>Toutes<span className="hidden sm:inline"> les couleurs</span></span>
              </button>
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
                    <span className="sm:hidden">{c.short}</span>
                    <span className="hidden sm:inline">{c.label}</span>
                    <span className="tabular-nums opacity-75">{counts[code]}</span>
                  </button>
                );
              })}
            </div>

            <section aria-labelledby="planche-title" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="planche-title" className="flex flex-wrap items-baseline gap-x-2 font-display text-keyword font-bold">
                  Sur la planche
                  <span className="label-caps tabular-nums">
                    {allCards} carte{allCards > 1 ? "s" : ""} · {pages} page{pages > 1 ? "s" : ""}
                  </span>
                </h3>
                {planche.length > 1 && (
                  <button onClick={() => onSelect(planche.map((w) => w.id), false)} className="btn-quiet">
                    {filter ? `Retirer ces ${planche.length} cartes` : "Tout retirer"}
                  </button>
                )}
              </div>
              {planche.length > 0 ? (
                <>
                  <p className="text-sm text-ink-soft">
                    Dans l&apos;ordre d&apos;impression ({ORDER_LABELS[order]}).
                    <span className="hidden sm:inline"> Cliquez sur une image pour la changer, sur le mot pour le réécrire.</span>
                  </p>
                  <ul className="tile-enter grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 2xl:grid-cols-3">
                    {planche.map((w, i) => (
                      <WordTile
                        key={w.id}
                        word={w}
                        index={i}
                        onUpdate={(patch) => onUpdate(w.id, patch)}
                        onOpen={() => onOpen(w.id)}
                        onRemove={() => onRemoveCard(w.id)}
                        onAddSense={() => onAddSense(w.id)}
                      />
                    ))}
                  </ul>
                </>
              ) : (
                <div className="rounded-sheet border-2 border-dashed border-line bg-tack/40 px-5 py-6 text-center">
                  <p className="font-bold text-ink">{filter ? "Aucune carte de cette couleur sur la planche." : "La planche est vide."}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Ajoutez des mots depuis la liste ci-dessous, ou choisissez-les en lisant{" "}
                    <button onClick={() => onView("text")} className="btn-quiet">
                      dans le texte
                    </button>
                    .
                  </p>
                </div>
              )}
            </section>

            <WordBank words={bank} filtered={filter !== null} onPick={(id) => onSelect([id], true)} onAdd={onAdd} />
          </>
        )}
      </div>
    </section>
  );
}
