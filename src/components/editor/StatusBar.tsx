// ── MaßWerk · Statusleiste: ein Gedanke, ein Satz ────────────────────────────
"use client";

import { useEditor } from "@/lib/measure/store";
import { fmtNumber } from "@/lib/measure/geometry";

function useHint(): string {
  const st = useEditor();
  const n = st.draft?.length ?? 0;

  if (st.analysis.active) {
    return st.analysis.roi
      ? "Schwellenwert im Bild-Panel · Esc beendet"
      : "Auswertebereich aufziehen · Esc beendet";
  }
  if (st.rectify?.active)
    return `Ecke ${Math.min(4, (st.rectify.points.length || 0) + 1)} von 4 im Uhrzeigersinn · Esc bricht ab`;
  if (st.pendingCalib) return "Reale Länge eingeben · Enter bestätigt";

  switch (st.tool) {
    case "select":
      return "Klicken: auswählen · Ziehen: bewegen · Entf: löschen";
    case "calibrate":
      return n === 0 ? "Startpunkt der Referenzstrecke" : "Endpunkt der Referenzstrecke";
    case "line":
      return n === 0 ? "Startpunkt setzen" : "Endpunkt setzen";
    case "polyline":
      return n === 0 ? "Startpunkt setzen" : `Punkt ${n} setzen · Enter beendet`;
    case "lot":
      return n === 0
        ? "Referenzlinie: Punkt 1 von 2"
        : n === 1
          ? "Referenzlinie: Punkt 2 von 2"
          : "Messpunkt setzen – das Lot fällt automatisch";
    case "angle":
      return n === 0 ? "Erster Schenkel" : n === 1 ? "Scheitelpunkt" : "Zweiter Schenkel";
    case "crossangle":
      return n < 2 ? `Gerade 1: Punkt ${n + 1} von 2` : `Gerade 2: Punkt ${n - 1} von 2`;
    case "rect":
      return n === 0 ? "Erste Ecke setzen" : "Gegenüberliegende Ecke setzen";
    case "ellipse":
      return n === 0 ? "Erste Ecke der Umfassungsbox" : "Gegenüberliegende Ecke setzen";
    case "circle3":
      return `Randpunkt ${n + 1} von 3`;
    case "polygon":
      return n === 0
        ? "Ersten Eckpunkt setzen"
        : n < 3
          ? `Eckpunkt ${n + 1} setzen`
          : `Punkt ${n} · Startpunkt oder Enter schließt`;
    case "count":
      return "Jedes Objekt einmal anklicken";
    case "annotate":
      return "Klicken: Notiz · Ziehen: Pfeil";
  }
}

export default function StatusBar() {
  const image = useEditor((s) => s.image);
  const hint = useHint();

  return (
    <footer className="flex h-8 select-none items-center gap-4 border-t border-[var(--mw-border)] bg-[var(--mw-surface-1)] px-3 text-[11.5px] text-[var(--mw-text-faint)]">
      <span className="min-w-0 flex-1 truncate">{hint}</span>
      <span id="mw-coords" className="shrink-0 font-tabular text-[var(--mw-text-dim)]" />
      {image && (
        <span className="shrink-0 font-tabular text-[var(--mw-text-ghost)]">
          {fmtNumber(image.width, 0)} × {fmtNumber(image.height, 0)} px
        </span>
      )}
    </footer>
  );
}
