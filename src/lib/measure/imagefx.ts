// ── MaßWerk · Bildverarbeitung: LUT-Filter, Schärfe, Snap, Entzerrung ───────
import type { Filters, Pt } from "./types";
import { applyHomography, clamp, invert3 } from "./geometry";

// ── Radiale Objektivverzeichnung (Barrel/Pincushion) ────────────────────────

/**
 * Erzeugt ein LUT für die Vorwärtsverzeichnung und rendert über das WebGL-
 * Fragment-Shader des Perspektive-Moduls – hier nutzen wir die gleiche
 * Invers-Abbildungs-Idee: wir rendern das Ausgabebild, indem wir für jedes
 * Ausgabepixel den entsprechenden Eingabepixel abfragen.
 *
 * k < 0 = Kissenverzeichnung (Pincushion)
 * k > 0 = Tonnenverzeichnung (Barrel)
 * Die Abbildung ist eine Brown-Conrady-Ordnung 2:
 *   r_u = r_d · (1 + k · r_d²)
 * mit r in Einheiten der halben Diagonale (also optisch invariant bei
 * Bildgröße / Auflösung).
 */

const RADIAL_MAX_PIXELS = 60_000_000;

export function radialDistort(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  k: number,
): HTMLCanvasElement | null {
  const out = document.createElement("canvas");
  out.width = srcW;
  out.height = srcH;
  const octx = out.getContext("2d");
  if (!octx) return null;

  // Bild im Zweifelsfall einfach unberührt zurückgeben
  if (Math.abs(k) < 1e-6 || srcW * srcH > RADIAL_MAX_PIXELS) {
    octx.drawImage(source, 0, 0, srcW, srcH);
    return out;
  }

  // Quellbild EINMAL vollständig in einen Lesepuffer rendern – wir brauchen
  // wahlfreien Zugriff auf beliebige Quellzeilen, nicht nur den aktuellen
  // Ausgabestreifen (eine frühere Version las fälschlich nur aus dem
  // gerade geschriebenen Streifen und erzeugte dadurch Bildrauschen).
  const readCanvas = document.createElement("canvas");
  readCanvas.width = srcW;
  readCanvas.height = srcH;
  const rctx = readCanvas.getContext("2d", { willReadFrequently: true });
  if (!rctx) return null;
  rctx.drawImage(source, 0, 0, srcW, srcH);
  const srcBuf = rctx.getImageData(0, 0, srcW, srcH).data;

  const strip = 256;
  const cx = srcW / 2;
  const cy = srcH / 2;
  const invR = 1 / Math.hypot(cx, cy);
  // Inverse: gegeben r_u, suche r_d so dass r_d · (1 + k · r_d²) ≈ r_u.
  const distortInv = (ru: number): number => {
    // Start mit Newtonschritten; bei moderatem |k|<0.4 reichen wenige Iterationen.
    let rd = ru;
    for (let i = 0; i < 6; i++) {
      const f = rd * (1 + k * rd * rd) - ru;
      const fp = 1 + 3 * k * rd * rd;
      rd -= f / fp;
      if (Math.abs(f) < 1e-6) break;
    }
    return rd;
  };
  for (let y = 0; y < srcH; y += strip) {
    const h = Math.min(strip, srcH - y);
    const dst = new Uint8ClampedArray(srcW * h * 4);
    for (let v = 0; v < h; v++) {
      for (let x = 0; x < srcW; x++) {
        const dx = (x - cx) * invR;
        const dy = (y + v - cy) * invR;
        const ru = Math.hypot(dx, dy);
        const rd = ru > 1e-9 ? distortInv(ru) : 0;
        const scale = ru > 1e-9 ? rd / ru : 1;
        const su = cx + (dx * scale) / invR;
        const sv = cy + (dy * scale) / invR;
        const iu = Math.round(su);
        const iv = Math.round(sv);
        const outI = (v * srcW + x) * 4;
        if (iu < 0 || iu >= srcW || iv < 0 || iv >= srcH) {
          dst[outI + 3] = 255;
          continue;
        }
        const srcI = (iv * srcW + iu) * 4;
        dst[outI] = srcBuf[srcI];
        dst[outI + 1] = srcBuf[srcI + 1];
        dst[outI + 2] = srcBuf[srcI + 2];
        dst[outI + 3] = 255;
      }
    }
    octx.putImageData(new ImageData(dst, srcW, h), 0, y);
  }
  return out;
}

/** Punkttransformation für Messpunkte: "verzerrt → unverzerrt". */
export function distortPointInv(p: Pt, w: number, h: number, k: number): Pt {
  if (Math.abs(k) < 1e-6) return p;
  const cx = w / 2;
  const cy = h / 2;
  const invR = 1 / Math.hypot(cx, cy);
  const dx = (p.x - cx) * invR;
  const dy = (p.y - cy) * invR;
  const ru = Math.hypot(dx, dy);
  let rd = ru;
  for (let i = 0; i < 6; i++) {
    const f = rd * (1 + k * rd * rd) - ru;
    const fp = 1 + 3 * k * rd * rd;
    rd -= f / fp;
    if (Math.abs(f) < 1e-6) break;
  }
  const s = ru > 1e-9 ? rd / ru : 1;
  return { x: cx + dx * s / invR, y: cy + dy * s / invR };
}

