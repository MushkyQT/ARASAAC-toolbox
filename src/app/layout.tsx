import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Les mêmes fichiers que ceux proposés pour les cartes (public/fonts) : aucune requête vers un tiers.
const andika = localFont({
  variable: "--font-andika",
  display: "swap",
  src: [
    { path: "../../public/fonts/Andika-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/Andika-Bold.ttf", weight: "700" },
  ],
});

const atkinson = localFont({
  variable: "--font-atkinson",
  display: "swap",
  src: [
    { path: "../../public/fonts/AtkinsonHyperlegible-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/AtkinsonHyperlegible-Bold.ttf", weight: "700" },
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
    <html lang="fr" className={`${andika.variable} ${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
