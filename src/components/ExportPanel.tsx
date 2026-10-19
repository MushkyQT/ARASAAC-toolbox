"use client";

import { useState, type ReactNode } from "react";
import { FONTS, fetchImageBytes, fontUrl, type CardSpec } from "@/lib/cards/model";
import type { CardSettings, FontId } from "@/lib/types";
import { IconChevronDown, IconDownload, IconPrinter } from "./icons";

interface Props {
  cards: CardSpec[];
  pages: number;
  perPage: number;
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

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px]" />
      {children}
    </label>
  );
}

function ExportButton({
  primary,
  disabled,
  onClick,
  label,
  hint,
}: {
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button onClick={onClick} disabled={disabled} className={`${primary ? "btn-primary" : "btn-secondary"} w-full justify-start`}>
        <IconDownload size={18} />
        {label}
      </button>
      <p className="px-1 text-xs leading-snug text-ink-soft">{hint}</p>
    </div>
  );
}

/** Le format des cartes, la mise en page des planches, et les fichiers à télécharger. */
/** Groupe repliable : son titre résume les valeurs en cours, pour savoir sans l'ouvrir ce qui sera imprimé. */
function Disclosure({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-control border border-rule">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-control px-3 py-2.5 transition-colors duration-(--duration-swap) ease-out hover:bg-tack [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{title}</span>
          <span className="block truncate text-xs text-ink-soft">{summary}</span>
        </span>
        <IconChevronDown size={18} className="shrink-0 text-ink-soft transition-transform duration-(--duration-hover) ease-out group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-rule px-3 pb-4 pt-3">{children}</div>
    </details>
  );
}

