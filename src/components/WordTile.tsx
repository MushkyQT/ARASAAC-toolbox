"use client";

import type { CSSProperties } from "react";
import { pictoImageUrl } from "@/lib/arasaac";
import { CATEGORIES, CATEGORY_ORDER, type CategoryCode } from "@/lib/categories";
import { hasChoices, needsReview } from "@/lib/senses";
import type { WordItem } from "@/lib/types";
import { IconClose, IconImage, IconPlus } from "./icons";
import { SenseStrip } from "./SenseStrip";

/** Inclinaison de la mini-carte (±0,6°), stable pour un même mot : posée à la main, pas au hasard à chaque rendu. */
function tiltOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 13) - 6) / 10;
}

/** Chevron d'une liste déroulante sur fond coloré, tracé dans la couleur du texte. */
const chevron = (color: string) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='${color.replace("#", "%23")}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M5 8l5 5 5-5'/></svg>")`;

export function wordImage(word: WordItem, resolution: 300 | 500 = 300) {
  return (
    word.customImage ??
    (word.pictoId !== null ? pictoImageUrl(word.pictoId, { resolution, noColor: word.noColor, plural: word.plural }) : null)
  );
}

interface Props {
  word: WordItem;
  index: number;
  onUpdate: (patch: Partial<WordItem>) => void;
  onOpen: () => void;
  onRemove: () => void;
  onAddSense: () => void;
}

/** Une carte de la planche : son image, le mot imprimé, sa couleur, et les autres images possibles. */
export function WordTile({ word, index, onUpdate, onOpen, onRemove, onAddSense }: Props) {
  const color = CATEGORIES[word.category].color;
  const image = wordImage(word);
  const review = needsReview(word);

  return (
    <li className="relative flex gap-3 rounded-sheet border border-rule bg-sheet p-3 pr-11">
      <button
        onClick={onOpen}
        className="mini-card relative h-20 w-20 shrink-0 cursor-pointer rounded-sheet border-4 bg-sheet p-1.5"
        style={{ borderColor: color, "--tilt": `${tiltOf(word.id)}deg`, "--i": index } as CSSProperties}
        aria-label={`Changer l'image de ${word.label}`}
        title="Changer l'image"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={image} src={image} alt="" className="swap-in h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-0.5 text-center text-xs leading-tight text-ink-soft">
            <IconImage size={22} />
            Sans image
          </span>
        )}
        {review && (
          <span className="absolute -right-2 -top-2 h-3.5 w-3.5 rounded-full border-2 border-sheet bg-attention" aria-hidden />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          value={word.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="inline-field min-w-0 font-display text-keyword font-bold uppercase tracking-[0.02em]"
          title="Mot imprimé sur la carte : cliquez pour le modifier"
          aria-label={`Mot imprimé sur la carte (${word.label})`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={word.category}
            onChange={(e) => onUpdate({ category: e.target.value as CategoryCode, categoryLocked: true })}
            aria-label={`Couleur de la carte ${word.label}`}
            title="Couleur de la bordure (nature du mot)"
            className="max-w-full cursor-pointer truncate rounded-control border-0 py-1 pl-2.5 pr-7 text-xs font-bold [field-sizing:content]"
            style={
              {
                backgroundColor: color,
                color: CATEGORIES[word.category].onColor,
                "--chevron": chevron(CATEGORIES[word.category].onColor),
                "--chevron-inset": "0.5rem",
                "--chevron-size": "0.875rem",
              } as CSSProperties
            }
          >
            {CATEGORY_ORDER.map((code) => (
              <option key={code} value={code}>
                {CATEGORIES[code].label}
              </option>
            ))}
          </select>
          {review && (
            <button onClick={onOpen} className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-attention hover:underline">
              <span className="h-2 w-2 rounded-full bg-attention" aria-hidden />
              Image à vérifier
            </button>
          )}
        </div>
        {hasChoices(word) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SenseStrip word={word} onUpdate={onUpdate} onMore={onOpen} />
            <button
              onClick={onAddSense}
              className="btn-quiet inline-flex items-center gap-1 text-xs"
              title="Le mot a deux sens dans le texte (l'avocat mange un avocat) : ajouter une deuxième carte avec une autre image"
            >
              <IconPlus size={14} />
              Autre sens
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-control text-ink-soft transition-colors duration-(--duration-swap) ease-out hover:bg-tack hover:text-ink"
        aria-label={word.copyOf ? `Supprimer la carte ${word.label} (autre sens)` : `Retirer ${word.label} de la planche`}
        title={word.copyOf ? "Supprimer cette carte" : "Retirer de la planche"}
      >
        <IconClose size={18} />
      </button>
    </li>
  );
}
