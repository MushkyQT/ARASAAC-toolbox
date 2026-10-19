"use client";

import { useRef, useState } from "react";
import { ACCEPTED_FILES, readFile, readUrl } from "@/lib/ingest";

type Tab = "texte" | "fichier" | "lien";

interface Props {
  text: string;
  onText: (text: string, title?: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
}

const EXAMPLE = `Il était une fois une petite fille que tout le monde appelait le Petit Chaperon Rouge. Un jour, sa mère lui dit : « Va porter cette galette et ce petit pot de beurre à ta grand-mère qui est malade. »
Dans la forêt, elle rencontra le loup. Le loup courut jusqu'à la maison de la grand-mère et la mangea. Le soir, un chasseur entendit le loup ronfler.`;

export function SourcePanel({ text, onText, onAnalyze, analyzing }: Props) {
  const [tab, setTab] = useState<Tab>("texte");
  const [busy, setBusy] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      if (!res.text.trim()) throw new Error("Aucun texte trouvé dans ce fichier.");
      onText(res.text, file.name.replace(/\.[^.]+$/, ""));
      setNotice(res.notice ?? null);
      setTab("texte");
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
      setNotice(res.notice ?? null);
      setTab("texte");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de lire cette page.");
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "texte", label: "Texte" },
    { id: "fichier", label: "Fichier" },
    { id: "lien", label: "Lien web" },
  ];

  return (
    <section aria-label="Texte" className="flex flex-col gap-4">
      <div className="flex">
        <div role="tablist" aria-label="Type de support" className="flex gap-1 rounded-control bg-tack p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`cursor-pointer rounded-control px-4 py-2 font-bold transition-[background-color,color,box-shadow] duration-(--duration-swap) ease-out ${
                tab === t.id ? "bg-sheet text-ink shadow-sheet" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "fichier" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) importFile(f);
          }}
          className={`flex flex-col items-center gap-3 rounded-sheet border-2 border-dashed px-6 py-10 text-center transition-colors duration-(--duration-swap) ease-out ${
            dragging ? "border-ink-blue bg-ink-blue-wash" : "border-line bg-tack/50"
          }`}
        >
          <button
            onClick={() => fileInput.current?.click()}
            className="btn-primary"
          >
            Choisir un fichier
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
        </div>
      )}

      {tab === "lien" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            importUrl();
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor="url" className="sr-only">
            Adresse de la page
          </label>
          <input
            id="url"
            type="url"
            required
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="field min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={Boolean(busy)}
            className="btn-primary"
          >
            Importer
          </button>
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
      {notice && !busy && <p className="rounded-control border border-attention/30 bg-attention-wash px-4 py-3 text-sm text-attention">{notice}</p>}

      <div className="flex flex-col gap-2">
        <label htmlFor="source-text" className="sr-only">
          Texte à analyser
        </label>
        <textarea
          id="source-text"
          value={text}
          onChange={(e) => onText(e.target.value)}
          rows={10}
          placeholder="Collez un texte…"
          className="field w-full resize-y px-4 py-3 leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-3">
          {!text.trim() && (
            <button
              className="btn-quiet"
              onClick={() => onText(EXAMPLE, "Le Petit Chaperon Rouge")}
            >
              Exemple
            </button>
          )}
          <button
            onClick={onAnalyze}
            disabled={!text.trim() || analyzing}
            className="btn-primary ml-auto px-6 text-base"
          >
            {analyzing ? "Analyse…" : "Analyser"}
          </button>
        </div>
      </div>
    </section>
  );
}
