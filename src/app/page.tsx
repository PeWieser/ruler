// ── MaßWerk · App-Shell ──────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import TopBar from "@/components/editor/TopBar";
import Toolbar from "@/components/editor/Toolbar";
import CanvasStage from "@/components/editor/CanvasStage";
import SidePanel from "@/components/editor/SidePanel";
import StatusBar from "@/components/editor/StatusBar";
import EmptyState from "@/components/editor/EmptyState";
import TooltipLayer from "@/components/editor/TooltipLayer";
import ShortcutOverlay from "@/components/editor/ShortcutOverlay";
import { useEditor } from "@/lib/measure/store";
import { imageFileFromDataTransfer, loadImageFile } from "@/lib/measure/loadImage";

export default function Page() {
  const image = useEditor((s) => s.image);
  const banner = useEditor((s) => s.banner);
  const setBanner = useEditor((s) => s.setBanner);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const openFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const img = await loadImageFile(file);
      useEditor.getState().setLoaded(img);
    } catch {
      useEditor.getState().setBanner("Die Datei konnte nicht als Bild gelesen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openSample = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/samples/beispiel.png");
      const blob = await res.blob();
      const file = new File([blob], "beispiel.png", { type: "image/png" });
      const img = await loadImageFile(file);
      useEditor.getState().setLoaded(img);
      useEditor.getState().setBanner("Beispiel geladen – am Lineal unten kalibrieren.");
    } catch {
      useEditor.getState().setBanner("Beispielbild konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Globales Ablegen & Einfügen
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      const f = imageFileFromDataTransfer(dt);
      if (f) openFile(f);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const f = imageFileFromDataTransfer(e.clipboardData);
      if (f) {
        e.preventDefault();
        openFile(f);
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [openFile]);

  // Banner blendet sich selbst aus
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4600);
    return () => clearTimeout(t);
  }, [banner, setBanner]);

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[var(--mw-surface-1)] text-[var(--mw-text)]">
      <TopBar onOpenImage={openFile} />
      <div className="flex min-h-0 flex-1">
        {/* Ohne Bild tritt die Arbeits-Chrome zurück – die leere Bühne gehört
            der Einladung, nicht toten Werkzeugreihen (Chrome Recedes). */}
        {image && <Toolbar />}
        <main className="relative min-w-0 flex-1">
          <CanvasStage />
          {!image && <EmptyState onOpenImage={openFile} onSample={openSample} />}
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#17171C] px-4 py-3 text-[13px] text-white/80">
                <Loader2 size={16} className="animate-spin text-[#8AB4FF]" />
                Bild wird geladen …
              </div>
            </div>
          )}
        </main>
        {image && <SidePanel />}
      </div>
      {image && <StatusBar />}
      <TooltipLayer />
      <ShortcutOverlay />

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0E]/70 backdrop-blur-[3px]">
          <div className="animate-pop-in flex flex-col items-center rounded-[22px] border border-white/[0.12] bg-white/[0.045] px-16 py-12 text-center shadow-2xl">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden className="mb-3.5 text-[#8AB4FF]">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <div className="text-[15px] font-medium tracking-[-0.01em] text-white/90">Bild loslassen</div>
            <div className="mt-1 text-[12px] text-white/40">
              {image ? "Ersetzt das aktuelle Bild" : "JPG · PNG · WebP · BMP · GIF · TIFF"}
            </div>
          </div>
        </div>
      )}

      {banner && (
        <div className="animate-banner-in fixed left-1/2 top-14 z-50 -translate-x-1/2">
          <div
            role="status"
            className="rounded-full border border-[var(--mw-border-strong)] bg-[var(--mw-surface-4)] px-4 py-2 text-[12.5px] text-[var(--mw-text-dim)] shadow-xl"
            style={{ boxShadow: "0 12px 28px var(--mw-shadow)" }}
          >
            {banner}
          </div>
        </div>
      )}
    </div>
  );
}