/** Punkttransformation "unverzerrt → verzerrt" (für Umkehroperation). */
export function distortPointFwd(p: Pt, w: number, h: number, k: number): Pt {
  if (Math.abs(k) < 1e-6) return p;
  const cx = w / 2;
  const cy = h / 2;
  const invR = 1 / Math.hypot(cx, cy);
  const dx = (p.x - cx) * invR;
  const dy = (p.y - cy) * invR;
  const rd = Math.hypot(dx, dy);
  const s = 1 + k * rd * rd;
  return { x: cx + dx * s / invR, y: cy + dy * s / invR };
}



/** Eine 256er-LUT, die Helligkeit, Kontrast, Gamma und Graustufen abbildet. */
export function buildLUT(f: Filters): {
  r: Uint8ClampedArray;
  g: Uint8ClampedArray;
  b: Uint8ClampedArray;
} {
  const r = new Uint8ClampedArray(256);
  const g = new Uint8ClampedArray(256);
  const b = new Uint8ClampedArray(256);
  const invGamma = 1 / f.gamma;
  for (let i = 0; i < 256; i++) {
    let v = (i / 255) * f.brightness;
    v = (v - 0.5) * f.contrast + 0.5;
    v = Math.pow(Math.min(1, Math.max(0, v)), invGamma);
    const out = Math.round(v * 255);
    r[i] = out;
    g[i] = out;
    b[i] = out;
  }
  return { r, g, b };
}

/**
 * Einpass-Nachbearbeitung: optionale Schärfe-Faltung, danach LUT (+ Graustufen).
 * Arbeitet in-place auf einem RGBA-Buffer.
 */
export function postProcess(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  f: Filters,
): void {
  if (f.sharpen > 0 && w >= 3 && h >= 3) {
    const k = f.sharpen * 1.2;
    const src = Uint8ClampedArray.from(data);
    const c00 = -k;
    const c11 = 1 + 4 * k;
    for (let y = 1; y < h - 1; y++) {
      let i = (y * w + 1) * 4;
      for (let x = 1; x < w - 1; x++, i += 4) {
        for (let c = 0; c < 3; c++) {
          const v =
            src[i + c] * c11 +
            (src[i - 4 + c] + src[i + 4 + c] + src[i - w * 4 + c] + src[i + w * 4 + c]) *
              c00;
          data[i + c] = v;
        }
      }
    }
  }
  const lut = buildLUT(f);
  const gray = f.grayscale;
  for (let i = 0; i < data.length; i += 4) {
    let rr = data[i];
    let gg = data[i + 1];
    let bb = data[i + 2];
    if (gray) {
      const lum = (rr * 77 + gg * 150 + bb * 29) >> 8;
      rr = gg = bb = lum;
    }
    data[i] = lut.r[rr];
    data[i + 1] = lut.g[gg];
    data[i + 2] = lut.b[bb];
  }
}

// ── Edge-Snap (Snap-to-Edge) ────────────────────────────────────────────────

let snapTile: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null =
  null;

function getSnapTile() {
  if (!snapTile) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    snapTile = { canvas, ctx };
  }
  return snapTile;
}

export interface SnapHit {
  pt: Pt;
  strength: number;
}

/**
 * Präziser Kantenfang:
 * - arbeitet auf einer kleinen Kachel des ORIGINALBILDS (volle Auflösung,
 *   unabhängig vom Analyse-Capture),
 * - Suchradius wird in Bildpixeln übergeben → zoomabhängig steuerbar,
 * - Sobel-Gradienten + distanzgewichteter Score (Kosinus²-Abfall),
 * - Sub-Pixel-Verfeinerung per Parabel-Fit entlang der Gradientenrichtung.
 */
