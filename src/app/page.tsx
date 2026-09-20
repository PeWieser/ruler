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
      useEditor.getState().setBanner("Diese Datei kann nicht als Bild gelesen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openSample = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/samples/beispiel.jpg");
      const blob = await res.blob();
      const file = new File([blob], "beispiel.jpg", { type: "image/jpeg" });
      const img = await loadImageFile(file);
      useEditor.getState().setLoaded(img);
      useEditor.getState().setBanner("Beispielbild geladen – am Lineal kalibrieren, um loszulegen.");
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
        <Toolbar />
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
        <SidePanel />
      </div>
      <StatusBar />
      <TooltipLayer />

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0E]/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-[#60A5FA]/70 px-10 py-8 text-center">
            <div className="text-[15px] font-medium text-white/90">Bild loslassen</div>
            <div className="mt-1 text-[12px] text-white/45">
              {image ? "Ersetzt das aktuelle Bild" : "JPG · PNG · WebP · BMP · TIFF"}
            </div>
          </div>
        </div>
      )}

      {banner && (
        <div className="animate-banner-in fixed left-1/2 top-14 z-50 -translate-x-1/2">
          <div
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
