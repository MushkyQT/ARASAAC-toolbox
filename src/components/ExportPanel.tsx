"use client";

import { useState } from "react";
import { FONTS, fetchImageBytes, fontUrl, type CardSpec } from "@/lib/cards/model";
import type { CardSettings, FontId } from "@/lib/types";

interface Props {
  cards: CardSpec[];
  settings: CardSettings;
  onSettings: (patch: Partial<CardSettings>) => void;
  title: string;
}

const SIZES = [
  { mm: 50, label: "5 cm" },
  { mm: 60, label: "6 cm" },
  { mm: 80, label: "8 cm" },
  { mm: 100, label: "10 cm" },
];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function fileBase(title: string) {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `pictos-${base || "planche"}`;
}

async function toDataUrl(bytes: Uint8Array) {
  const blob = new Blob([bytes as BlobPart], { type: "image/png" });
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function ExportPanel({ cards, settings, onSettings, title }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const empty = cards.length === 0;

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await task();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "L'export a échoué.");
    } finally {
      setBusy(null);
    }
  }

  async function fontBytes() {
    const { loadFontBytes } = await import("@/lib/cards/measure");
    return loadFontBytes(fontUrl(settings));
  }

  const exportPdf = () =>
    run("Création du PDF…", async () => {
      const { buildCardsPdf } = await import("@/lib/cards/pdf");
      const bytes = await buildCardsPdf({ cards, settings, fontBytes: await fontBytes(), loadImage: fetchImageBytes, title });
      download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${fileBase(title)}.pdf`);
    });

  const exportPptx = (mode: "sheet" | "single") =>
    run("Création du fichier pour Canva…", async () => {
      const [{ buildCardsPptx }, { measurerFromFont }] = await Promise.all([
        import("@/lib/cards/pptx"),
        import("@/lib/cards/measure"),
      ]);
      const blob = await buildCardsPptx({
        cards,
        settings,
        mode,
        title,
        measure: measurerFromFont(await fontBytes()),
        loadImageDataUrl: async (url) => toDataUrl(await fetchImageBytes(url)),
      });
      download(blob, `${fileBase(title)}${mode === "single" ? "-cartes" : ""}.pptx`);
    });

  const exportPng = () =>
    run("Création des images…", async () => {
      const [{ buildCardsZip }, { measurerFromFont }] = await Promise.all([import("@/lib/cards/png"), import("@/lib/cards/measure")]);
      const blob = await buildCardsZip(cards, settings, measurerFromFont(await fontBytes()), fontUrl(settings), fetchImageBytes);
      download(blob, `${fileBase(title)}-images.zip`);
    });

  const btn = "w-full justify-start";

  return (
    <section aria-label="Planche" className="flex flex-col gap-5">

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Taille des cartes</legend>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s.mm}
              onClick={() => onSettings({ sizeMm: s.mm })}
              aria-pressed={settings.sizeMm === s.mm}
              className={`cursor-pointer rounded-control border-2 border-ink px-3 py-1 text-sm font-bold tabular-nums transition-colors duration-(--duration-swap) ease-out ${
                settings.sizeMm === s.mm ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-tack"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="label-caps">Police</span>
          <select
            value={settings.font}
            onChange={(e) => onSettings({ font: e.target.value as FontId })}
            className="field cursor-pointer px-2"
          >
            {Object.entries(FONTS).map(([id, f]) => (
              <option key={id} value={id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps">
            Bordure : <span className="tabular-nums">{settings.borderMm.toLocaleString("fr-FR")}</span> mm
          </span>
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={settings.borderMm}
            onChange={(e) => onSettings({ borderMm: Number(e.target.value) })}
            className="h-10 cursor-pointer"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps">Ordre</span>
          <select
            value={settings.order}
            onChange={(e) => onSettings({ order: e.target.value as CardSettings["order"] })}
            className="field cursor-pointer px-2"
          >
            <option value="text">Texte</option>
            <option value="category">Par couleur</option>
            <option value="alpha">Alphabétique</option>
          </select>
        </label>
        <div className="flex flex-col gap-1.5 pt-1 text-ink">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={settings.bold} onChange={(e) => onSettings({ bold: e.target.checked })} /> Gras
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={settings.rounded} onChange={(e) => onSettings({ rounded: e.target.checked })} /> Coins arrondis
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={settings.cutMarks} onChange={(e) => onSettings({ cutMarks: e.target.checked })} /> Repères
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={settings.blackWhite} onChange={(e) => onSettings({ blackWhite: e.target.checked })} /> Noir et blanc
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button onClick={exportPdf} disabled={empty || Boolean(busy)} className={`btn-primary ${btn}`}>
          PDF
        </button>
        <button onClick={() => exportPptx("sheet")} disabled={empty || Boolean(busy)} className={`btn-secondary ${btn}`}>
          Canva : planches A4
        </button>
        <button onClick={() => exportPptx("single")} disabled={empty || Boolean(busy)} className={`btn-secondary ${btn}`}>
          Canva : une carte par page
        </button>
        <button onClick={exportPng} disabled={empty || Boolean(busy)} className={`btn-secondary ${btn}`}>
          Images PNG (.zip)
        </button>
      </div>

      {busy && (
        <p role="status" className="text-sm text-ink-soft">
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-wash px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-sm text-ink-soft">Imprimer en taille réelle (100 %).</p>
    </section>
  );
}
