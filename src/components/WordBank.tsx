"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { WordItem } from "@/lib/types";
import { IconImage, IconPlus } from "./icons";
import { wordImage } from "./WordTile";

type Sort = "importance" | "text" | "alpha";

const SORTS: Record<Sort, string> = {
  importance: "Les plus importants d'abord",
  text: "Dans l'ordre du texte",
  alpha: "Par ordre alphabétique",
};

// Long texte : seuls les mots fréquents et les plus importants sont affichés d'emblée, les autres
// attendent derrière un bouton, pour que la liste reste lisible d'un coup d'œil.
const COLLAPSE_AFTER = 50;
const ALWAYS_SHOWN = 30;

/** Les mots affichés d'emblée : les plus importants, et tous ceux qui reviennent ou désignent un personnage. */
function prominent(words: WordItem[]): Set<string> {
  const top = [...words].sort((a, b) => b.score - a.score || a.firstIndex - b.firstIndex).slice(0, ALWAYS_SHOWN);
  return new Set([...top, ...words.filter((w) => w.count > 1 || w.proper || w.manual)].map((w) => w.id));
}

function sortWords(words: WordItem[], sort: Sort) {
  const list = [...words];
  if (sort === "importance") list.sort((a, b) => b.score - a.score || a.firstIndex - b.firstIndex);
  else if (sort === "text") list.sort((a, b) => a.firstIndex - b.firstIndex);
  else list.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return list;
}

interface Props {
  /** Mots trouvés dans le texte qui ne sont pas sur la planche. */
  words: WordItem[];
  /** Un filtre de catégorie est actif. */
  filtered: boolean;
  onPick: (id: string) => void;
  onAdd: (word: string) => Promise<string | null>;
}

/** Les mots qui ne sont pas (encore) sur la planche : une étiquette par mot, un clic pour l'ajouter. */
export function WordBank({ words, filtered, onPick, onAdd }: Props) {
  const [sort, setSort] = useState<Sort>("importance");
  const [showAll, setShowAll] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [addMessage, setAddMessage] = useState<string | null>(null);

  const sorted = sortWords(words, sort);
  const first = prominent(words);
  const rare = sorted.filter((w) => !first.has(w.id));
  const collapsible = words.length > COLLAPSE_AFTER && rare.length > 0;
  const shown = collapsible && !showAll ? sorted.filter((w) => first.has(w.id)) : sorted;

  return (
    <section aria-labelledby="bank-title" className="flex flex-col gap-3 border-t border-rule pt-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 id="bank-title" className="flex items-baseline gap-2 font-display text-keyword font-bold">
          Autres mots du texte
          <span className="label-caps tabular-nums">{words.length}</span>
        </h3>
        {words.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Trier</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field h-9 min-h-0 cursor-pointer pl-3 pr-9 text-sm">
              {Object.entries(SORTS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {words.length > 0 ? (
        <>
          <p className="text-sm text-ink-soft">
            Cliquez sur un mot pour l&apos;ajouter à la planche.
            <span className="[@media(hover:none)]:hidden"> Survolez-le pour lire la phrase où il apparaît.</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {shown.map((w) => {
              const image = wordImage(w);
              return (
                <li key={w.id} className="min-w-0 max-w-full">
                  <button
                    onClick={() => onPick(w.id)}
                    className="bank-chip group"
                    title={w.example ? `« ${w.example} »` : undefined}
                    aria-label={`Ajouter ${w.label} à la planche${w.count > 1 ? ` (${w.count} fois dans le texte)` : ""}`}
                  >
                    <span className="bank-thumb" style={{ borderColor: CATEGORIES[w.category].color }}>
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <IconImage size={14} className="text-ink-soft" />
                      )}
                    </span>
                    <span className="min-w-0 truncate">{w.label}</span>
                    {w.count > 1 && <span className="text-xs font-normal tabular-nums text-ink-soft">×{w.count}</span>}
                    <IconPlus size={16} className="shrink-0 text-ink-soft transition-colors duration-(--duration-swap) ease-out group-hover:text-ink-blue" />
                  </button>
                </li>
              );
            })}
          </ul>
          {collapsible && (
            <button onClick={() => setShowAll((s) => !s)} className="btn-secondary btn-sm self-start" aria-expanded={showAll}>
              {showAll ? "Masquer les mots peu fréquents" : `Afficher ${rare.length} autres mots, moins fréquents`}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-soft">
          {filtered ? "Aucun autre mot de cette couleur dans le texte." : "Tous les mots trouvés dans le texte sont sur la planche."}
        </p>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newWord.trim()) return;
          const message = await onAdd(newWord);
          setAddMessage(message);
          if (!message) setNewWord("");
        }}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <label htmlFor="add-word" className="text-sm font-bold text-ink">
          Il manque un mot ?
        </label>
        <input
          id="add-word"
          value={newWord}
          onChange={(e) => {
            setNewWord(e.target.value);
            setAddMessage(null);
          }}
          placeholder="gâteau, maîtresse…"
          className="field min-w-0 flex-1 text-sm sm:max-w-64"
        />
        <button className="btn-primary btn-sm" disabled={!newWord.trim()}>
          <IconPlus size={16} />
          Ajouter à la planche
        </button>
        {addMessage && (
          <p role="status" className="basis-full text-sm text-attention">
            {addMessage}
          </p>
        )}
      </form>
    </section>
  );
}
