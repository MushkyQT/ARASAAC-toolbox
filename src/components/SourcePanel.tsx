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
        <div role="tablist" aria-label="Type de support" className="flex rounded-full bg-stone-100 p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 transition ${
                tab === t.id ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
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
          className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragging ? "border-emerald-500 bg-emerald-50" : "border-stone-300 bg-stone-50"
          }`}
        >
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700"
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
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
          <button
            type="submit"
            disabled={Boolean(busy)}
            className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Importer
          </button>
        </form>
      )}

      {busy && (
        <div role="status" className="flex flex-col gap-2 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <span>{busy}</span>
          {ratio !== undefined && (
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && !busy && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}

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
          className="w-full resize-y rounded-2xl border border-stone-300 bg-white px-4 py-3 leading-relaxed text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
        <div className="flex flex-wrap items-center gap-3">
          {!text.trim() && (
            <button
              className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-800"
              onClick={() => onText(EXAMPLE, "Le Petit Chaperon Rouge")}
            >
              Exemple
            </button>
          )}
          <button
            onClick={onAnalyze}
            disabled={!text.trim() || analyzing}
            className="ml-auto rounded-full bg-emerald-700 px-6 py-2.5 font-medium text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analyzing ? "Analyse…" : "Analyser"}
          </button>
        </div>
      </div>
    </section>
  );
}
