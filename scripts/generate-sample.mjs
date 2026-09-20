// ── MaßWerk · Beispielbild generieren ────────────────────────────────────────
// Erzeugt public/samples/beispiel.png: ein messtechnisch exaktes Zielbild.
//  · Lineal unten: genau 10 px pro Millimeter (0–160 mm)
//  · Scheiben mit known Durchmessern, Winkel 45°, Lochplatte, Zählunkte
// Ohne Abhängigkeiten: eigener Rasterer (analytisches Anti-Aliasing) +
// eigener PNG-Writer (node:zlib).
//
// Nutzung: node scripts/generate-sample.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1920;
const H = 1280;
const PXM = 10; // Pixel pro Millimeter auf dem Lineal

const buf = new Float64Array(W * H * 3); // RGB, 0..255
const shadow = new Float32Array(W * H);  // Silhouetten-Puffer für weiche Schatten

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── Hintergrund (Papier) ─────────────────────────────────────────────────────
function bgAt(x, y) {
  const t = y / (H - 1);
  let r = 244 - 14 * t;
  let g = 242 - 15 * t;
  let b = 238 - 17 * t;
  // Vignette
  const dx = (x - W / 2) / (W / 2);
  const dy = (y - H / 2) / (H / 2);
  const v = 1 - 0.085 * clamp01((dx * dx + dy * dy) / 1.6);
  // feines deterministisches Rauschen gegen Banding
  const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  const d = (n - 0.5) * 1.6;
  return [r * v + d, g * v + d, b * v + d];
}

function paintBackground() {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = bgAt(x, y);
      const i = (y * W + x) * 3;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
    }
  }
}

// ── Primitiven mit analytischem Anti-Aliasing ────────────────────────────────
function blend(x, y, cov, r, g, b, into = buf) {
  if (cov <= 0) return;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  cov = clamp01(cov);
  const i = (y * W + x) * 3;
  into[i] = into[i] * (1 - cov) + r * cov;
  into[i + 1] = into[i + 1] * (1 - cov) + g * cov;
  into[i + 2] = into[i + 2] * (1 - cov) + b * cov;
}

function shadowAt(x, y, cov) {
  if (cov <= 0 || x < 0 || y < 0 || x >= W || y >= H) return;
  shadow[y * W + x] = Math.min(1, shadow[y * W + x] + clamp01(cov));
}

/** Gefüllte Scheibe. */
function disc(cx, cy, r, col, sh = true) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(H - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cov = clamp01(r + 0.5 - d);
      if (cov <= 0) continue;
      blend(x, y, cov, col[0], col[1], col[2]);
      if (sh) shadowAt(x, y + 7, cov * 0.9);
    }
  }
}

/** Ring (Lochscheibe). */
function ring(cx, cy, rOut, rIn, col, sh = true) {
  const mid = (rOut + rIn) / 2;
  const half = (rOut - rIn) / 2;
  const x0 = Math.max(0, Math.floor(cx - rOut - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + rOut + 1));
  const y0 = Math.max(0, Math.floor(cy - rOut - 1));
  const y1 = Math.min(H - 1, Math.ceil(cy + rOut + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cov = clamp01(half + 0.5 - Math.abs(d - mid));
      if (cov <= 0) continue;
      blend(x, y, cov, col[0], col[1], col[2]);
      if (sh) shadowAt(x, y + 7, cov * 0.9);
    }
  }
}

/** Strecke mit runden Enden (Punkt-Stempeln). */
function stroke(x0, y0, x1, y1, w, col, sh = true) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.ceil(len / (w / 2.5)));
  const r = w / 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    const xA = Math.max(0, Math.floor(cx - r - 1));
    const xB = Math.min(W - 1, Math.ceil(cx + r + 1));
    const yA = Math.max(0, Math.floor(cy - r - 1));
    const yB = Math.min(H - 1, Math.ceil(cy + r + 1));
    for (let y = yA; y <= yB; y++) {
      for (let x = xA; x <= xB; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const cov = clamp01(r + 0.5 - d) * 0.55;
        if (cov <= 0.01) continue;
        blend(x, y, cov, col[0], col[1], col[2]);
        if (sh) shadowAt(x, y + 7, cov * 0.5);
      }
    }
  }
}

