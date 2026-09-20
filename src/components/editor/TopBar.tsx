// ── MaßWerk · Obere Leiste: Datei, Maßstab, Ansicht, Export ─────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ImageDown,
  Loader2,
  Magnet,
  Maximize,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Ruler,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditor } from "@/lib/measure/store";
import { useView } from "./CanvasStage";
import { exportAnnotatedPNG, exportCSV, exportXLSX } from "@/lib/measure/export";
import { fmtNumber } from "@/lib/measure/geometry";

function Wordmark() {
  return (
    <div className="flex select-none items-center gap-2.5 pr-1">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20V4h16" stroke="var(--mw-text)" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M4 20L20 4" stroke="var(--mw-accent-text)" strokeWidth="1.7" strokeLinecap="round" />
        <path
          d="M8.5 20v-2.6M13 20v-2.6M17.5 20v-2.6"
          stroke="var(--mw-text)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--mw-text)]">
        MaßWerk
      </span>
    </div>
  );
}

export default function TopBar({
  onOpenImage,
}: {
  onOpenImage: (file: File) => void;
}) {
  const st = useEditor();
  const scale = useView((s) => s.scale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pngBusy, setPngBusy] = useState(0); // 0 = frei, >0 Fortschritt
  const [pngDone, setPngDone] = useState(false);
  const [calibPulse, setCalibPulse] = useState(false);
  const prevCalibRef = useRef(st.calibration);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasImage = st.image !== null;
  const canUndo = st.past.length > 0;
  const canRedo = st.future.length > 0;

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  // Kurzer, einmaliger Glanz-Impuls am Maßstab-Badge, sobald kalibriert wird
  useEffect(() => {
    if (!prevCalibRef.current && st.calibration) {
      setCalibPulse(true);
      const t = setTimeout(() => setCalibPulse(false), 900);
      return () => clearTimeout(t);
    }
    prevCalibRef.current = st.calibration;
  }, [st.calibration]);

  const runPng = async () => {
    if (!st.image || pngBusy > 0) return;
    st.setExportBusy(true);
    try {
      await exportAnnotatedPNG({
        width: st.image.width,
        height: st.image.height,
        measurements: st.measurements,
        calibration: st.calibration,
        scaleBar: st.scaleBar,
        filters: st.filters,
        imageName: st.image.name,
        onProgress: (f) => setPngBusy(Math.max(0.02, f)),
      });
      setPngDone(true);
      setTimeout(() => setPngDone(false), 1500);
    } finally {
      st.setExportBusy(false);
      setPngBusy(0);
    }
  };

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--mw-text-dim)] transition-colors duration-150 hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)] active:bg-[var(--mw-hover-strong)] disabled:opacity-30";
  const toggleBtn = (on: boolean) =>
    `flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 disabled:opacity-30 ${
      on
        ? "bg-[var(--mw-accent-bg-strong)] text-[var(--mw-accent-text)]"
        : "text-[var(--mw-text-dim)] hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)] active:bg-[var(--mw-hover-strong)]"
    }`;

  const ppuText = (() => {
    const c = st.calibration;
    if (!c) return null;
    return `${fmtNumber(c.pixelsPerUnit)} px/${c.unit}`;
  })();

  return (
    <header className="flex h-12 items-center gap-2 border-b border-[var(--mw-border)] bg-[var(--mw-surface-1)] px-3">
      <Wordmark />

      {/* Dateiname + Öffnen */}
      <div className="ml-2 flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          className={iconBtn}
          data-tip="Bild öffnen"
          data-desc="JPG · PNG · WebP · BMP · TIFF"
          onClick={() => fileRef.current?.click()}
        >
          <FolderOpen size={16} />
        </button>
        {st.image && (
          <span className="max-w-44 truncate text-[12.5px] text-[var(--mw-text-faint)]">
            {st.image.name}
          </span>
        )}
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

      {/* Maßstab-Badge */}
      <div className="mx-auto flex items-center">
        {hasImage && (
          <button
            type="button"
            onClick={() => {
              if (!st.calibration) st.setTool("calibrate");
              else st.setPanelTab("kalib");
            }}
            className={`relative flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors duration-150 active:scale-[0.97] ${
              st.calibration
                ? "border-[var(--mw-border-strong)] bg-[var(--mw-hover)] text-[var(--mw-text-dim)] hover:bg-[var(--mw-hover-strong)]"
                : "border-[var(--mw-accent-border)] bg-[var(--mw-accent-bg)] text-[var(--mw-accent-text)] hover:bg-[var(--mw-accent-bg-strong)]"
            }`}
            data-tip={st.calibration ? "Maßstab" : "Maßstab setzen"}
            data-desc={
              st.calibration
                ? "Im Panel anpassen"
                : "Referenzstrecke ziehen, Länge eingeben"
            }
            data-key={st.calibration ? "" : "K"}
          >
            {calibPulse && (
              <span
                className="pointer-events-none absolute inset-0 rounded-full animate-[pop-in_0.9s_cubic-bezier(0.16,1,0.3,1)_forwards]"
                style={{ backgroundColor: "color-mix(in srgb, var(--mw-accent) 40%, transparent)" }}
              />
            )}
            <Ruler size={13.5} className="relative" />
            {st.calibration ? (
              <span className="relative font-tabular">{ppuText}</span>
            ) : (
              <span className="relative">Maßstab setzen</span>
            )}
          </button>
        )}
      </div>

      {/* rechte Gruppe */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={iconBtn}
          data-tip="Rückgängig"
          data-key="Strg+Z"
          disabled={!canUndo}
          onClick={st.undo}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip="Wiederholen"
          data-key="Strg+Y"
          disabled={!canRedo}
          onClick={st.redo}
        >
          <Redo2 size={16} />
        </button>

        <span className="mx-1 h-5 w-px bg-[var(--mw-border)]" />

        <button
          type="button"
          className={iconBtn}
          data-tip="Verkleinern"
          data-key="−"
          disabled={!hasImage}
          onClick={() => st.fireViewCmd("out")}
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          data-tip="100 % anzeigen"
          data-desc="Ein Bildpixel entspricht einem Bildschirmpixel"
          data-key="1"
          disabled={!hasImage}
          onClick={() => st.fireViewCmd("100")}
          className="flex h-8 w-14 items-center justify-center rounded-lg font-tabular text-[12px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)] disabled:opacity-30"
        >
          {Math.round(scale * 100)} %
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip="Vergrößern"
          data-key="+"
          disabled={!hasImage}
          onClick={() => st.fireViewCmd("in")}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip="Einpassen"
          data-desc="Ganzes Bild anzeigen"
          data-key="0"
          disabled={!hasImage}
          onClick={() => st.fireViewCmd("fit")}
        >
          <Maximize size={16} />
        </button>

        <span className="mx-1 h-5 w-px bg-[var(--mw-border)]" />

        <button
          type="button"
          className={toggleBtn(st.snap)}
          data-tip="Kantenfang"
          data-desc="Punkte rasten an Kanten ein · Shift: frei"
          data-key="S"
          disabled={!hasImage}
          onClick={() => st.setSnap(!st.snap)}
        >
          <Magnet size={16} />
        </button>
        <button
          type="button"
          className={toggleBtn(st.scaleBar)}
          data-tip="Maßstabsbalken"
          data-desc="Im Bild und im Export anzeigen"
          disabled={!hasImage}
          onClick={() => st.setScaleBar(!st.scaleBar)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
            <path d="M4 15h16M4 15v3.5M20 15v3.5M9.5 15v2M14.5 15v2" />
          </svg>
        </button>

        <span className="mx-1 h-5 w-px bg-[var(--mw-border)]" />

        {/* Export */}
        <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={!hasImage}
            onClick={() => setMenuOpen((v) => !v)}
            data-tip="Exportieren"
            data-desc="PNG mit Messungen · CSV · Excel"
            className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[12.5px] font-medium text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-30 ${
              pngDone ? "bg-[#2FA84A]" : "bg-[var(--mw-accent)] hover:bg-[var(--mw-accent-strong)]"
            }`}
          >
            {pngDone ? (
              <Check size={15} />
            ) : pngBusy > 0 ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {pngDone ? "Gespeichert" : pngBusy > 0 ? `${Math.round(pngBusy * 100)} %` : "Export"}
          </button>
          {menuOpen && (
            <div className="animate-pop-in absolute right-0 top-10 z-30 w-60 origin-top-right overflow-hidden rounded-xl border border-[var(--mw-border-strong)] bg-[var(--mw-surface-4)] p-1 shadow-xl" style={{ boxShadow: "0 16px 40px var(--mw-shadow)" }}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)]"
                onClick={() => {
                  setMenuOpen(false);
                  runPng();
                }}
              >
                <ImageDown size={15.5} className="text-[var(--mw-text-faint)]" />
                <span className="flex-1">Bild mit Messungen</span>
                <span className="text-[11px] text-[var(--mw-text-ghost)]">PNG</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)]"
                onClick={() => {
                  setMenuOpen(false);
                  if (st.image) exportCSV(st.measurements, st.calibration, st.image.name);
                }}
              >
                <FileText size={15.5} className="text-[var(--mw-text-faint)]" />
                <span className="flex-1">Messwerttabelle</span>
                <span className="text-[11px] text-[var(--mw-text-ghost)]">CSV</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)]"
                onClick={() => {
                  setMenuOpen(false);
                  if (st.image) exportXLSX(st.measurements, st.calibration, st.image.name);
                }}
              >
                <FileSpreadsheet size={15.5} className="text-[var(--mw-text-faint)]" />
                <span className="flex-1">Messwerttabelle</span>
                <span className="text-[11px] text-[var(--mw-text-ghost)]">Excel</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={iconBtn}
          data-tip="Seitenleiste"
          data-desc="Panel ein- oder ausblenden"
          onClick={() => st.setPanelOpen(!st.panelOpen)}
        >
          {st.panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>
    </header>
  );
}
