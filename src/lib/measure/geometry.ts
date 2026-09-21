// ── MaßWerk · Geometrie, Statistik & Formatierung ───────────────────────────
import { t } from "@/lib/i18n";
import type { Calibration, Measurement, Pt, Rect } from "./types";

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Flächeninhalt (Schußformel) – Vorzeichen egal. */
export function polygonArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s / 2);
}

export function pathLength(pts: Pt[], closed = false): number {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += dist(pts[i], pts[i + 1]);
  if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0]);
  return s;
}

export function centroid(pts: Pt[]): Pt {
  let x = 0;
  let y = 0;
  // Flächenschwerpunkt für Polygone, sonst Mittelwert
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const c = p.x * q.y - q.x * p.y;
    a += c;
    x += (p.x + q.x) * c;
    y += (p.y + q.y) * c;
  }
  if (Math.abs(a) > 1e-9) {
    a /= 2;
    return { x: x / (6 * a), y: y / (6 * a) };
  }
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/** Kreis aus drei Randpunkten. Null bei kollinearen Punkten. */
export function circleFrom3Points(
  a: Pt,
  b: Pt,
  c: Pt,
): { c: Pt; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const center = { x: ux, y: uy };
  return { c: center, r: dist(center, a) };
}

/** Innenwinkel am Scheitelpunkt v in Grad (0–180). */
export function angleAt(a: Pt, v: Pt, c: Pt): number {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x);
  const a2 = Math.atan2(c.y - v.y, c.x - v.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/** Schnittpunkt zweier Geraden (p1p2) × (p3p4). Null wenn parallel. */
export function lineIntersection(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t =
    ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/** Winkel zwischen zwei Geraden (spitzer Schnittwinkel, 0–90°). */
export function angleBetweenLines(p1: Pt, p2: Pt, p3: Pt, p4: Pt): number {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;
  const dot = dx1 * dx2 + dy1 * dy2;
  const l1 = Math.hypot(dx1, dy1);
  const l2 = Math.hypot(dx2, dy2);
  if (l1 < 1e-9 || l2 < 1e-9) return 0;
  const cos = clamp(Math.abs(dot) / (l1 * l2), 0, 1);
  return Math.acos(cos) * (180 / Math.PI);
}

/** Lotfußpunkt von p auf Strecke ab (für Gerade beliebig, hier segment-gebunden). */
export function closestPointOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return { ...a };
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Lotfußpunkt auf der unendlichen Geraden durch a,b. */
export function closestPointOnLine(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return { ...a };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  return dist(p, closestPointOnSegment(p, a, b));
}

/** Ellipsenumfang, Ramanujan II – numerisch sehr genau. */
export function ellipseCircumference(rx: number, ry: number): number {
  const a = Math.max(rx, ry);
  const b = Math.min(rx, ry);
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export function rectFrom2(a: Pt, b: Pt): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

// ── Ellipsen-Hilfsfunktionen (Bounding-Box → Mittelpunkt/Radien) ────────────
export function ellipseFromBBox(a: Pt, b: Pt): { c: Pt; rx: number; ry: number } {
  return {
    c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    rx: Math.abs(b.x - a.x) / 2,
    ry: Math.abs(b.y - a.y) / 2,
  };
}

// ── Homographie (Entzerrung) ────────────────────────────────────────────────

/** Löst Ax=b mit Gauß-Elimination (partielle Pivotisierung). */
function gaussSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(A[r][col]) > Math.abs(A[maxRow][col])) maxRow = r;
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    const piv = A[col][col];
    if (Math.abs(piv) < 1e-12) continue;
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / piv;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = Math.abs(A[r][r]) < 1e-12 ? 0 : s / A[r][r];
  }
  return x;
}

/**
 * Homographie-Matrix (3×3, zeilenweise flach), die src→dst abbildet.
 * Beide Arrays enthalten 4 Punkte (Reihenfolge: li-oben, re-oben, re-unten, li-unten).
 */
export function homography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(Y);
  }
  const h = gaussSolve(A, b);
  return [...h, 1];
}

export function applyHomography(H: number[], p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / w,
  };
}

