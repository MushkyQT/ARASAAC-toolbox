// Géométrie des cartes et des planches, en millimètres, origine en haut à gauche.
// Partagée par l'aperçu, le PDF, le PPTX (Canva) et les PNG pour garantir un rendu identique.

export const A4 = { width: 210, height: 297 };
export const MM_PER_PT = 25.4 / 72;
export const PT_PER_MM = 72 / 25.4;

const MIN_MARGIN = 8;
const GUTTER = 6;
/** Hauteur de la ligne de crédit ARASAAC en bas de page. */
const FOOTER = 6;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageGrid {
  cols: number;
  rows: number;
  perPage: number;
  gutter: number;
  marginX: number;
  marginY: number;
  /** Position de chaque emplacement de carte sur la page. */
  slots: Rect[];
}

function fit(available: number, size: number): { count: number; gutter: number } {
  const withGutter = Math.floor((available + GUTTER) / (size + GUTTER));
  const without = Math.floor(available / size);
  // On garde les gouttières (plus faciles à découper) sauf si elles font perdre une carte.
  return withGutter >= without ? { count: Math.max(1, withGutter), gutter: GUTTER } : { count: without, gutter: 0 };
}

/** Grille A4 portrait : 8 cm → 2 × 3 cartes par page. */
export function pageGrid(sizeMm: number): PageGrid {
  const h = fit(A4.width - 2 * MIN_MARGIN, sizeMm);
  const v = fit(A4.height - 2 * MIN_MARGIN - FOOTER, sizeMm);
  const gutter = Math.min(h.gutter, v.gutter);
  const cols = h.count;
  const rows = v.count;
  const gridW = cols * sizeMm + (cols - 1) * gutter;
  const gridH = rows * sizeMm + (rows - 1) * gutter;
  const marginX = (A4.width - gridW) / 2;
  const marginY = (A4.height - FOOTER - gridH) / 2;
  const slots: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({ x: marginX + c * (sizeMm + gutter), y: marginY + r * (sizeMm + gutter), w: sizeMm, h: sizeMm });
    }
  }
  return { cols, rows, perPage: cols * rows, gutter, marginX, marginY, slots };
}

export interface CardBoxes {
  /** Rectangle de la bordure (milieu du trait). */
  border: Rect;
  borderWidth: number;
  /** Zone du mot, au-dessus de l'image. */
  label: Rect;
  /** Carré de l'image. */
  image: Rect;
  /** Taille de police maximale (pt) pour le mot. */
  maxFontPt: number;
  minFontPt: number;
  cornerRadius: number;
}

/** Disposition intérieure d'une carte (relative à son coin haut-gauche). Reproduit le modèle « Groupe communication ». */
export function cardBoxes(sizeMm: number, borderMm: number, rounded: boolean): CardBoxes {
  const s = sizeMm;
  const b = Math.min(borderMm, s * 0.1);
  const pad = s * 0.05;
  const inner = s - 2 * b;
  const labelH = s * 0.2;
  const label: Rect = { x: b + pad, y: b + pad * 0.6, w: inner - 2 * pad, h: labelH };
  const imgTop = label.y + label.h + pad * 0.3;
  const imgAvailH = s - b - pad - imgTop;
  const imgSide = Math.min(imgAvailH, inner - 2 * pad);
  const image: Rect = { x: (s - imgSide) / 2, y: imgTop + (imgAvailH - imgSide) / 2, w: imgSide, h: imgSide };
  return {
    border: { x: b / 2, y: b / 2, w: s - b, h: s - b },
    borderWidth: b,
    label,
    image,
    maxFontPt: s * 0.3,
    minFontPt: s * 0.13,
    cornerRadius: rounded ? s * 0.06 : 0,
  };
}

export interface FittedLabel {
  lines: string[];
  sizePt: number;
}

export const LINE_HEIGHT = 1.15;

/**
 * Taille de police la plus grande pour que le mot tienne dans sa zone,
 * sur une ligne ou deux (« POMME / DE TERRE »).
 * `measure` renvoie la largeur en points d'un texte à une taille donnée.
 */
export function fitLabel(
  text: string,
  box: { w: number; h: number },
  maxPt: number,
  minPt: number,
  measure: (text: string, sizePt: number) => number,
): FittedLabel {
  const maxW = box.w * PT_PER_MM;
  const maxH = box.h * PT_PER_MM;
  const sizeFor = (lines: string[]) => {
    const widest = Math.max(...lines.map((l) => measure(l, 1)));
    const byWidth = widest > 0 ? maxW / widest : maxPt;
    const byHeight = maxH / (lines.length * LINE_HEIGHT);
    return Math.min(maxPt, byWidth, byHeight);
  };

  let best: FittedLabel = { lines: [text], sizePt: sizeFor([text]) };
  const words = text.split(" ");
  if (words.length > 1) {
    for (let k = 1; k < words.length; k++) {
      const lines = [words.slice(0, k).join(" "), words.slice(k).join(" ")];
      const size = sizeFor(lines);
      // Une seule ligne reste préférable tant qu'elle est lisible.
      if (size > best.sizePt * 1.15) best = { lines, sizePt: size };
    }
  }
  best.sizePt = Math.max(minPt, Math.floor(best.sizePt * 2) / 2);
  return best;
}
