// ── MaßWerk · Bildausrichtung (90°-Schritte + Feinrotation) ─────────────────
//
// Die Ausrichtung verhält sich wie in Apple Fotos:
//  · „quarter" dreht in 90°-Schritten im Uhrzeigersinn (0–3),
//  · „fine" ist der Geraderichten-Regler in Grad (−45…+45).
//
// Bei der Feinrotation wird das Bild wie bei Apple um den Mittelpunkt gedreht
// und genau so weit hereingezoomt, dass der sichtbare Rahmen vollständig
// gefüllt bleibt (Crop-to-Fill). Die Rotation ist damit eine Ähnlichkeits-
// abbildung (Drehung + einheitliche Skalierung) – Messpunkte lassen sich
// exakt mitführen und der Maßstab exakt nachführen.

import type { Pt } from "./types";

export interface Orientation {
  /** 90°-Schritte im Uhrzeigersinn, normalisiert auf 0–3. */
  quarter: number;
  /** Geraderichten in Grad, −45…+45 (positiv = im Uhrzeigersinn). */
  fine: number;
}

export const IDENTITY_ORIENTATION: Orientation = { quarter: 0, fine: 0 };

export const FINE_MAX = 45;

const DEG = Math.PI / 180;

export function normQuarter(q: number): number {
  return ((Math.round(q) % 4) + 4) % 4;
}

export function clampFine(deg: number): number {
  return Math.min(FINE_MAX, Math.max(-FINE_MAX, deg));
}

export function orientationActive(o: Orientation): boolean {
  return normQuarter(o.quarter) !== 0 || Math.abs(o.fine) > 1e-9;
}

export function sameOrientation(a: Orientation, b: Orientation): boolean {
  return (
    normQuarter(a.quarter) === normQuarter(b.quarter) &&
    Math.abs(a.fine - b.fine) < 1e-9
  );
}

/** Sichtbare Bildgröße nach der Ausrichtung (Feinrotation ändert sie nicht). */
export function orientedSize(w0: number, h0: number, quarter: number): { w: number; h: number } {
  return normQuarter(quarter) % 2 === 1 ? { w: h0, h: w0 } : { w: w0, h: h0 };
}

/**
 * Zoomfaktor, mit dem die Feinrotation den Rahmen füllt (Crop-to-Fill):
 * der sichtbare w×h-Ausschnitt muss vollständig vom gedrehten Bild bedeckt
 * bleiben. s = cos θ + max(w/h, h/w) · sin θ.
 */
export function fillScale(fineDeg: number, w: number, h: number): number {
  const t = Math.abs(fineDeg) * DEG;
  if (t < 1e-9 || w <= 0 || h <= 0) return 1;
  return Math.cos(t) + Math.max(w / h, h / w) * Math.sin(t);
}

function rot(p: Pt, rad: number): Pt {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: c * p.x - s * p.y, y: s * p.x + c * p.y };
}

/**
 * Rohkoordinaten (Originalbild) → sichtbare Koordinaten.
 * w0/h0 sind die Maße des ungedrehten Originals.
 */
export function orientPointFwd(p: Pt, w0: number, h0: number, o: Orientation): Pt {
  const q = normQuarter(o.quarter);
  const { w: w1, h: h1 } = orientedSize(w0, h0, q);
  const c0 = { x: w0 / 2, y: h0 / 2 };
  const c1 = { x: w1 / 2, y: h1 / 2 };
  let d = { x: p.x - c0.x, y: p.y - c0.y };
  if (q !== 0) d = rot(d, q * Math.PI / 2);
  if (Math.abs(o.fine) > 1e-9) {
    const s = fillScale(o.fine, w1, h1);
    d = rot(d, o.fine * DEG);
    d = { x: d.x * s, y: d.y * s };
  }
  return { x: c1.x + d.x, y: c1.y + d.y };
}

/** Sichtbare Koordinaten → Rohkoordinaten (Umkehrung von orientPointFwd). */
export function orientPointInv(p: Pt, w0: number, h0: number, o: Orientation): Pt {
  const q = normQuarter(o.quarter);
  const { w: w1, h: h1 } = orientedSize(w0, h0, q);
  const c0 = { x: w0 / 2, y: h0 / 2 };
  const c1 = { x: w1 / 2, y: h1 / 2 };
  let d = { x: p.x - c1.x, y: p.y - c1.y };
  if (Math.abs(o.fine) > 1e-9) {
    const s = fillScale(o.fine, w1, h1);
    d = { x: d.x / s, y: d.y / s };
    d = rot(d, -o.fine * DEG);
  }
  if (q !== 0) d = rot(d, -q * Math.PI / 2);
  return { x: c0.x + d.x, y: c0.y + d.y };
}

/**
 * Rendert das ausgerichtete Bild in ein neues Canvas (GPU-beschleunigt über
 * drawImage – schnell genug für den Live-Regler). Gibt null zurück, wenn die
 * Ausrichtung identisch ist oder kein Kontext verfügbar ist.
 */
export function renderOriented(
  source: CanvasImageSource,
  w0: number,
  h0: number,
  o: Orientation,
): HTMLCanvasElement | null {
  if (!orientationActive(o)) return null;
  const q = normQuarter(o.quarter);
  const { w: w1, h: h1 } = orientedSize(w0, h0, q);
  const out = document.createElement("canvas");
  out.width = Math.max(1, w1);
  out.height = Math.max(1, h1);
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(w1 / 2, h1 / 2);
  if (Math.abs(o.fine) > 1e-9) {
    const s = fillScale(o.fine, w1, h1);
    ctx.rotate(o.fine * DEG);
    ctx.scale(s, s);
  }
  if (q !== 0) ctx.rotate(q * Math.PI / 2);
  ctx.drawImage(source, -w0 / 2, -h0 / 2, w0, h0);
  return out;
}