export function invert3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return m;
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}

// ── Schwellenwert-Analyse (Connected Components) ────────────────────────────

export interface Blob {
  area: number; // Capture-Pixel
  cx: number;
  cy: number;
}

export interface Blob {
  area: number; // Capture-Pixel
  cx: number;
  cy: number;
  /** Rand-Pixel für Konturlänge (optional, 0 wenn nicht berechnet) */
  perimeter: number;
}

/** Einfacher Box-Blur zur Rauschunterdrückung vor der Schwellenwertbildung. */
export function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  // horizontal
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) sum += src[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / (r * 2 + 1);
      const add = src[row + clamp(x + r + 1, 0, w - 1)];
      const sub = src[row + clamp(x - r, 0, w - 1)];
      sum += add - sub;
    }
  }
  // vertikal
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (r * 2 + 1);
      const add = tmp[clamp(y + r + 1, 0, h - 1) * w + x];
      const sub = tmp[clamp(y - r, 0, h - 1) * w + x];
      sum += add - sub;
    }
  }
  return out;
}

/**
 * Morphologisches Schließen (Dilatation gefolgt von Erosion) mit einem
 * kreisförmigen Strukturelement. Schließt kleine Lücken und verschmilzt
 * Objekte, die durch Reflexionen, Aufdrucke oder Rauschen fälschlich in
 * mehrere Teile zerfallen (typisch bei Linealen, glänzenden Schrauben …).
 */
export function morphClose(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const r = Math.round(radius);
  if (r <= 0) return mask;
  const offsets: [number, number][] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + 0.5) offsets.push([dx, dy]);
    }
  }
  const dilate = (src: Uint8Array): Uint8Array => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!src[y * w + x]) continue;
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
        }
      }
    }
    return out;
  };
  const erode = (src: Uint8Array): Uint8Array => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let keep = 1;
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || !src[ny * w + nx]) {
            keep = 0;
            break;
          }
        }
        out[y * w + x] = keep;
      }
    }
    return out;
  };
  return erode(dilate(mask));
}

/**
 * Automatische Otsu-Schwellenwertberechnung auf einem Graustufen-Luminanzpuffer.
 * Gibt 0..255 zurück.
 */
export function otsuThreshold(lum: Uint8ClampedArray | Float32Array, length: number): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < length; i++) {
    const v = lum[i];
    hist[v < 1 ? 0 : v > 254 ? 254 : v | 0]++;
  }
  const N = length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let maxVar = -Infinity;
  // Bei einem flachen "Tal" zwischen zwei deutlich getrennten Häufungen
  // (typisch: sauberes Objekt vor gleichmäßigem Hintergrund) liefern mehrere
  // benachbarte Werte dieselbe maximale Streuung. Statt willkürlich den
  // ersten Treffer zu nehmen, wird die Mitte dieses Plateaus verwendet –
  // das legt die Schwelle sauber in die Mitte des Tals statt an dessen Rand.
  let loT = 128;
  let hiT = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = N - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar + 1e-6) {
      maxVar = between;
      loT = t;
      hiT = t;
    } else if (Math.abs(between - maxVar) <= 1e-6) {
      hiT = t;
    }
  }
  return Math.round((loT + hiT) / 2);
}

/**
 * Labelt verbundene Regionen (8-Connexity) mit anschließender Lochfüllung:
 * Komponenten, die den Rand berühren und "Löcher" vollständig umschließen,
 * werden als Hintergrund angesehen und ihre umschlossenen Löcher gefüllt.
 */
