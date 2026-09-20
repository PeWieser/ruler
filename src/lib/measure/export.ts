// ── MaßWerk · Export: PNG (Burn-in), CSV, Excel ─────────────────────────────
import type { Calibration, Measurement } from "./types";
import { KIND_LABEL, UNIT_TO_MM, filtersActive, type Filters } from "./types";
import { fmtStatFull, measurementStats, niceScaleLength } from "./geometry";
import { postProcess } from "./imagefx";
import { drawMeasurement, type RenderEnv } from "./render";
import { imgReg } from "./store";
import { t, useLocale } from "@/lib/i18n";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "bild";
}

// ── Tabellenzeilen (CSV & Excel) ─────────────────────────────────────────────

export interface ExportRow {
  Name: string;
  Typ: string;
  Messgröße: string;
  Wert: number | string;
  Einheit: string;
  Anzeige: string;
}

export function buildRows(
  measurements: Measurement[],
  calib: Calibration | null,
): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const m of measurements) {
    const stats = measurementStats(m);
    if (stats.length === 0) {
      if (m.kind === "note" || m.kind === "arrow") {
        rows.push({
          Name: m.name,
          Typ: KIND_LABEL[m.kind],
          Messgröße: t("Text"),
          Wert: m.text ?? "",
          Einheit: "",
          Anzeige: m.text ?? "",
        });
      }
      continue;
    }
    for (const s of stats) {
      let value: number | string = s.raw;
      let unit = "px";
      if (s.kind === "angle") {
        value = Math.round(s.raw * 10) / 10;
        unit = "°";
      } else if (s.kind === "count") {
        value = s.raw;
        unit = "";
      } else if (calib && calib.unit !== "px") {
        const ppu = calib.pixelsPerUnit;
        value = s.kind === "area" ? s.raw / (ppu * ppu) : s.raw / ppu;
        value = Math.round(value * 10000) / 10000;
        unit = s.kind === "area" ? `${calib.unit}²` : calib.unit;
      } else {
        unit = s.kind === "area" ? "px²" : "px";
      }
      rows.push({
        Name: m.name,
        Typ: KIND_LABEL[m.kind],
        Messgröße: s.label,
        Wert: value,
        Einheit: unit,
        Anzeige: `${s.label}: ${fmtStatFull(s, calib)}`,
      });
    }
  }
  return rows;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export function exportCSV(
  measurements: Measurement[],
  calib: Calibration | null,
  imageName: string,
) {
  const rows = buildRows(measurements, calib);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(
    `# MaßWerk Messprotokoll;${new Date().toLocaleString(
      useLocale.getState().locale === "de" ? "de-DE" : "en-GB",
    )}`,
  );
  lines.push(`# Bild;${esc(imageName)}`);
  lines.push(
    calib
      ? `# Maßstab;1 px = ${(UNIT_TO_MM[calib.unit] / calib.pixelsPerUnit).toPrecision(6)} ${calib.unit}`
      : `# ${t("Maßstab")};${t("nicht kalibriert (Pixelwerte)")}`,
  );
  lines.push([t("Name"), t("Typ"), t("Messgröße"), t("Wert"), t("Einheit")].join(";"));
  for (const r of rows) {
    const wert =
      typeof r.Wert === "number" ? String(r.Wert).replace(".", ",") : r.Wert;
    lines.push([r.Name, r.Typ, r.Messgröße, wert, r.Einheit].map(esc).join(";"));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, `${baseName(imageName)}_messwerte.csv`);
}

// ── Excel (SheetJS, dynamisch geladen) ───────────────────────────────────────

