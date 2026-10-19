"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { pictoImageUrl } from "@/lib/arasaac";
import { CATEGORIES, type CategoryCode } from "@/lib/categories";
import { NOISE_LABELS, type Passage } from "@/lib/nlp/passages";
import { hasChoices, visibleChoices } from "@/lib/senses";
import { lineBreakMode } from "@/lib/text";
import type { WordItem } from "@/lib/types";
import { IconEye, IconEyeOff, IconImage } from "./icons";
import { tiltOf, wordImage } from "./WordTile";

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

// Aperçu de l'image d'un mot survolé : il attend un instant avant d'apparaître, puis suit la souris
// de mot en mot sans attendre, et reste le temps de traverser l'espace entre deux mots.
const PEEK_DELAY = 250;
const PEEK_GRACE = 120;
const PEEK_WARM = 400;
// Côté de l'aperçu (px), comme `.tv-peek-card`, hauteur ajoutée par les points des autres images, et écart avec le mot.
const PEEK_SIZE = 64;
const PEEK_PIPS = 8;
const PEEK_GAP = 6;
// Mot à plusieurs pictogrammes : si la souris s'y attarde, l'aperçu les montre une fois tour à tour
// (5 au plus, comme sur la tuile), puis revient à l'image de la carte.
const PEEK_FRAMES = 5;
const PEEK_DWELL = 1000;
const PEEK_STEP = 1200;

/** Aperçu ouvert (ou sur le point de l'être) : le mot et sa position dans la vue. */
interface Peek {
  id: string;
  x: number;
  y: number;
  /** Sous le mot, faute de place au-dessus. */
  below: boolean;
  open: boolean;
  /** Passe d'un mot à l'autre en glissant, au lieu d'apparaître. */
  glide: boolean;
  /** Image montrée (0 : celle de la carte, puis les autres pictogrammes du mot). */
  frame: number;
  /** Tour des images, propre à chaque survol (0 : pas de tour, aperçu ouvert au clavier). */
  run: number;
}

interface Frame {
  src: string | null;
  category: CategoryCode;
}

/** Les images de l'aperçu : celle de la carte, puis les autres pictogrammes du mot, dans leur couleur. */
function framesOf(w: WordItem): Frame[] {
  const card = { src: wordImage(w), category: w.category };
  if (!hasChoices(w)) return [card];
  const others = visibleChoices(w, PEEK_FRAMES)
    .filter(([id]) => id !== w.pictoId)
    .slice(0, PEEK_FRAMES - 1);
  return [
    card,
    ...others.map(([id, category]) => ({
      src: pictoImageUrl(id, { resolution: 300, noColor: w.noColor, plural: w.plural }),
      // La couleur suit le pictogramme choisi, sauf si elle a été fixée à la main.
      category: w.categoryLocked ? w.category : category,
    })),
  ];
}

/** Centré au-dessus du mot (de la ligne survolée s'il est coupé), dessous s'il touche le haut de l'écran. */
function placePeek(view: HTMLElement, el: HTMLElement, pointerY?: number) {
  const box = view.getBoundingClientRect();
  const lines = [...el.getClientRects()];
  const r = lines.find((l) => pointerY !== undefined && pointerY >= l.top && pointerY <= l.bottom) ?? lines[0] ?? el.getBoundingClientRect();
  const below = r.top - PEEK_SIZE - PEEK_PIPS - PEEK_GAP < 8;
  // Point d'attache : le bas de l'aperçu au-dessus du mot, ou son haut en dessous.
  return {
    x: Math.max(0, Math.min(r.left + r.width / 2 - PEEK_SIZE / 2 - box.left, box.width - PEEK_SIZE)),
    y: (below ? r.bottom + PEEK_GAP : r.top - PEEK_GAP) - box.top,
    below,
  };
}

/**
 * La mini-carte du mot, posée au-dessus du texte. S'il a plusieurs pictogrammes, une deuxième carte
 * dépasse derrière, et des points disent laquelle des images est montrée.
 */