export function labelBlobs(
  mask: Uint8Array,
  w: number,
  h: number,
  minArea: number,
  maxArea = Infinity,
): Blob[] {
  const labels = new Int32Array(w * h).fill(-1);
  const masks = new Uint8Array(w * h);
  const blobs: Blob[] = [];
  const stack = new Int32Array(w * h);
  let current = -1;
  const nbrs = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx] === 0 || labels[idx] !== -1) continue;
      current++;
      let sp = 0;
      stack[sp++] = idx;
      labels[idx] = current;
      let area = 0;
      let sx = 0;
      let sy = 0;
      let touchesBorder = false;
      let perimeter = 0;
      while (sp > 0) {
        const i = stack[--sp];
        const px = i % w;
        const py = (i / w) | 0;
        area++;
        sx += px;
        sy += py;
        if (px === 0 || py === 0 || px === w - 1 || py === h - 1)
          touchesBorder = true;
        let edges = 0;
        for (let n = 0; n < 8; n++) {
          const ni = i + nbrs[n];
          const npx = px + (nbrs[n] % w);
          const npy = py + ((nbrs[n] / w) | 0);
          // Diagonale: Nur wenn einer der orth. Nachbarn auch da ist (echte 8-Connexity-Füllung, aber Perimeter zählt 4er)
          if (n % 2 === 1) {
            if (
              ni < 0 ||
              ni >= w * h ||
              npx < 0 ||
              npx >= w ||
              npy < 0 ||
              npy >= h ||
              !mask[ni]
            ) {
              edges++;
            }
            continue;
          }
          if (
            ni < 0 ||
            ni >= w * h ||
            npx < 0 ||
            npx >= w ||
            npy < 0 ||
            npy >= h ||
            !mask[ni]
          ) {
            edges++;
          } else if (labels[ni] === -1) {
            labels[ni] = current;
            stack[sp++] = ni;
          }
        }
        perimeter += edges;
      }
      if (touchesBorder) continue; // Randberührend → Hintergrund oder Schnitt mit ROI-Kante
      blobs.push({
        area,
        cx: sx / area,
        cy: sy / area,
        perimeter,
      });
      if (area <= maxArea && area >= minArea) {
        // Maske für Tint zeichnen (alle mit diesem Label)
        for (let i = 0; i < w * h; i++) if (labels[i] === current) masks[i] = 1;
      }
    }
  }
  // mask-Output zurückschreiben: nur die "echten" Blobs bleiben markiert
  mask.fill(0);
  for (let i = 0; i < w * h; i++) if (masks[i]) mask[i] = 1;
  return blobs.filter((b) => b.area >= minArea && b.area <= maxArea);
}

// ── Statistik je Messung ────────────────────────────────────────────────────

export type StatKind = "length" | "area" | "angle" | "count" | "none";

export interface Stat {
  label: string;
  kind: StatKind;
  /** Rohwert in px, px², Grad oder Stück. */
  raw: number;
}

export function measurementStats(m: Measurement): Stat[] {
  const p = m.points;
  switch (m.kind) {
    case "line":
      return p.length >= 2
        ? [{ label: t("Länge"), kind: "length", raw: dist(p[0], p[1]) }]
        : [];
    case "polyline":
      return p.length >= 2
        ? [{ label: t("Länge"), kind: "length", raw: pathLength(p) }]
        : [];
    case "lot": {
      if (p.length < 3) return [];
      const foot = closestPointOnLine(p[2], p[0], p[1]);
      return [{ label: t("Abstand"), kind: "length", raw: dist(p[2], foot) }];
    }
    case "angle":
      return p.length >= 3
        ? [{ label: t("Winkel"), kind: "angle", raw: angleAt(p[0], p[1], p[2]) }]
        : [];
    case "crossangle": {
      if (p.length < 4) return [];
      const acute = angleBetweenLines(p[0], p[1], p[2], p[3]);
      return [
        { label: t("Schnittwinkel"), kind: "angle", raw: acute },
        { label: t("Gegenwinkel"), kind: "angle", raw: 180 - acute },
      ];
    }
    case "rect": {
      if (p.length < 2) return [];
      const r = rectFrom2(p[0], p[1]);
      return [
        { label: t("Fläche"), kind: "area", raw: r.w * r.h },
        { label: t("Umfang"), kind: "length", raw: 2 * (r.w + r.h) },
        { label: t("Breite"), kind: "length", raw: r.w },
        { label: t("Höhe"), kind: "length", raw: r.h },
      ];
    }
    case "ellipse": {
      if (p.length < 2) return [];
      const e = ellipseFromBBox(p[0], p[1]);
      return [
        { label: t("Fläche"), kind: "area", raw: Math.PI * e.rx * e.ry },
        { label: t("Umfang ≈"), kind: "length", raw: ellipseCircumference(e.rx, e.ry) },
        { label: t("Achse a"), kind: "length", raw: e.rx * 2 },
        { label: t("Achse b"), kind: "length", raw: e.ry * 2 },
      ];
    }
    case "circle3": {
      if (p.length < 3) return [];
      const c = circleFrom3Points(p[0], p[1], p[2]);
      if (!c) return [];
      return [
        { label: t("Radius"), kind: "length", raw: c.r },
        { label: t("Durchmesser"), kind: "length", raw: 2 * c.r },
        { label: t("Fläche"), kind: "area", raw: Math.PI * c.r * c.r },
        { label: t("Umfang"), kind: "length", raw: 2 * Math.PI * c.r },
      ];
    }
    case "polygon":
      return p.length >= 3
        ? [
            { label: t("Fläche"), kind: "area", raw: polygonArea(p) },
            { label: t("Umfang"), kind: "length", raw: pathLength(p, true) },
          ]
        : [];
    case "count":
      return [{ label: t("Anzahl"), kind: "count", raw: p.length }];
    default:
      return [];
  }
}

