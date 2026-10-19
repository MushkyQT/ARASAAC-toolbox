"use client";

import { useRef, useState } from "react";
import { ACCEPTED_FILES, readFile, readUrl } from "@/lib/ingest";
import { IconArrowRight, IconLink, IconUpload } from "./icons";

interface Props {
  text: string;
  onText: (text: string, title?: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  /** Des mots ont déjà été choisis : la nouvelle analyse les conserve. */
  reanalyze: boolean;
  /** Revenir aux mots sans rien changer. */
  onCancel?: () => void;
}

const EXAMPLE = `Il était une fois une petite fille que tout le monde appelait le Petit Chaperon Rouge. Un jour, sa mère lui dit : « Va porter cette galette et ce petit pot de beurre à ta grand-mère qui est malade. »
Dans la forêt, elle rencontra le loup. Le loup courut jusqu'à la maison de la grand-mère et la mangea. Le soir, un chasseur entendit le loup ronfler.`;

const countWords = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;

export function SourcePanel({ text, onText, onAnalyze, analyzing, reanalyze, onCancel }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function importFile(file: File) {
    setError(null);
    setNotice(null);
    setBusy(`Lecture de « ${file.name} »…`);
    try {
      const res = await readFile(file, (m, r) => {
        setBusy(m);
        setRatio(r);
      });
      if (!res.text.trim()) throw new Error("Aucun texte trouvé dans ce fichier. S'il s'agit d'une photo floue, essayez avec une image plus nette.");
      onText(res.text, file.name.replace(/\.[^.]+$/, ""));
      setNotice(res.notice ?? `Texte importé depuis « ${file.name} ». Relisez-le si besoin, puis trouvez les mots-clés.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fichier illisible.");
    } finally {
      setBusy(null);
      setRatio(undefined);
    }
  }

  async function importUrl() {
    if (!url.trim()) return;
    setError(null);
    setNotice(null);
    setBusy("Lecture de la page…");
    try {
      const res = await readUrl(url.trim());
      onText(res.text, res.title);
      setNotice(res.notice ?? "Texte de la page importé. Relisez-le si besoin, puis trouvez les mots-clés.");
      setLinkOpen(false);
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de lire cette page.");
    } finally {
      setBusy(null);
    }
  }

  const words = countWords(text);

  return (
    <div
      className="relative flex flex-col gap-4"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) importFile(f);
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-section font-bold">Le texte</h2>
        {!text.trim() && (
          <button className="btn-quiet" onClick={() => onText(EXAMPLE, "Le Petit Chaperon Rouge")}>
            Essayer avec un exemple
          </button>
        )}
      </div>
      <p className="-mt-2 max-w-prose text-ink-soft">
        Collez une histoire, un album, un conte ou une recette dans le cadre ci-dessous, ou importez-le.
      </p>

      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <button onClick={() => fileInput.current?.click()} disabled={Boolean(busy)} className="btn-secondary btn-sm">
          <IconUpload size={18} />
          Importer un fichier
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_FILES}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => setLinkOpen((o) => !o)}
          aria-expanded={linkOpen}
          aria-controls="source-link"
          disabled={Boolean(busy)}
          className="btn-secondary btn-sm"
        >
          <IconLink size={18} />
          Depuis une page web
        </button>
      </div>

      {linkOpen && (
        <form
          id="source-link"
          onSubmit={(e) => {
            e.preventDefault();
            importUrl();
          }}
          className="flex flex-col gap-2 rounded-control bg-tack/60 p-3 sm:p-4"
        >
          <label htmlFor="url" className="label-caps">
            Adresse de la page
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="url"
              type="url"
              required
              autoFocus
              placeholder="https://www.marmiton.org/recettes/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="field min-w-0 flex-1"
            />
            <button type="submit" disabled={Boolean(busy)} className="btn-primary">
              Importer la page
            </button>
          </div>
          <p className="text-sm text-ink-soft">
            Pour une recette, les ingrédients et les étapes sont repris tels quels. Pour une autre page, seul le texte principal est gardé.
          </p>
        </form>
      )}

      {busy && (
        <div role="status" className="flex flex-col gap-2 rounded-control bg-tack px-4 py-3 text-sm text-ink">
          <span>{busy}</span>
          {ratio !== undefined && (
            <div className="h-1.5 overflow-hidden rounded-full bg-rule">
              <div
                className="h-full origin-left bg-ink-blue transition-transform duration-(--duration-swap) ease-out"
                style={{ transform: `scaleX(${ratio})` }}
              />
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-wash px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && !busy && (
        <p role="status" className="rounded-control border border-attention/30 bg-attention-wash px-4 py-3 text-sm text-attention">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="source-text" className="label-caps">
          Texte à transformer en cartes
        </label>
        <textarea
          id="source-text"
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={12}
          placeholder="Il était une fois…"
          className="field w-full resize-y px-4 py-3 leading-relaxed"
        />
        <p className="text-sm text-ink-soft tabular-nums">
          {words.toLocaleString("fr-FR")} mot{words > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel && (
          <button onClick={onCancel} className="btn-quiet">
            Revenir aux mots sans changer
          </button>
        )}
        <button onClick={onAnalyze} disabled={!text.trim() || analyzing} className="btn-primary px-6 text-base">
          {analyzing ? "Recherche des mots…" : reanalyze ? "Mettre à jour les mots" : "Trouver les mots-clés"}
          {!analyzing && <IconArrowRight size={18} />}
        </button>
      </div>
      {reanalyze && (
        <p className="-mt-2 text-right text-sm text-ink-soft">Les cartes déjà choisies et leurs images sont conservées.</p>
      )}

      {dragging && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-2 flex items-center justify-center rounded-sheet border-2 border-dashed border-ink-blue bg-ink-blue-wash/90 sm:-inset-3"
        >
          <p className="font-display text-section font-bold text-ink-blue">Déposez le fichier pour l&apos;importer</p>
        </div>
      )}
    </div>
  );
}
