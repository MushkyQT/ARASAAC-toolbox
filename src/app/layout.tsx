import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atelier Pictos — cartes ARASAAC à partir d'un texte",
  description:
    "Transformez une histoire, un album, un conte ou une recette en cartes pictogrammes ARASAAC de 8 × 8 cm, avec le code couleur de chaque nature de mot.",
};

export const viewport: Viewport = {
  themeColor: "#f5f3ef",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${lexend.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
