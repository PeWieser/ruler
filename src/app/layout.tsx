import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// Selbst gehostet (woff2 aus dem `geist`-Paket): Die Typografie darf nicht
// von einem CDN zur Build- oder Laufzeit abhängen.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaßWerk – Präzise Bildvermessung",
  description:
    "Bilder hochladen, Referenzmaß kalibrieren und Distanzen, Flächen, Winkel sowie Objekte in echten Einheiten vermessen. Lokal, schnell, präzise.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F6F7" },
    { media: "(prefers-color-scheme: dark)", color: "#131317" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