function PeekCard({ word, peek }: { word: WordItem; peek: Peek }) {
  const frames = framesOf(word);
  const frame = frames[Math.min(peek.frame, frames.length - 1)];
  return (
    <div
      aria-hidden
      className="tv-peek"
      data-open={peek.open || undefined}
      data-glide={peek.glide || undefined}
      data-below={peek.below || undefined}
      data-stack={frames.length > 1 || undefined}
      style={{ transform: `translate(${peek.x}px, ${peek.y}px)` }}
    >
      <div className="tv-peek-stack" style={{ "--cat": CATEGORIES[frame.category].color, "--tilt": `${tiltOf(word.id)}deg` } as CSSProperties}>
        <div className="tv-peek-back" />
        <div className="tv-peek-card">
          <div className="tv-peek-pic">
            {frame.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={frame.src} src={frame.src} alt="" className="swap-in h-full w-full object-contain" />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-0.5 text-center text-xs leading-tight text-ink-soft">
                <IconImage size={18} />
                Sans image
              </span>
            )}
          </div>
          {frames.length > 1 && (
            <div className="tv-peek-pips">
              {frames.map((f, k) => (
                <span key={k} data-on={k === peek.frame || undefined} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const viewRef = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const peekTimer = useRef(0);
  const peekOpen = useRef(false);
  const peekClosedAt = useRef(0);
  // Aperçu ouvert au clavier : la sortie du mot le referme (pas un clic sur un autre mot à la souris).
  const peekByFocus = useRef(false);
  const peekRuns = useRef(0);

  function openPeek(at: Omit<Peek, "open" | "glide">, glide: boolean) {
    peekOpen.current = true;
    setPeek({ ...at, open: true, glide });
  }

  /** Sans pointeur (focus au clavier), l'aperçu s'ouvre tout de suite. */
  function peekAt(id: string, el: HTMLElement, pointer?: { clientY: number; timeStamp: number }) {
    if (!viewRef.current) return;
    window.clearTimeout(peekTimer.current);
    const at = { id, ...placePeek(viewRef.current, el, pointer?.clientY), frame: 0, run: pointer ? ++peekRuns.current : 0 };
    if (peekOpen.current) return openPeek(at, true);
    if (!pointer || pointer.timeStamp - peekClosedAt.current < PEEK_WARM) return openPeek(at, false);
    // Encore caché : l'image commence à charger pendant le délai.
    setPeek({ ...at, open: false, glide: false });
    peekTimer.current = window.setTimeout(() => openPeek(at, false), PEEK_DELAY);
  }

  function closePeek(delay = PEEK_GRACE) {
    window.clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => {
      // Même horloge que le `timeStamp` des évènements.
      if (peekOpen.current) peekClosedAt.current = performance.now();
      peekOpen.current = false;
      peekByFocus.current = false;
      setPeek((p) => p && { ...p, open: false, glide: false });
    }, delay);
  }

  const peekWord = peek && byId.get(peek.id);
  const peekShown = peek?.open ?? false;
  const peekRun = peek?.run ?? 0;
  // Les autres images du mot survolé (adresses séparées par une espace) : elles seules relancent le tour.
  const peekOthers = peekWord
    ? framesOf(peekWord)
        .slice(1)
        .map((f) => f.src)
        .join(" ")
    : "";

  useEffect(() => {
    if (!peekShown || !peekRun || !peekOthers || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stopped = false;
    let timer = 0;
    const wait = (ms: number) => new Promise((done) => (timer = window.setTimeout(done, ms)));
    const show = (frame: number) => setPeek((p) => (p && p.run === peekRun ? { ...p, frame } : p));
    // Chargées pendant l'attente : chaque image est prête quand vient son tour (une image introuvable est sautée).
    const ready = peekOthers.split(" ").map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().then(
        () => true,
        () => false,
      );
    });
    (async () => {
      await wait(PEEK_DWELL);
      for (let k = 0; k < ready.length; k++) {
        if (!(await ready[k]) || stopped) continue;
        show(k + 1);
        await wait(PEEK_STEP);
      }
      if (!stopped) show(0);
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [peekShown, peekRun, peekOthers]);
  useEffect(() => {
    if (!peekShown) return;
    // Échap ferme l'aperçu, où que soit le focus ; il ne revient qu'au prochain mot survolé.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      window.clearTimeout(peekTimer.current);
      peekOpen.current = false;
      setPeek((p) => p && { ...p, open: false, glide: false });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [peekShown]);

  useEffect(() => () => window.clearTimeout(peekTimer.current), []);

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
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    const frames = peekShown && peekWord?.id === marks[i].id ? framesOf(peekWord).length : 0;
    if (step !== undefined && frames > 1) {
      // Les flèches haut et bas passent d'une image du mot à l'autre, à la main (le tour s'arrête).
      e.preventDefault();
      setPeek((p) => p && { ...p, run: 0, frame: (p.frame + step + frames) % frames });
    } else if (move !== undefined) {
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
      // eslint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-description (ARIA 1.3) vaut pour tous les rôles
      <span
        key={`m${i}`}
        role="button"
        data-mark={i}
        tabIndex={i === active ? 0 : -1}
        aria-pressed={w.selected}
        className="tv-mark"
        style={{ "--cat": CATEGORIES[w.category].color } as CSSProperties}
        // Pas de `title` : l'infobulle du navigateur doublerait l'aperçu de l'image.
        aria-description={`${w.label} : ${w.selected ? "sur la planche (cliquer pour retirer)" : "cliquer pour ajouter à la planche"}${
          hasChoices(w) ? ", plusieurs pictogrammes possibles" : ""
        }`}
        onClick={() => {
          setActive(i);
          onToggle(w.id, !w.selected);
        }}
        onPointerEnter={(e) => e.pointerType !== "touch" && peekAt(w.id, e.currentTarget, e)}
        onPointerLeave={(e) => e.pointerType !== "touch" && closePeek()}
        onFocus={(e) => {
          setActive(i);
          if (!e.currentTarget.matches(":focus-visible")) return;
          peekByFocus.current = true;
          peekAt(w.id, e.currentTarget);
        }}
        onBlur={() => peekByFocus.current && closePeek(0)}
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
      <div ref={viewRef} className="tv relative flex flex-col gap-3" onKeyDown={onKeyDown}>
        {blocks}
        {peekWord && <PeekCard word={peekWord} peek={peek} />}
      </div>
    </div>
  );
}
