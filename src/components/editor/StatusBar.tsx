// ── MaßWerk · Statusleiste: ein Gedanke, ein Satz ────────────────────────────
"use client";

import { useEditor } from "@/lib/measure/store";
import { fmtNumber } from "@/lib/measure/geometry";
import { KIND_LABEL } from "@/lib/measure/types";
import { useT, type TFn } from "@/lib/i18n";

/**
 * ARIA-Live-Region: meldet Auswahl und Zählergebnisse höflich (polite),
 * aber nur bei echtem Wechsel – nicht bei jedem Punkt-Ziehen.
 */
function LiveMeasure() {
  const tr = useT();
  const selectedId = useEditor((s) => s.selectedId);
  const kind = useEditor(
    (s) => s.measurements.find((m) => m.id === s.selectedId)?.kind ?? null,
  );
  const count = useEditor((s) => s.analysisResult?.count ?? null);
  const areaPx = useEditor((s) => s.analysisResult?.totalAreaPx ?? 0);
  const calib = useEditor((s) => s.calibration);

  const parts: string[] = [];
  if (kind) parts.push(`${tr("Ausgewählt")}: ${tr(KIND_LABEL[kind])}`);
  if (count !== null) {
    const area = calib ? areaPx / calib.pixelsPerUnit ** 2 : areaPx;
    parts.push(
      tr("{count} Objekte erkannt, Fläche {area} {unit}²", {
        count,
        area: fmtNumber(area, 1),
        unit: calib ? calib.unit : "px",
      }),
    );
  }
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {parts.join(". ")}
    </span>
  );
}

function useHint(tr: TFn): string {
  const st = useEditor();
  const n = st.draft?.length ?? 0;

  if (st.analysis.active) {
    return st.analysis.roi
      ? tr("Schwellenwert im Bild-Panel · Esc beendet")
      : tr("Auswertebereich aufziehen · Esc beendet");
  }
  if (st.rectify?.active)
    return tr("Ecke {n} von 4 im Uhrzeigersinn · Esc bricht ab", { n: Math.min(4, (st.rectify.points.length || 0) + 1) });
  if (st.pendingCalib) return tr("Reale Länge eingeben · Enter bestätigt");

  switch (st.tool) {
    case "select":
      return tr("Klicken: auswählen · Ziehen: bewegen · Entf: löschen");
    case "calibrate":
      return n === 0 ? tr("Startpunkt der Referenzstrecke") : tr("Endpunkt der Referenzstrecke");
    case "line":
      return n === 0 ? tr("Startpunkt setzen") : tr("Endpunkt setzen");
    case "polyline":
      return n === 0 ? "Startpunkt setzen" : tr("Punkt {n} setzen · Enter beendet", { n });
    case "lot":
      return n === 0
        ? tr("Referenzlinie: Punkt 1 von 2")
        : n === 1
          ? tr("Referenzlinie: Punkt 2 von 2")
          : tr("Messpunkt setzen – das Lot fällt automatisch");
    case "angle":
      return n === 0 ? tr("Erster Schenkel") : n === 1 ? tr("Scheitelpunkt") : tr("Zweiter Schenkel");
    case "crossangle":
      return n < 2 ? tr("Gerade 1: Punkt {n} von 2", { n: n + 1 }) : tr("Gerade 2: Punkt {n} von 2", { n: n - 1 });
    case "rect":
      return n === 0 ? tr("Erste Ecke setzen") : tr("Gegenüberliegende Ecke setzen");
    case "ellipse":
      return n === 0 ? tr("Erste Ecke der Umfassungsbox") : "Gegenüberliegende Ecke setzen";
    case "circle3":
      return tr("Randpunkt {n} von 3", { n: n + 1 });
    case "polygon":
      return n === 0
        ? tr("Ersten Eckpunkt setzen")
        : n < 3
          ? tr("Eckpunkt {n} setzen", { n: n + 1 })
          : tr("Punkt {n} · Startpunkt oder Enter schließt", { n });
    case "count":
      return tr("Jedes Objekt einmal anklicken");
    case "annotate":
      return tr("Klicken: Notiz · Ziehen: Pfeil");
  }
}

export default function StatusBar() {
  const image = useEditor((s) => s.image);
  const tr = useT();
  const hint = useHint(tr);

  return (
    <footer className="flex h-8 select-none items-center gap-4 border-t border-[var(--mw-border)] bg-[var(--mw-surface-1)] px-3 text-[11.5px] text-[var(--mw-text-faint)]">
      <span className="min-w-0 flex-1 truncate">{hint}</span>
      <span id="mw-coords" className="shrink-0 font-tabular text-[var(--mw-text-dim)]" />
      {image && (
        <span className="shrink-0 font-tabular text-[var(--mw-text-ghost)]">
          {fmtNumber(image.width, 0)} × {fmtNumber(image.height, 0)} px
        </span>
      )}
      <LiveMeasure />
    </footer>
  );
}