export function findEdgeLocal(
  source: CanvasImageSource,
  imgW: number,
  imgH: number,
  center: Pt,
  radius: number,
  minStrength = 22,
): SnapHit | null {
  const r = clamp(radius, 1.5, 96);
  const tile = getSnapTile();
  if (!tile) return null;

  const sx0 = Math.max(0, Math.floor(center.x - Math.ceil(r)));
  const sy0 = Math.max(0, Math.floor(center.y - Math.ceil(r)));
  const sx1 = Math.min(imgW, Math.ceil(center.x + Math.ceil(r)));
  const sy1 = Math.min(imgH, Math.ceil(center.y + Math.ceil(r)));
  const w = sx1 - sx0;
  const h = sy1 - sy0;
  if (w < 5 || h < 5) return null;

  if (tile.canvas.width !== w) tile.canvas.width = w;
  if (tile.canvas.height !== h) tile.canvas.height = h;
  const { ctx } = tile;
  try {
    ctx.drawImage(source, sx0, sy0, w, h, 0, 0, w, h);
  } catch {
    return null;
  }
  const data = ctx.getImageData(0, 0, w, h).data;

  const lum = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    lum[j] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  const grad = (x: number, y: number): { gx: number; gy: number; m: number } => {
    const i = y * w + x;
    const gx =
      lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] -
      (lum[i - w - 1] + 2 * lum[i - 1] + lum[i + w - 1]);
    const gy =
      lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] -
      (lum[i - w - 1] + 2 * lum[i - w] + lum[i - w + 1]);
    return { gx, gy, m: Math.abs(gx) + Math.abs(gy) };
  };

  const cx = center.x - sx0;
  const cy = center.y - sy0;
  const r2 = r * r;
  let best = -1;
  let bx = 0;
  let by = 0;
  let bgx = 0;
  let bgy = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const ddx = x - cx;
      const ddy = y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 > r2) continue;
      const g = grad(x, y);
      if (g.m < minStrength) continue;
      const d = Math.sqrt(d2);
      // nahe Kandidaten bevorzugen, aber deutliche Kanten weiter weg erlauben
      const wgt = Math.cos((Math.min(1, d / r) * Math.PI) / 2);
      const score = g.m * wgt * wgt;
      if (score > best) {
        best = score;
        bx = x;
        by = y;
        bgx = g.gx;
        bgy = g.gy;
      }
    }
  }
  if (best <= 0) return null;

  // Sub-Pixel: Parabel-Fit der Gradientenstärke entlang (gx, gy)
  const gl = Math.hypot(bgx, bgy) || 1;
  const dx = bgx / gl;
  const dy = bgy / gl;
  const sx = Math.round(dx);
  const sy = Math.round(dy);
  let off = 0;
  if (
    bx + sx >= 1 &&
    bx + sx < w - 1 &&
    by + sy >= 1 &&
    by + sy < h - 1 &&
    bx - sx >= 1 &&
    bx - sx < w - 1 &&
    by - sy >= 1 &&
    by - sy < h - 1
  ) {
    const m0 = grad(bx, by).m;
    const mp = grad(bx + sx, by + sy).m;
    const mm = grad(bx - sx, by - sy).m;
    const denom = mm - 2 * m0 + mp;
    if (denom < 0) off = clamp((0.5 * (mm - mp)) / denom, -0.75, 0.75);
  }

  return {
    pt: { x: sx0 + bx + dx * off, y: sy0 + by + dy * off },
    strength: best,
  };
}

// ── Entzerrung via WebGL (projektive Textur-Abbildung) ──────────────────────

/**
 * Wendet die Homographie H (Bildquelle → Zielrechteck) auf das Quellbild an.
 * Rendert per WebGL mit inverser Punktabbildung im Fragment-Shader.
 * Gibt ein Canvas mit dem entzerrten Bild (outW×outH) zurück oder null bei Fehlern.
 */
export function warpPerspective(
  source: CanvasImageSource,
  H: number[],
  outW: number,
  outH: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const gl = canvas.getContext("webgl", {
    antialias: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const vsSrc = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const fsSrc = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform mat3 uInvH;
uniform vec2 uOutSize;
uniform vec2 uSrcSize;
void main(){
  vec3 p = uInvH * vec3(vUv.x * uOutSize.x, (1.0 - vUv.y) * uOutSize.y, 1.0);
  vec2 src = p.xy / p.w;
  vec2 uv = vec2(src.x / uSrcSize.x, 1.0 - src.y / uSrcSize.y);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = texture2D(uTex, uv);
  }
}`;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
  } catch {
    return null;
  }

  const srcW =
    source instanceof HTMLCanvasElement || source instanceof ImageBitmap
      ? source.width
      : outW;
  const srcH =
    source instanceof HTMLCanvasElement || source instanceof ImageBitmap
      ? source.height
      : outH;

  const invH = invert3(H);
  // WebGL erwartet spaltenweise für uniformMatrix3fv
  gl.uniformMatrix3fv(gl.getUniformLocation(prog, "uInvH"), false, [
    invH[0], invH[3], invH[6],
    invH[1], invH[4], invH[7],
    invH[2], invH[5], invH[8],
  ]);
  gl.uniform2f(gl.getUniformLocation(prog, "uOutSize"), outW, outH);
  gl.uniform2f(gl.getUniformLocation(prog, "uSrcSize"), srcW, srcH);
  gl.viewport(0, 0, outW, outH);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}

/** Entzerrte Zielgröße aus 4 Eckpunkten (Durchschnittslängen der Seiten). */
export function rectifiedSize(pts: Pt[]): { w: number; h: number } {
  const d = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
  const w = Math.round((d(pts[0], pts[1]) + d(pts[3], pts[2])) / 2);
  const h = Math.round((d(pts[1], pts[2]) + d(pts[0], pts[3])) / 2);
  return { w: Math.max(8, w), h: Math.max(8, h) };
}

/** Wendet eine Punkttransformation auf alle Messpunkte an (nach Entzerrung). */
export function transformPoints(pts: Pt[], H: number[]): Pt[] {
  return pts.map((p) => applyHomography(H, p));
}
