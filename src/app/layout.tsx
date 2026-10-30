import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Polices de l'interface, servies par l'application (public/fonts/ui) : aucune requête vers un tiers.
// Les polices des cartes (Open Sans, Andika, Atkinson Hyperlegible) restent dans public/fonts pour les exports.
const atkinsonNext = localFont({
  variable: "--font-atkinson-next",
  display: "swap",
  fallback: ["Verdana", "Segoe UI", "sans-serif"],
  src: [
    { path: "../../public/fonts/ui/AtkinsonHyperlegibleNext-400.woff2", weight: "400" },
    { path: "../../public/fonts/ui/AtkinsonHyperlegibleNext-700.woff2", weight: "700" },
    { path: "../../public/fonts/ui/AtkinsonHyperlegibleNext-800.woff2", weight: "800" },
  ],
});

const atkinsonMono = localFont({
  variable: "--font-atkinson-mono",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "monospace"],
  adjustFontFallback: false,
  src: [
    { path: "../../public/fonts/ui/AtkinsonHyperlegibleMono-500.woff2", weight: "500" },
    { path: "../../public/fonts/ui/AtkinsonHyperlegibleMono-600.woff2", weight: "600" },
  ],
});

export const metadata: Metadata = {
  title: "Atelier Pictos — cartes ARASAAC à partir d'un texte",
  description:
    "Transformez une histoire, un album, un conte ou une recette en cartes pictogrammes ARASAAC de 8 × 8 cm, avec le code couleur de chaque nature de mot.",
};

export const viewport: Viewport = {
  themeColor: "#c6a47c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${atkinsonNext.variable} ${atkinsonMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
