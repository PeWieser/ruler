// ── MaßWerk · Werkzeugleiste (links) ─────────────────────────────────────────
"use client";

import type { ComponentType } from "react";
import { useEditor } from "@/lib/measure/store";
import type { ToolId } from "@/lib/measure/types";
import { useT } from "@/lib/i18n";
import {
  AngleIcon,
  AnnotateIcon,
  CalibrateIcon,
  Circle3Icon,
  CountIcon,
  CrossAngleIcon,
  EllipseIcon,
  LineIcon,
  LotIcon,
  PolygonIcon,
  PolylineIcon,
  RectIcon,
  SelectIcon,
  type IconProps,
} from "./ToolIcons";

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
      label: "Auswählen",
      key: "V",
      desc: "Anklicken, verschieben, Punkte korrigieren",
      icon: SelectIcon,
    },
    {
      id: "calibrate",
      label: "Maßstab kalibrieren",
      key: "K",
      desc: "Strecke bekannter Länge ziehen, Wert eingeben",
      icon: CalibrateIcon,
    },
  ],
  [
    {
      id: "line",
      label: "Distanz",
      key: "M",
      desc: "Abstand zwischen zwei Punkten",
      icon: LineIcon,
    },
    {
      id: "polyline",
      label: "Polylinie",
      key: "P",
      desc: "Pfadlänge über beliebig viele Punkte",
      icon: PolylineIcon,
    },
    {
      id: "lot",
      label: "Lot",
      key: "L",
      desc: "Senkrechter Abstand von Punkt zu Linie",
      icon: LotIcon,
    },
    {
      id: "angle",
      label: "Winkel",
      key: "W",
      desc: "Schenkel – Scheitelpunkt – Schenkel",
      icon: AngleIcon,
    },
    {
      id: "crossangle",
      label: "Schnittwinkel",
      key: "X",
      desc: "Winkel zwischen zwei Geraden",
      icon: CrossAngleIcon,
    },
  ],
  [
    {
      id: "rect",
      label: "Rechteck",
      key: "R",
      desc: "Fläche und Umfang aus zwei Ecken",
      icon: RectIcon,
    },
    {
      id: "ellipse",
      label: "Ellipse",
      key: "E",
      desc: "Fläche und Achsen aus der Umfassungsbox",
      icon: EllipseIcon,
    },
    {
      id: "circle3",
      label: "Kreis aus 3 Punkten",
      key: "C",
      desc: "Radius und Mittelpunkt aus drei Randpunkten",
      icon: Circle3Icon,
    },
    {
      id: "polygon",
      label: "Polygonfläche",
      key: "F",
      desc: "Freie Form · Startpunkt oder Enter schließt",
      icon: PolygonIcon,
    },
  ],
  [
    {
      id: "count",
      label: "Zählen",
      key: "Z",
      desc: "Objekte anklicken – automatisch nummeriert",
      icon: CountIcon,
    },
    {
      id: "annotate",
      label: "Notiz & Pfeil",
      key: "T",
      desc: "Klicken: Notiz · Ziehen: Pfeil",
      icon: AnnotateIcon,
    },
  ],
];

export default function Toolbar() {
  const tr = useT();
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const hasImage = useEditor((s) => s.image !== null);

  return (
    <div className="flex w-12 flex-col items-center gap-0.5 overflow-y-auto border-r border-[var(--mw-border)] bg-[var(--mw-surface-0)] py-2">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col items-center gap-0.5">
          {gi > 0 && <div className="my-1.5 h-px w-5 bg-[var(--mw-border)]" />}
          {group.map((d) => {
            const active = tool === d.id;
            return (
              <button
                key={d.id}
                type="button"
                disabled={!hasImage && d.id !== "select"}
                onClick={() => setTool(d.id)}
                data-tip={tr(d.label)}
                data-desc={tr(d.desc)}
                data-key={d.key}
                data-side="right"
                className={`group relative flex h-9 w-9 items-center justify-center rounded-[9px] transition-colors duration-150 disabled:opacity-25 ${
                  active
                    ? "bg-[var(--mw-accent-bg-strong)] text-[var(--mw-accent-text)]"
                    : "text-[var(--mw-text-dim)] hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text)]"
                }`}
                aria-label={tr(d.label)}
                aria-pressed={active}
              >
                <d.icon size={18} />
                {active && (
                  <span className="absolute left-[-7px] h-4.5 w-[2.5px] rounded-full bg-[var(--mw-accent)]" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
