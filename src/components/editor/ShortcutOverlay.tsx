// ── MaßWerk · Tastaturkürzel-Überlagerung („?") ──────────────────────────────
// Eine Pro-App zeigt ihre Kürzel auf Zuruf – vollständig, gruppiert,
// ohne Suche im Handbuch. Öffnen: „?" oder Button in der Kopfleiste.
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useEditor } from "@/lib/measure/store";
import { useT } from "@/lib/i18n";

interface Row {
  keys: string[];
  label: string;
}

interface Group {
  title: string;
  rows: Row[];
}

const TOOLS: Group = {
  title: "Werkzeuge",
  rows: [
    { keys: ["V"], label: "Auswählen & Bewegen" },
    { keys: ["K"], label: "Maßstab kalibrieren" },
    { keys: ["M"], label: "Distanz" },
    { keys: ["P"], label: "Polylinie" },
    { keys: ["L"], label: "Lot" },
    { keys: ["W"], label: "Winkel" },
    { keys: ["X"], label: "Schnittwinkel" },
    { keys: ["R"], label: "Rechteck" },
    { keys: ["E"], label: "Ellipse" },
    { keys: ["C"], label: "Kreis aus 3 Punkten" },
    { keys: ["F"], label: "Polygonfläche" },
    { keys: ["Z"], label: "Zählen" },
    { keys: ["T"], label: "Notiz & Pfeil" },
  ],
};

const VIEW: Group = {
  title: "Ansicht",
  rows: [
    { keys: ["0"], label: "Einpassen" },
    { keys: ["1"], label: "100 %" },
    { keys: ["+"], label: "Vergrößern" },
    { keys: ["−"], label: "Verkleinern" },
    { keys: ["Leertaste"], label: "Bild bewegen (halten)" },
    { keys: ["S"], label: "Kantenfang ein/aus" },
  ],
};

const DRAW: Group = {
  title: "Zeichnen",
  rows: [
    { keys: ["Enter"], label: "Entwurf abschließen" },
    { keys: ["Doppelklick"], label: "Polylinie/Polygon schließen" },
    { keys: ["Rechtsklick"], label: "Letzten Punkt entfernen" },
    { keys: ["Esc"], label: "Entwurf verwerfen" },
    { keys: ["Shift"], label: "Kantenfang umgehen (halten)" },
  ],
};

const EDIT: Group = {
  title: "Bearbeiten",
  rows: [
    { keys: ["Strg", "Z"], label: "Rückgängig" },
    { keys: ["Strg", "Y"], label: "Wiederholen" },
    { keys: ["Entf"], label: "Auswahl löschen" },
    { keys: ["Esc"], label: "Auswahl aufheben" },
    { keys: ["?"], label: "Diese Übersicht" },
  ],
};

function GroupBlock({ group }: { group: Group }) {
  const tr = useT();
  return (
    <section>
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--mw-text-ghost)]">
        {tr(group.title)}
      </div>
      <div className="space-y-0.5">
        {group.rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6 py-[3px]">
            <span className="text-[12.5px] text-[var(--mw-text-dim)]">{tr(r.label)}</span>
            <span className="flex shrink-0 items-center gap-1">
              {r.keys.map((k) => (
                <kbd key={k} className="mw-kbd">
                  {tr(k)}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ShortcutOverlay() {
  const tr = useT();
  const open = useEditor((s) => s.helpOpen);
  const setOpen = useEditor((s) => s.setHelpOpen);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onPointerDown={() => setOpen(false)}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={tr("Tastaturkürzel")}
        onPointerDown={(e) => e.stopPropagation()}
        className="animate-pop-in max-h-[84vh] w-[min(620px,94vw)] overflow-y-auto rounded-2xl border border-[var(--mw-border-strong)] bg-[var(--mw-surface-4)] p-5 outline-none"
        style={{ boxShadow: "0 24px 64px var(--mw-shadow)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--mw-text)]">
            {tr("Tastaturkürzel")}
          </h2>
          <button
            type="button"
            aria-label={tr("Schließen")}
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
          <GroupBlock group={TOOLS} />
          <div className="space-y-5">
            <GroupBlock group={VIEW} />
            <GroupBlock group={DRAW} />
            <GroupBlock group={EDIT} />
          </div>
        </div>
      </div>
    </div>
  );
}
