// Lecture des documents, entièrement dans le navigateur (le fichier ne quitte pas l'ordinateur).

export interface IngestResult {
  text: string;
  /** Message à afficher (ex. texte reconnu par OCR, à relire). */
  notice?: string;
}

export type Progress = (message: string, ratio?: number) => void;

const MAX_OCR_PAGES = 30;

/** Recolle les mots coupés en fin de ligne et nettoie les espaces d'un texte extrait. */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readPdf(file: File, onProgress: Progress): Promise<IngestResult> {
  const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = text as string[];
  const joined = cleanExtractedText(pages.join("\n\n"));
  // Peu de texte par page : album scanné ou mis en page en images → reconnaissance de caractères.
  if (joined.replace(/\s/g, "").length >= 20 * totalPages) return { text: joined };

  const count = Math.min(totalPages, MAX_OCR_PAGES);
  const images: string[] = [];
  for (let i = 1; i <= count; i++) {
    onProgress(`Préparation de la page ${i}/${count}…`, (i - 1) / count / 2);
    images.push(await renderPageAsImage(pdf, i, { scale: 2, toDataURL: true }));
  }
  const ocr = await recognize(images, (m, r) => onProgress(m, 0.5 + (r ?? 0) / 2));
  return {
    text: ocr,
    notice: `Texte lu par OCR${totalPages > count ? ` (${count} premières pages)` : ""} : à relire.`,
  };
}

async function readDocx(file: File): Promise<IngestResult> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { text: cleanExtractedText(value) };
}

async function readOdt(file: File): Promise<IngestResult> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error("Fichier OpenDocument illisible.");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
  const blocks = [...doc.getElementsByTagNameNS(NS, "h"), ...doc.getElementsByTagNameNS(NS, "p")];
  // Conserver l'ordre du document.
  blocks.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return { text: cleanExtractedText(blocks.map((b) => b.textContent ?? "").join("\n")) };
}

async function recognize(images: (string | File)[], onProgress: Progress): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker("fra", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress(`Lecture de l'image ${current + 1}/${images.length}…`, (current + m.progress) / images.length);
      } else if (m.status.startsWith("loading")) {
        onProgress("Chargement du module de lecture (première fois uniquement)…");
      }
    },
  });
  try {
    const out: string[] = [];
    for (; current < images.length; current++) {
      const { data } = await worker.recognize(images[current]);
      out.push(data.text);
    }
    return cleanExtractedText(out.join("\n\n"));
  } finally {
    await worker.terminate();
  }
}

export const ACCEPTED_FILES = ".pdf,.docx,.odt,.txt,.md,.rtf,.html,.htm,image/*";

export async function readFile(file: File, onProgress: Progress = () => {}): Promise<IngestResult> {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (type === "application/pdf" || name.endsWith(".pdf")) return readPdf(file, onProgress);
  if (name.endsWith(".docx")) return readDocx(file);
  if (name.endsWith(".odt")) return readOdt(file);
  if (type.startsWith("image/")) {
    const text = await recognize([file], onProgress);
    return { text, notice: "Texte lu par OCR : à relire." };
  }
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    const doc = new DOMParser().parseFromString(await file.text(), "text/html");
    return { text: cleanExtractedText(doc.body.innerText || doc.body.textContent || "") };
  }
  if (name.endsWith(".doc")) throw new Error("Ancien format Word (.doc) : enregistrez-le en .docx ou en PDF.");
  return { text: cleanExtractedText(await file.text()) };
}

export interface UrlResult extends IngestResult {
  title?: string;
}

/** Récupère le texte d'une page web via le serveur (recettes : données structurées schema.org en priorité). */
export async function readUrl(url: string): Promise<UrlResult> {
  const res = await fetch("/api/extract-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = (await res.json()) as { text?: string; title?: string; error?: string; kind?: string };
  if (!res.ok || !data.text) throw new Error(data.error ?? "Impossible de lire cette page.");
  return { text: cleanExtractedText(data.text), title: data.title };
}
