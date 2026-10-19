// Mise en forme du résultat OCR : on écarte ce que Tesseract « lit » dans les illustrations,
// on remet les colonnes dans l'ordre (doubles pages d'albums) et on corrige les lettres que
// les polices manuscrites font confondre (« vne » → « une »).

interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: Bbox;
}

export interface OcrLine {
  words: OcrWord[];
  rowAttributes: { rowHeight: number };
}

/** Sous-ensemble du résultat « blocks » de Tesseract dont on a besoin. */
export type OcrBlocks = { paragraphs: { lines: OcrLine[] }[] }[] | null;

interface Segment {
  words: OcrWord[];
  x0: number;
  x1: number;
  y0: number;
}

/** Écart entre deux mots, en hauteurs de ligne, au-delà duquel ils appartiennent à deux zones de texte. */
const COLUMN_GAP = 3;
/** Confiance moyenne minimale d'un morceau de ligne (le texte réel dépasse 80, les dessins restent sous 50). */
const MIN_CONFIDENCE = 60;

function segmentsOf(line: OcrLine): Segment[] {
  // Tesseract mélange parfois l'ordre des mots quand deux colonnes partagent une ligne.
  const words = line.words.filter((w) => w.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const gap = COLUMN_GAP * Math.max(line.rowAttributes.rowHeight, 1);
  const out: Segment[] = [];
  for (const w of words) {
    const last = out[out.length - 1];
    if (last && w.bbox.x0 - last.x1 <= gap) {
      last.words.push(w);
      last.x1 = Math.max(last.x1, w.bbox.x1);
      last.y0 = Math.min(last.y0, w.bbox.y0);
    } else {
      out.push({ words: [w], x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0 });
    }
  }
  return out;
}

/** Vrai pour un morceau de texte plausible : confiance suffisante et surtout des lettres. */
function isText(seg: Segment): boolean {
  const text = seg.words.map((w) => w.text).join("");
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 3 || letters / text.length < 0.6) return false;
  const weight = seg.words.reduce((n, w) => n + w.text.length, 0);
  const confidence = seg.words.reduce((n, w) => n + w.confidence * w.text.length, 0) / weight;
  return confidence >= MIN_CONFIDENCE;
}

/** Regroupe les morceaux qui se chevauchent horizontalement : chaque groupe est une colonne. */
function columnsOf(segments: Segment[]): Segment[][] {
  const columns: { x1: number; segments: Segment[] }[] = [];
  for (const seg of [...segments].sort((a, b) => a.x0 - b.x0)) {
    const last = columns[columns.length - 1];
    if (last && seg.x0 <= last.x1) {
      last.segments.push(seg);
      last.x1 = Math.max(last.x1, seg.x1);
    } else {
      columns.push({ x1: seg.x1, segments: [seg] });
    }
  }
  return columns.map((c) => c.segments.sort((a, b) => a.y0 - b.y0));
}

/** Texte d'une page OCR, sans le bruit des illustrations, colonne par colonne. */
export function ocrPageText(blocks: OcrBlocks): string {
  const lines = (blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  const segments = lines.flatMap(segmentsOf).filter(isText);
  return columnsOf(segments)
    .map((col) => col.map((seg) => seg.words.map((w) => w.text).join(" ")).join("\n"))
    .join("\n\n");
}

// Confusions typiques des polices d'albums (u ouvert lu « v », t sans barre lu « f »…).
const CONFUSIONS: Record<string, string[]> = {
  v: ["u"],
  V: ["U"],
  f: ["t"],
  c: ["o"],
  J: ["l"],
  j: ["l"],
  é: ["ê", "è"],
  è: ["é", "ê"],
  ê: ["é", "è"],
  ä: ["à"],
  ï: ["i"],
};
const MAX_EDITS = 2;

/** Variantes d'un mot, rangées par nombre de lettres changées (index 0 : une lettre). */
function variants(word: string): string[][] {
  const chars = [...word];
  const spots = chars.flatMap((c, i) => (CONFUSIONS[c] ? [i] : []));
  const out: string[][] = Array.from({ length: MAX_EDITS }, () => []);
  const walk = (from: number, edits: number, acc: string[]) => {
    if (edits > 0) out[edits - 1].push(acc.join(""));
    if (edits === MAX_EDITS) return;
    for (let k = from; k < spots.length; k++) {
      const i = spots[k];
      for (const alt of CONFUSIONS[chars[i]]) {
        const next = [...acc];
        next[i] = alt;
        walk(k + 1, edits + 1, next);
      }
    }
  };
  walk(0, 0, chars);
  return out;
}

/**
 * Corrige les mots inconnus du dictionnaire quand une seule variante est un mot connu, en changeant
 * le moins de lettres possible (« savf » → « sauf » plutôt que « saut »). Les mots déjà connus,
 * noms propres et onomatopées restent tels quels.
 */
export function correctOcrText(text: string, isWord: (lower: string) => boolean): string {
  const known = (w: string) => isWord(w.toLocaleLowerCase("fr-FR"));
  return text.replace(/\p{L}{2,}/gu, (word) => {
    if (known(word)) return word;
    for (const level of variants(word)) {
      const found = new Set(level.filter(known));
      if (found.size === 1) return [...found][0];
      if (found.size > 1) return word;
    }
    return word;
  });
}

/** Nombre de mots reconnus par le dictionnaire : sert à comparer deux lectures d'une même page. */
export function knownWordCount(text: string, isWord: (lower: string) => boolean): number {
  return (text.match(/\p{L}{2,}/gu) ?? []).filter((w) => isWord(w.toLocaleLowerCase("fr-FR"))).length;
}

/**
 * Version en niveaux de gris où chaque pixel vaut max(R, V, B) : un fond coloré (ciel, herbe) devient
 * clair alors que le texte foncé le reste, là où la conversion habituelle de Tesseract les confond.
 */
export async function valueChannel(image: string | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(typeof image === "string" ? await (await fetch(image)).blob() : image);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = Math.max(px[i], px[i + 1], px[i + 2]);
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob();
}

let dictionary: Promise<Set<string>> | null = null;

/** Dictionnaire français complet (≈ 336 000 formes), chargé seulement quand l'OCR est utilisé. */
export function loadDictionary(): Promise<Set<string>> {
  dictionary ??= import("an-array-of-french-words/index.json")
    .then((m) => new Set((m.default as string[]).map((w) => w.normalize("NFC"))))
    .catch((err) => {
      dictionary = null;
      throw err;
    });
  return dictionary;
}
