// ── MaßWerk · Leerzustand: Ablagefläche & Schnelleinstieg ────────────────────
"use client";

import { useRef } from "react";
import { FolderOpen, ImagePlus, Image as ImageIcon } from "lucide-react";

export default function EmptyState({
  onOpenImage,
  onSample,
}: {
  onOpenImage: (file: File) => void;
  onSample: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0B0B0E]">
      <div className="flex w-full max-w-md flex-col items-center px-8 text-center">
        <svg width="58" height="58" viewBox="0 0 24 24" fill="none" className="mb-6 opacity-90">
          <path d="M4 20V4h16" stroke="#3A3A42" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M4 20L20 4" stroke="#60A5FA" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M8.5 20v-2.6M13 20v-2.6M17.5 20v-2.6" stroke="#3A3A42" strokeWidth="1.1" strokeLinecap="round" />
        </svg>

        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-white/90">
          Präzise vermessen – direkt im Bild
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/40">
          Bild ablegen, eine bekannte Strecke kalibrieren und anschließend Distanzen,
          Flächen, Winkel und Objekte in echten Einheiten vermessen.
        </p>

        <div className="mt-7 w-full rounded-2xl border border-dashed border-white/[0.14] bg-white/[0.02] p-6 transition-colors hover:border-[#60A5FA]/50 hover:bg-[#60A5FA]/[0.03]">
          <ImagePlus size={22} className="mx-auto mb-2.5 text-white/35" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-[#3B6DED] px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-[#4578F0] active:scale-[0.98]"
          >
            <FolderOpen size={14} className="mr-2 -mt-0.5 inline" />
            Bild auswählen
          </button>
          <p className="mt-2.5 text-[12px] text-white/35">
            oder Datei hier ablegen · Strg+V fügt ein
          </p>
          <p className="mt-1 text-[11px] text-white/25">
            JPG · PNG · WebP · BMP · GIF · TIFF — auch sehr hochauflösend
          </p>
        </div>

        <button
          type="button"
          onClick={onSample}
          className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] text-[#8AB4FF] transition-colors hover:bg-[#60A5FA]/[0.08]"
        >
          <ImageIcon size={14} />
          Mit Beispielbild ausprobieren
        </button>

        <p className="mt-8 text-[11px] text-white/25">
          Alle Daten bleiben lokal auf diesem Gerät – nichts wird hochgeladen.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.tif,.tiff"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onOpenImage(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
