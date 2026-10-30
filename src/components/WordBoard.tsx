"use client";

import { useEffect, useRef, useState } from "react";
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

/** L'arrivée sur la planche ne joue que pour les 18 premières cartes. */
const LANDING_MAX = 18;

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
  /** Change à chaque analyse terminée : les cartes arrivent alors sur la planche, famille par famille. */
  landing: number;
}

/**
 * Fin d'une analyse : les cartes arrivent sur la planche famille par famille (une vague par couleur, dans
 * l'ordre des couleurs, puis carte après carte) et chaque mini-carte se scelle d'un éclat, une seule fois.
 * Jouée par script pour ne jamais rejouer quand la liste se remonte (filtre, changement de vue).
 */
function landOnBoard(board: HTMLUListElement | null) {
  if (!board) return;
  const css = getComputedStyle(document.documentElement);
  // Les jetons de durée, en ms ou en s (le CSS minifié écrit « .28s »).
  const ms = (name: string) => {
    const value = css.getPropertyValue(name).trim();
    return (parseFloat(value) || 0) * (value.endsWith("ms") ? 1 : 1000);
  };
  const tiles = [...board.querySelectorAll<HTMLElement>(":scope > li")].slice(0, LANDING_MAX);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    tiles.forEach((li) => li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "linear", fill: "backwards" }));
    return;
  }
  const families = CATEGORY_ORDER.filter((c) => tiles.some((li) => li.dataset.category === c));
  const inFamily: Partial<Record<string, number>> = {};
  tiles.forEach((li) => {
    const family = li.dataset.category ?? "";
    const n = (inFamily[family] = (inFamily[family] ?? -1) + 1);
    const delay = families.indexOf(family as CategoryCode) * ms("--family-gap") + n * ms("--stagger");
    li.animate(
      [
        { opacity: 0, transform: "translateY(-10px) scale(1.03)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: ms("--duration-land"), easing: "cubic-bezier(0.16, 1, 0.3, 1)", delay, fill: "backwards" },
    );
    li.querySelector(".laminate-sheen")?.animate(
      [{ transform: "translateX(-130%)" }, { transform: "translateX(130%)" }],
      { duration: ms("--duration-glint"), easing: "cubic-bezier(0.2, 0, 0, 1)", delay: delay + 200, pseudoElement: "::after" },
    );
  });
}

export function WordBoard(props: Props) {
  const { words, text, passages, order, perPage, view, onView, onUpdate, onSelect, onRemoveCard, onAdd, onAddSense, onOpen, onReview, onPassage, landing } =
    props;
  const [filter, setFilter] = useState<CategoryCode | null>(null);
  const boardRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (landing) landOnBoard(boardRef.current);
  }, [landing]);

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
    <section aria-labelledby="words-title" className="sheet flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 id="words-title" className="font-display text-section font-bold">
          Les mots
        </h2>
        <div role="tablist" aria-label="Affichage des mots" className="flex gap-1 rounded-control bg-wash p-1 text-sm">
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
                view === id ? "bg-sheet text-ink shadow-contact" : "text-ink-soft hover:text-ink"
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-wash/70 px-4 py-3 text-sm text-ink">
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
                className={`${CHIP} border-ink ${filter === null ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-wash"}`}
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
                    className={`${CHIP} disabled:cursor-not-allowed disabled:opacity-35 ${filter === code ? "" : "bg-sheet text-ink hover:bg-wash"}`}
                    style={{
                      borderColor: c.color,
                      ...(filter === code ? { background: c.color, color: c.onColor } : {}),
                    }}
                  >
                    <span className="sm:hidden">{c.short}</span>
                    <span className="hidden sm:inline">{c.label}</span>
                    <span className="font-mono font-semibold tabular-nums opacity-80">{counts[code]}</span>
                  </button>
                );
              })}
            </div>

            <section aria-labelledby="planche-title" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="planche-title" className="flex flex-wrap items-baseline gap-x-2 font-display text-keyword font-bold">
                  Sur la planche
                  <span className="measure text-ink-soft">
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
                  <ul ref={boardRef} className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 2xl:grid-cols-3">
                    {planche.map((w) => (
                      <WordTile
                        key={w.id}
                        word={w}
                        onUpdate={(patch) => onUpdate(w.id, patch)}
                        onOpen={() => onOpen(w.id)}
                        onRemove={() => onRemoveCard(w.id)}
                        onAddSense={() => onAddSense(w.id)}
                      />
                    ))}
                  </ul>
                </>
              ) : (
                <div className="rounded-card border-2 border-dashed border-line bg-wash/40 px-5 py-6 text-center">
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
