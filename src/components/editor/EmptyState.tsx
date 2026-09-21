// ── MaßWerk · Leerzustand: ein Icon, ein Satz, eine Aktion ───────────────────
"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n";

/** App-Icon im macOS-Stil: das Lineal-Motiv der Wortmarke, groß gedacht. */
function AppTile() {
  return (
    <div className="relative mb-7">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(96,165,250,0.13), transparent 72%)",
        }}
      />
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden className="relative">
        <defs>
          <linearGradient id="mw-tile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#26262D" />
            <stop offset="1" stopColor="#131318" />
          </linearGradient>
        </defs>
        <rect
          x="1"
          y="1"
          width="62"
          height="62"
          rx="14.5"
          fill="url(#mw-tile)"
          stroke="rgba(255,255,255,0.1)"
        />
        <path
          d="M3 15.5A13.5 13.5 0 0 1 15.5 3h33A13.5 13.5 0 0 1 62 15.5v2a0.5 0.5 0 0 1-0.5 0.5h-61A0.5 0.5 0 0 1 3 17.5Z"
          fill="rgba(255,255,255,0.045)"
        />
        <g transform="translate(14,14) scale(1.5)">
          <path d="M4 20V4h16" stroke="#E9E9EE" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M4 20 20 4" stroke="#60A5FA" strokeWidth="1.7" strokeLinecap="round" />
          <path
            d="M8.5 20v-2.6M13 20v-2.6M17.5 20v-2.6"
            stroke="#E9E9EE"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}

export default function EmptyState({
  onOpenImage,
  onSample,
}: {
  onOpenImage: (file: File) => void;
  onSample: () => void;
}) {
  const tr = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--mw-surface-1)]">
      <div className="flex w-full max-w-sm flex-col items-center px-8 text-center">
        <AppTile />

        <h1 className="text-[17px] font-semibold tracking-[-0.015em] text-[var(--mw-text)]">
          {tr("Präzise vermessen")}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--mw-text-faint)]">
          {tr("Bild öffnen, Maßstab setzen, in echten Einheiten messen.")}
        </p>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-6 rounded-[10px] bg-[var(--mw-accent)] px-4.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--mw-accent-strong)] active:bg-[var(--mw-accent-strong)]"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.4), 0 6px 18px rgba(59,109,237,0.28)" }}
        >
          {tr("Bild öffnen")}
        </button>
        <p className="mt-3 text-[11.5px] text-[var(--mw-text-ghost)]">
          {tr("Datei hierher ziehen oder mit Strg+V einfügen")}
        </p>

        <button
          type="button"
          onClick={onSample}
          className="mt-6 rounded-lg px-3 py-1.5 text-[12.5px] text-[var(--mw-accent-text)] transition-colors hover:bg-[var(--mw-hover)]"
        >
          {tr("Beispielbild laden")}
        </button>

        <p className="mt-10 text-[11px] text-[var(--mw-text-ghost)]">
          {tr("Alle Daten bleiben auf diesem Gerät.")}
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
