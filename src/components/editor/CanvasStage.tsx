// ── MaßWerk · CanvasStage: Rendering & sämtliche Interaktion ────────────────
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useEditor, imgReg, analysisReg } from "@/lib/measure/store";
import {
  clamp,
  closestPointOnLine,
  dist,
  distToSegment,
  ellipseFromBBox,
  circleFrom3Points,
  fmtNumber,
  labelBlobs,
  primaryLabel,
  rectFrom2,
} from "@/lib/measure/geometry";
import { findEdgeLocal, postProcess, radialDistort } from "@/lib/measure/imagefx";
import { glAvailable, glRenderPipeline } from "@/lib/measure/glpipe";
import { orientationActive, renderOriented, renderOrientedFull } from "@/lib/measure/orientation";
import { boxBlur, morphClose, otsuThreshold } from "@/lib/measure/geometry";
import { drawChip, drawMeasurement, type RenderEnv } from "@/lib/measure/render";
import { loadFromDataUrl } from "@/lib/measure/loadImage";
import { t, useT } from "@/lib/i18n";
import {
  PALETTE,
  filtersActive,
  type Measurement,
  type MeasurementKind,
  type Pt,
  type Rect,
  type ToolId,
} from "@/lib/measure/types";

// ── Mini-Store für Zoom-Anzeige (TopBar) ─────────────────────────────────────
interface ViewInfo {
  scale: number;
  setScale: (s: number) => void;
}
export const useView = create<ViewInfo>()((set) => ({
  scale: 1,
  setScale: (scale) => set({ scale }),
}));

const DRAFT_KIND: Partial<Record<ToolId, MeasurementKind>> = {
  line: "line",
  polyline: "polyline",
  lot: "lot",
  angle: "angle",
  crossangle: "crossangle",
  rect: "rect",
  ellipse: "ellipse",
  circle3: "circle3",
  polygon: "polygon",
};