export async function exportXLSX(
  measurements: Measurement[],
  calib: Calibration | null,
  imageName: string,
) {
  const XLSX = await import("xlsx");
  const rows = buildRows(measurements, calib).map((r) => ({
    [t("Name")]: r.Name,
    [t("Typ")]: r.Typ,
    [t("Messgröße")]: r.Messgröße,
    [t("Wert")]: r.Wert,
    [t("Einheit")]: r.Einheit,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t("Messwerte"));
  const meta = [
    ["MaßWerk Messprotokoll", new Date().toLocaleString("de-DE")],
    ["Bild", imageName],
    [
      t("Maßstab"),
      calib
        ? `1 px = ${(UNIT_TO_MM[calib.unit] / calib.pixelsPerUnit).toPrecision(6)} ${calib.unit}`
        : t("nicht kalibriert (Pixelwerte)"),
    ],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 24 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Info");
  XLSX.writeFile(wb, `${baseName(imageName)}_messwerte.xlsx`);
}

// ── PNG mit eingebrannten Messungen (volle Auflösung) ────────────────────────

function drawScaleBarExport(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  calib: Calibration | null,
  strokeW: number,
  fontPx: number,
) {
  const target = W * 0.14; // Ziel-Pixelbreite des Balkens
  let barPx: number;
  let label: string;
  if (calib && calib.unit !== "px") {
    const nice = niceScaleLength(target / calib.pixelsPerUnit);
    if (nice <= 0) return;
    barPx = nice * calib.pixelsPerUnit;
    label = `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(nice)} ${calib.unit}`;
  } else {
    const nice = niceScaleLength(target);
    if (nice <= 0) return;
    barPx = nice;
    label = `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(nice)} px`;
  }
  const m = Math.max(W, H) * 0.035;
  const x1 = W - m;
  const x0 = x1 - barPx;
  const y = H - m;
  const tick = barPx * 0.06 + strokeW * 2;
  ctx.save();
  ctx.lineCap = "butt";
  const drawPass = (color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.moveTo(x0, y - tick / 2);
    ctx.lineTo(x0, y + tick / 2);
    ctx.moveTo(x1, y - tick / 2);
    ctx.lineTo(x1, y + tick / 2);
    ctx.stroke();
  };
  drawPass("rgba(0,0,0,0.85)", strokeW * 2.4);
  drawPass("#FFFFFF", strokeW);
  ctx.font = `600 ${fontPx}px "Geist Mono", ui-monospace, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const ty = y - tick / 2 - fontPx * 0.4;
  ctx.lineWidth = strokeW * 2;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(label, (x0 + x1) / 2, ty);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(label, (x0 + x1) / 2, ty);
  ctx.restore();
}

export async function exportAnnotatedPNG(opts: {
  width: number;
  height: number;
  measurements: Measurement[];
  calibration: Calibration | null;
  scaleBar: boolean;
  filters: Filters;
  imageName: string;
  onProgress?: (f: number) => void;
}): Promise<void> {
  const src = imgReg.lensCorrected ?? imgReg.original;
  if (!src) return;
  const { width: W, height: H } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(src, 0, 0, W, H);
  opts.onProgress?.(0.05);

  // Filter in Streifen anwenden (speicherschonend bei 8000×8000+)
  if (filtersActive(opts.filters)) {
    const strip = 1024;
    for (let y = 0; y < H; y += strip) {
      const h = Math.min(strip, H - y);
      const im = ctx.getImageData(0, y, W, h);
      postProcess(im.data, W, h, opts.filters);
      ctx.putImageData(im, 0, y);
      opts.onProgress?.(0.05 + 0.7 * ((y + h) / H));
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Vektoren einbrennen
  const strokeW = Math.max(2, Math.max(W, H) / 850);
  const env: RenderEnv = {
    strokeW,
    fontPx: strokeW * 6.4,
    selectedId: null,
    showHandles: false,
    calibration: opts.calibration,
    forExport: true,
  };
  for (const m of opts.measurements) {
    if (m.visible) drawMeasurement(ctx, m, env);
  }
  if (opts.scaleBar) {
    drawScaleBarExport(ctx, W, H, opts.calibration, strokeW, env.fontPx);
  }
  opts.onProgress?.(0.92);

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/png"),
  );
  opts.onProgress?.(1);
  if (blob) downloadBlob(blob, `${baseName(opts.imageName)}_vermessen.png`);
}