// ── Formatierung ────────────────────────────────────────────────────────────

function decimalsFor(v: number): number {
  const a = Math.abs(v);
  if (a >= 1000) return 0;
  if (a >= 100) return 1;
  if (a >= 10) return 2;
  if (a >= 1) return 2;
  if (a === 0) return 0;
  if (a >= 0.01) return 3;
  return 4;
}

export function fmtNumber(v: number, maxDec?: number): string {
  const d = maxDec ?? decimalsFor(v);
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  }).format(v);
}

/** Wandelt einen Rohwert in die kalibrierte Anzeige (Wert + Einheit). */
export function fmtStat(
  stat: Stat,
  calib: Calibration | null,
): { value: string; unit: string } {
  if (stat.kind === "angle") return { value: fmtNumber(stat.raw, 1), unit: "°" };
  if (stat.kind === "count")
    return { value: fmtNumber(stat.raw, 0), unit: "" };
  if (!calib || calib.unit === "px") {
    return {
      value: fmtNumber(stat.raw),
      unit: stat.kind === "area" ? "px²" : "px",
    };
  }
  const ppu = calib.pixelsPerUnit;
  if (stat.kind === "area") {
    const v = stat.raw / (ppu * ppu);
    return { value: fmtNumber(v), unit: `${calib.unit}²` };
  }
  const v = stat.raw / ppu;
  return { value: fmtNumber(v), unit: calib.unit };
}

export function fmtStatFull(stat: Stat, calib: Calibration | null): string {
  const { value, unit } = fmtStat(stat, calib);
  return unit ? `${value} ${unit}` : value;
}

/** Kurzer Beschriftungstext für die Canvas-Chip neben einer Messung. */
export function primaryLabel(m: Measurement, calib: Calibration | null): string {
  const stats = measurementStats(m);
  if (stats.length === 0) {
    if (m.kind === "note" || m.kind === "arrow") return m.text ?? "";
    return "";
  }
  const s = fmtStatFull(stats[0], calib);
  switch (m.kind) {
    case "rect":
    case "polygon":
    case "ellipse":
      return `A = ${s}`;
    case "circle3": {
      const dia = stats.find((x) => x.label === t("Durchmesser"));
      return dia ? `Ø ${fmtStatFull(dia, calib)}` : s;
    }
    case "count":
      return `${m.points.length} ${m.points.length === 1 ? t("Objekt") : t("Objekte")}`;
    case "angle":
      return `${s}`;
    case "crossangle":
      return `${s}`;
    default:
      return s;
  }
}

/** „Schöne“ Maßstabsbalken-Länge in echten Einheiten (1/2/5 × 10^n). */
export function niceScaleLength(targetReal: number): number {
  if (targetReal <= 0 || !isFinite(targetReal)) return 0;
  const exp = Math.floor(Math.log10(targetReal));
  const base = Math.pow(10, exp);
  const f = targetReal / base;
  const nice = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  return nice * base;
}
