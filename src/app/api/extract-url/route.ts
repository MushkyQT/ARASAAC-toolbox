import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractFromHtml } from "@/lib/ingest/web";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Refuse tout ce qui n'est pas une page web publique (protection SSRF). */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Adresse invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Seules les adresses http(s) sont acceptées.");
  if (url.username || url.password) throw new Error("Adresse invalide.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Cette adresse n'est pas accessible.");
  }
  return url;
}

async function fetchHtml(start: string): Promise<{ html: string; url: string }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; AtelierPictos/1.0; +https://arasaac.org)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fr-FR,fr;q=0.9",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`La page a répondu ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new Error("Cette adresse n'est pas une page web (pour un PDF, téléchargez-le puis importez le fichier).");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Page vide.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    // Au-delà de MAX_BYTES on garde le début de la page : le contenu principal y est presque toujours.
    const buf = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.byteLength;
    }
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? "utf-8";
    let html: string;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = new TextDecoder().decode(buf);
    }
    return { html, url: url.toString() };
  }
  throw new Error("Trop de redirections.");
}

export async function POST(request: Request) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof url !== "string" || url.length > 2048) {
    return Response.json({ error: "Adresse manquante." }, { status: 400 });
  }
  try {
    const page = await fetchHtml(url.trim());
    const extracted = extractFromHtml(page.html, page.url);
    if (!extracted) return Response.json({ error: "Aucun texte trouvé sur cette page." }, { status: 422 });
    return Response.json(extracted);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "La page met trop de temps à répondre."
        : err instanceof Error
          ? err.message
          : "Impossible de lire cette page.";
    return Response.json({ error: message }, { status: 422 });
  }
}
