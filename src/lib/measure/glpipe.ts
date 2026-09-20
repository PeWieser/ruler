// ── MaßWerk · GPU-Bildpipeline (WebGL) ──────────────────────────────────────
// Ein einziger Kontext, zwei Pässe, null getImageData-Schleifen:
//
//   Pass A (Geometrie):  90°-Schritte + Feinrotation + radiale Objektiv-
//                        korrektur – invers abgebildet im Fragment-Shader,
//                        Rendern in ein FBO-Textur-Ziel (kein Readback).
//   Kopie:               FBO → Standard-Framebuffer → 2D-Canvas. Diese Kopie
//                        IST `lensCorrected` (ungefiltert!) – Export und
//                        Kantenfang lesen davon und dürfen keine Filter sehen.
//   Pass B (Filter):     Schärfen (4er-Laplacian) + Helligkeit/Kontrast/
//                        Gamma/Graustufen – identische Formeln wie die
//                        CPU-LUT, nur ohne 8-Bit-Rundungszwischenschritt.
//
// Die Quelltextur wird einmal pro Bild uploadet, nicht pro Regler-Tick.
// Jeder Fehlschlag (kein WebGL, Shader-Fehler, Kontextverlust) liefert null
// – die CPU-Pipeline in CanvasStage bleibt dann der ehrliche Rückfall.

import type { Filters } from "./types";
import { filtersActive } from "./types";
import type { Orientation } from "./orientation";

const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uOutSize;
uniform vec2 uSrcSize;
uniform float uCosF;
uniform float uSinF;
uniform int uQuarter;
uniform float uK;
uniform float uInvR;
uniform float uGeom;
uniform float uBright;
uniform float uContrast;
uniform float uInvGamma;
uniform float uSharpenK;
uniform float uGray;

// Inverse Abbildung: Ausgabepixel -> Quelltextur.
// 1) radiale Entzerrung im Sichtraum (Brown-Conrady Ordnung 2, Newton),
// 2) Rückrotation (Feinwinkel, dann 90°-Schritt),
// 3) Bereichstest gegen die Rohmaße.
vec4 sampleSrc(vec2 pOut) {
  vec2 pv = pOut;
  if (uK != 0.0) {
    vec2 d = (pOut - uOutSize * 0.5) * uInvR;
    float ru = length(d);
    float rd = ru;
    for (int i = 0; i < 5; i++) {
      float f = rd * (1.0 + uK * rd * rd) - ru;
      rd -= f / (1.0 + 3.0 * uK * rd * rd);
    }
    float s = ru > 1e-9 ? rd / ru : 1.0;
    pv = uOutSize * 0.5 + d * s / uInvR;
  }
  if (uGeom < 0.5) {
    // Identische Geometrie: Texturraum == Ausgaberaum (Kopie-/Filterpass)
    return texture2D(uTex, vec2(pv.x / uOutSize.x, 1.0 - pv.y / uOutSize.y));
  }
  vec2 q = pv - uOutSize * 0.5;
  q = vec2(uCosF * q.x + uSinF * q.y, -uSinF * q.x + uCosF * q.y);
  if (uQuarter == 1) q = vec2(q.y, -q.x);
  else if (uQuarter == 2) q = vec2(-q.x, -q.y);
  else if (uQuarter == 3) q = vec2(-q.y, q.x);
  vec2 src = q + uSrcSize * 0.5;
  if (src.x < 0.0 || src.y < 0.0 || src.x > uSrcSize.x || src.y > uSrcSize.y)
    return vec4(0.0);
  return texture2D(uTex, vec2(src.x / uSrcSize.x, 1.0 - src.y / uSrcSize.y));
}

