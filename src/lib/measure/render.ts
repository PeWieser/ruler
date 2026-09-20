// ── MaßWerk · Vektor-Renderer (Editor-Overlay & Bildexport) ────────────────
import type { Calibration, Measurement, Pt } from "./types";
import {
  angleBetweenLines,
  circleFrom3Points,
  closestPointOnLine,
  dist,
  ellipseFromBBox,
  lineIntersection,
  primaryLabel,
  rectFrom2,
} from "./geometry";

export interface RenderEnv {
  /** Linienbreite in Canvas-Pixeln (bei gesetzter Transform). */
  strokeW: number;
  /** Basisschriftgröße in Canvas-Pixeln. */
  fontPx: number;
  selectedId: string | null;
  showHandles: boolean;
  calibration: Calibration | null;
  forExport: boolean;
}

const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Beschriftungs-Chip mit Farbpunkt. Zeichnet so, dass Text gut lesbar ist. */
export function drawChip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  color: string,
  env: RenderEnv,
  align: "center" | "left" = "center",
) {
  if (!text) return;
  const f = env.fontPx;
  ctx.font = `600 ${f}px ${MONO}`;
  const tw = ctx.measureText(text).width;
  const dot = text ? f * 0.5 : 0;
  const padX = f * 0.62;
  const w = tw + padX * 2 + dot;
  const h = f * 1.72;
  const x = align === "center" ? cx - w / 2 : cx;
  const y = cy - h / 2;
  ctx.save();
  rr(ctx, x, y, w, h, h * 0.38);
  ctx.fillStyle = "rgba(13, 13, 17, 0.85)";
  ctx.fill();
  ctx.lineWidth = Math.max(1, env.strokeW * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.stroke();
  // Farbpunkt
  ctx.beginPath();
  ctx.arc(x + padX * 0.92, y + h / 2, f * 0.21, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  // Text
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + padX * 0.92 + f * 0.42, y + h / 2 + f * 0.04);
  ctx.restore();
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  close: boolean,
  color: string,
  env: RenderEnv,
  opts?: { dashed?: boolean; fill?: boolean },
) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = env.strokeW;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (opts?.dashed) ctx.setLineDash([env.strokeW * 3.2, env.strokeW * 2.6]);
  if (!env.forExport) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = env.strokeW * 1.9;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  if (opts?.fill) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.stroke();
  ctx.restore();
}

function drawHandles(ctx: CanvasRenderingContext2D, pts: Pt[], env: RenderEnv) {
  const r = env.strokeW * 2.7;
  ctx.save();
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = env.strokeW * 0.9;
    ctx.strokeStyle = "#101014";
    ctx.stroke();
  }
  ctx.restore();
}

function drawSelectionGlow(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  close: boolean,
  env: RenderEnv,
) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "rgba(96, 165, 250, 0.5)";
  ctx.lineWidth = env.strokeW * 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Zeichnet eine komplette Messung inkl. Geometrie und Wert-Chip. */