type DragState =
  | { type: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { type: "vertex"; id: string; idx: number; orig: Pt; moved: boolean }
  | { type: "move"; id: string; grab: Pt; start: Pt[]; moved: boolean }
  | { type: "annotate"; start: Pt; cur: Pt }
  | { type: "roi"; start: Pt; cur: Pt }
  | { type: "roi-move"; grab: Pt; orig: Rect; moved: boolean }
  | { type: "roi-scale"; anchor: Pt; orig: Rect; moved: boolean }
  | null;

/** Die vier Eckgriffe eines Analyse-ROIs (Bildkoordinaten). */
function roiCorners(r: Rect): Pt[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

interface Hit {
  m: Measurement;
  idx: number; // -1 = Körper
}

function pointInPolygon(p: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Haben Pipeline-Zwischenstände schon die Maße der neuen Ausrichtung? */
function srcDimsMatch(src: CanvasImageSource, w: number, h: number): boolean {
  let sw = 0;
  let sh = 0;
  if (src instanceof HTMLCanvasElement || src instanceof ImageBitmap) {
    sw = src.width;
    sh = src.height;
  } else if (typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement) {
    sw = src.naturalWidth;
    sh = src.naturalHeight;
  } else if (typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement) {
    sw = src.videoWidth;
    sh = src.videoHeight;
  } else {
    return true; // unbekannte Quelle: nicht blockieren
  }
  return sw === w && sh === h;
}

export default function CanvasStage() {
  const tr = useT();
  const st = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
  const tRef = useRef({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<DragState>(null);
  const cursorImgRef = useRef<Pt | null>(null);
  const effRef = useRef<{ pt: Pt; snapped: boolean } | null>(null);
  const roiDraftRef = useRef<{ start: Pt; cur: Pt } | null>(null);
  const spaceRef = useRef(false);
  // Multitouch: aktive Zeiger, laufende Pinch-Geste, grober Zeiger?
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{ d: number; c: { x: number; y: number } } | null>(null);
  const touchRef = useRef(false);
  // Merkt, welcher Einzel-Aktionspunkt der letzte Fingertipp setzte – die
  // zweite Fingerkuppe annulliert ihn binnen 700 ms (kein Streupunkt).
  const downActionRef = useRef<
    { kind: "draft" | "horizon" | "rectify"; t: number } | null
  >(null);
  const drawPending = useRef(false);
  const drawImplRef = useRef<() => void>(() => {});
  const restoredRef = useRef(false);
  const lastCmdRef = useRef(0);
  const rebuildToken = useRef(0);
  const lastClickRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const zoomUiTimer = useRef(0);
  const [captureTick, setCaptureTick] = useState(0);
  const [noteValue, setNoteValue] = useState("");
  const loupeRef = useRef({
    sx: 0,
    sy: 0,
    imgX: 0,
    imgY: 0,
    show: false,
    snapped: false,
    zoom: 4,
  });

  const scheduleDraw = useCallback(() => {
    if (drawPending.current) return;
    drawPending.current = true;
    requestAnimationFrame(() => {
      drawPending.current = false;
      drawImplRef.current();
    });
  }, []);

  // ── Koordinaten ─────────────────────────────────────────────────────────
  const toImage = useCallback((clientX: number, clientY: number): Pt => {
    const rect = containerRef.current?.getBoundingClientRect();
    const t = tRef.current;
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    return { x: (sx - t.x) / t.scale, y: (sy - t.y) / t.scale };
  }, []);

  const toScreen = useCallback((p: Pt): Pt => {
    const t = tRef.current;
    return { x: p.x * t.scale + t.x, y: p.y * t.scale + t.y };
  }, []);

  const pushZoomUi = useCallback(() => {
    const now = performance.now();
    if (now - zoomUiTimer.current < 100) return;
    zoomUiTimer.current = now;
    useView.getState().setScale(tRef.current.scale);
  }, []);

  const zoomAt = useCallback(
    (sx: number, sy: number, factor: number) => {
      const t = tRef.current;
      const ns = clamp(t.scale * factor, 0.02, 80);
      const k = ns / t.scale;
      tRef.current = {
        scale: ns,
        x: sx - (sx - t.x) * k,
        y: sy - (sy - t.y) * k,
      };
      scheduleDraw();
      pushZoomUi();
    },
    [scheduleDraw, pushZoomUi],
  );

  const fitImage = useCallback(() => {
    const img = useEditor.getState().image;
    const { w, h } = sizeRef.current;
    if (!img || w < 20) return;
    const s = Math.min((w - 90) / img.width, (h - 90) / img.height);
    const scale = clamp(s, 0.02, 4);
    tRef.current = {
      scale,
      x: (w - img.width * scale) / 2,
      y: (h - img.height * scale) / 2,
    };
    scheduleDraw();
    pushZoomUi();
  }, [scheduleDraw, pushZoomUi]);

  const zoomCenter = useCallback(
    (factor: number) => {
      const { w, h } = sizeRef.current;
      zoomAt(w / 2, h / 2, factor);
    },
    [zoomAt],
  );

  // ── Edge-Snap (zoomabhängig, Sub-Pixel, mit Stickiness) ──────────────────
  const lastSnapRef = useRef<Pt | null>(null);
  const pulsesRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const computeEffective = useCallback(
    (p: Pt, bypass: boolean): { pt: Pt; snapped: boolean } => {
      const s = useEditor.getState();
      const source = imgReg.lensCorrected ?? imgReg.original;
      if (!s.snap || bypass || !s.image || !source) {
        lastSnapRef.current = null;
        return { pt: p, snapped: false };
      }
      // Konstant ~11 Bildschirmpixel → zoomangepasster Bildpixel-Radius
      const r = clamp(11 / tRef.current.scale, 2, 64);
      const hit = findEdgeLocal(source, s.image.width, s.image.height, p, r);
      if (!hit) {
        lastSnapRef.current = null;
        return { pt: p, snapped: false };
      }
      // Beim erstmaligen Einrasten (steigende Flanke) einen kurzen, feinen
      // Bestätigungsimpuls auslösen – ein winziges, aber spürbares "Klick"-Gefühl.
      if (!lastSnapRef.current) {
        pulsesRef.current.push({ x: hit.pt.x, y: hit.pt.y, t: performance.now() });
        if (pulsesRef.current.length > 6) pulsesRef.current.shift();
      }
      // Stickiness: bei randständigen Gleichgewichten Jitter vermeiden
      const stick = Math.max(1, r * 0.45);
      if (
        lastSnapRef.current &&
        Math.hypot(hit.pt.x - lastSnapRef.current.x, hit.pt.y - lastSnapRef.current.y) <
          stick
      ) {
        return { pt: lastSnapRef.current, snapped: true };
      }
      lastSnapRef.current = hit.pt;
      return { pt: hit.pt, snapped: true };
    },
    [],
  );

  // ── Hit-Test ─────────────────────────────────────────────────────────────
  const hitTest = useCallback(
    (p: Pt): Hit | null => {
      // Touch braucht größere Trefferflächen als die Maus (P4)
      const tol = (touchRef.current ? 16 : 9) / tRef.current.scale;
      const list = [...useEditor.getState().measurements].reverse();
      for (const m of list) {
        if (!m.visible) continue;
        for (let i = 0; i < m.points.length; i++) {
          const r = m.kind === "count" ? tol * 1.7 : tol;
          if (dist(p, m.points[i]) < r) return { m, idx: i };
        }
        const pts = m.points;
        let body = false;
        switch (m.kind) {
          case "line":
          case "polyline":
          case "arrow":
            for (let i = 0; i < pts.length - 1 && !body; i++)
              body = distToSegment(p, pts[i], pts[i + 1]) < tol;
            break;
          case "lot": {
            if (pts.length >= 3) {
              const foot = closestPointOnLine(pts[2], pts[0], pts[1]);
              body =
                distToSegment(p, pts[0], pts[1]) < tol ||
                distToSegment(p, pts[2], foot) < tol;
            }
            break;
          }
          case "angle":
            if (pts.length >= 3)
              body =
                distToSegment(p, pts[0], pts[1]) < tol ||
                distToSegment(p, pts[1], pts[2]) < tol;
            break;
          case "crossangle":
            if (pts.length >= 4)
              body =
                distToSegment(p, pts[0], pts[1]) < tol ||
                distToSegment(p, pts[2], pts[3]) < tol;
            break;
          case "rect": {
            if (pts.length >= 2) {
              const r = rectFrom2(pts[0], pts[1]);
              body =
                p.x > r.x - tol &&
                p.x < r.x + r.w + tol &&
                p.y > r.y - tol &&
                p.y < r.y + r.h + tol;
            }
            break;
          }
          case "ellipse": {
            if (pts.length >= 2) {
              const e = ellipseFromBBox(pts[0], pts[1]);
              const n =
                Math.hypot(
                  (p.x - e.c.x) / Math.max(e.rx, 1e-6),
                  (p.y - e.c.y) / Math.max(e.ry, 1e-6),
                ) || 0;
              body = n < 1 + tol / Math.max(Math.min(e.rx, e.ry), 1e-6);
            }
            break;
          }
          case "circle3": {
            if (pts.length >= 3) {
              const c = circleFrom3Points(pts[0], pts[1], pts[2]);
              if (c) body = dist(p, c.c) < c.r + tol;
            }
            break;
          }
          case "polygon":
            if (pts.length >= 3)
              body =
                pointInPolygon(p, pts) ||
                pts.some((a, i) => distToSegment(p, a, pts[(i + 1) % pts.length]) < tol);
            break;
          case "note": {
            // Punkt großzügig treffen UND den Text-Chip als Grifffläche:
            // Erstelltes muss greifbar bleiben (Zero Dead Ends).
            const q = pts[0];
            if (dist(p, q) < tol * 2.2) {
              body = true;
              break;
            }
            const ntext = m.text ?? "";
            if (ntext) {
              const f = 12.5 / tRef.current.scale;
              const sw = 1.9 / tRef.current.scale;
              const wch = ntext.length * f * 0.6 + f * 1.74;
              const hch = f * 1.72;
              const x0 = q.x + sw * 6;
              const y0 = q.y - sw * 5 - hch / 2;
              const pad = tol * 0.4;
              body =
                p.x > x0 - pad && p.x < x0 + wch + pad &&
                p.y > y0 - pad && p.y < y0 + hch + pad;
            }
            break;
          }
          case "count":
            break;
        }
        if (body) return { m, idx: -1 };
      }
      return null;
    },
    [],
  );

  // ── Bildschirm-Koordinatenanzeige (StatusBar, ohne Re-Render) ────────────
  const updateCoordsDom = useCallback(() => {
    const el = document.getElementById("mw-coords");
    if (!el) return;
    const p = effRef.current?.pt ?? cursorImgRef.current;
    const s = useEditor.getState();
    if (!p || !s.image) {
      el.textContent = "";
      return;
    }
    if (s.calibration && s.calibration.unit !== "px") {
      const ppu = s.calibration.pixelsPerUnit;
      el.textContent = `${fmtNumber(p.x / ppu)} ${s.calibration.unit}  ·  ${fmtNumber(p.y / ppu)} ${s.calibration.unit}`;
    } else {
      el.textContent = `${fmtNumber(p.x, 0)} px  ·  ${fmtNumber(p.y, 0)} px`;
    }
  }, []);

  // ── Canvas-Größen / DPR ─────────────────────────────────────────────────
  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const apply = () => {
      const w = cont.clientWidth;
      const h = cont.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      sizeRef.current = { w, h, dpr };
      for (const c of [imgRef.current, ovRef.current]) {
        if (!c) continue;
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      scheduleDraw();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(cont);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // ── Sitzung wiederherstellen (Bild aus LocalStorage) ─────────────────────
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const s = useEditor.getState();
    if (s.image && s.imageDataUrl && !imgReg.original) {
      loadFromDataUrl(s.imageDataUrl)
        .then((img) => {
          imgReg.original = img;
          imgReg.processed = null;
          imgReg.capture = null;
          useEditor.getState().bumpImg();
        })
        .catch(() => {
          useEditor.setState({ image: null, imageDataUrl: null });
        });
    }
  }, []);

  // ── Ansicht-Befehle (Fit, Zoom, 100 %) ───────────────────────────────────
  useEffect(() => {
    const c = st.viewCmd;
    if (c.seq === lastCmdRef.current) return;
    lastCmdRef.current = c.seq;
    if (c.cmd === "fit") fitImage();
    else if (c.cmd === "in") zoomCenter(1.35);
    else if (c.cmd === "out") zoomCenter(1 / 1.35);
    else if (c.cmd === "100") {
      const img = useEditor.getState().image;
      const { w, h } = sizeRef.current;
      if (!img) return;
      tRef.current = {
        scale: 1,
        x: w / 2 - img.width / 2,
        y: h / 2 - img.height / 2,
      };
      scheduleDraw();
      pushZoomUi();
    }
  }, [st.viewCmd, fitImage, zoomCenter, scheduleDraw, pushZoomUi]);

  // ── Beim Bildwechsel neu einpassen ───────────────────────────────────────
  useEffect(() => {
    lastSnapRef.current = null;
    fitImage();
  }, [st.imgVersion, fitImage]);

  // ── Analyse-Capture: Readback erst bauen, wenn die Analyse wirklich läuft ─
  const buildCapture = useCallback((source: CanvasImageSource, W: number, H: number) => {
    const capLong = 1800;
    const cs = Math.min(1, capLong / Math.max(W, H));
    const cw = Math.max(1, Math.round(W * cs));
    const ch = Math.max(1, Math.round(H * cs));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const cx = c.getContext("2d", { willReadFrequently: true });
    if (!cx) return;
    cx.drawImage(source, 0, 0, cw, ch);
    imgReg.capture = cx.getImageData(0, 0, cw, ch);
    imgReg.captureScale = cs;
  }, []);

  const refreshCapture = useCallback(
    (source: CanvasImageSource, W: number, H: number) => {
      if (useEditor.getState().analysis.active) {
        buildCapture(source, W, H);
        setCaptureTick((n) => n + 1);
      } else if (imgReg.capture) {
        // Analyse aus: teuren Puffer freigeben statt ihn mitzuschleifen
        imgReg.capture = null;
        imgReg.captureScale = 1;
      }
      scheduleDraw();
    },
    [buildCapture, scheduleDraw],
  );

  // ── Bildpipeline: Ausrichtung → Linskorrektur → Filter → Capture ────────
  useEffect(() => {
    const src = imgReg.original;
    const img = st.image;
    if (!src || !img) return;
    const token = ++rebuildToken.current;
    let alive = true;

    // Unterlage fürs Geraderichten: die UNBESCHNITTENE gedrehte Ansicht.
    // Der Rahmen bleibt stehen, der Inhalt dreht sichtbar daraus hervor –
    // die Operation wird erklärt statt heimlich beschnitten (Apple Fotos).
    if (Math.abs(st.orientation.fine) > 1e-9) {
      const o = st.orientation;
      const rawW = o.quarter % 2 === 1 ? img.height : img.width;
      const rawH = o.quarter % 2 === 1 ? img.width : img.height;
      imgReg.orientFull = renderOrientedFull(src, rawW, rawH, o);
    } else {
      imgReg.orientFull = null;
    }

    // Ein einziger sequenzieller Ablauf: Ausrichtung → Objektivkorrektur →
    // Filter → Capture. (Getrennte Effekte würden hier zu Wettlaufzuständen
    // führen: der Capture-Aufbau lief teils, bevor eine asynchrone Stufe
    // fertig war, wodurch diese visuell wirkungslos blieb.)
    const run = async () => {
      const W = img.width;
      const H = img.height;

      // 0) GPU-Vorzugsweg: EIN WebGL-Kontext für Rotation, radiale
      //    Objektivkorrektur und Filter – ohne getImageData-Schleifen,
      //    ohne Entprellen. lensCorrected bleibt ungefiltert (Export &
      //    Kantenfang lesen davon); die CPU-Kette darunter ist der
      //    ehrliche Rückfall, falls WebGL fehlt oder scheitert.
      const o0 = st.orientation;
      const glRes =
        orientationActive(o0) ||
        Math.abs(st.lensK) >= 1e-5 ||
        filtersActive(st.filters)
          ? glRenderPipeline(
              src,
              o0.quarter % 2 === 1 ? H : W,
              o0.quarter % 2 === 1 ? W : H,
              W,
              H,
              o0,
              st.lensK,
              st.filters,
            )
          : null;
      if (glRes) {
        if (!alive || token !== rebuildToken.current) return;
        const oldP = imgReg.processed;
        if (
          oldP && oldP !== glRes.processed &&
          oldP instanceof ImageBitmap && typeof oldP.close === "function"
        ) {
          oldP.close();
        }
        const oldL = imgReg.lensCorrected;
        if (
          oldL && oldL !== glRes.lens &&
          oldL instanceof ImageBitmap && typeof oldL.close === "function"
        ) {
          oldL.close();
        }
        imgReg.lensCorrected = glRes.lens;
        imgReg.lensK = st.lensK;
        imgReg.processed = glRes.processed;
        refreshCapture(glRes.processed, W, H);
        return;
      }

      // 1) Ausrichtung (90°-Schritte + Geraderichten mit Crop-Zoom).
      //    W/H sind die sichtbaren Maße – die Rohmaße ergeben sich aus der
      //    90°-Stufe (bei ungerader Stufe sind sie vertauscht).
      const o = st.orientation;
      let base: CanvasImageSource = src;
      if (orientationActive(o)) {
        const rawW = o.quarter % 2 === 1 ? H : W;
        const rawH = o.quarter % 2 === 1 ? W : H;
        const c = renderOriented(src, rawW, rawH, o);
        if (c) base = c;
      }

      // 2) Objektivkorrektur (radiale Verzeichnung)
      if (Math.abs(st.lensK) >= 1e-5) {
        const c = radialDistort(base, W, H, st.lensK);
        if (c) {
          const bmp = await createImageBitmap(c).catch(() => null);
          base = bmp ?? c;
        }
      }
      if (!alive || token !== rebuildToken.current) return;
      imgReg.lensCorrected = base;
      imgReg.lensK = st.lensK;

      // 3) Bildoptimierung (Helligkeit/Kontrast/Gamma/Schärfe) + Capture
      if (!filtersActive(st.filters)) {
        imgReg.processed = base;
        refreshCapture(base, W, H);
        return;
      }
      const sc = Math.min(1, 3200 / Math.max(W, H));
      const cw = Math.max(1, Math.round(W * sc));
      const ch = Math.max(1, Math.round(H * sc));
      const c2 = document.createElement("canvas");
      c2.width = cw;
      c2.height = ch;
      const cx2 = c2.getContext("2d", { willReadFrequently: true });
      if (!cx2) return;
      cx2.drawImage(base, 0, 0, cw, ch);
      const id = cx2.getImageData(0, 0, cw, ch);
      postProcess(id.data, cw, ch, st.filters);
      const bmp2 = await createImageBitmap(id).catch(() => null);
      if (!alive || token !== rebuildToken.current || !bmp2) return;
      const old = imgReg.processed;
      if (old && old !== base && old instanceof ImageBitmap && typeof old.close === "function") {
        old.close();
      }
      imgReg.processed = bmp2;
      refreshCapture(bmp2, W, H);
    };

    // Entprellen nur, wenn die CPU-Kette läuft: mit GPU ist jeder Tick
    // ein synchroner Shader-Durchlauf – der Regler fühlt sich direkt an.
    const busy =
      (filtersActive(st.filters) || Math.abs(st.lensK) >= 1e-5) && !glAvailable();
    if (busy) {
      // Teure CPU-Stufen aktiv: leicht entprellen, damit Regler flüssig bleiben
      const to = setTimeout(run, 130);
      return () => {
        alive = false;
        clearTimeout(to);
      };
    }
    // Schneller Pfad (nur Drehung/Filter aus): synchron ausführen, damit das
    // nächste gezeichnete Bild bereits die neue Ausrichtung zeigt – kein
    // Zwischenframe mit falschem Seitenverhältnis beim 90°-Drehen.
    void run();
    return () => {
      alive = false;
    };
  }, [st.imgVersion, st.filters, st.lensK, st.orientation, st.image, scheduleDraw, refreshCapture]);

  // ── Schwellenwert-Analyse berechnen ──────────────────────────────────────
  // Wichtig: Die Abhängigkeiten sind bewusst auf einzelne, primitive Werte
  // beschränkt. Bei automatischem Schwellenwert wird "threshold" laufend als
  // Ergebnis zurückgeschrieben (setAnalysis) – würde der Effekt auf dem
  // gesamten "analysis"-Objekt hängen, hätte jede Aktualisierung des
  // errechneten Schwellenwerts sofort einen erneuten Durchlauf ausgelöst
  // ("es passiert dauernd etwas", ohne dass sich am Bild etwas ändert).
  const a = st.analysis;
  const roiKey = a.roi ? `${a.roi.x}|${a.roi.y}|${a.roi.w}|${a.roi.h}` : "";

  // Capture nachziehen, sobald die Analyse aktiv wird und noch kein Puffer
  // existiert (Readback wird sonst pro Regler-Tick bezahlt, obwohl ihn
  // niemand braucht – siehe refreshCapture).
  useEffect(() => {
    if (!st.analysis.active || !st.analysis.roi) return;
    if (imgReg.capture || !imgReg.processed || !st.image) return;
    buildCapture(imgReg.processed, st.image.width, st.image.height);
    setCaptureTick((n) => n + 1);
  }, [st.analysis.active, roiKey, st.imgVersion, captureTick, buildCapture]);
  useEffect(() => {
    const s = useEditor.getState();
    const a = s.analysis;
    if (!a.active || !a.roi || !imgReg.capture) {
      analysisReg.bitmap = null;
      if (a.active && !a.roi) s.setAnalysisResult(null);
      scheduleDraw();
      return;
    }
    const cs = imgReg.captureScale;
    const cap = imgReg.capture;
    const rx0 = clamp(Math.round(a.roi.x * cs), 0, cap.width - 1);
    const ry0 = clamp(Math.round(a.roi.y * cs), 0, cap.height - 1);
    const rx1 = clamp(Math.round((a.roi.x + a.roi.w) * cs), rx0 + 1, cap.width);
    const ry1 = clamp(Math.round((a.roi.y + a.roi.h) * cs), ry0 + 1, cap.height);
    const rw = rx1 - rx0;
    const rh = ry1 - ry0;
    if (rw < 3 || rh < 3) return;

    let alive = true;
    const to = setTimeout(() => {
      const d = cap.data;
      // Luminanzen im ROI, leicht geglättet (unterdrückt Sensorrauschen und
      // kleine Glanzlichter, die sonst als eigene Mini-Objekte auftauchen)
      const lumRaw = new Float32Array(rw * rh);
      for (let y = 0; y < rh; y++) {
        const srcRow = ry0 + y;
        for (let x = 0; x < rw; x++) {
          const i = (srcRow * cap.width + rx0 + x) * 4;
          lumRaw[y * rw + x] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        }
      }
      const lum = boxBlur(lumRaw, rw, rh, 1);
      const threshold = a.autoThreshold ? otsuThreshold(lum, rw * rh) : a.threshold;
      if (a.autoThreshold && alive && Math.abs(threshold - a.threshold) >= 1) {
        s.setAnalysis({ threshold });
      }
      let mask: Uint8Array<ArrayBufferLike> = new Uint8Array(rw * rh);
      for (let i = 0; i < rw * rh; i++) {
        const on = a.dark ? lum[i] < threshold : lum[i] >= threshold;
        mask[i] = on ? 1 : 0;
      }
      // Kleine Lücken schließen, damit z. B. ein Lineal mit Zahlenaufdruck
      // oder eine glänzende Schraube nicht in mehrere Teile zerfällt.
      if (a.closeRadius > 0) {
        mask = morphClose(mask, rw, rh, a.closeRadius);
      }
      const minC = Math.max(2, Math.round(a.minArea * cs * cs));
      const maxC = Math.round(a.maxArea * cs * cs);
      const blobs = labelBlobs(mask, rw, rh, minC, maxC);
      if (!alive) return;
      const centroids: Pt[] = blobs.map((b) => ({
        x: (b.cx + rx0) / cs,
        y: (b.cy + ry0) / cs,
      }));
      const totalAreaPx = blobs.reduce((s2, b) => s2 + b.area, 0) / (cs * cs);
      // Einzelobjekte: absteigend nach Fläche – die Liste im Panel soll die
      // größten Treffer zuerst zeigen (Menschen lesen Rankings, keine Sets).
      const blobList = [...blobs]
        .sort((u, v) => v.area - u.area)
        .map((b) => ({
          areaPx: b.area / (cs * cs),
          c: { x: (b.cx + rx0) / cs, y: (b.cy + ry0) / cs },
        }));
      // Tint-Overlay: nur Kontur, keine Fläche (wirkt professioneller)
      const tint = new ImageData(rw, rh);
      for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
          const i = y * rw + x;
          if (!mask[i]) continue;
          // Randpixel? Mindestens ein Nachbar ist 0
          let edge =
            x === 0 || y === 0 || x === rw - 1 || y === rh - 1;
          if (!edge) {
            edge =
              !mask[i - 1] ||
              !mask[i + 1] ||
              !mask[i - rw] ||
              !mask[i + rw];
          }
          if (!edge) continue;
          const ti = i * 4;
          tint.data[ti] = 96;
          tint.data[ti + 1] = 165;
          tint.data[ti + 2] = 250;
          tint.data[ti + 3] = 230;
        }
      }
      // Zentroid-Punkte einzeichnen
      for (const b of blobs) {
        const cx = Math.round(b.cx);
        const cy = Math.round(b.cy);
        const r = 2;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= rw || y >= rh) continue;
            const ti = (y * rw + x) * 4;
            tint.data[ti] = 255;
            tint.data[ti + 1] = 214;
            tint.data[ti + 2] = 10;
            tint.data[ti + 3] = 255;
          }
        }
      }
      createImageBitmap(tint).then((bmp) => {
        if (!alive) return;
        analysisReg.bitmap = bmp;
        analysisReg.roi = a.roi!;
        analysisReg.count = blobs.length;
        analysisReg.totalAreaPx = totalAreaPx;
        analysisReg.centroids = centroids;
        useEditor.getState().setAnalysisResult({
          count: blobs.length,
          totalAreaPx,
          centroids,
          blobs: blobList,
        });
        scheduleDraw();
      });
    }, 110);
    return () => {
      alive = false;
      clearTimeout(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    a.active,
    roiKey,
    a.dark,
    a.autoThreshold,
    a.autoThreshold ? 0 : a.threshold,
    a.minArea,
    a.maxArea,
    a.closeRadius,
    captureTick,
    st.imgVersion,
    scheduleDraw,
  ]);

  // ── Zeichnen ─────────────────────────────────────────────────────────────
  const draw = () => {
    const ic = imgRef.current;
    const oc = ovRef.current;
    if (!ic || !oc) return;
    const { w, h, dpr } = sizeRef.current;
    const t = tRef.current;
    const ictx = ic.getContext("2d");
    const octx = oc.getContext("2d");
    if (!ictx || !octx) return;

    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ictx.fillStyle = "#0B0B0E";
    ictx.fillRect(0, 0, w, h);

    const img = st.image;
    const src = imgReg.processed ?? imgReg.lensCorrected ?? imgReg.original;
    // Während teurer Umbauten (Filter/Objektiv) kann die Quelle kurz hinter
    // den neuen Maßen zurückbleiben – dann lieber eine dunkle Bühne zeigen
    // als ein verzerrtes Bild.
    const srcReady = !!img && !!src && srcDimsMatch(src, img.width, img.height);
    // Geraderichten sichtbar machen: Regler gehalten, Horizont-Modus aktiv
    // oder kurzer Glow nach der letzten Änderung (mit 400 ms Ausklang).
    const horizonActive = st.horizon !== null;
    const straightenHoldOn = st.straightenHold || horizonActive;
    const straightenOn =
      !!img && !!imgReg.orientFull && Math.abs(st.orientation.fine) > 1e-9 &&
      (straightenHoldOn || st.straightenGlowUntil > Date.now());
    const glowT = straightenHoldOn
      ? 1
      : clamp((st.straightenGlowUntil - Date.now()) / 400, 0, 1);

    if (img && src && srcReady) {
      ictx.imageSmoothingEnabled = true;
      ictx.imageSmoothingQuality = "high";
      ictx.setTransform(dpr * t.scale, 0, 0, dpr * t.scale, dpr * t.x, dpr * t.y);
      if (straightenOn && imgReg.orientFull) {
        // Hintergrund: vollständig gedrehtes Bild, der sichtbare Rahmen
        // liegt mittig darauf – nichts geht „verloren“, es liegt nur außen.
        const wu = imgReg.orientFull.width;
        const hu = imgReg.orientFull.height;
        ictx.globalAlpha = 0.55 * glowT;
        ictx.drawImage(
          imgReg.orientFull,
          -(wu - img.width) / 2,
          -(hu - img.height) / 2,
          wu,
          hu,
        );
        ictx.globalAlpha = 1;
      }
      ictx.drawImage(src, 0, 0, img.width, img.height);
    }

    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, w, h);
    if (!img || !src) return;

    octx.setTransform(dpr * t.scale, 0, 0, dpr * t.scale, dpr * t.x, dpr * t.y);
    octx.strokeStyle = "rgba(255,255,255,0.09)";
    octx.lineWidth = 1.2 / t.scale;
    octx.strokeRect(0, 0, img.width, img.height);

    if (straightenOn) {
      // Drittelraster + Mittellinien: Bildschirm-ausgerichtet, denn die
      // Referenz ist der Zielrahmen – nicht der mitgedrehte Inhalt.
      octx.save();
      octx.globalAlpha = glowT;
      octx.strokeStyle = "rgba(255,255,255,0.20)";
      octx.lineWidth = 1 / t.scale;
      octx.beginPath();
      for (const f of [1 / 3, 2 / 3]) {
        octx.moveTo(img.width * f, 0);
        octx.lineTo(img.width * f, img.height);
        octx.moveTo(0, img.height * f);
        octx.lineTo(img.width, img.height * f);
      }
      octx.stroke();
      octx.strokeStyle = "rgba(255,255,255,0.10)";
      octx.beginPath();
      octx.moveTo(img.width / 2, 0);
      octx.lineTo(img.width / 2, img.height);
      octx.moveTo(0, img.height / 2);
      octx.lineTo(img.width, img.height / 2);
      octx.stroke();
      // Rahmenkante in Akzent: „Hier ist dein Bild“
      octx.strokeStyle = "#32ADE6";
      octx.lineWidth = 1.6 / t.scale;
      octx.strokeRect(0, 0, img.width, img.height);
      octx.restore();
      // Glow klingt ab – Folgerender nachziehen, bis er aus ist
      if (!straightenHoldOn && glowT > 0) {
        window.setTimeout(scheduleDraw, 50);
      }
    }

    if (horizonActive && st.horizon && st.horizon.length >= 1) {
      // Horizont-Entwurf: Linie vom ersten Punkt zum Cursor (oder zum
      // bereits gesetzten zweiten Punkt)
      const cur = effRef.current?.pt ?? cursorImgRef.current;
      const a = st.horizon[0];
      const b = st.horizon.length > 1 ? st.horizon[1] : cur;
      if (b) {
        octx.save();
        octx.strokeStyle = "#32ADE6";
        octx.lineWidth = 2 / t.scale;
        octx.lineCap = "round";
        if (st.horizon.length === 1) octx.setLineDash([8 / t.scale, 6 / t.scale]);
        octx.beginPath();
        octx.moveTo(a.x, a.y);
        octx.lineTo(b.x, b.y);
        octx.stroke();
        for (const q of st.horizon) {
          octx.beginPath();
          octx.arc(q.x, q.y, 4.5 / t.scale, 0, Math.PI * 2);
          octx.fillStyle = "#32ADE6";
          octx.fill();
          octx.strokeStyle = "#fff";
          octx.lineWidth = 1.5 / t.scale;
          octx.stroke();
        }
        octx.restore();
      }
    }

    // Bei gedrehtem Zuschnitt (Geraderichten) endet das sichtbare Dokument am
    // Bildrand – Überstände (weggedrehte Ecken) werden wie bei Apple Fotos
    // ausgeblendet, statt frei auf der dunklen Bühne zu schweben.
    const fineCrop = Math.abs(st.orientation.fine) > 1e-9;
    if (fineCrop) {
      octx.save();
      octx.beginPath();
      octx.rect(0, 0, img.width, img.height);
      octx.clip();
    }

    const env: RenderEnv = {
      strokeW: 1.9 / t.scale,
      fontPx: 12.5 / t.scale,
      selectedId: st.selectedId,
      showHandles: true,
      calibration: st.calibration,
      forExport: false,
    };

    // Analyse-Overlay
    if (st.analysis.active) {
      if (analysisReg.bitmap && st.analysis.roi) {
        const r = st.analysis.roi;
        octx.save();
        octx.globalAlpha = 0.85;
        octx.drawImage(analysisReg.bitmap, r.x, r.y, r.w, r.h);
        octx.restore();
        const cents = analysisReg.centroids;
        if (cents.length <= 400) {
          octx.save();
          octx.fillStyle = "#60A5FA";
          for (const c of cents) {
            octx.beginPath();
            octx.arc(c.x, c.y, env.strokeW * 1.9, 0, Math.PI * 2);
            octx.fill();
          }
          octx.restore();
        }
      }
      const r = roiDraftRef.current
        ? rectFrom2(roiDraftRef.current.start, roiDraftRef.current.cur)
        : st.analysis.roi;
      if (r) {
        octx.save();
        octx.strokeStyle = "rgba(255,255,255,0.65)";
        octx.lineWidth = env.strokeW * 0.8;
        octx.setLineDash([env.strokeW * 3, env.strokeW * 2.4]);
        octx.strokeRect(r.x, r.y, r.w, r.h);
        octx.restore();
        // Eckgriffe: sichtbar, sobald der Bereich steht – Versprechen:
        // „Dieses Ding kannst du noch anfassen." (P7)
        if (!roiDraftRef.current) {
          const hs = 4.2 / t.scale;
          octx.save();
          for (const c of roiCorners(r)) {
            octx.beginPath();
            octx.rect(c.x - hs, c.y - hs, hs * 2, hs * 2);
            octx.fillStyle = "#ffffff";
            octx.fill();
            octx.strokeStyle = "#32ADE6";
            octx.lineWidth = 1.4 / t.scale;
            octx.stroke();
          }
          octx.restore();
        }
      }
    }

    // Messungen
    for (const m of st.measurements) {
      if (m.visible) drawMeasurement(octx, m, env);
    }

    // Entzerrung: gesetzte Ecken
    if (st.rectify?.active) {
      const pts = st.rectify.points;
      octx.save();
      if (pts.length > 1) {
        octx.strokeStyle = "#60A5FA";
        octx.lineWidth = env.strokeW * 0.9;
        octx.setLineDash([env.strokeW * 3, env.strokeW * 2.4]);
        octx.beginPath();
        octx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) octx.lineTo(pts[i].x, pts[i].y);
        if (cursorImgRef.current) {
          octx.lineTo(cursorImgRef.current.x, cursorImgRef.current.y);
        }
        octx.stroke();
        octx.setLineDash([]);
      }
      octx.font = `700 ${env.fontPx}px "Geist Mono", monospace`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      pts.forEach((q, i) => {
        octx.beginPath();
        octx.arc(q.x, q.y, env.fontPx * 0.85, 0, Math.PI * 2);
        octx.fillStyle = "#60A5FA";
        octx.fill();
        octx.fillStyle = "#0B0B0E";
        octx.fillText(String(i + 1), q.x, q.y + env.fontPx * 0.04);
      });
      octx.restore();
    }

    // Ausstehende Kalibrierlinie
    if (st.pendingCalib) {
      const { a, b } = st.pendingCalib;
      octx.save();
      octx.strokeStyle = "#60A5FA";
      octx.lineWidth = env.strokeW;
      octx.setLineDash([env.strokeW * 3, env.strokeW * 2.4]);
      octx.beginPath();
      octx.moveTo(a.x, a.y);
      octx.lineTo(b.x, b.y);
      octx.stroke();
      octx.restore();
      const px = dist(a, b);
      drawChip(
        octx,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2 - env.strokeW * 7,
        `${fmtNumber(px)} px`,
        "#60A5FA",
        env,
      );
    }

    // Entwurf (Gummiband + Live-Wert)
    const cursor = effRef.current?.pt ?? cursorImgRef.current;
    const draftKind = DRAFT_KIND[st.tool];
    if (st.draft && st.draft.length > 0 && draftKind) {
      const pts = st.draft;
      const nextColor = PALETTE[st.measurements.length % PALETTE.length];
      octx.save();
      octx.strokeStyle = nextColor;
      octx.lineWidth = env.strokeW;
      octx.lineJoin = "round";
      octx.beginPath();
      octx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) octx.lineTo(pts[i].x, pts[i].y);
      octx.stroke();
      // gesetzte Punkte
      octx.fillStyle = nextColor;
      for (const q of pts) {
        octx.beginPath();
        octx.arc(q.x, q.y, env.strokeW * 1.9, 0, Math.PI * 2);
        octx.fill();
      }
      if (cursor) {
        octx.setLineDash([env.strokeW * 3, env.strokeW * 2.4]);
        octx.globalAlpha = 0.85;
        octx.beginPath();
        octx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        octx.lineTo(cursor.x, cursor.y);
        octx.stroke();
        if (draftKind === "polygon" && pts.length > 2) {
          octx.beginPath();
          octx.moveTo(cursor.x, cursor.y);
          octx.lineTo(pts[0].x, pts[0].y);
          octx.stroke();
        }
        octx.setLineDash([]);
        octx.globalAlpha = 1;
        // Vorschau der fertigen Geometrie (Ellipse/Kreis/Rechteck)
        if (
          (draftKind === "rect" ||
            draftKind === "ellipse" ||
            draftKind === "circle3" ||
            draftKind === "polygon") &&
          pts.length + 1 >= 2
        ) {
          const temp: Measurement = {
            id: "__draft",
            kind: draftKind,
            name: "",
            points: [...pts, cursor],
            color: nextColor,
            visible: true,
            createdAt: 0,
          };
          if (
            (temp.kind === "polygon" && pts.length >= 2) ||
            (temp.kind === "circle3" && pts.length === 2) ||
            temp.kind === "rect" ||
            temp.kind === "ellipse"
          ) {
            octx.globalAlpha = 0.45;
            drawMeasurement(octx, temp, { ...env, selectedId: null });
            octx.globalAlpha = 1;
          }
        }
      }
      // Schließ-Ring am Startpunkt (Polygon)
      if (
        draftKind === "polygon" &&
        pts.length >= 3 &&
        cursor &&
        dist(cursor, pts[0]) < 12 / t.scale
      ) {
        octx.beginPath();
        octx.arc(pts[0].x, pts[0].y, 11 / t.scale, 0, Math.PI * 2);
        octx.strokeStyle = nextColor;
        octx.lineWidth = env.strokeW * 1.4;
        octx.stroke();
      }
      // Live-Wert-Chip
      if (cursor) {
        const temp: Measurement = {
          id: "__live",
          kind: draftKind,
          name: "",
          points: [...pts, cursor],
          color: nextColor,
          visible: true,
          createdAt: 0,
        };
        const enough =
          (temp.kind === "line" ||
            temp.kind === "polyline" ||
            temp.kind === "rect" ||
            temp.kind === "ellipse") &&
          temp.points.length >= 2;
        const enough3 =
          (temp.kind === "lot" ||
            temp.kind === "angle" ||
            temp.kind === "circle3" ||
            temp.kind === "polygon") &&
          temp.points.length >= 3;
        if (enough || enough3) {
          const label = primaryLabel(temp, st.calibration);
          if (label) {
            drawChip(
              octx,
              cursor.x + 14 / t.scale,
              cursor.y + 24 / t.scale,
              label,
              nextColor,
              env,
              "left",
            );
          }
        }
      }
      octx.restore();
    }

    // Kalibrier-Gummiband
    if (st.tool === "calibrate" && st.draft && st.draft.length === 1 && cursor) {
      const a = st.draft[0];
      octx.save();
      octx.strokeStyle = "#60A5FA";
      octx.lineWidth = env.strokeW;
      octx.setLineDash([env.strokeW * 3, env.strokeW * 2.4]);
      octx.beginPath();
      octx.moveTo(a.x, a.y);
      octx.lineTo(cursor.x, cursor.y);
      octx.stroke();
      octx.restore();
      drawChip(
        octx,
        cursor.x + 14 / t.scale,
        cursor.y + 24 / t.scale,
        `${fmtNumber(dist(a, cursor))} px`,
        "#60A5FA",
        env,
        "left",
      );
      octx.beginPath();
      octx.arc(a.x, a.y, env.strokeW * 1.9, 0, Math.PI * 2);
      octx.fillStyle = "#60A5FA";
      octx.fill();
    }

    // Anmerkung: Pfeil-Vorschau beim Ziehen
    const drag = dragRef.current;
    if (drag?.type === "annotate") {
      const d0 = dist(drag.start, drag.cur);
      if (d0 > 8 / t.scale) {
        const temp: Measurement = {
          id: "__arr",
          kind: "arrow",
          name: "",
          points: [drag.start, drag.cur],
          color: PALETTE[st.measurements.length % PALETTE.length],
          visible: true,
          createdAt: 0,
        };
        octx.save();
        octx.globalAlpha = 0.8;
        drawMeasurement(octx, temp, { ...env, selectedId: null });
        octx.restore();
      }
    }

    // Snap-Fadenkreuz
    const snapTarget =
      effRef.current &&
      (drag?.type === "vertex" ||
        st.tool === "calibrate" ||
        DRAFT_KIND[st.tool] !== undefined);
    if (snapTarget && effRef.current) {
      const p = effRef.current.pt;
      const len = 8 / t.scale;
      octx.save();
      octx.strokeStyle = effRef.current.snapped
        ? "#4ADE80"
        : "rgba(255,255,255,0.55)";
      octx.lineWidth = Math.max(1, env.strokeW * 0.7);
      octx.beginPath();
      octx.moveTo(p.x - len, p.y);
      octx.lineTo(p.x + len, p.y);
      octx.moveTo(p.x, p.y - len);
      octx.lineTo(p.x, p.y + len);
      octx.stroke();
      if (effRef.current.snapped) {
        octx.beginPath();
        octx.arc(p.x, p.y, 6 / t.scale, 0, Math.PI * 2);
        octx.strokeStyle = "#4ADE80";
        octx.stroke();
      }
      octx.restore();
    }

    // Kurzer, feiner Bestätigungsimpuls beim Einrasten (Kantenfang) – reine
    // Freude am Detail: bestätigt spürbar, dass exakt eingerastet wurde.
    if (pulsesRef.current.length > 0) {
      const now = performance.now();
      const dur = 380;
      pulsesRef.current = pulsesRef.current.filter((pu) => now - pu.t < dur);
      for (const pu of pulsesRef.current) {
        const k = (now - pu.t) / dur;
        const ease = 1 - Math.pow(1 - k, 3);
        octx.save();
        octx.globalAlpha = (1 - k) * 0.6;
        octx.strokeStyle = "#4ADE80";
        octx.lineWidth = 1.4 / t.scale;
        octx.beginPath();
        octx.arc(pu.x, pu.y, (4 + ease * 14) / t.scale, 0, Math.PI * 2);
        octx.stroke();
        octx.restore();
      }
      if (pulsesRef.current.length > 0) scheduleDraw();
    }

    // Zuschnitt-Clip beenden, bevor bildschirmfeste Elemente folgen
    if (fineCrop) octx.restore();

    // Maßstabsbalken (Bildschirm)
    if (st.scaleBar) {
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScaleBarScreen(octx, w, h, t.scale, st.calibration);
    }

    // Lupe (Bildschirm-Koordinaten)
    const loupe = loupeRef.current;
    if (loupe.show && imgReg.processed && st.image) {
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const radius = 58;
      const zoom = loupe.zoom;
      // Position: rechts oben neben dem Cursor; kollidiert er mit dem
      // rechten oder oberen Rand, wandert sie auf die andere Seite.
      let lx = loupe.sx + radius + 22;
      if (lx + radius > w - 8) lx = loupe.sx - radius - 18;
      let ly = loupe.sy - radius - 14;
      if (ly - radius < 54) ly = loupe.sy + radius + 18;
      octx.save();
      octx.beginPath();
      octx.arc(lx, ly, radius, 0, Math.PI * 2);
      octx.clip();
      octx.fillStyle = "#0B0B0E";
      octx.fill();
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      const sW = (radius * 2) / zoom / t.scale;
      const sH = (radius * 2) / zoom / t.scale;
      octx.drawImage(
        imgReg.processed,
        loupe.imgX - sW / 2,
        loupe.imgY - sH / 2,
        sW,
        sH,
        lx - radius,
        ly - radius,
        radius * 2,
        radius * 2,
      );
      if (zoom >= 3) {
        octx.strokeStyle = "rgba(96,165,250,0.10)";
        octx.lineWidth = 0.5;
        for (let gx = -10; gx <= 10; gx += 2) {
          octx.beginPath();
          octx.moveTo(lx + gx * 4, ly - radius);
          octx.lineTo(lx + gx * 4, ly + radius);
          octx.stroke();
          octx.beginPath();
          octx.moveTo(lx - radius, ly + gx * 4);
          octx.lineTo(lx + radius, ly + gx * 4);
          octx.stroke();
        }
      }
      octx.strokeStyle = "rgba(255,255,255,0.92)";
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(lx - radius, ly);
      octx.lineTo(lx - 7, ly);
      octx.moveTo(lx + 7, ly);
      octx.lineTo(lx + radius, ly);
      octx.moveTo(lx, ly - radius);
      octx.lineTo(lx, ly - 7);
      octx.moveTo(lx, ly + 7);
      octx.lineTo(lx, ly + radius);
      octx.stroke();
      octx.restore();
      octx.save();
      octx.beginPath();
      octx.arc(lx, ly, radius, 0, Math.PI * 2);
      octx.strokeStyle = loupe.snapped ? "#4ADE80" : "rgba(255,255,255,0.62)";
      octx.lineWidth = 1.6;
      octx.stroke();
      octx.beginPath();
      octx.arc(lx, ly, radius + 0.5, 0, Math.PI * 2);
      octx.strokeStyle = "rgba(0,0,0,0.55)";
      octx.lineWidth = 3;
      octx.stroke();
      // Zoom-Stufe als dezentes Label
      octx.font = '600 10px "Geist Mono", monospace';
      octx.fillStyle = "rgba(255,255,255,0.65)";
      octx.textAlign = "right";
      octx.textBaseline = "top";
      octx.fillText(`${zoom}×`, lx + radius - 8, ly - radius + 6);
      octx.restore();
    }
  };
  drawImplRef.current = draw;

  // Neuzeichnen bei jeder Store-Änderung
  useEffect(() => {
    scheduleDraw();
  });

  // ── Maßstabsbalken (bildschirmfix) ───────────────────────────────────────
  function drawScaleBarScreen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number,
    calib: typeof st.calibration,
  ) {
    const target = 130;
    let barScreen: number;
    let label: string;
    if (calib && calib.unit !== "px") {
      const realTarget = target / scale / calib.pixelsPerUnit;
      const exp = Math.floor(Math.log10(realTarget));
      const base = Math.pow(10, exp);
      const f = realTarget / base;
      const nice = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * base;
      if (!isFinite(nice) || nice <= 0) return;
      barScreen = nice * calib.pixelsPerUnit * scale;
      label = `${fmtNumber(nice, 2)} ${calib.unit}`;
    } else {
      const pxTarget = target / scale;
      const exp = Math.floor(Math.log10(pxTarget));
      const base = Math.pow(10, exp);
      const f = pxTarget / base;
      const nice = (f >= 5 ? 5 : f >= 2 ? 2 : 1) * base;
      if (!isFinite(nice) || nice <= 0) return;
      barScreen = nice * scale;
      label = `${fmtNumber(nice, 0)} px`;
    }
    if (barScreen < 24) return;
    const m = 18;
    const x1 = w - m;
    const x0 = x1 - barScreen;
    const y = h - m;
    ctx.save();
    ctx.lineCap = "butt";
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.moveTo(x0, y - 5);
    ctx.lineTo(x0, y + 5);
    ctx.moveTo(x1, y - 5);
    ctx.lineTo(x1, y + 5);
    ctx.stroke();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.font = '600 11.5px "Geist Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(label, (x0 + x1) / 2, y - 9);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(label, (x0 + x1) / 2, y - 9);
    ctx.restore();
  }

  // ── Pointer-Events ───────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!st.image) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (e.pointerType === "touch") touchRef.current = true;
    else if (e.pointerType === "mouse") touchRef.current = false;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Zweite Fingerkuppe: Pinch-Zoom + Zwei-Finger-Pan beginnen. Die laufende
    // Einzelaktion tritt zurück; ein frisch gesetzter Punkt wird annulliert.
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const rect = containerRef.current?.getBoundingClientRect();
      gestureRef.current = {
        d: Math.max(24, Math.hypot(p1.x - p2.x, p1.y - p2.y)),
        c: {
          x: (p1.x + p2.x) / 2 - (rect?.left ?? 0),
          y: (p1.y + p2.y) / 2 - (rect?.top ?? 0),
        },
      };
      dragRef.current = null;
      roiDraftRef.current = null;
      loupeRef.current.show = false;
      const act = downActionRef.current;
      if (act && performance.now() - act.t < 700) {
        if (act.kind === "draft" && st.draft && st.draft.length > 0) {
          useEditor.setState({ draft: st.draft.slice(0, -1) });
        } else if (act.kind === "horizon" && st.horizon && st.horizon.length > 0) {
          useEditor.setState({ horizon: st.horizon.slice(0, -1) });
        } else if (act.kind === "rectify" && st.rectify && st.rectify.points.length > 0) {
          useEditor.setState({
            rectify: { active: true, points: st.rectify.points.slice(0, -1) },
          });
        }
      }
      downActionRef.current = null;
      return;
    }
    downActionRef.current = null;

    const p = toImage(e.clientX, e.clientY);
    cursorImgRef.current = p;
    effRef.current = computeEffective(p, e.shiftKey);

    // Rechtsklick im Zeichenmodus: letzten Punkt löschen (Photoshop-Konvention)
    if (e.button === 2 && st.draft && st.draft.length > 0) {
      useEditor.setState({ draft: st.draft.slice(0, -1) });
      return;
    }
    if (e.button === 2 && st.horizon !== null && st.horizon.length > 0) {
      const rest = st.horizon.slice(0, -1);
      if (rest.length === 0) st.cancelHorizon();
      else useEditor.setState({ horizon: rest });
      return;
    }
    if (e.button === 2 && st.rectify?.active && st.rectify.points.length > 0) {
      useEditor.setState({
        rectify: { active: true, points: st.rectify.points.slice(0, -1) },
      });
      return;
    }

    // Schwenk: Mittelklick, Rechtsklick oder Leertaste – immer
    if (e.button === 1 || e.button === 2 || spaceRef.current) {
      dragRef.current = {
        type: "pan",
        sx: e.clientX,
        sy: e.clientY,
        ox: tRef.current.x,
        oy: tRef.current.y,
      };
      return;
    }
    if (e.button !== 0) return;

    if (st.horizon !== null) {
      // Automatisch begradigen: Kante entlangziehen – Edge-Snap hilft dabei
      st.addHorizonPoint(effRef.current.pt);
      downActionRef.current = { kind: "horizon", t: performance.now() };
      return;
    }
    if (st.analysis.active) {
      // Bestehende ROI bleibt greifbar: Ecken skalieren, Körper verschiebt.
      // Erst ein Klick außerhalb startet einen neuen Bereich (P7).
      const r = st.analysis.roi;
      if (r) {
        const ht = (touchRef.current ? 16 : 10) / tRef.current.scale;
        const corners = roiCorners(r);
        const hi = corners.findIndex((c) => dist(p, c) < ht);
        if (hi >= 0) {
          dragRef.current = {
            type: "roi-scale",
            anchor: corners[(hi + 2) % 4],
            orig: r,
            moved: false,
          };
          return;
        }
        if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) {
          dragRef.current = { type: "roi-move", grab: p, orig: r, moved: false };
          return;
        }
      }
      roiDraftRef.current = { start: p, cur: p };
      dragRef.current = { type: "roi", start: p, cur: p };
      return;
    }
    if (st.rectify?.active) {
      st.addRectifyPoint(effRef.current.pt);
      downActionRef.current = { kind: "rectify", t: performance.now() };
      return;
    }

    switch (st.tool) {
      case "select": {
        const hit = hitTest(p);
        if (hit) {
          // Bereits ausgewählte Anmerkung erneut anklicken → Text editieren
          if (
            hit.m.id === st.selectedId &&
            (hit.m.kind === "note" || hit.m.kind === "arrow")
          ) {
            st.setNoteEditing(hit.m.id);
            return;
          }
          st.select(hit.m.id);
          if (hit.idx >= 0) {
            dragRef.current = {
              type: "vertex",
              id: hit.m.id,
              idx: hit.idx,
              orig: hit.m.points[hit.idx],
              moved: false,
            };
          } else {
            dragRef.current = {
              type: "move",
              id: hit.m.id,
              grab: p,
              start: hit.m.points,
              moved: false,
            };
          }
        } else {
          st.select(null);
          dragRef.current = {
            type: "pan",
            sx: e.clientX,
            sy: e.clientY,
            ox: tRef.current.x,
            oy: tRef.current.y,
          };
        }
        return;
      }
      case "count": {
        st.addCountPoint(effRef.current.pt);
        return;
      }
      case "annotate": {
        // Erstellte Objekte bleiben greifbar: Treffer gewinnt vor Neuanlage.
        // (Notizen/Kommentare waren nach dem Erstellen „einzementiert“.)
        const hit = hitTest(p);
        if (hit) {
          if (
            hit.m.id === st.selectedId &&
            (hit.m.kind === "note" || hit.m.kind === "arrow")
          ) {
            st.setNoteEditing(hit.m.id);
            return;
          }
          st.select(hit.m.id);
          dragRef.current =
            hit.idx >= 0
              ? {
                  type: "vertex",
                  id: hit.m.id,
                  idx: hit.idx,
                  orig: hit.m.points[hit.idx],
                  moved: false,
                }
              : {
                  type: "move",
                  id: hit.m.id,
                  grab: p,
                  start: hit.m.points,
                  moved: false,
                };
          return;
        }
        dragRef.current = { type: "annotate", start: effRef.current.pt, cur: effRef.current.pt };
        return;
      }
      default: {
        // Zeichenwerkzeuge & Kalibrierung: Klick-Punkte setzen
        const ep = effRef.current.pt;
        // Polygon schließen, wenn Anfangspunkt getroffen
        if (
          st.tool === "polygon" &&
          st.draft &&
          st.draft.length >= 3 &&
          dist(ep, st.draft[0]) < 12 / tRef.current.scale
        ) {
          st.commitDraft();
          return;
        }
        // Doppelklick-Duplikate filtern
        const lc = lastClickRef.current;
        const now = performance.now();
        if (lc && dist(ep, { x: lc.x, y: lc.y }) < 2 / tRef.current.scale && now - lc.t < 450) {
          return;
        }
        lastClickRef.current = { x: ep.x, y: ep.y, t: now };
        st.addDraftPoint(ep);
        downActionRef.current = { kind: "draft", t: now };
        return;
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (e.pointerType === "touch") touchRef.current = true;
    else if (e.pointerType === "mouse") touchRef.current = false;

    // Pinch-Zoom + Zwei-Finger-Pan: inkrementell pro Move, damit die Geste
    // unabhängig von der absoluten Finger spreizung ruhig läuft.
    if (gestureRef.current && pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const rect = containerRef.current?.getBoundingClientRect();
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const c = {
        x: (p1.x + p2.x) / 2 - (rect?.left ?? 0),
        y: (p1.y + p2.y) / 2 - (rect?.top ?? 0),
      };
      const g = gestureRef.current;
      zoomAt(c.x, c.y, d / g.d);
      tRef.current = {
        scale: tRef.current.scale,
        x: tRef.current.x + (c.x - g.c.x),
        y: tRef.current.y + (c.y - g.c.y),
      };
      g.d = Math.max(24, d);
      g.c = c;
      loupeRef.current.show = false;
      pushZoomUi();
      scheduleDraw();
      return;
    }

    const p = toImage(e.clientX, e.clientY);
    cursorImgRef.current = p;
    const rect = containerRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);
    const drag = dragRef.current;
    const wantsSnap =
      drag?.type === "vertex" ||
      st.tool === "calibrate" ||
      DRAFT_KIND[st.tool] !== undefined ||
      st.tool === "count" ||
      st.tool === "annotate";
    effRef.current = wantsSnap ? computeEffective(p, e.shiftKey) : { pt: p, snapped: false };

    // Greif-Feedback: über verschiebbaren Objekten „move“ zeigen – auch mit
    // dem Anmerkungswerkzeug, das jetzt Vorhandenes auswählt statt übermalt.
    const cont = containerRef.current;
    if (cont && !drag && !spaceRef.current && st.horizon === null) {
      let hoverCursor = "";
      if (st.analysis.active && st.analysis.roi) {
        const r = st.analysis.roi;
        const ht = (touchRef.current ? 16 : 10) / tRef.current.scale;
        const hi = roiCorners(r).findIndex((c) => dist(p, c) < ht);
        if (hi === 0 || hi === 2) hoverCursor = "nwse-resize";
        else if (hi === 1 || hi === 3) hoverCursor = "nesw-resize";
        else if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h)
          hoverCursor = "move";
      }
      if (!hoverCursor) {
        const grabbable =
          (st.tool === "select" || st.tool === "annotate") && !!hitTest(p);
        hoverCursor = grabbable ? "move" : cursor;
      }
      cont.style.cursor = hoverCursor;
    }

    if (drag) {
      if (drag.type === "pan") {
        tRef.current = {
          scale: tRef.current.scale,
          x: drag.ox + (e.clientX - drag.sx),
          y: drag.oy + (e.clientY - drag.sy),
        };
        pushZoomUi();
      } else if (drag.type === "vertex") {
        const m = st.measurements.find((x) => x.id === drag.id);
        if (m) {
          if (!drag.moved && dist(p, drag.orig) > 2 / tRef.current.scale) {
            st.pushHistory();
            drag.moved = true;
          }
          const pts = m.points.map((q, i) => (i === drag.idx ? effRef.current!.pt : q));
          st.updatePoints(drag.id, pts);
        }
      } else if (drag.type === "move") {
        const m = st.measurements.find((x) => x.id === drag.id);
        if (m) {
          if (!drag.moved && dist(p, drag.grab) > 2 / tRef.current.scale) {
            st.pushHistory();
            drag.moved = true;
          }
          const dx = p.x - drag.grab.x;
          const dy = p.y - drag.grab.y;
          st.updatePoints(
            drag.id,
            drag.start.map((q) => ({ x: q.x + dx, y: q.y + dy })),
          );
        }
      } else if (drag.type === "annotate") {
        drag.cur = effRef.current.pt;
      } else if (drag.type === "roi") {
        drag.cur = p;
        roiDraftRef.current = { start: drag.start, cur: p };
      } else if (drag.type === "roi-move" || drag.type === "roi-scale") {
        const img = st.image;
        if (!drag.moved && dist(p, drag.type === "roi-move" ? drag.grab : drag.anchor) > 2 / tRef.current.scale) {
          st.pushHistory();
          drag.moved = true;
        }
        let next: Rect;
        if (drag.type === "roi-move") {
          const dx = p.x - drag.grab.x;
          const dy = p.y - drag.grab.y;
          const w = img ? img.width : 1e9;
          const h = img ? img.height : 1e9;
          next = {
            x: clamp(drag.orig.x + dx, 0, Math.max(0, w - drag.orig.w)),
            y: clamp(drag.orig.y + dy, 0, Math.max(0, h - drag.orig.h)),
            w: drag.orig.w,
            h: drag.orig.h,
          };
        } else {
          const r2 = rectFrom2(drag.anchor, p);
          const min = 6 / tRef.current.scale;
          next = { ...r2, w: Math.max(min, r2.w), h: Math.max(min, r2.h) };
        }
        st.setAnalysis({ roi: next });
      }
    }

    // Lupe nur, wenn wir tatsächlich Punkte platzieren oder einzelne Punkte ziehen
    const placing =
      st.draft !== null ||
      st.pendingCalib !== null ||
      st.tool === "calibrate" ||
      DRAFT_KIND[st.tool] !== undefined ||
      st.tool === "count" ||
      st.tool === "annotate" ||
      st.rectify?.active ||
      st.horizon !== null ||
      (st.analysis.active && !drag) ||
      drag?.type === "vertex" ||
      drag?.type === "annotate";
    const showLoupe = !!placing && p && !spaceRef.current;
    // Lupe-Update direkt in den Ref (keine React-Rerender bei jedem Move)
    const lr = loupeRef.current;
    lr.sx = sx;
    lr.sy = sy;
    lr.imgX = effRef.current?.pt.x ?? p.x;
    lr.imgY = effRef.current?.pt.y ?? p.y;
    lr.show = !!showLoupe;
    lr.snapped = !!effRef.current?.snapped;
    lr.zoom = effRef.current?.snapped ? 6 : 4;

    scheduleDraw();
    updateCoordsDom();
  };

  const releasePointer = (id: number) => {
    pointersRef.current.delete(id);
    if (pointersRef.current.size < 2) gestureRef.current = null;
  };

  const onPointerLeave = () => {
    loupeRef.current.show = false;
    cursorImgRef.current = null;
    lastSnapRef.current = null;
    scheduleDraw();
    const el = document.getElementById("mw-coords");
    if (el) el.textContent = "";
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    releasePointer(e.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;
    if (gestureRef.current) return; // Geste endet – kein Werkzeug-Abschluss
    if (!drag) return;
    if (drag.type === "annotate") {
      const d0 = dist(drag.start, drag.cur);
      if (d0 > 10 / tRef.current.scale) st.addArrow(drag.start, drag.cur);
      else st.addNote(drag.start);
    } else if (drag.type === "roi") {
      const r = rectFrom2(drag.start, drag.cur);
      roiDraftRef.current = null;
      if (r.w * tRef.current.scale > 8 && r.h * tRef.current.scale > 8) {
        st.setAnalysis({ roi: r });
      }
    }
    void e;
    scheduleDraw();
  };

  const onDoubleClick = () => {
    // Doppeltippen auf Glas: ganzes Bild zeigen – die Geste, die das
    // fehlende Zoom-Cluster auf kleinen Bühnen ersetzt (D1).
    if (
      touchRef.current &&
      !st.draft &&
      st.tool !== "polyline" &&
      st.tool !== "polygon"
    ) {
      st.fireViewCmd("fit");
      return;
    }
    if (st.tool === "polyline" || st.tool === "polygon") {
      // letzten Duplikatpunkt entfernen, dann abschließen
      const d = st.draft;
      if (d && d.length >= 2) {
        const last = d[d.length - 1];
        const prev = d[d.length - 2];
        if (dist(last, prev) < 3 / tRef.current.scale) {
          useEditor.setState({ draft: d.slice(0, -1) });
        }
      }
      st.commitDraft();
    }
  };

  // ── Rad-Zoom (nativ, nicht-passiv) ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const factor =
        e.ctrlKey || e.metaKey ? Math.exp(-dy * 0.0085) : Math.exp(-dy * 0.0016);
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ── Tastatur ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const isFormTarget = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      // Ist die Kürzel-Übersicht offen, gehört ihr die Tastatur allein
      if (s.helpOpen) {
        if (e.key === "Escape" || e.key === "?") {
          e.preventDefault();
          s.setHelpOpen(false);
        }
        return;
      }
      if (e.code === "Space" && !isFormTarget(e.target)) {
        spaceRef.current = true;
        e.preventDefault();
        return;
      }
      if (isFormTarget(e.target)) return;
      if (e.key === "?") {
        s.setHelpOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "Escape":
          if (s.noteEditingId) s.setNoteEditing(null);
          else if (s.draft || s.pendingCalib) s.cancelDraft();
          else if (s.horizon) s.cancelHorizon();
          else if (s.rectify?.active) s.cancelRectify();
          else if (s.analysis.active) s.exitAnalysis();
          else s.select(null);
          return;
        case "Enter":
          s.commitDraft();
          return;
        case "Delete":
        case "Backspace":
          if (s.selectedId && !s.draft) s.remove(s.selectedId);
          return;
        case "0":
          s.fireViewCmd("fit");
          return;
        case "1":
          s.fireViewCmd("100");
          return;
        case "+":
          s.fireViewCmd("in");
          return;
        case "-":
          if (e.key === "-") s.fireViewCmd("out");
          return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key.toLowerCase() === "s") {
        const s2 = useEditor.getState();
        const next = !s2.snap;
        s2.setSnap(next);
        s2.setBanner(t(next ? "Kantenfang aktiviert" : "Kantenfang deaktiviert"));
        return;
      }
      const toolKeys: Record<string, ToolId> = {
        v: "select",
        k: "calibrate",
        m: "line",
        p: "polyline",
        l: "lot",
        w: "angle",
        x: "crossangle",
        r: "rect",
        e: "ellipse",
        c: "circle3",
        f: "polygon",
        z: "count",
        t: "annotate",
      };
      const tk = toolKeys[e.key.toLowerCase()];
      if (tk) s.setTool(tk);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ── Cursor-Stil ──────────────────────────────────────────────────────────
  const cursor = (() => {
    if (spaceRef.current) return "grab";
    if (st.analysis.active || st.rectify?.active || st.horizon !== null) return "crosshair";
    if (st.tool === "select") return "default";
    if (st.tool === "annotate") return "text";
    return "crosshair";
  })();

  // ── Inline-Texteditor für Anmerkungen ────────────────────────────────────
  const noteTarget = st.noteEditingId
    ? st.measurements.find((m) => m.id === st.noteEditingId)
    : null;
  let notePos: Pt | null = null;
  if (noteTarget) {
    const sp = toScreen(noteTarget.points[0]);
    notePos = sp;
  }

  useEffect(() => {
    if (noteTarget) setNoteValue(noteTarget.text ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.noteEditingId]);

  const commitNote = () => {
    if (noteTarget) st.updateText(noteTarget.id, noteValue.trim());
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label={tr("Mess-Bühne: Bild mit Messwerkzeugen, per Tastatur und Zeiger bedienbar")}
      className="absolute inset-0 touch-none overflow-hidden"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={(e) => {
        releasePointer(e.pointerId);
        dragRef.current = null;
        onPointerLeave();
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={imgRef} className="absolute inset-0" />
      <canvas ref={ovRef} className="absolute inset-0" />
      {st.horizon !== null && (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg bg-black/60 px-3.5 py-1.5 text-center text-xs text-white/90 shadow-lg backdrop-blur"
          role="status"
        >
          {st.horizon.length === 0
            ? tr("Automatisch begradigen: eine Linie entlang einer geraden Kante oder des Horizonts ziehen")
            : tr("Zweiter Klick setzt den Endpunkt – das Bild richtet sich aus · Rechtsklick: zurück · Esc: abbrechen")}
        </div>
      )}
      {noteTarget && notePos && (
        <input
          autoFocus
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitNote();
            if (e.key === "Escape") st.setNoteEditing(null);
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder={tr("Beschriftung …")}
          className="absolute z-20 -translate-y-8 rounded-md border border-white/15 bg-[#141419] px-2.5 py-1.5 text-[13px] text-white shadow-xl outline-none placeholder:text-white/30 focus:border-[#60A5FA]"
          style={{ left: notePos.x + 10, top: notePos.y - 4, minWidth: 170 }}
        />
      )}
    </div>
  );
}
