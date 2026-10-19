"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { CATEGORIES } from "@/lib/categories";
import { NOISE_LABELS, type Passage } from "@/lib/nlp/passages";
import { lineBreakMode } from "@/lib/text";
import type { WordItem } from "@/lib/types";
import { IconEye, IconEyeOff } from "./icons";

interface Props {
  /** Texte de référence (`canonicalText`) : les positions des mots et des passages s'y rapportent. */
  text: string;
  passages: Passage[];
  words: WordItem[];
  onToggle: (id: string, selected: boolean) => void;
  onPassages: (keys: string[], ignored: boolean) => void;
}

interface Mark {
  start: number;
  end: number;
  id: string;
}

interface Paragraph {
  start: number;
  end: number;
  passages: Passage[];
  /** Index (dans la liste de toutes les marques) des mots de ce paragraphe. */
  marks: number[];
  ignored: boolean;
}

// Au-delà, une suite de passages ignorés (licence en anglais, notes…) est repliée en une ligne.
const FOLD_FROM = 3;

const reasonOf = (p: Passage) => (p.noise ? NOISE_LABELS[p.noise] : "Ignoré à la main");

function paragraphsOf(text: string, soft: boolean, passages: Passage[], marks: Mark[]): Paragraph[] {
  // Texte coupé à largeur fixe : un paragraphe va jusqu'à la ligne vide ; sinon chaque ligne en est un.
  const split = soft ? /\n[^\S\n]*\n/g : /\n/g;
  const ranges: [number, number][] = [];
  let at = 0;
  for (const m of text.matchAll(split)) {
    ranges.push([at, m.index ?? 0]);
    at = (m.index ?? 0) + m[0].length;
  }
  ranges.push([at, text.length]);
  return ranges
    .filter(([s, e]) => text.slice(s, e).trim())
    .map(([start, end]) => {
      const inside = passages.filter((p) => p.start < end && p.end > start);
      const ids: number[] = [];
      marks.forEach((m, i) => m.start >= start && m.end <= end && ids.push(i));
      return { start, end, passages: inside, marks: ids, ignored: inside.length > 0 && inside.every((p) => p.ignored) };
    });
}

