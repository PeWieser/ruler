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

/** Sichtbare Bildgröße nach der Ausrichtung: die Bounding-Box der
    gedrehten Ansicht. Nichts wird beschnitten, nichts gezoomt – das
    Dokument wächst ehrlich um die weggedrehten Ecken (Rotate-and-Expand).
    Der Maßstab (Pixel pro Einheit) bleibt dadurch exakt erhalten. */
export function orientedSize(
  w0: number,
  h0: number,
  quarter: number,
  fine = 0,
): { w: number; h: number } {
  const q = normQuarter(quarter);
  const w1 = q % 2 === 1 ? h0 : w0;
  const h1 = q % 2 === 1 ? w0 : h0;
  const t = Math.abs(fine) * DEG;
  if (t < 1e-9) return { w: w1, h: h1 };
  return {
    w: Math.ceil(w1 * Math.cos(t) + h1 * Math.sin(t)),
    h: Math.ceil(w1 * Math.sin(t) + h1 * Math.cos(t)),
  };
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
  const { w: w1, h: h1 } = orientedSize(w0, h0, q, o.fine);
  const c0 = { x: w0 / 2, y: h0 / 2 };
  const c1 = { x: w1 / 2, y: h1 / 2 };
  let d = { x: p.x - c0.x, y: p.y - c0.y };
  if (q !== 0) d = rot(d, q * Math.PI / 2);
  if (Math.abs(o.fine) > 1e-9) d = rot(d, o.fine * DEG);
  return { x: c1.x + d.x, y: c1.y + d.y };
}

/** Sichtbare Koordinaten → Rohkoordinaten (Umkehrung von orientPointFwd). */
export function orientPointInv(p: Pt, w0: number, h0: number, o: Orientation): Pt {
  const q = normQuarter(o.quarter);
  const { w: w1, h: h1 } = orientedSize(w0, h0, q, o.fine);
  const c0 = { x: w0 / 2, y: h0 / 2 };
  const c1 = { x: w1 / 2, y: h1 / 2 };
  let d = { x: p.x - c1.x, y: p.y - c1.y };
  if (Math.abs(o.fine) > 1e-9) d = rot(d, -o.fine * DEG);
  if (q !== 0) d = rot(d, -q * Math.PI / 2);
  return { x: c0.x + d.x, y: c0.y + d.y };
}

/**
 * Zielwinkel für „Automatisch begradigen": Die gezogene Linie soll horizontal
 * (oder, wenn sie steiler liegt, vertikal) werden. Liefert den neuen
 * Feinwinkel in Grad (−45…+45), ausgehend vom aktuellen.
 */
export function straightenDelta(currentFine: number, a: Pt, b: Pt): number {
  let deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  // auf (−90, 90] normalisieren
  deg = ((((deg + 90) % 180) + 180) % 180) - 90;
  // Linie interpretieren: flacher → Horizontale, steiler → Vertikale
  const primary = Math.abs(deg) > 45 ? Math.sign(deg) * 90 : 0;
  const candidates = [primary, ...[0, 90, -90].filter((t) => t !== primary)];
  for (const t of candidates) {
    const next = currentFine + (t - deg);
    if (next >= -FINE_MAX && next <= FINE_MAX) return Math.round(next * 10) / 10;
  }
  return Math.round(clampFine(currentFine + (primary - deg)) * 10) / 10;
}

/** Automatisch begradigen: die gezeichnete Linie wird zur gewählten Achse.
    Liegt das Ziel außerhalb der ±45°-Feinspanne, wandert der Überhang
    ehrlich in einen 90°-Schritt – die Sperre schützt den Regler,
    nicht die Entscheidung des Menschen. */
export function straightenOrientation(
  cur: Orientation,
  a: Pt,
  b: Pt,
  axis: "h" | "v",
): Orientation {
  let deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  // auf (−90, 90] normalisieren
  deg = ((((deg + 90) % 180) + 180) % 180) - 90;
  const delta = axis === "h" ? -deg : deg >= 0 ? 90 - deg : -90 - deg;
  const total = cur.fine + delta;
  const q = Math.round(total / 90);
  return {
    quarter: normQuarter(cur.quarter + q),
    fine: Math.round(clampFine(total - q * 90) * 10) / 10,
  };
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
  const { w: w1, h: h1 } = orientedSize(w0, h0, q, o.fine);
  const out = document.createElement("canvas");
  out.width = Math.max(1, w1);
  out.height = Math.max(1, h1);
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(w1 / 2, h1 / 2);
  if (Math.abs(o.fine) > 1e-9) ctx.rotate(o.fine * DEG);
  if (q !== 0) ctx.rotate(q * Math.PI / 2);
  ctx.drawImage(source, -w0 / 2, -h0 / 2, w0, h0);
  return out;
}