export function ExportPanel({ cards, pages, perPage, settings, onSettings, title }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const empty = cards.length === 0;

  async function run(label: string, success: string, task: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setDone(null);
    try {
      await task();
      setDone(success);
    } catch (e) {
      console.error(e);
      setError(
        `${e instanceof Error ? e.message : "L'export a échoué."} Vérifiez la connexion (les images viennent d'ARASAAC), puis réessayez.`,
      );
    } finally {
      setBusy(null);
    }
  }

  async function fontBytes() {
    const { loadFontBytes } = await import("@/lib/cards/measure");
    return loadFontBytes(fontUrl(settings));
  }

  const exportPdf = () =>
    run("Création du PDF…", "PDF téléchargé. Imprimez-le en taille réelle (100 %).", async () => {
      const { buildCardsPdf } = await import("@/lib/cards/pdf");
      const bytes = await buildCardsPdf({ cards, settings, fontBytes: await fontBytes(), loadImage: fetchImageBytes, title });
      download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${fileBase(title)}.pdf`);
    });

  const exportPptx = (mode: "sheet" | "single") =>
    run("Création du fichier pour Canva…", "Fichier téléchargé. Dans Canva : Créer → Importer un fichier.", async () => {
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
    run("Création des images…", "Images téléchargées (une par carte, dans un fichier .zip).", async () => {
      const [{ buildCardsZip }, { measurerFromFont }] = await Promise.all([import("@/lib/cards/png"), import("@/lib/cards/measure")]);
      const blob = await buildCardsZip(cards, settings, measurerFromFont(await fontBytes()), fontUrl(settings), fetchImageBytes);
      download(blob, `${fileBase(title)}-images.zip`);
    });

  const size = SIZES.find((s) => s.mm === settings.sizeMm)?.label ?? `${settings.sizeMm / 10} cm`;
  const disabled = empty || Boolean(busy);
  const orderLabel = { text: "ordre du texte", category: "par couleur", alpha: "ordre alphabétique" }[settings.order];
  const settingsSummary = [
    size,
    FONTS[settings.font].name.replace(/ \(.*\)$/, "") + (settings.bold ? " gras" : ""),
    `bordure ${settings.borderMm.toLocaleString("fr-FR")} mm`,
    orderLabel,
    settings.blackWhite ? "noir et blanc" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-section font-bold">L&apos;impression</h2>
        <p className="text-sm text-ink tabular-nums">
          {empty ? (
            "Aucune carte sur la planche pour l'instant."
          ) : (
            <>
              <b>
                {cards.length} carte{cards.length > 1 ? "s" : ""}
              </b>{" "}
              · {pages} page{pages > 1 ? "s" : ""} A4
            </>
          )}
        </p>
      </div>

      <ExportButton
        primary
        disabled={disabled}
        onClick={exportPdf}
        label="PDF à imprimer"
        hint="Imprimez en « taille réelle » (100 %). La mention de licence ARASAAC est incluse."
      />
      {busy && (
        <p role="status" className="flex items-center gap-2 text-sm text-ink">
          <IconPrinter size={18} className="text-ink-blue" />
          {busy}
        </p>
      )}
      {done && !busy && (
        <p role="status" className="text-sm text-ink">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-wash px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Disclosure title="Autres formats" summary="Pour Canva (.pptx) · images PNG">
          <ExportButton
            disabled={disabled}
            onClick={() => exportPptx("sheet")}
            label="Pour Canva : planches A4"
            hint="Fichier .pptx. Dans Canva : Créer → Importer un fichier. Bordures, mots et images restent modifiables."
          />
          <ExportButton
            disabled={disabled}
            onClick={() => exportPptx("single")}
            label="Pour Canva : une carte par page"
            hint={`Fichier .pptx avec une page de ${size} par carte.`}
          />
          <ExportButton disabled={disabled} onClick={exportPng} label="Images PNG" hint="Une image par carte, en 300 dpi, dans un fichier .zip." />
        </Disclosure>

        <Disclosure title="Réglages des cartes" summary={settingsSummary}>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-ink" id="size-label">
              Taille
            </span>
            <div role="group" aria-labelledby="size-label" className="flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.mm}
                  onClick={() => onSettings({ sizeMm: s.mm })}
                  aria-pressed={settings.sizeMm === s.mm}
                  className={`min-w-14 cursor-pointer rounded-control border-2 border-ink px-3 py-1 text-sm font-bold tabular-nums transition-colors duration-(--duration-swap) ease-out ${
                    settings.sizeMm === s.mm ? "bg-ink text-sheet" : "bg-sheet text-ink hover:bg-tack"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-soft tabular-nums">{perPage} cartes par page A4. Le PDF est à la taille exacte.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-ink">Police du mot</span>
              <select
                value={settings.font}
                onChange={(e) => onSettings({ font: e.target.value as FontId })}
                className="field cursor-pointer pl-3 pr-9 text-sm"
              >
                {Object.entries(FONTS).map(([id, f]) => (
                  <option key={id} value={id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-ink">
                Bordure : <span className="tabular-nums">{settings.borderMm.toLocaleString("fr-FR")} mm</span>
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
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Check checked={settings.bold} onChange={(bold) => onSettings({ bold })}>
              Mot en gras
            </Check>
            <Check checked={settings.rounded} onChange={(rounded) => onSettings({ rounded })}>
              Coins arrondis
            </Check>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold text-ink">Ordre des cartes</span>
            <select
              value={settings.order}
              onChange={(e) => onSettings({ order: e.target.value as CardSettings["order"] })}
              className="field cursor-pointer pl-3 pr-9 text-sm"
            >
              <option value="text">Dans l&apos;ordre du texte</option>
              <option value="category">Regroupées par couleur</option>
              <option value="alpha">Par ordre alphabétique</option>
            </select>
          </label>
          <div className="flex flex-col gap-2">
            <Check checked={settings.cutMarks} onChange={(cutMarks) => onSettings({ cutMarks })}>
              Repères de découpe
            </Check>
            <Check checked={settings.blackWhite} onChange={(blackWhite) => onSettings({ blackWhite })}>
              Toutes les images en noir et blanc
            </Check>
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