void main() {
  vec2 p = vec2(vUv.x * uOutSize.x, (1.0 - vUv.y) * uOutSize.y);
  vec4 c = sampleSrc(p);
  vec3 col = c.rgb;
  if (uSharpenK > 0.0) {
    vec3 l = sampleSrc(max(p - vec2(1.0, 0.0), vec2(0.0))).rgb;
    vec3 r = sampleSrc(min(p + vec2(1.0, 0.0), uOutSize)).rgb;
    vec3 u = sampleSrc(max(p - vec2(0.0, 1.0), vec2(0.0))).rgb;
    vec3 d = sampleSrc(min(p + vec2(0.0, 1.0), uOutSize)).rgb;
    col = c.rgb * (1.0 + 4.0 * uSharpenK) - uSharpenK * (l + r + u + d);
  }
  if (uGray > 0.5) {
    float lum = dot(col, vec3(77.0, 150.0, 29.0)) / 256.0;
    col = vec3(lum);
  }
  vec3 v = col / 255.0 * uBright;
  v = (v - 0.5) * uContrast + 0.5;
  v = pow(clamp(v, 0.0, 1.0), vec3(uInvGamma));
  gl_FragColor = vec4(v, c.a);
}
`;

interface GLState {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  lensCanvas: HTMLCanvasElement;
  lctx: CanvasRenderingContext2D;
  prog: WebGLProgram;
  texSrc: WebGLTexture;
  fbo: WebGLFramebuffer;
  fboTex: WebGLTexture;
  fboW: number;
  fboH: number;
  srcRef: CanvasImageSource | null;
  srcW: number;
  srcH: number;
  u: Record<string, WebGLUniformLocation | null>;
}

let S: GLState | null = null;
let broken = false;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function init(): GLState | null {
  if (S) return S;
  if (broken || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl) {
    broken = true;
    return null;
  }
  canvas.addEventListener("webglcontextlost", () => {
    S = null; // nächster Aufruf initialisiert frisch (oder fällt auf CPU)
  });

  const vs = compile(gl, gl.VERTEX_SHADER, VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) {
    broken = true;
    return null;
  }
  const prog = gl.createProgram();
  if (!prog) {
    broken = true;
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    broken = true;
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const texSrc = gl.createTexture();
  if (!texSrc) {
    broken = true;
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, texSrc);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const fboTex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!fboTex || !fbo) {
    broken = true;
    return null;
  }

  const lensCanvas = document.createElement("canvas");
  const lctx = lensCanvas.getContext("2d");
  if (!lctx) {
    broken = true;
    return null;
  }

  const names = [
    "uTex", "uOutSize", "uSrcSize", "uCosF", "uSinF", "uQuarter", "uK",
    "uInvR", "uGeom", "uBright", "uContrast", "uInvGamma", "uSharpenK", "uGray",
  ];
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) u[n] = gl.getUniformLocation(prog, n);

  S = {
    gl, canvas, lensCanvas, lctx, prog, texSrc, fbo, fboTex,
    fboW: 0, fboH: 0, srcRef: null, srcW: 0, srcH: 0, u,
  };
  return S;
}

/** Ist die GPU-Pipeline einsatzbereit? (Cheap: initialisiert nur den Kontext.) */
export function glAvailable(): boolean {
  return init() !== null;
}

export interface GLPipeResult {
  /** Ungefilterte, ausgerichtete + entzerrte Ansicht (Export & Kantenfang). */
  lens: HTMLCanvasElement;
  /** Fertige Ansicht inkl. Filter – bei inaktiven Filtern identisch zu lens. */
  processed: HTMLCanvasElement;
}

function setFilterUniforms(s: GLState, f: Filters | null) {
  const { gl, u } = s;
  if (!f) {
    gl.uniform1f(u.uBright, 1);
    gl.uniform1f(u.uContrast, 1);
    gl.uniform1f(u.uInvGamma, 1);
    gl.uniform1f(u.uSharpenK, 0);
    gl.uniform1f(u.uGray, 0);
    return;
  }
  gl.uniform1f(u.uBright, f.brightness);
  gl.uniform1f(u.uContrast, f.contrast);
  gl.uniform1f(u.uInvGamma, 1 / f.gamma);
  gl.uniform1f(u.uSharpenK, f.sharpen > 0 ? f.sharpen * 1.2 : 0);
  gl.uniform1f(u.uGray, f.grayscale ? 1 : 0);
}

function drawFullscreen(s: GLState) {
  s.gl.drawArrays(s.gl.TRIANGLES, 0, 3);
}

/**
 * Rendert Ausrichtung + Objektivkorrektur + Filter in einem WebGL-Kontext.
 * `srcW/srcH` sind die ROHmaße des Quellbilds, `outW/outH` die sichtbaren
 * (ausgerichteten) Maße. Gibt null zurück, wenn die GPU-Pipeline nicht
 * verfügbar ist – Aufrufer fällt dann auf die CPU-Kette zurück.
 */
export function glRenderPipeline(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  o: Orientation,
  lensK: number,
  filters: Filters,
): GLPipeResult | null {
  const s = init();
  if (!s) return null;
  const { gl, u } = s;

  // Texturen haben Hardware-Grenzen – jenseits davon ehrlich an die CPU geben
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  if (
    srcW > maxTex || srcH > maxTex || outW > maxTex || outH > maxTex ||
    srcW < 1 || srcH < 1 || outW < 1 || outH < 1
  ) {
    return null;
  }

  // Quelltextur: genau ein Upload pro Bildwechsel
  if (s.srcRef !== source || s.srcW !== srcW || s.srcH !== srcH) {
    gl.bindTexture(gl.TEXTURE_2D, s.texSrc);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    } catch {
      return null;
    }
    s.srcRef = source;
    s.srcW = srcW;
    s.srcH = srcH;
  }

  // FBO-Textur in Zielgröße (neu allokieren bei Größenwechsel)
  if (s.fboW !== outW || s.fboH !== outH) {
    gl.bindTexture(gl.TEXTURE_2D, s.fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, outW, outH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, s.fboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    s.fboW = outW;
    s.fboH = outH;
  }

  const rad = (o.fine * Math.PI) / 180;

  // ── Pass A: Geometrie (Rotation + Radial) ins FBO ───────────────────────
  gl.useProgram(s.prog);
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo);
  gl.viewport(0, 0, outW, outH);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, s.texSrc);
  gl.uniform1i(u.uTex, 0);
  gl.uniform2f(u.uOutSize, outW, outH);
  gl.uniform2f(u.uSrcSize, srcW, srcH);
  gl.uniform1f(u.uCosF, Math.cos(rad));
  gl.uniform1f(u.uSinF, Math.sin(rad));
  gl.uniform1i(u.uQuarter, ((o.quarter % 4) + 4) % 4);
  gl.uniform1f(u.uK, Math.abs(lensK) >= 1e-6 ? lensK : 0);
  gl.uniform1f(u.uInvR, 1 / Math.hypot(outW / 2, outH / 2));
  gl.uniform1f(u.uGeom, 1);
  setFilterUniforms(s, null);
  drawFullscreen(s);

  // ── Kopie: FBO -> Standard-Framebuffer -> 2D-Canvas (lensCorrected) ─────
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, outW, outH);
  gl.bindTexture(gl.TEXTURE_2D, s.fboTex);
  gl.uniform2f(u.uOutSize, outW, outH);
  gl.uniform2f(u.uSrcSize, outW, outH);
  gl.uniform1f(u.uK, 0);
  gl.uniform1f(u.uGeom, 0);
  setFilterUniforms(s, null);
  drawFullscreen(s);

  if (s.lensCanvas.width !== outW) s.lensCanvas.width = outW;
  if (s.lensCanvas.height !== outH) s.lensCanvas.height = outH;
  s.lctx.clearRect(0, 0, outW, outH);
  s.lctx.drawImage(s.canvas, 0, 0);

  // ── Pass B: Filter (Schärfe + LUT) aufs Standard-Framebuffer ────────────
  if (!filtersActive(filters)) {
    return { lens: s.lensCanvas, processed: s.lensCanvas };
  }
  gl.bindTexture(gl.TEXTURE_2D, s.fboTex);
  gl.uniform2f(u.uOutSize, outW, outH);
  gl.uniform2f(u.uSrcSize, outW, outH);
  gl.uniform1f(u.uK, 0);
  gl.uniform1f(u.uGeom, 0);
  setFilterUniforms(s, filters);
  drawFullscreen(s);

  return { lens: s.lensCanvas, processed: s.canvas };
}