function polyline(pts, w, col, sh = true) {
  for (let i = 0; i < pts.length - 1; i++) {
    stroke(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, col, sh);
  }
}

/** Gefülltes, abgerundetes Rechteck. */
function roundRect(x0, y0, x1, y1, r, col, sh = true) {
  for (let y = Math.floor(y0) - 1; y <= Math.ceil(y1) + 1; y++) {
    for (let x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
      const cxq = Math.max(x0 + r, Math.min(x + 0.5, x1 - r));
      const cyq = Math.max(y0 + r, Math.min(y + 0.5, y1 - r));
      const inCore =
        x + 0.5 > x0 && x + 0.5 < x1 && y + 0.5 > y0 && y + 0.5 < y1;
      const d = Math.hypot(x + 0.5 - cxq, y + 0.5 - cyq);
      const cov = inCore ? 1 : clamp01(r + 0.5 - d);
      if (cov <= 0) continue;
      blend(x, y, cov, col[0], col[1], col[2]);
      if (sh) shadowAt(x, y + 8, cov * 0.9);
    }
  }
}

// ── Strichziffern (eigene Mini-Vektorschrift) ────────────────────────────────
// Raster 0..10 × 0..16, gezeichnet als Polylinien.
function ellipsePts(cx, cy, rx, ry, n = 44) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

const GLYPHS = {
  0: [ellipsePts(5, 8, 3.9, 6.9)],
  1: [
    [[2.9, 3.6], [5.1, 1.4]],
    [[5.1, 1.4], [5.1, 14.8]],
  ],
  2: [
    [
      [1.3, 4.9], [1.7, 3.2], [2.9, 1.9], [4.6, 1.2], [6.4, 1.4],
      [7.9, 2.4], [8.7, 4.0], [8.6, 5.7], [7.7, 7.2], [6.0, 9.1],
      [1.4, 14.6], [8.9, 14.6],
    ],
  ],
  3: [
    [
      [1.5, 2.4], [3.2, 1.4], [5.4, 1.1], [7.3, 1.7], [8.5, 3.2],
      [8.4, 5.1], [7.2, 6.6], [5.4, 7.5], [4.2, 7.8],
    ],
    [
      [4.2, 7.8], [6.2, 8.0], [7.9, 9.0], [8.9, 10.8], [8.7, 12.9],
      [7.4, 14.4], [5.3, 15.1], [3.2, 14.8], [1.6, 13.9],
    ],
  ],
  4: [[[7.0, 14.8], [7.0, 1.2], [1.1, 11.4], [9.4, 11.4]]],
  5: [
    [
      [8.6, 1.3], [2.7, 1.3], [2.0, 6.6], [3.4, 5.8], [5.2, 5.5],
      [7.0, 6.0], [8.3, 7.3], [8.8, 9.2], [8.5, 11.4], [7.3, 13.2],
      [5.4, 14.3], [3.4, 14.3], [1.8, 13.5],
    ],
  ],
  6: [
    [
      [8.0, 1.6], [6.2, 1.1], [4.4, 1.5], [3.0, 2.8], [2.0, 4.8],
      [1.5, 7.3], [1.4, 9.8], [1.9, 11.9], [3.1, 13.6], [4.9, 14.5],
      [6.7, 14.4], [8.1, 13.4], [8.9, 11.8], [8.9, 10.0], [8.0, 8.6],
      [6.5, 7.8], [4.8, 7.7], [3.2, 8.4], [2.1, 9.8], [1.55, 11.3],
    ],
  ],
  7: [[[1.6, 1.3], [8.9, 1.3], [4.6, 14.8]]],
  8: [ellipsePts(5, 4.9, 3.5, 3.8), ellipsePts(5, 11.1, 3.8, 4.0)],
  9: [
    ellipsePts(5, 4.7, 3.9, 3.7),
    [
      [8.9, 4.7], [8.9, 9.6], [8.4, 12.2], [7.2, 14.0], [5.4, 15.0],
      [3.4, 14.8], [2.0, 14.0],
    ],
  ],
};

