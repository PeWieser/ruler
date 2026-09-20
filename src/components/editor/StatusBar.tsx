// ── MaßWerk · Statusleiste: kontextbezogene Hilfe & Koordinaten ──────────────
"use client";

import { useEditor } from "@/lib/measure/store";
import { fmtNumber } from "@/lib/measure/geometry";

function useHint(): string {
  const st = useEditor();
  const n = st.draft?.length ?? 0;

  if (st.analysis.active) {
    return st.analysis.roi
      ? "Schwellenwert im Bild-Panel anpassen · „Bereich neu“ für anderen Ausschnitt · Esc beendet"
      : "Auswertebereich im Bild aufziehen · Esc beendet";
  }
  if (st.rectify?.active)
    return `Ecke ${Math.min(4, (st.rectify.points.length || 0) + 1)} von 4 anklicken (Rechtecksfläche, im Uhrzeigersinn) · Esc bricht ab`;
  if (st.pendingCalib)
    return "Reale Länge im Panel eingeben und mit Enter bestätigen · Esc verwirft";

  switch (st.tool) {
    case "select":
      return "Klicken: auswählen · Punkt greifen: korrigieren · Leere Fläche ziehen: Bild bewegen · Entf löscht Auswahl";
    case "calibrate":
      return n === 0
        ? "Startpunkt der Referenzstrecke setzen (z. B. Lineal, Maßstab)"
        : "Endpunkt der Referenzstrecke setzen";
    case "line":
      return n === 0 ? "Startpunkt setzen" : "Endpunkt setzen";
    case "polyline":
      return n === 0
        ? "Startpunkt setzen"
        : `Weiteren Punkt setzen (${n}) · Doppelklick oder Enter beendet`;
    case "lot":
      return n === 0
        ? "Referenzgerade: Punkt 1 von 2 setzen"
        : n === 1
          ? "Referenzgerade: Punkt 2 von 2 setzen"
          : "Punkt setzen – das Lot wird automatisch gefällt";
    case "angle":
      return n === 0
        ? "Ersten Schenkelpunkt setzen"
        : n === 1
          ? "Scheitelpunkt setzen"
          : "Zweiten Schenkelpunkt setzen";
    case "crossangle":
      return n < 2
        ? `Gerade 1: Punkt ${n + 1} von 2 setzen`
        : `Gerade 2: Punkt ${n - 1} von 2 setzen`;
    case "rect":
      return n === 0 ? "Erste Ecke setzen" : "Gegenüberliegende Ecke setzen";
    case "ellipse":
      return n === 0 ? "Erste Ecke der Umfassungsbox setzen" : "Gegenüberliegende Ecke setzen";
    case "circle3":
      return `Randpunkt ${n + 1} von 3 setzen`;
    case "polygon":
      return n === 0
        ? "Ersten Eckpunkt setzen"
        : n < 3
          ? `Eckpunkt ${n + 1} setzen`
          : `Weiteren Punkt setzen (${n}) · Startpunkt, Doppelklick oder Enter schließt`;
    case "count":
      return "Jedes Objekt einmal anklicken – Werkzeug erneut wählen startet eine neue Zählung";
    case "annotate":
      return "Klicken = Notiz · Ziehen = Pfeil · Text eingeben, Enter bestätigt";
  }
}

export default function StatusBar() {
  const image = useEditor((s) => s.image);
  const snap = useEditor((s) => s.snap);
  const hint = useHint();

  return (
    <footer className="flex h-8 select-none items-center gap-3 border-t border-[var(--mw-border)] bg-[var(--mw-surface-1)] px-3 text-[11.5px] text-[var(--mw-text-faint)]">
      <span className="min-w-0 flex-1 truncate">{hint}</span>
      {snap && image && (
        <span className="hidden shrink-0 items-center gap-1.5 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#30D158]" />
          Kantenfang (S) · Shift = frei
        </span>
      )}
      <span id="mw-coords" className="shrink-0 font-tabular text-[var(--mw-text-dim)]" />
      {image && (
        <span className="shrink-0 font-tabular text-[var(--mw-text-ghost)]">
          {fmtNumber(image.width, 0)} × {fmtNumber(image.height, 0)} px
        </span>
      )}
    </footer>
  );
}
