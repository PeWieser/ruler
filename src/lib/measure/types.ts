// ── MaßWerk · Kerntypen ─────────────────────────────────────────────────────

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Unit = "px" | "mm" | "cm" | "m" | "µm" | "in" | "ft";

export const UNITS: Unit[] = ["mm", "cm", "m", "µm", "in", "ft", "px"];

/** Umrechnung einer Einheit in Millimeter (für Profil-Konvertierung). */
export const UNIT_TO_MM: Record<Unit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  µm: 0.001,
  in: 25.4,
  ft: 304.8,
  px: 0,
};

export type ToolId =
  | "select"
  | "calibrate"
  | "line"
  | "polyline"
  | "lot"
  | "angle"
  | "crossangle"
  | "rect"
  | "ellipse"
  | "circle3"
  | "polygon"
  | "count"
  | "annotate";

export type MeasurementKind =
  | "line"
  | "polyline"
  | "lot"
  | "angle"
  | "crossangle"
  | "rect"
  | "ellipse"
  | "circle3"
  | "polygon"
  | "count"
  | "note"
  | "arrow";

export interface Measurement {
  id: string;
  kind: MeasurementKind;
  name: string;
  /** Punkte in Bildkoordinaten (Original-Pixel). */
  points: Pt[];
  color: string;
  visible: boolean;
  text?: string;
  createdAt: number;
}

export interface Calibration {
  /** Pixel pro Einheit – Länge in Einheit = px / pixelsPerUnit */
  pixelsPerUnit: number;
  unit: Unit;
}

export interface CalibrationProfile {
  id: string;
  name: string;
  pixelsPerUnit: number;
  unit: Unit;
}

export interface Filters {
  brightness: number; // 1 = neutral
  contrast: number; // 1 = neutral
  gamma: number; // 1 = neutral
  sharpen: number; // 0 = aus
  grayscale: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  brightness: 1,
  contrast: 1,
  gamma: 1,
  sharpen: 0,
  grayscale: false,
};

export function filtersActive(f: Filters): boolean {
  return (
    f.brightness !== 1 ||
    f.contrast !== 1 ||
    f.gamma !== 1 ||
    f.sharpen !== 0 ||
    f.grayscale
  );
}

/** Farbpalette, aus der neue Messungen automatisch gefärbt werden. */
export const PALETTE = [
  "#FFD60A",
  "#32ADE6",
  "#FF9F0A",
  "#30D158",
  "#FF6482",
  "#BF5AF2",
];

export const KIND_LABEL: Record<MeasurementKind, string> = {
  line: "Distanz",
  polyline: "Polylinie",
  lot: "Lot",
  angle: "Winkel",
  crossangle: "Schnittwinkel",
  rect: "Rechteck",
  ellipse: "Ellipse",
  circle3: "Kreis",
  polygon: "Fläche",
  count: "Zählung",
  note: "Anmerkung",
  arrow: "Pfeil",
};

let idCounter = 0;
export function uid(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`;
}