export function drawMeasurement(
  ctx: CanvasRenderingContext2D,
  m: Measurement,
  env: RenderEnv,
) {
  const p = m.points;
  const selected = env.selectedId === m.id;
  const color = selected ? "#60A5FA" : m.color;
  const labelEnv: RenderEnv = env;

  const chipAt = (at: Pt, override?: string, align: "center" | "left" = "center") =>
    drawChip(ctx, at.x, at.y, override ?? primaryLabel(m, env.calibration), color, labelEnv, align);

  switch (m.kind) {
    case "line": {
      if (p.length < 2) return;
      if (selected) drawSelectionGlow(ctx, p, false, env);
      strokePath(ctx, p, false, color, env);
      const off = env.strokeW * 6;
      chipAt({ x: mid(p[0], p[1]).x, y: mid(p[0], p[1]).y - off });
      break;
    }
    case "polyline": {
      if (p.length < 2) return;
      if (selected) drawSelectionGlow(ctx, p, false, env);
      strokePath(ctx, p, false, color, env);
      chipAt(p[Math.floor(p.length / 2)]);
      break;
    }
    case "lot": {
      if (p.length < 3) return;
      const [a, b, pt] = p;
      const foot = closestPointOnLine(pt, a, b);
      // Referenzgerade (verlängert, gestrichelt)
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const ext = 0.35 * l;
      strokePath(
        ctx,
        [
          { x: a.x - (dx / l) * ext, y: a.y - (dy / l) * ext },
          { x: b.x + (dx / l) * ext, y: b.y + (dy / l) * ext },
        ],
        false,
        color,
        env,
        { dashed: true },
      );
      if (selected) drawSelectionGlow(ctx, [foot, pt], false, env);
      strokePath(ctx, [pt, foot], false, color, env);
      // Rechter-Winkel-Markierung
      const s = env.strokeW * 7;
      const ux = (dx / l) * s;
      const uy = (dy / l) * s;
      const vx0 = pt.x - foot.x;
      const vy0 = pt.y - foot.y;
      const vl = Math.hypot(vx0, vy0) || 1;
      const wx = (vx0 / vl) * s;
      const wy = (vy0 / vl) * s;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = env.strokeW * 0.8;
      ctx.beginPath();
      ctx.moveTo(foot.x + ux, foot.y + uy);
      ctx.lineTo(foot.x + ux + wx, foot.y + uy + wy);
      ctx.lineTo(foot.x + wx, foot.y + wy);
      ctx.stroke();
      ctx.restore();
      chipAt(mid(pt, foot));
      break;
    }
    case "angle": {
      if (p.length < 3) return;
      const [a, v, c] = p;
      if (selected) drawSelectionGlow(ctx, [a, v, c], false, env);
      strokePath(ctx, [a, v, c], false, color, env);
      const r = Math.min(dist(a, v), dist(c, v)) * 0.38;
      const a1 = Math.atan2(a.y - v.y, a.x - v.x);
      const a2 = Math.atan2(c.y - v.y, c.x - v.x);
      let sweep = a2 - a1;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = env.strokeW * 0.85;
      ctx.beginPath();
      ctx.arc(v.x, v.y, r, a1, a1 + sweep, sweep < 0);
      ctx.stroke();
      ctx.restore();
      const angMid = a1 + sweep / 2;
      chipAt({
        x: v.x + Math.cos(angMid) * (r + env.strokeW * 8),
        y: v.y + Math.sin(angMid) * (r + env.strokeW * 8),
      });
      break;
    }
    case "crossangle": {
      if (p.length < 4) return;
      const I = lineIntersection(p[0], p[1], p[2], p[3]);
      strokePath(ctx, [p[0], p[1]], false, color, env, { dashed: true });
      strokePath(ctx, [p[2], p[3]], false, color, env, { dashed: true });
      if (!I) break;
      // Punkt am Schnitt
      ctx.save();
      ctx.beginPath();
      ctx.arc(I.x, I.y, env.strokeW * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // Bogen des spitzen Winkels
      const acute = (angleBetweenLines(p[0], p[1], p[2], p[3]) * Math.PI) / 180;
      let d1 = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      let d2 = Math.atan2(p[3].y - p[2].y, p[3].x - p[2].x);
      let sweep = d2 - d1;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      if (Math.abs(sweep) > Math.PI / 2 + 1e-9) {
        d2 = d2 + Math.PI;
        sweep = d2 - d1;
        while (sweep > Math.PI) sweep -= Math.PI * 2;
        while (sweep < -Math.PI) sweep += Math.PI * 2;
      }
      void acute;
      const r = Math.min(
        dist(p[0], p[1]),
        dist(p[2], p[3]),
      ) * 0.18;
      ctx.strokeStyle = color;
      ctx.lineWidth = env.strokeW * 0.85;
      ctx.beginPath();
      ctx.arc(I.x, I.y, r, d1, d1 + sweep, sweep < 0);
      ctx.stroke();
      ctx.restore();
      chipAt({ x: I.x, y: I.y - r - env.strokeW * 6 });
      break;
    }
    case "rect": {
      if (p.length < 2) return;
      const r = rectFrom2(p[0], p[1]);
      const corners: Pt[] = [
        { x: r.x, y: r.y },
        { x: r.x + r.w, y: r.y },
        { x: r.x + r.w, y: r.y + r.h },
        { x: r.x, y: r.y + r.h },
      ];
      if (selected) drawSelectionGlow(ctx, corners, true, env);
      strokePath(ctx, corners, true, color, env, { fill: true });
      chipAt({ x: r.x + r.w / 2, y: r.y + r.h + env.strokeW * 8 });
      break;
    }
    case "ellipse": {
      if (p.length < 2) return;
      const e = ellipseFromBBox(p[0], p[1]);
      if (e.rx < 1e-6 || e.ry < 1e-6) return;
      ctx.save();
      if (selected) {
        ctx.strokeStyle = "rgba(96, 165, 250, 0.5)";
        ctx.lineWidth = env.strokeW * 3;
        ctx.beginPath();
        ctx.ellipse(e.c.x, e.c.y, e.rx, e.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = env.strokeW;
      if (!env.forExport) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = env.strokeW * 1.9;
      }
      ctx.beginPath();
      ctx.ellipse(e.c.x, e.c.y, e.rx, e.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = color;
      ctx.shadowBlur = 0;
      ctx.fill();
      ctx.restore();
      chipAt({ x: e.c.x + e.rx, y: e.c.y - e.ry - env.strokeW * 6 });
      break;
    }
    case "circle3": {
      if (p.length < 3) return;
      const circle = circleFrom3Points(p[0], p[1], p[2]);
      if (circle) {
        ctx.save();
        if (selected) {
          ctx.strokeStyle = "rgba(96, 165, 250, 0.5)";
          ctx.lineWidth = env.strokeW * 3;
          ctx.beginPath();
          ctx.arc(circle.c.x, circle.c.y, circle.r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = env.strokeW;
        if (!env.forExport) {
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = env.strokeW * 1.9;
        }
        ctx.beginPath();
        ctx.arc(circle.c.x, circle.c.y, circle.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.09;
        ctx.fillStyle = color;
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.globalAlpha = 1;
        // Mittelkreuz
        const s = env.strokeW * 4;
        ctx.beginPath();
        ctx.moveTo(circle.c.x - s, circle.c.y);
        ctx.lineTo(circle.c.x + s, circle.c.y);
        ctx.moveTo(circle.c.x, circle.c.y - s);
        ctx.lineTo(circle.c.x, circle.c.y + s);
        ctx.lineWidth = env.strokeW * 0.8;
        ctx.stroke();
        ctx.restore();
        chipAt({ x: circle.c.x, y: circle.c.y - circle.r - env.strokeW * 6 });
      }
      break;
    }
    case "polygon": {
      if (p.length < 3) return;
      if (selected) drawSelectionGlow(ctx, p, true, env);
      strokePath(ctx, p, true, color, env, { fill: true });
      let cx = 0;
      let cy = 0;
      for (const q of p) {
        cx += q.x;
        cy += q.y;
      }
      chipAt({ x: cx / p.length, y: cy / p.length });
      break;
    }
    case "count": {
      if (p.length < 1) return;
      const r = Math.max(env.strokeW * 5.2, env.fontPx * 0.72);
      ctx.save();
      ctx.font = `700 ${env.fontPx * 0.92}px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      p.forEach((q, i) => {
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = env.strokeW * 0.85;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
        ctx.fillStyle = "#101014";
        ctx.fillText(String(i + 1), q.x, q.y + env.fontPx * 0.03);
      });
      ctx.restore();
      break;
    }
    case "note": {
      if (p.length < 1) return;
      const q = p[0];
      ctx.save();
      ctx.beginPath();
      ctx.arc(q.x, q.y, env.strokeW * 2.1, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      if (m.text) chipAt({ x: q.x + env.strokeW * 6, y: q.y - env.strokeW * 5 }, m.text, "left");
      break;
    }
    case "arrow": {
      if (p.length < 2) return;
      const [a, b] = p;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const hs = env.strokeW * 6.5;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = env.strokeW;
      ctx.lineCap = "round";
      if (!env.forExport) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = env.strokeW * 1.9;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - hs * Math.cos(ang - Math.PI / 6), b.y - hs * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(b.x - hs * Math.cos(ang + Math.PI / 6), b.y - hs * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      if (m.text) chipAt({ x: a.x, y: a.y - env.strokeW * 7 }, m.text);
      break;
    }
  }

  if (selected && env.showHandles && m.kind !== "count") drawHandles(ctx, p, env);
}
