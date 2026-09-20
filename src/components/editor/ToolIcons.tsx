// ── MaßWerk · Werkzeug-Ikonen ────────────────────────────────────────────────
// Eine durchgezeichnete Familie: 24er-Raster, Strich 1.6, runde Enden,
// gefüllte Akzentpunkte. Jede Ikone erzählt, was ihr Werkzeug tut –
// kein Icon-Mix, keine Stilbrüche.
"use client";

import type { ComponentType, ReactNode } from "react";

export interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 18,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Gefüllter Akzentpunkt (Messpunkt, Stützstelle). */
function Dot({ cx, cy, r = 1.45 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
}

export const SelectIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 3.8 11.4 20.4 13.9 13.7 20.6 11.2Z" />
  </Svg>
);

export const CalibrateIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" strokeWidth={1.3} />
  </Svg>
);

export const LineIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 7.5v9M19 7.5v9" strokeWidth={1.3} />
    <path d="M7 12h10" />
    <path d="m9.6 9.7-2.6 2.3 2.6 2.3M14.4 9.7l2.6 2.3-2.6 2.3" strokeWidth={1.3} />
  </Svg>
);

export const PolylineIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 18 9.8 8.6l4.4 5.6 5.3-8.4" />
    <Dot cx={4.5} cy={18} />
    <Dot cx={9.8} cy={8.6} />
    <Dot cx={14.2} cy={14.2} />
    <Dot cx={19.5} cy={5.8} />
  </Svg>
);

export const LotIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5.5 4v16" />
    <path d="M5.5 15h13" />
    <path d="M9 15v-3.5h-3.5" strokeWidth={1.25} />
    <Dot cx={20} cy={15} />
  </Svg>
);

export const AngleIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 19.5h15M4.5 19.5 17.5 5.8" />
    <path d="M12 19.5a7.5 7.5 0 0 0-2.4-5.4" strokeWidth={1.3} />
    <Dot cx={4.5} cy={19.5} r={1.3} />
  </Svg>
);

export const CrossAngleIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m5 5 14 14M19 5 5 19" />
    <path d="M14.8 9.2a4 4 0 0 1 0 5.6" strokeWidth={1.3} />
  </Svg>
);

export const RectIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="4.5" y="6.5" width="15" height="11" rx="1.4" />
  </Svg>
);

export const EllipseIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="8.5" ry="6" />
  </Svg>
);

export const Circle3Icon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.8" />
    <Dot cx={12} cy={4.2} />
    <Dot cx={5.3} cy={15.9} />
    <Dot cx={18.7} cy={15.9} />
  </Svg>
);

export const PolygonIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 4l7.8 5.7-3 9.1H7.2l-3-9.1Z" />
  </Svg>
);

export const CountIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 7v10M10 7v10M14 7v10M18 7v10" strokeWidth={1.4} />
    <path d="m4.6 15.2 14.8-7" />
  </Svg>
);

export const AnnotateIcon: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="4.5" y="4.5" width="15" height="11" rx="2" />
    <path d="M8.6 15.5v4l4.2-4" />
    <path d="m8.5 8 6.1 4.3" strokeWidth={1.4} />
    <path d="m13.2 9.4 1.4 2.9-3.2-.4" strokeWidth={1.25} />
  </Svg>
);