/** Le texte, mots-clés soulignés : un clic ajoute le mot à la planche ou l'en retire. */
export function TextView({ text, passages, words, onToggle, onPassages }: Props) {
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const marks = useMemo(() => {
    const out: Mark[] = [];
    for (const w of words) if (!w.copyOf) for (const [start, end] of w.spans ?? []) out.push({ start, end, id: w.id });
    return out.sort((a, b) => a.start - b.start);
  }, [words]);
  const soft = useMemo(() => lineBreakMode(text) === "soft", [text]);
  const paragraphs = useMemo(() => paragraphsOf(text, soft, passages, marks), [text, soft, passages, marks]);
  // Un seul arrêt de tabulation pour tout le texte ; les flèches passent d'un mot à l'autre.
  const [active, setActive] = useState(0);
  const [unfolded, setUnfolded] = useState<Set<number>>(new Set());

  function focusMark(i: number, container: HTMLElement) {
    const n = Math.max(0, Math.min(marks.length - 1, i));
    setActive(n);
    container.querySelector<HTMLElement>(`[data-mark="${n}"]`)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const i = Number(target.dataset.mark);
    if (target.dataset.mark === undefined || Number.isNaN(i)) return;
    const move = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: marks.length - 1 }[e.key];
    if (move !== undefined) {
      e.preventDefault();
      focusMark(move, e.currentTarget);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const w = byId.get(marks[i].id);
      if (w) onToggle(w.id, !w.selected);
    }
  }

  function renderMark(i: number): ReactNode {
    const m = marks[i];
    const w = byId.get(m.id);
    if (!w) return text.slice(m.start, m.end);
    return (
      <span
        key={`m${i}`}
        role="button"
        data-mark={i}
        tabIndex={i === active ? 0 : -1}
        aria-pressed={w.selected}
        className="tv-mark"
        style={{ "--cat": CATEGORIES[w.category].color } as CSSProperties}
        title={w.selected ? `${w.label} : sur la planche (cliquer pour retirer)` : `${w.label} : cliquer pour ajouter à la planche`}
        onClick={() => {
          setActive(i);
          onToggle(w.id, !w.selected);
        }}
        onFocus={() => setActive(i)}
      >
        {text.slice(m.start, m.end)}
      </span>
    );
  }

  /** Le contenu d'un paragraphe : texte, mots cliquables, et passages ignorés au fil du texte. */
  function renderContent(para: Paragraph): ReactNode[] {
    const out: ReactNode[] = [];
    let at = para.start;
    let next = 0;
    const flush = (until: number) => {
      while (next < para.marks.length && marks[para.marks[next]].end <= until) {
        const i = para.marks[next++];
        if (marks[i].start < at) continue;
        if (marks[i].start > at) out.push(text.slice(at, marks[i].start));
        out.push(renderMark(i));
        at = marks[i].end;
      }
      if (until > at) out.push(text.slice(at, until));
      at = Math.max(at, until);
    };
    for (const p of para.passages) {
      if (!p.ignored) continue;
      flush(Math.max(at, p.start));
      out.push(
        <span key={`i${p.start}`} className="tv-ignored" title={`Passage ignoré : ${reasonOf(p)}`}>
          {text.slice(Math.max(at, p.start), p.end)}
        </span>,
        " ",
        <button key={`b${p.start}`} onClick={() => onPassages([p.key], false)} className="tv-include">
          <IconEye size={14} />
          Inclure
        </button>,
      );
      at = Math.max(at, p.end);
    }
    flush(para.end);
    return out;
  }

  function renderParagraph(para: Paragraph, key: number) {
    if (para.ignored) {
      const reasons = [...new Set(para.passages.map(reasonOf))].join(", ");
      return (
        <div key={key} className="tv-ignored-block">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-ink-soft">
              <IconEyeOff size={14} />
              Ignoré · {reasons}
            </span>
            <button onClick={() => onPassages(para.passages.map((p) => p.key), false)} className="btn-quiet text-xs">
              Inclure ce passage
            </button>
          </p>
          <p className={soft ? "tv-ignored-text tv-reflow" : "tv-ignored-text"}>{text.slice(para.start, para.end)}</p>
        </div>
      );
    }
    const content = para.passages.filter((p) => !p.ignored);
    const hasActive = para.marks.includes(active);
    return (
      <div key={key} className="tv-para group">
        {/* Texte coupé à largeur fixe : les lignes se recomposent à la largeur de l'écran. */}
        <p className={soft ? "tv-text tv-reflow" : "tv-text"}>{renderContent(para)}</p>
        {content.length > 0 && (
          <button
            onClick={() => onPassages(content.map((p) => p.key), true)}
            tabIndex={hasActive ? 0 : -1}
            className="tv-para-action"
            aria-label="Ignorer ce passage (ses mots ne seront plus proposés)"
            title="Ignorer ce passage : ses mots ne seront plus proposés"
          >
            <IconEyeOff size={18} />
          </button>
        )}
      </div>
    );
  }

  // Les suites de passages ignorés sont repliées.
  const blocks: ReactNode[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    let j = i;
    while (j < paragraphs.length && paragraphs[j].ignored) j++;
    if (j - i >= FOLD_FROM && !unfolded.has(i)) {
      const run = paragraphs.slice(i, j);
      const keys = run.flatMap((p) => p.passages.map((x) => x.key));
      const reasons = [...new Set(run.flatMap((p) => p.passages.map(reasonOf)))].join(", ");
      const start = i;
      blocks.push(
        <div key={`f${i}`} className="tv-ignored-block flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex min-w-[12rem] flex-1 items-center gap-2 text-sm text-ink-soft">
            <IconEyeOff size={16} className="shrink-0" />
            <span>
              <b className="text-ink">{run.length} passages ignorés</b> · {reasons}
            </span>
          </p>
          <button onClick={() => setUnfolded((s) => new Set(s).add(start))} className="btn-secondary btn-sm">
            Afficher
          </button>
          <button onClick={() => onPassages(keys, false)} className="btn-quiet">
            Tout inclure
          </button>
        </div>,
      );
      i = j - 1;
      continue;
    }
    if (j - i >= FOLD_FROM) {
      const start = i;
      blocks.push(
        <button
          key={`u${i}`}
          onClick={() =>
            setUnfolded((s) => {
              const n = new Set(s);
              n.delete(start);
              return n;
            })
          }
          className="btn-quiet self-start"
        >
          Replier les {j - i} passages ignorés
        </button>,
      );
      for (let k = i; k < j; k++) blocks.push(renderParagraph(paragraphs[k], k));
      i = j - 1;
      continue;
    }
    blocks.push(renderParagraph(paragraphs[i], i));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-control bg-tack/60 px-4 py-3 text-sm text-ink">
        <p className="basis-full font-bold sm:basis-auto">Cliquez sur un mot pour l&apos;ajouter à la planche ou l&apos;en retirer.</p>
        <span className="flex items-center gap-2 text-ink-soft">
          <span aria-hidden className="flex gap-1">
            {(["P", "V", "N"] as const).map((c) => (
              <span key={c} className="tv-mark" data-on style={{ "--cat": CATEGORIES[c].color } as CSSProperties}>
                mot
              </span>
            ))}
          </span>
          sur la planche, souligné à la couleur de sa carte
        </span>
        <span className="flex items-center gap-2 text-ink-soft">
          <span aria-hidden className="tv-mark">
            mot
          </span>
          proposé
        </span>
        <span className="flex items-center gap-2 text-ink-soft">
          <span aria-hidden className="tv-ignored">
            texte
          </span>
          ignoré
        </span>
      </div>
      <div className="tv flex flex-col gap-3" onKeyDown={onKeyDown}>
        {blocks}
      </div>
    </div>
  );
}
