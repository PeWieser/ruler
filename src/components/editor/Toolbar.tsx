// ── MaßWerk · Werkzeugleiste (links) ─────────────────────────────────────────
"use client";

import type { ComponentType } from "react";
import {
  MousePointer2,
  Ruler,
  Slash,
  Waypoints,
  Square,
  Circle,
  Pentagon,
  Hash,
  MessageSquarePlus,
} from "lucide-react";
import { useEditor } from "@/lib/measure/store";
import type { ToolId } from "@/lib/measure/types";

type IconProps = { size?: number; className?: string };

// Eigene präzise Glyphen für Werkzeuge ohne Lucide-Pendant (Strich 1.6 wie Lucide)
const LotIcon: ComponentType<IconProps> = ({ size = 19, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 5v14" strokeDasharray="3 2.4" />
    <path d="M4 12h13" />
    <path d="M7.5 12v3h3" strokeWidth={1.3} />
    <circle cx="20" cy="12" r="2.6" />
  </svg>
);

const AngleIcon: ComponentType<IconProps> = ({ size = 19, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20h15" />
    <path d="M4 20L19 6" />
    <path d="M11.6 20a8 8 0 0 0-3.1-6.2" strokeWidth={1.4} />
  </svg>
);

const CrossAngleIcon: ComponentType<IconProps> = ({ size = 19, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 5l14 14" />
    <path d="M19 5L5 19" />
    <path d="M14.5 9.5a3.8 3.8 0 0 1 0 5" strokeWidth={1.4} />
  </svg>
);

const EllipseIcon: ComponentType<IconProps> = ({ size = 19, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="12" rx="9" ry="5.8" />
  </svg>
);

interface ToolDef {
  id: ToolId;
  label: string;
  key: string;
  desc: string;
  icon: ComponentType<IconProps>;
}

const GROUPS: ToolDef[][] = [
  [
    {
      id: "select",
      label: "Auswählen & Bewegen",
      key: "V",
      desc: "Messungen anklicken und einzelne Punkte oder die gesamte Form verschieben",
      icon: MousePointer2,
    },
    {
      id: "calibrate",
      label: "Maßstab kalibrieren",
      key: "K",
      desc: "Strecke mit bekannter Länge ziehen und reale Länge eingeben",
      icon: Ruler,
    },
  ],
  [
    {
      id: "line",
      label: "Distanz",
      key: "M",
      desc: "Gerade Abstandsmessung zwischen zwei Punkten",
      icon: Slash,
    },
    {
      id: "polyline",
      label: "Polylinie",
      key: "P",
      desc: "Pfadlänge entlang beliebig vieler Punkte · Enter beendet",
      icon: Waypoints,
    },
    {
      id: "lot",
      label: "Lot",
      key: "L",
      desc: "Senkrechter Abstand eines Punktes zu einer Referenzgeraden",
      icon: LotIcon,
    },
    {
      id: "angle",
      label: "Winkel",
      key: "W",
      desc: "Drei Punkte: erster Schenkel, Scheitel, zweiter Schenkel",
      icon: AngleIcon,
    },
    {
      id: "crossangle",
      label: "Schnittwinkel",
      key: "X",
      desc: "Winkel zwischen zwei beliebigen Geraden",
      icon: CrossAngleIcon,
    },
  ],
  [
    {
      id: "rect",
      label: "Rechteck",
      key: "R",
      desc: "Fläche und Umfang über zwei gegenüberliegende Ecken",
      icon: Square,
    },
    {
      id: "ellipse",
      label: "Ellipse",
      key: "E",
      desc: "Fläche und Achsen über die Umfassungsbox aufziehen",
      icon: EllipseIcon,
    },
    {
      id: "circle3",
      label: "Kreis aus 3 Punkten",
      key: "C",
      desc: "Radius, Durchmesser und Mittelpunkt aus drei Randpunkten",
      icon: Circle,
    },
    {
      id: "polygon",
      label: "Polygonfläche",
      key: "F",
      desc: "Freie Form umfahren · Startpunkt oder Enter schließt",
      icon: Pentagon,
    },
  ],
  [
    {
      id: "count",
      label: "Zählen",
      key: "Z",
      desc: "Objekte anklicken – automatische Nummerierung und Summe",
      icon: Hash,
    },
    {
      id: "annotate",
      label: "Notiz & Pfeil",
      key: "T",
      desc: "Klicken für eine Notiz, Ziehen für einen beschrifteten Pfeil",
      icon: MessageSquarePlus,
    },
  ],
];

export default function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const hasImage = useEditor((s) => s.image !== null);

  return (
    <div className="flex w-12 flex-col items-center gap-0.5 overflow-y-auto border-r border-[var(--mw-border)] bg-[var(--mw-surface-0)] py-2">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col items-center gap-0.5">
          {gi > 0 && <div className="my-1.5 h-px w-5 bg-[var(--mw-border)]" />}
          {group.map((t) => {
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!hasImage && t.id !== "select"}
                onClick={() => setTool(t.id)}
                data-tip={t.label}
                data-desc={t.desc}
                data-key={t.key}
                data-side="right"
                className={`group relative flex h-9 w-9 items-center justify-center rounded-[9px] transition-all duration-150 active:scale-90 disabled:opacity-25 disabled:active:scale-100 ${
                  active
                    ? "bg-[var(--mw-accent-bg-strong)] text-[var(--mw-accent-text)]"
                    : "text-[var(--mw-text-dim)] hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)]"
                }`}
                aria-label={t.label}
              >
                <t.icon size={t.id === "line" ? 17 : 18} />
                {active && (
                  <span className="absolute left-[-7px] h-4.5 w-[2.5px] rounded-full bg-[#60A5FA]" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
