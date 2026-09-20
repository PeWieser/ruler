// ── MaßWerk · Obere Leiste: Datei, Maßstab, Ansicht, Export ─────────────────
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleHelp,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ImageDown,
  Languages,
  Loader2,
  Magnet,
  Maximize,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Ruler,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditor } from "@/lib/measure/store";
import { useLocale, useT } from "@/lib/i18n";
import { useView } from "./CanvasStage";
import {
  exportAnnotatedPNG,
  exportCSV,
  exportDocument,
  exportXLSX,
} from "@/lib/measure/export";
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
  const tr = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const scale = useView((s) => s.scale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [pngBusy, setPngBusy] = useState(0); // 0 = frei, >0 Fortschritt
  const [pngDone, setPngDone] = useState(false);
  const [calibPulse, setCalibPulse] = useState(false);
  const prevCalibRef = useRef(st.calibration);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasImage = st.image !== null;
  const canUndo = st.past.length > 0;
  const canRedo = st.future.length > 0;

  useEffect(() => {
    if (!menuOpen && !scaleOpen) return;
    const close = () => {
      setMenuOpen(false);
      setScaleOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen, scaleOpen]);

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

  // Ohne Bild tritt die Chrome zurück: keine toten Schalter, keine leeren
  // Badges – nur Marke, Hilfe und eine klare Einladung.
  if (!hasImage) {
    return (
      <header className="flex h-12 items-center gap-2 border-b border-[var(--mw-border)] bg-[var(--mw-surface-1)] px-3">
        <Wordmark />
        <span className="flex-1" />
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Sprache wechseln")}
          data-desc={locale === "de" ? "English" : "Deutsch"}
          onClick={() => setLocale(locale === "de" ? "en" : "de")}
        >
          <Languages size={16} />
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Tastaturkürzel")}
          data-key="?"
          onClick={() => st.setHelpOpen(true)}
        >
          <CircleHelp size={16} />
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-8 items-center gap-2 rounded-lg bg-[var(--mw-accent)] px-3.5 text-[12.5px] font-medium text-white transition-all duration-150 hover:bg-[var(--mw-accent-strong)] active:scale-[0.98]"
        >
          <FolderOpen size={15} />
          {tr("Bild öffnen")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.tif,.tiff,.masswerk"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onOpenImage(f);
            e.target.value = "";
          }}
        />
      </header>
    );
  }

  return (
    <header className="flex h-12 items-center gap-2 border-b border-[var(--mw-border)] bg-[var(--mw-surface-1)] px-3">
      <Wordmark />

      {/* Dateiname + Öffnen */}
      <div className="ml-2 flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Bild öffnen")}
          data-desc={tr("JPG · PNG · WebP · BMP · TIFF")}
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
          accept="image/*,.tif,.tiff,.masswerk"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onOpenImage(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Maßstab-Badge – jeder Klick bekommt eine sichtbare Antwort */}
      <div
        className="relative mx-auto flex items-center"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {hasImage && (
          <button
            type="button"
            aria-expanded={scaleOpen}
            aria-haspopup="dialog"
            onClick={() => setScaleOpen((v) => !v)}
            className={`relative flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors duration-150 active:scale-[0.97] ${
              st.calibration
                ? "border-[var(--mw-border-strong)] bg-[var(--mw-hover)] text-[var(--mw-text-dim)] hover:bg-[var(--mw-hover-strong)]"
                : "border-[var(--mw-accent-border)] bg-[var(--mw-accent-bg)] text-[var(--mw-accent-text)] hover:bg-[var(--mw-accent-bg-strong)]"
            }`}
            data-tip={tr(st.calibration ? "Maßstab" : "Maßstab setzen")}
            data-desc={tr(
              st.calibration
                ? "Kalibrierung ansehen und anpassen"
                : "Referenzstrecke ziehen, Länge eingeben",
            )}
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
              <span className="relative">{tr("Maßstab setzen")}</span>
            )}
          </button>
        )}
        {hasImage && scaleOpen && (
          <div
            className="animate-pop-in absolute left-1/2 top-10 z-30 w-72 -translate-x-1/2 origin-top rounded-xl border border-[var(--mw-border-strong)] bg-[var(--mw-surface-4)] p-3.5"
            style={{ boxShadow: "0 16px 40px var(--mw-shadow)" }}
            role="dialog"
            aria-label={tr("Maßstab")}
          >
            {!st.calibration ? (
              <>
                <div className="text-[13px] font-medium text-[var(--mw-text)]">
                  {tr("Noch kein Maßstab")}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--mw-text-faint)]">
                  {tr(
                    "Messwerte sind gerade in Pixeln. Ziehen Sie eine Referenzstrecke entlang einer bekannten Länge und tragen Sie ihren realen Wert ein – danach misst alles in der gewählten Einheit.",
                  )}
                </p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setScaleOpen(false);
                      st.setTool("calibrate");
                    }}
                    className="rounded-lg bg-[var(--mw-accent)] px-2.5 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-[var(--mw-accent-strong)]"
                  >
                    {tr("Jetzt kalibrieren")}
                  </button>
                  <span className="ml-auto font-tabular text-[10.5px] text-[var(--mw-text-ghost)]">
                    {tr("Taste K")}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--mw-text-ghost)]">
                  {tr("Maßstab")}
                </div>
                <div className="mt-0.5 font-tabular text-[17px] font-medium text-[var(--mw-text)]">
                  {fmtNumber(st.calibration.pixelsPerUnit)}
                  <span className="ml-1.5 text-[12px] font-normal text-[var(--mw-text-dim)]">
                    px / {st.calibration.unit}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setScaleOpen(false);
                      st.setTool("calibrate");
                    }}
                    className="rounded-lg border border-[var(--mw-border-strong)] bg-[var(--mw-surface-3)] px-2.5 py-1.5 text-[11.5px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)]"
                  >
                    {tr("Neu kalibrieren")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScaleOpen(false);
                      st.setPanelTab("kalib");
                    }}
                    className="rounded-lg border border-[var(--mw-border-strong)] bg-[var(--mw-surface-3)] px-2.5 py-1.5 text-[11.5px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)]"
                  >
                    {tr("Im Panel anpassen")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScaleOpen(false);
                      st.clearCalibration();
                    }}
                    className="ml-auto rounded-lg px-2 py-1.5 text-[11.5px] text-[var(--mw-text-ghost)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text-dim)]"
                  >
                    {tr("Entfernen")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* rechte Gruppe */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Rückgängig")}
          data-key={tr("Strg+Z")}
          disabled={!canUndo}
          onClick={st.undo}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Wiederholen")}
          data-key={tr("Strg+Y")}
          disabled={!canRedo}
          onClick={st.redo}
        >
          <Redo2 size={16} />
        </button>

        <span className="mx-1 h-5 w-px bg-[var(--mw-border)]" />

        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Verkleinern")}
          data-key="−"
          disabled={!hasImage}
          onClick={() => st.fireViewCmd("out")}
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          data-tip={tr("100 % anzeigen")}
          data-desc={tr("Ein Bildpixel entspricht einem Bildschirmpixel")}
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
          data-tip={tr("Vergrößern")}
          data-key="+"
          disabled={!hasImage}
          onClick={() => st.fireViewCmd("in")}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Einpassen")}
          data-desc={tr("Ganzes Bild anzeigen")}
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
          data-tip={tr("Kantenfang")}
          data-desc={tr("Punkte rasten an Kanten ein · Shift: frei")}
          data-key="S"
          disabled={!hasImage}
          onClick={() => st.setSnap(!st.snap)}
        >
          <Magnet size={16} />
        </button>
        <button
          type="button"
          className={toggleBtn(st.scaleBar)}
          data-tip={tr("Maßstabsbalken")}
          data-desc={tr("Im Bild und im Export anzeigen")}
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
            data-tip={tr("Exportieren")}
            data-desc={tr("PNG mit Messungen · CSV · Excel")}
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
            {pngDone ? tr("Gespeichert") : pngBusy > 0 ? `${Math.round(pngBusy * 100)} %` : tr("Export")}
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
                <span className="flex-1">{tr("Bild mit Messungen")}</span>
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
                <span className="flex-1">{tr("Messwerttabelle")}</span>
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
                <span className="flex-1">{tr("Messwerttabelle")}</span>
                <span className="text-[11px] text-[var(--mw-text-ghost)]">Excel</span>
              </button>
              <div className="mx-1 my-1 h-px bg-[var(--mw-border)]" />
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)]"
                data-tip={tr("Bild, Messungen, Maßstab, Ausrichtung – eine Datei, wieder öffnbar")}
                data-side="left"
                onClick={() => {
                  setMenuOpen(false);
                  const json = st.serializeDocument();
                  if (json && st.image) exportDocument(json, st.image.name);
                }}
              >
                <Save size={15.5} className="text-[var(--mw-text-faint)]" />
                <span className="flex-1">{tr("MaßWerk-Dokument")}</span>
                <span className="text-[11px] text-[var(--mw-text-ghost)]">.masswerk</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Sprache wechseln")}
          data-desc={locale === "de" ? "English" : "Deutsch"}
          onClick={() => setLocale(locale === "de" ? "en" : "de")}
        >
          <Languages size={16} />
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Tastaturkürzel")}
          data-key="?"
          onClick={() => st.setHelpOpen(true)}
        >
          <CircleHelp size={16} />
        </button>
        <button
          type="button"
          className={iconBtn}
          data-tip={tr("Seitenleiste")}
          data-desc={tr("Panel ein- oder ausblenden")}
          onClick={() => st.setPanelOpen(!st.panelOpen)}
        >
          {st.panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>
    </header>
  );
}