/** Zahl zentriert auf (cx, topY) mit gegebener Höhe zeichnen. */
function drawNumber(cx, topY, value, size, col) {
  const s = size / 16;
  const digits = String(value).split("").map(Number);
  const adv = 10 * s * 1.32;
  const total = adv * digits.length - 3.2 * s;
  let x = cx - total / 2;
  const w = Math.max(1.4, size * 0.115);
  for (const d of digits) {
    for (const poly of GLYPHS[d]) {
      const pts = poly.map(([px2, py]) => [x + px2 * s, topY + py * s]);
      polyline(pts, w, col, false);
    }
    x += adv;
  }
}

// ── Lineal (exakt 10 px/mm) ──────────────────────────────────────────────────
function drawRuler() {
  const x0 = 140;
  const x1 = 1780;
  const y0 = 1020;
  const y1 = 1210;
  const r = 12;
  // Stahlkörper mit vertikalem Verlauf
  for (let y = Math.floor(y0); y <= y1; y++) {
    const t = (y - y0) / (y1 - y0);
    const g = 226 - 30 * t;
    for (let x = Math.floor(x0); x <= x1; x++) {
      const cxq = Math.max(x0 + r, Math.min(x + 0.5, x1 - r));
      const cyq = Math.max(y0 + r, Math.min(y + 0.5, y1 - r));
      const inCore = x + 0.5 > x0 && x + 0.5 < x1 && y + 0.5 > y0 && y + 0.5 < y1;
      const d = Math.hypot(x + 0.5 - cxq, y + 0.5 - cyq);
      const cov = inCore ? 1 : clamp01(r + 0.5 - d);
      if (cov <= 0) continue;
      blend(x, y, cov, g + 4, g + 5, g + 8);
      shadowAt(x, y + 9, cov * 0.95);
    }
  }
  // Kanten: oben hell, unten dunkel
  polyline([[x0 + r, y0 + 0.8], [x1 - r, y0 + 0.8]], 1.6, [250, 251, 252], false);
  polyline([[x0 + r, y1 - 0.8], [x1 - r, y1 - 0.8]], 1.6, [120, 123, 129], false);

  // Skala: 0…160 mm bei 10 px/mm
  const tickCol = [58, 60, 64];
  for (let mm = 0; mm <= 160; mm++) {
    const x = 160 + mm * PXM;
    const big = mm % 10 === 0;
    const mid = mm % 5 === 0;
    const h = big ? 46 : mid ? 30 : 17;
    const w = big ? 2.6 : mid ? 2 : 1.5;
    stroke(x, y0 + 5, x, y0 + 5 + h, w, tickCol, false);
    if (big) drawNumber(x, y0 + 66, mm, 30, tickCol);
  }
}

// ── Objekte ──────────────────────────────────────────────────────────────────
function drawScene() {
  const steel = [52, 53, 59];
  const steelDark = [44, 45, 50];
  const mark = [58, 59, 65];

  // Lochscheiben (Unterlegscheiben) – Durchmesser exakt in mm
  const washers = [
    { cx: 460, cy: 430, ro: 110, ri: 50 }, // Ø 22 mm, Bohrung Ø 10 mm
    { cx: 980, cy: 300, ro: 75, ri: 34 },  // Ø 15 mm
    { cx: 1500, cy: 500, ro: 50, ri: 22 }, // Ø 10 mm
  ];
  for (const wsh of washers) {
    ring(wsh.cx, wsh.cy, wsh.ro, wsh.ri, steel);
    // feine Innenschattierung am Bohrrand
    ring(wsh.cx, wsh.cy, wsh.ri + 5, wsh.ri, steelDark, false);
    // Mittelkreuz für den Circle-from-3-Points-Demo
    const s = 16;
    stroke(wsh.cx - s, wsh.cy, wsh.cx + s, wsh.cy, 2.4, [232, 230, 225], false);
    stroke(wsh.cx, wsh.cy - s, wsh.cx, wsh.cy + s, 2.4, [232, 230, 225], false);
  }

  // Lochplatte mit zwei Bohrungen (Distanz-Messdemo)
  roundRect(240, 700, 760, 950, 20, [64, 65, 71]);
  for (const [hx, hy] of [[340, 780], [660, 870]]) {
    disc(hx, hy, 27, bgAt(hx, hy), false);         // Bohrung = Papier
    ring(hx, hy, 27, 23, [38, 39, 43], false);      // Senkkante
    shadowAt(hx, hy + 2, 0); // (Schatten der Bohrung entfällt)
  }

  // Winkel-Target: exakt 45°
  const vx = 1150, vy = 870, L = 280;
  stroke(vx, vy, vx + L, vy, 11, mark);
  const a45 = (Math.PI / 4);
  stroke(vx, vy, vx + L * Math.cos(a45), vy - L * Math.sin(a45), 11, mark);
  const arc = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * a45;
    arc.push([vx + 88 * Math.cos(t), vy - 88 * Math.sin(t)]);
  }
  polyline(arc, 4.5, mark, false);

  // Zählpunkte (5 Stück, für den Zählwerkzeug-Demo)
  for (const [cx, cy] of [
    [300, 180], [438, 138], [575, 205], [390, 292], [548, 322],
  ]) {
    disc(cx, cy, 18, [70, 71, 78]);
  }
}

// ── Schatten (Box-Blur über Silhouetten-Puffer) ─────────────────────────────
function boxBlur1(src, dst, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    let acc = 0;
    const row = y * W;
    for (let x = -r; x <= r; x++) acc += src[row + Math.max(0, Math.min(W - 1, x))];
    for (let x = 0; x < W; x++) {
      dst[row + x] = acc * inv;
      acc += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += dst[Math.max(0, Math.min(H - 1, y)) * W + x];
    for (let y = 0; y < H; y++) {
      src[y * W + x] = acc * inv;
      acc +=
        dst[Math.min(H - 1, y + r + 1) * W + x] - dst[Math.max(0, y - r) * W + x];
    }
  }
}

function applyShadows() {
  const tmp = new Float32Array(W * H);
  boxBlur1(shadow, tmp, 6);
  boxBlur1(shadow, tmp, 6);
  for (let i = 0; i < W * H; i++) {
    const s = clamp01(shadow[i]) * 0.3;
    if (s <= 0) continue;
    buf[i * 3] *= 1 - s;
    buf[i * 3 + 1] *= 1 - s;
    buf[i * 3 + 2] *= 1 - s;
  }
}

// ── PNG-Writer ───────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG() {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  const line = Buffer.alloc(W * 4);
  const prev = Buffer.alloc(W * 4);
  let o = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      line[x * 4] = Math.max(0, Math.min(255, Math.round(buf[i])));
      line[x * 4 + 1] = Math.max(0, Math.min(255, Math.round(buf[i + 1])));
      line[x * 4 + 2] = Math.max(0, Math.min(255, Math.round(buf[i + 2])));
      line[x * 4 + 3] = 255;
    }
    // Filterwahl: None / Sub / Up – kleinste Summe gewinnt
    const sums = [0, 0, 0];
    for (let i = 0; i < W * 4; i++) {
      const a = i >= 4 ? line[i - 4] : 0;
      const b = prev[i];
      sums[0] += line[i];
      sums[1] += Math.abs(line[i] - a);
      sums[2] += Math.abs(line[i] - b);
    }
    const f = sums.indexOf(Math.min(...sums));
    raw[o++] = f;
    for (let i = 0; i < W * 4; i++) {
      const a = i >= 4 ? line[i - 4] : 0;
      const b = prev[i];
      const v = f === 0 ? line[i] : f === 1 ? line[i] - a : line[i] - b;
      raw[o++] = v & 0xff;
    }
    prev.set(line);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // Bit depth
  ihdr[9] = 6;  // Truecolor + Alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Hauptprogramm ────────────────────────────────────────────────────────────
paintBackground();
drawScene();
drawRuler();
applyShadows();

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples");
mkdirSync(out, { recursive: true });
const file = join(out, "beispiel.png");
writeFileSync(file, encodePNG());
console.log(`✓ ${file} (${Math.round(statSync(file).size / 1024)} KB)`);
